<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Leafer, Pen, Group, Rect, Ellipse } from 'leafer-ui'
import type { ToolConfig, ToolType } from '../types'

/** 当前工具配置 */
const toolConfig = ref<ToolConfig>({
  toolType: 'pen' as ToolType,
  brush: {
    color: '#000000',
    baseLineWidth: 3,
    pressureEnabled: true,
    pressureFactor: 0.8
  },
  eraser: {
    type: 'path',
    size: 20
  }
})

/** Leafer实例 */
let leaferInstance: Leafer | null = null
/** 主容器Group（存放所有的绘制组，形成栈） */
let mainGroup: Group | null = null
/** 当前绘制组（一次连续绘制动作） */
let currentGroup: Group | null = null
/** 画布容器ref */
const canvasRef = ref<HTMLDivElement | null>(null)

/** 绘图状态 */
let isDrawing = false
let lastX = 0
let lastY = 0
let isEraserActive = false

/**
 * 获取笔刷大小（基于压感）
 */
function getBrushSize(pressure: number, baseSize: number, pressureEnabled: boolean): number {
  if (!pressureEnabled) return baseSize
  // 压感值 0-1，最小为 baseSize 的 50%，最大为 baseSize 的 300%
  return baseSize * (0.5 + pressure * 2.5)
}

/**
 * 更新光标样式
 */
function updateCursor() {
  if (!canvasRef.value) return

  if (isEraserActive || toolConfig.value.toolType === 'eraser') {
    canvasRef.value.style.cursor = 'cell' // 橡皮擦光标
  } else {
    canvasRef.value.style.cursor = 'crosshair' // 画笔光标
  }
}

/**
 * 绘制点
 */
function drawPoint(x: number, y: number, pressure: number, isEraser: boolean) {
  const { brush, eraser } = toolConfig.value
  const brushSize = isEraser ? eraser.size : getBrushSize(pressure, brush.baseLineWidth, brush.pressureEnabled)

  // 橡皮擦：直接添加到 mainGroup
  // 绘制：添加到 currentGroup
  if (isEraser) {
    if (!mainGroup) return

    // 使用圆形作为橡皮擦点
    const eraserDot = new Ellipse({
      x: x - brushSize / 2,
      y: y - brushSize / 2,
      width: brushSize,
      height: brushSize,
      fill: 'rgba(0,0,0,1)',
      eraser: true
    })

    mainGroup.add(eraserDot)
  } else {
    if (!currentGroup) return

    const dot = new Rect({
      x: x - brushSize / 2,
      y: y - brushSize / 2,
      width: brushSize,
      height: brushSize,
      fill: brush.color,
      cornerRadius: brushSize / 2
    })

    currentGroup.add(dot)
  }
}

/**
 * 绘制线段
 */
function drawLine(x1: number, y1: number, x2: number, y2: number, pressure: number, isEraser: boolean) {
  const { brush, eraser } = toolConfig.value
  const brushSize = isEraser ? eraser.size : getBrushSize(pressure, brush.baseLineWidth, brush.pressureEnabled)

  if (isEraser) {
    // 橡皮擦：直接添加到 mainGroup
    if (!mainGroup) return

    // 创建 Pen 对象
    const eraserPath = new Pen()
    eraserPath.setStyle({
      stroke: 'rgba(0,0,0,1)',
      strokeWidth: brushSize,
      strokeCap: 'round',
      strokeJoin: 'round'
    })
    // 设置 eraser 属性（Pen 继承自 UI，有 eraser 属性）
    eraserPath.eraser = true

    eraserPath.moveTo(x1, y1)
    eraserPath.lineTo(x2, y2)

    mainGroup.add(eraserPath)
  } else {
    // 绘制：添加到 currentGroup
    if (!currentGroup) return

    const line = new Pen()
    line.setStyle({
      stroke: brush.color,
      strokeWidth: brushSize,
      strokeCap: 'round',
      strokeJoin: 'round'
    })

    line.moveTo(x1, y1)
    line.lineTo(x2, y2)

    currentGroup.add(line)
  }
}

/**
 * 原生 pointerdown 事件处理
 */
function handlePointerDown(e: PointerEvent) {
  if (!canvasRef.value || !mainGroup) return

  // 检测压感笔橡皮擦端
  const isPenEraser = e.pointerType === 'pen' && e.buttons === 32

  // 确定是否使用橡皮擦：压感笔橡皮擦端自动切换，否则使用工具栏选择
  if (isPenEraser) {
    isEraserActive = true
    toolConfig.value.toolType = 'eraser' as ToolType
  } else {
    isEraserActive = toolConfig.value.toolType === 'eraser'
  }

  // 绘制模式：创建新的绘制组
  // 橡皮擦模式：不创建组，直接添加元素到 mainGroup
  if (!isEraserActive) {
    currentGroup = new Group({
      x: 0,
      y: 0
    })
    mainGroup.add(currentGroup)
  }

  isDrawing = true

  const rect = canvasRef.value.getBoundingClientRect()
  lastX = e.clientX - rect.left
  lastY = e.clientY - rect.top
  const pressure = e.pressure || 0.5

  // 绘制起始点
  drawPoint(lastX, lastY, pressure, isEraserActive)

  // 更新光标
  updateCursor()
}

/**
 * 原生 pointermove 事件处理
 */
function handlePointerMove(e: PointerEvent) {
  if (!isDrawing || !canvasRef.value) return

  // 动态检测压感笔橡皮擦（支持绘制过程中翻转笔）
  const isPenEraser = e.pointerType === 'pen' && e.buttons === 32

  // 确定是否使用橡皮擦：压感笔橡皮擦端自动切换，否则使用工具栏选择
  if (isPenEraser) {
    isEraserActive = true
    if (toolConfig.value.toolType !== 'eraser') {
      toolConfig.value.toolType = 'eraser' as ToolType
      updateCursor()
    }
  } else {
    isEraserActive = toolConfig.value.toolType === 'eraser'
  }

  const pressure = e.pressure || 0.5

  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 绘制线段
  drawLine(lastX, lastY, x, y, pressure, isEraserActive)

  // 更新上一个坐标
  lastX = x
  lastY = y
}

/**
 * 原生 pointerup 事件处理
 */
function handlePointerUp() {
  isDrawing = false

  // 只有在绘制模式下才需要清空 currentGroup
  if (!isEraserActive) {
    currentGroup = null
  }

  isEraserActive = false
}

/**
 * 原生 pointerleave 事件处理
 */
function handlePointerLeave() {
  isDrawing = false
  isEraserActive = false
}

/**
 * 阻止右键菜单
 */
function handleContextMenu(e: Event) {
  e.preventDefault()
}

/**
 * 初始化画布
 */
function initCanvas() {
  if (!canvasRef.value) return

  console.log('初始化画布，容器尺寸:', {
    width: canvasRef.value.clientWidth,
    height: canvasRef.value.clientHeight
  })

  leaferInstance = new Leafer({
    view: canvasRef.value,
    type: 'design'
  })

  // 添加白色背景（最底层）
  const background = new Rect({
    x: 0,
    y: 0,
    width: canvasRef.value.clientWidth,
    height: canvasRef.value.clientHeight,
    fill: '#ffffff'
  })

  leaferInstance.add(background)

  // 创建主容器Group（所有绘制内容都在这里）
  mainGroup = new Group({
    x: 0,
    y: 0
  })

  leaferInstance.add(mainGroup)

  // ===== 测试数据：验证橡皮擦架构 =====
  console.log('创建测试数据...')

  // 创建一个测试组，把绘制和橡皮擦都放进去
  const testGroup = new Group({ x: 0, y: 0 })

  // 1. 红色线 (100,100) -> (300,100)
  const line1 = new Pen()
  line1.setStyle({
    stroke: '#FF0000',
    strokeWidth: 10,
    strokeCap: 'round'
  })
  line1.moveTo(100, 100)
  line1.lineTo(300, 100)
  testGroup.add(line1)
  console.log('✓ 红色线 (100,100) -> (300,100)')

  // 2. 蓝色线 (100,150) -> (300,150)
  const line2 = new Pen()
  line2.setStyle({
    stroke: '#0000FF',
    strokeWidth: 10,
    strokeCap: 'round'
  })
  line2.moveTo(100, 150)
  line2.lineTo(300, 150)
  testGroup.add(line2)
  console.log('✓ 蓝色线 (100,150) -> (300,150)')

  // 3. 橡皮擦线 - 应该擦除红色和蓝色线
  const eraser1 = new Pen()
  eraser1.setStyle({
    stroke: 'rgba(0,0,0,1)',
    strokeWidth: 30,
    strokeCap: 'round'
  })
  eraser1.eraser = true
  eraser1.moveTo(150, 80)
  eraser1.lineTo(150, 170)
  testGroup.add(eraser1)
  console.log('✓ 橡皮擦竖线 (150,80) -> (150,170)，应该擦除红色和蓝色线')

  // 4. 绿色线 (100,200) -> (300,200)
  const line3 = new Pen()
  line3.setStyle({
    stroke: '#00FF00',
    strokeWidth: 10,
    strokeCap: 'round'
  })
  line3.moveTo(100, 200)
  line3.lineTo(300, 200)
  testGroup.add(line3)
  console.log('✓ 绿色线 (100,200) -> (300,200)')

  // 5. 橡皮擦线 - 应该擦除绿色线
  const eraser2 = new Pen()
  eraser2.setStyle({
    stroke: 'rgba(0,0,0,1)',
    strokeWidth: 30,
    strokeCap: 'round'
  })
  eraser2.eraser = true
  eraser2.moveTo(200, 180)
  eraser2.lineTo(200, 220)
  testGroup.add(eraser2)
  console.log('✓ 橡皮擦竖线 (200,180) -> (200,220)，应该擦除绿色线')

  mainGroup.add(testGroup)
  console.log('Leafer画布初始化完成，测试数据已添加')
}

/**
 * 切换工具
 */
function setToolType(toolType: ToolType) {
  toolConfig.value.toolType = toolType
  updateCursor()
}

/**
 * 设置画笔颜色
 */
function setBrushColor(color: string) {
  toolConfig.value.brush.color = color
}

/**
 * 设置画笔粗细
 */
function setBrushSize(size: number) {
  toolConfig.value.brush.baseLineWidth = size
}

/**
 * 设置橡皮擦大小
 */
function setEraserSize(size: number) {
  toolConfig.value.eraser.size = size
}

/**
 * 清空画布
 */
function clearCanvas() {
  if (!mainGroup) return
  mainGroup.removeAll()
}

onMounted(() => {
  initCanvas()

  if (canvasRef.value) {
    // 使用原生 DOM 事件监听
    canvasRef.value.addEventListener('pointerdown', handlePointerDown)
    canvasRef.value.addEventListener('pointermove', handlePointerMove)
    canvasRef.value.addEventListener('pointerup', handlePointerUp)
    canvasRef.value.addEventListener('pointerleave', handlePointerLeave)
    canvasRef.value.addEventListener('contextmenu', handleContextMenu)
  }

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    if (!leaferInstance || !canvasRef.value) return
    leaferInstance.width = canvasRef.value.clientWidth
    leaferInstance.height = canvasRef.value.clientHeight
  })
})

onUnmounted(() => {
  if (leaferInstance) {
    leaferInstance.destroy()
  }

  if (canvasRef.value) {
    canvasRef.value.removeEventListener('pointerdown', handlePointerDown)
    canvasRef.value.removeEventListener('pointermove', handlePointerMove)
    canvasRef.value.removeEventListener('pointerup', handlePointerUp)
    canvasRef.value.removeEventListener('pointerleave', handlePointerLeave)
    canvasRef.value.removeEventListener('contextmenu', handleContextMenu)
  }
})

onUnmounted(() => {
  if (leaferInstance) {
    leaferInstance.destroy()
  }
})
</script>

<template>
  <div class="whiteboard-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="tool-group">
        <button
          :class="['tool-btn', { active: toolConfig.toolType === 'pen' }]"
          @click="setToolType('pen' as ToolType)"
        >
          画笔
        </button>
        <button
          :class="['tool-btn', { active: toolConfig.toolType === 'eraser' }]"
          @click="setToolType('eraser' as ToolType)"
        >
          橡皮擦
        </button>
      </div>

      <div class="tool-group" v-show="toolConfig.toolType === 'pen'">
        <label class="tool-label">
          颜色:
          <input
            type="color"
            :value="toolConfig.brush.color"
            @input="(e: Event) => setBrushColor((e.target as HTMLInputElement).value)"
          />
        </label>
        <label class="tool-label">
          粗细:
          <input
            type="range"
            min="1"
            max="50"
            :value="toolConfig.brush.baseLineWidth"
            @input="(e: Event) => setBrushSize(Number((e.target as HTMLInputElement).value))"
          />
          {{ toolConfig.brush.baseLineWidth }}
        </label>
      </div>

      <div class="tool-group" v-show="toolConfig.toolType === 'eraser'">
        <label class="tool-label">
          大小:
          <input
            type="range"
            min="5"
            max="100"
            :value="toolConfig.eraser.size"
            @input="(e: Event) => setEraserSize(Number((e.target as HTMLInputElement).value))"
          />
          {{ toolConfig.eraser.size }}
        </label>
      </div>

      <div class="tool-group">
        <button class="tool-btn danger" @click="clearCanvas">清空</button>
      </div>
    </div>

    <!-- 画布容器 -->
    <div
      ref="canvasRef"
      class="canvas-wrapper"
      style="touch-action: none;"
    ></div>
  </div>
</template>

<style scoped>
.whiteboard-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-right: 1px solid #e0e0e0;
}

.tool-group:last-child {
  border-right: none;
}

.tool-btn {
  padding: 8px 16px;
  border: 1px solid #d0d0d0;
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: #f5f5f5;
  border-color: #b0b0b0;
}

.tool-btn.active {
  background: #3296fa;
  color: #ffffff;
  border-color: #3296fa;
}

.tool-btn.danger {
  color: #ff4d4f;
  border-color: #ff4d4f;
}

.tool-btn.danger:hover {
  background: #fff1f0;
}

.tool-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
}

.canvas-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
