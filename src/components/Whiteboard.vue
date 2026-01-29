<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { useStorage } from '@vueuse/core';
  import { Leafer, Pen, Group, Rect } from 'leafer-ui';
  import type { ToolConfig, ToolType } from '../types';
  import { createTestData } from '../utils/testData';
  import PerformanceMonitor from './PerformanceMonitor.vue';
  import Toolbar from './Toolbar.vue';

  /**
   * 使用 useStorage 持久化工具配置
   * 所有状态都会自动保存到 localStorage
   */
  const toolConfig = useStorage<ToolConfig>('whiteboard-tool-config', {
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
    touchEnabled: true,
  }, localStorage, { mergeDefaults: true });

  /**
   * 性能分析开关（持久化）
   */
  const performanceMonitorEnabled = useStorage('whiteboard-performance-monitor', false, localStorage);

  /** Leafer实例 */
  let leaferInstance: Leafer | null = null;
  /** 主容器Group（所有绘制内容和橡皮擦都在这里） */
  let mainGroup: Group | null = null;
  /** 画布容器ref */
  const canvasRef = ref<HTMLDivElement | null>(null);

  /** 绘图状态 */
  /** 每个指针的绘制状态 Map<pointerId, DrawingState> */
  const drawingStates = new Map<
    number,
    {
      path: Pen;
      isEraser: boolean;
      lastPressure: number; // 上一次的压力值
      lastX: number; // 上一次的X坐标
      lastY: number; // 上一次的Y坐标
    }
  >();
  /** 是否正在使用压感笔（用于自动禁用触摸） */
  const isUsingPen = ref(false);
  /** 压力变化阈值，超过此值时创建新的路径段 */
  const PRESSURE_THRESHOLD = 0.05;

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

    if (toolConfig.value.toolType === 'eraser') {
      canvasRef.value.style.cursor = 'cell'; // 橡皮擦光标
    } else {
      canvasRef.value.style.cursor = 'crosshair'; // 画笔光标
    }
  }

  /**
   * 切换触摸输入是否启用
   */
  function setTouchEnabled(enabled: boolean) {
    toolConfig.value.touchEnabled = enabled;
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
   * 原生 pointerdown 事件处理（支持多点触控）
   */
  function handlePointerDown(e: PointerEvent) {
    if (!canvasRef.value || !mainGroup) return;

    // 如果是触摸输入且触摸被禁用，则忽略
    if (e.pointerType === 'touch' && !toolConfig.value.touchEnabled) {
      return;
    }

    // 如果是压感笔，自动禁用触摸输入（防止手掌误触）
    if (e.pointerType === 'pen' && !isUsingPen.value) {
      isUsingPen.value = true;
      toolConfig.value.touchEnabled = false;
    }

    // 检测压感笔橡皮擦端
    const isPenEraser = e.pointerType === 'pen' && e.buttons === 32;

    // 确定是否使用橡皮擦
    let isEraser = isPenEraser;
    if (isPenEraser) {
      toolConfig.value.toolType = 'eraser' as ToolType;
      isEraser = true;
    } else {
      isEraser = toolConfig.value.toolType === 'eraser';
    }

    const rect = canvasRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;

    // 捕获指针，防止压感笔事件被中断（解决绘制一小段就停顿的问题）
    canvasRef.value.setPointerCapture(e.pointerId);

    // 创建新路径（一次连续绘制只创建一个 Pen）
    const path = startPath(x, y, pressure, isEraser);
    if (!path) return;

    // 存储该指针的绘制状态
    drawingStates.set(e.pointerId, {
      path,
      isEraser,
      lastPressure: pressure,
      lastX: x,
      lastY: y,
    });

    // 更新光标
    updateCursor();
  }

  /**
   * 原生 pointermove 事件处理（支持多点触控 + 动态压感）
   */
  function handlePointerMove(e: PointerEvent) {
    // 如果是触摸输入且触摸被禁用，则忽略
    if (e.pointerType === 'touch' && !toolConfig.value.touchEnabled) {
      return;
    }

    const drawingState = drawingStates.get(e.pointerId);
    if (!drawingState || !canvasRef.value) return;

    const rect = canvasRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;

    // 检查压力是否显著变化
    const pressureChanged =
      Math.abs(pressure - drawingState.lastPressure) > PRESSURE_THRESHOLD;

    if (pressureChanged && !drawingState.isEraser) {
      // 压力变化显著，结束当前路径，创建新的路径段
      // 创建新路径，起点为上一个点（保持连续性）
      const newPath = startPath(drawingState.lastX, drawingState.lastY, pressure, false);
      if (newPath) {
        // 添加新点
        newPath.lineTo(x, y);

        // 更新绘制状态
        drawingState.path = newPath;
        drawingState.lastPressure = pressure;
      }
    } else {
      // 压力变化不大，继续使用当前路径
      drawingState.path.lineTo(x, y);
    }

    // 更新坐标
    drawingState.lastX = x;
    drawingState.lastY = y;
  }

  /**
   * 原生 pointerup 事件处理（支持多点触控）
   */
  function handlePointerUp(e: PointerEvent) {
    // 释放指针捕获
    canvasRef.value?.releasePointerCapture(e.pointerId);

    // 移除该指针的绘制状态
    drawingStates.delete(e.pointerId);

    // 如果所有指针都已释放，检查是否是压感笔操作结束
    if (drawingStates.size === 0 && isUsingPen.value) {
      isUsingPen.value = false;
      // 压感笔操作结束后，恢复触摸输入（如果用户没有手动关闭）
      // 这里保持当前状态，让用户手动控制
    }
  }

  /**
   * 原生 pointercancel 事件处理（压感笔可能触发此事件导致绘制中断）
   */
  function handlePointerCancel(e: PointerEvent) {
    // 释放指针捕获
    canvasRef.value?.releasePointerCapture(e.pointerId);

    // 移除该指针的绘制状态
    drawingStates.delete(e.pointerId);

    // 如果所有指针都已释放，检查是否是压感笔操作结束
    if (drawingStates.size === 0 && isUsingPen.value) {
      isUsingPen.value = false;
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
    setTouchEnabled,
    clearCanvas,
  });
</script>

<template>
  <div class="whiteboard-container">
    <div ref="canvasRef" class="whiteboard-canvas"></div>

    <!-- 工具栏组件 -->
    <Toolbar
      v-model:toolConfig="toolConfig"
      v-model:performanceMonitorEnabled="performanceMonitorEnabled"
      @clearCanvas="clearCanvas"
    />

    <!-- 压感笔提示 -->
    <div v-if="isUsingPen" class="pen-indicator">
      压感笔模式 - 触摸已禁用
    </div>

    <!-- 性能监控组件 -->
    <PerformanceMonitor
      :enabled="performanceMonitorEnabled"
      :leaferInstance="leaferInstance"
      :mainGroup="mainGroup"
    />
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

  .pen-indicator {
    position: absolute;
    bottom: 20px;
    left: 20px;
    padding: 8px 12px;
    background-color: rgba(24, 144, 255, 0.9);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
  }
</style>
