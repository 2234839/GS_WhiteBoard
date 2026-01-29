<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { Leafer, Pen, Group, Rect } from 'leafer-ui';
  import type { ToolConfig, ToolType } from '../types';

  /** 当前工具配置 */
  const toolConfig = ref<ToolConfig>({
    toolType: 'pen' as ToolType,
    brush: {
      color: '#000000',
      baseLineWidth: 3,
      pressureEnabled: true,
      pressureFactor: 0.8,
    },
    eraser: {
      type: 'path',
      size: 20,
    },
  });

  /** Leafer实例 */
  let leaferInstance: Leafer | null = null;
  /** 主容器Group（所有绘制内容和橡皮擦都在这里） */
  let mainGroup: Group | null = null;
  /** 画布容器ref */
  const canvasRef = ref<HTMLDivElement | null>(null);

  /** 绘图状态 */
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let isEraserActive = false;
  /** 当前正在绘制的路径（一次连续绘制只创建一个 Pen） */
  let currentPath: Pen | null = null;

  /**
   * 获取笔刷大小（基于压感）
   */
  function getBrushSize(pressure: number, baseSize: number, pressureEnabled: boolean): number {
    if (!pressureEnabled) return baseSize;
    // 压感值 0-1，最小为 baseSize 的 50%，最大为 baseSize 的 300%
    return baseSize * (0.5 + pressure * 2.5);
  }

  /**
   * 更新光标样式
   */
  function updateCursor() {
    if (!canvasRef.value) return;

    if (isEraserActive || toolConfig.value.toolType === 'eraser') {
      canvasRef.value.style.cursor = 'cell'; // 橡皮擦光标
    } else {
      canvasRef.value.style.cursor = 'crosshair'; // 画笔光标
    }
  }

  /**
   * 开始绘制（创建新的路径）
   */
  function startPath(x: number, y: number, pressure: number, isEraser: boolean) {
    if (!mainGroup) return null;
    const { brush, eraser } = toolConfig.value;
    const brushSize =
      isEraser ? eraser.size : getBrushSize(pressure, brush.baseLineWidth, brush.pressureEnabled);

    // 创建路径
    const path = new Pen();
    path.setStyle({
      stroke: isEraser ? 'rgba(0,0,0,1)' : brush.color,
      strokeWidth: brushSize,
      strokeCap: 'round',
      strokeJoin: 'round',
    });

    if (isEraser) {
      // 使用 pixel 类型橡皮擦，效果更自然平滑
      path.eraser = 'pixel';
    }

    // 移动到起始点
    path.moveTo(x, y);
    path.lineTo(x, y); // 绘制一个点

    // 添加到 mainGroup
    mainGroup.add(path);

    return path;
  }

  /**
   * 继续绘制（向当前路径添加点）
   */
  function continuePath(path: Pen, x: number, y: number) {
    path.lineTo(x, y);
  }

  /**
   * 原生 pointerdown 事件处理
   */
  function handlePointerDown(e: PointerEvent) {
    if (!canvasRef.value || !mainGroup) return;

    // 检测压感笔橡皮擦端
    const isPenEraser = e.pointerType === 'pen' && e.buttons === 32;

    // 确定是否使用橡皮擦
    if (isPenEraser) {
      isEraserActive = true;
      toolConfig.value.toolType = 'eraser' as ToolType;
    } else {
      isEraserActive = toolConfig.value.toolType === 'eraser';
    }

    isDrawing = true;

    const rect = canvasRef.value.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;

    // 创建新路径（一次连续绘制只创建一个 Pen）
    currentPath = startPath(lastX, lastY, pressure, isEraserActive);

    // 更新光标
    updateCursor();
  }

  /**
   * 原生 pointermove 事件处理
   */
  function handlePointerMove(e: PointerEvent) {
    if (!isDrawing || !canvasRef.value || !currentPath) return;

    const rect = canvasRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 向当前路径添加新点
    continuePath(currentPath, x, y);

    // 更新最后位置
    lastX = x;
    lastY = y;
  }

  /**
   * 原生 pointerup 事件处理
   */
  function handlePointerUp() {
    isDrawing = false;
    currentPath = null;
    isEraserActive = false;
  }

  /**
   * 原生 pointerleave 事件处理
   */
  function handlePointerLeave() {
    if (isDrawing) {
      isDrawing = false;
      currentPath = null;
      isEraserActive = false;
    }
  }

  /**
   * 初始化画布
   */
  function initCanvas() {
    if (!canvasRef.value) return;

    // 销毁旧实例
    if (leaferInstance) {
      leaferInstance.destroy();
    }

    leaferInstance = new Leafer({
      view: canvasRef.value,
      type: 'design',
    });

    // 添加白色背景（最底层）
    const background = new Rect({
      x: 0,
      y: 0,
      width: canvasRef.value.clientWidth,
      height: canvasRef.value.clientHeight,
      fill: '#ffffff',
    });

    leaferInstance.add(background);

    // 创建主容器Group（所有绘制内容和橡皮擦都在这里）
    mainGroup = new Group({
      x: 0,
      y: 0,
    });

    leaferInstance.add(mainGroup);

    // ===== 测试数据：验证橡皮擦 =====
    console.log('创建测试数据...');

    // 1. 红色线
    const line1 = new Pen();
    line1.setStyle({
      stroke: '#FF0000',
      strokeWidth: 10,
      strokeCap: 'round',
    });
    line1.moveTo(100, 100);
    line1.lineTo(300, 100);
    mainGroup.add(line1);
    console.log('✓ 红色线');

    // 2. 蓝色线
    const line2 = new Pen();
    line2.setStyle({
      stroke: '#0000FF',
      strokeWidth: 10,
      strokeCap: 'round',
    });
    line2.moveTo(100, 150);
    line2.lineTo(300, 150);
    mainGroup.add(line2);
    console.log('✓ 蓝色线');

    // 3. 橡皮擦竖线 - 应该擦除红色和蓝色线
    const eraser1 = new Pen();
    eraser1.setStyle({
      stroke: 'rgba(0,0,0,1)',
      strokeWidth: 30,
      strokeCap: 'round',
    });
    eraser1.eraser = 'pixel';
    eraser1.moveTo(150, 80);
    eraser1.lineTo(150, 170);
    mainGroup.add(eraser1);
    console.log('✓ 橡皮擦竖线');

    // 4. 绿色线
    const line3 = new Pen();
    line3.setStyle({
      stroke: '#00FF00',
      strokeWidth: 10,
      strokeCap: 'round',
    });
    line3.moveTo(100, 200);
    line3.lineTo(300, 200);
    mainGroup.add(line3);
    console.log('✓ 绿色线');

    // 5. 橡皮擦竖线 - 应该擦除绿色线
    const eraser2 = new Pen();
    eraser2.setStyle({
      stroke: 'rgba(0,0,0,1)',
      strokeWidth: 30,
      strokeCap: 'round',
    });
    eraser2.eraser = true;
    eraser2.moveTo(200, 180);
    eraser2.lineTo(200, 220);
    mainGroup.add(eraser2);
    console.log('✓ 第二条橡皮擦竖线');

    console.log('Leafer画布初始化完成，测试数据已添加');
  }

  /**
   * 切换工具
   */
  function setToolType(toolType: ToolType) {
    toolConfig.value.toolType = toolType;
    updateCursor();
  }

  /**
   * 设置画笔颜色
   */
  function setBrushColor(color: string) {
    toolConfig.value.brush.color = color;
  }

  /**
   * 设置画笔粗细
   */
  function setBrushSize(size: number) {
    toolConfig.value.brush.baseLineWidth = size;
  }

  /**
   * 设置橡皮擦粗细
   */
  function setEraserSize(size: number) {
    toolConfig.value.eraser.size = size;
  }

  /**
   * 清空画布
   */
  function clearCanvas() {
    if (mainGroup) {
      // LeaferJS 的正确清空方式：遍历删除所有子元素
      const children = [...mainGroup.children];
      for (const child of children) {
        mainGroup.remove(child);
      }
    }
  }

  // 组件挂载时初始化画布
  onMounted(() => {
    initCanvas();

    // 添加事件监听（使用原生 DOM 事件，而不是 LeaferJS 的事件）
    if (canvasRef.value) {
      canvasRef.value.addEventListener('pointerdown', handlePointerDown);
      canvasRef.value.addEventListener('pointermove', handlePointerMove);
      canvasRef.value.addEventListener('pointerup', handlePointerUp);
      canvasRef.value.addEventListener('pointerleave', handlePointerLeave);
    }
  });

  // 组件卸载时清理
  onUnmounted(() => {
    if (canvasRef.value) {
      canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
      canvasRef.value.removeEventListener('pointermove', handlePointerMove);
      canvasRef.value.removeEventListener('pointerup', handlePointerUp);
      canvasRef.value.removeEventListener('pointerleave', handlePointerLeave);
    }

    if (leaferInstance) {
      leaferInstance.destroy();
    }
  });

  // 暴露方法供父组件调用
  defineExpose({
    setToolType,
    setBrushColor,
    setBrushSize,
    setEraserSize,
    clearCanvas,
  });
</script>

<template>
  <div class="whiteboard-container">
    <div ref="canvasRef" class="whiteboard-canvas"></div>

    <!-- 工具栏 -->
    <div class="toolbar">
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
      <button class="tool-btn" @click="clearCanvas">清空</button>
    </div>
  </div>
</template>

<style scoped>
  .whiteboard-container {
    width: 100%;
    height: 100vh;
    position: relative;
    background-color: #f0f0f0;
  }

  .whiteboard-canvas {
    width: 100%;
    height: 100%;
  }

  .toolbar {
    position: absolute;
    top: 20px;
    left: 20px;
    display: flex;
    gap: 10px;
    padding: 10px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .tool-btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tool-btn:hover {
    background-color: #f5f5f5;
  }

  .tool-btn.active {
    background-color: #1890ff;
    color: white;
    border-color: #1890ff;
  }
</style>
