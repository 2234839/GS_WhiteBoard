<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { Leafer, Pen, Group, Rect } from 'leafer-ui';
  import type { ToolConfig, ToolType } from '../types';
  import { createTestData } from '../utils/testData';

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

    // 捕获指针，防止压感笔事件被中断（解决绘制一小段就停顿的问题）
    canvasRef.value.setPointerCapture(e.pointerId);

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
    currentPath.lineTo(x, y);

    // 更新最后位置
    lastX = x;
    lastY = y;
  }

  /**
   * 原生 pointerup 事件处理
   */
  function handlePointerUp(e: PointerEvent) {
    // 释放指针捕获
    canvasRef.value?.releasePointerCapture(e.pointerId);

    isDrawing = false;
    currentPath = null;
    isEraserActive = false;
  }

  /**
   * 原生 pointercancel 事件处理（压感笔可能触发此事件导致绘制中断）
   */
  function handlePointerCancel(e: PointerEvent) {
    // 释放指针捕获
    canvasRef.value?.releasePointerCapture(e.pointerId);

    // 停止绘制
    isDrawing = false;
    currentPath = null;
    isEraserActive = false;
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

    // ===== 创建测试数据 =====
    // 使用 realistic 模式，模拟真实绘制（多小段路径）
    createTestData(mainGroup, { realistic: true, segments: 20 });
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
      // 监听 pointercancel 事件（压感笔可能触发此事件导致绘制中断）
      canvasRef.value.addEventListener('pointercancel', handlePointerCancel);
    }
  });

  // 组件卸载时清理
  onUnmounted(() => {
    if (canvasRef.value) {
      canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
      canvasRef.value.removeEventListener('pointermove', handlePointerMove);
      canvasRef.value.removeEventListener('pointerup', handlePointerUp);
      canvasRef.value.removeEventListener('pointercancel', handlePointerCancel);
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
    /* 禁止浏览器默认的触摸行为（防止 pointercancel 事件） */
    touch-action: none;
    /* 防止文本选择 */
    user-select: none;
    /* 防止拖拽 */
    -webkit-user-drag: none;
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
