<script setup lang="ts">
  import { ref, shallowRef, onMounted, onUnmounted, computed, watch } from 'vue';
  import { useStorage } from '@vueuse/core';
  import { Leafer, Pen, Group } from 'leafer-ui';
  import type { ToolConfig, ToolType } from '@/types';
  import type { CanvasData } from '@/composables/useCanvasData';
  import { createTestData } from '@/utils/testData';
  import {
    exponentialMovingAverage,
    DEFAULT_POSITION_SMOOTHING_ALPHA,
    adaptiveInterpolatePressureTransition,
    shouldAcceptPoint,
    smoothPosition,
    initAdaptiveSmoothingState,
    getAdaptivePressureAlpha,
    AdaptiveSmoothingState,
  } from '@/utils/pressureSmoothing';
  import { useCanvasGestures } from '@/composables/useCanvasGestures';
  import { pushState, undo, redo } from '@/utils/historyUtils';
  import { useLogControl } from '@/composables/useLogControl';
  import PerformanceMonitor from './PerformanceMonitor.vue';
  import Toolbar from './Toolbar.vue';
  import CustomCursor from './CustomCursor.vue';

  /**
   * 日志控制
   */
  const logEnable = useLogControl();

  /**
   * 组件 Props
   */
  interface Props {
    /** 画布数据（可选，如果不传则使用本地存储） */
    canvasData?: CanvasData;
    /** 是否显示返回按钮 */
    showBackButton?: boolean;
  }

  const props = defineProps<Props>();

  /**
   * 定义 emits
   */
  const emit = defineEmits<{
    back: [];
  }>();

  /**
   * 默认工具配置
   */
  const defaultToolConfig: ToolConfig = {
    toolType: 'pen' as ToolType,
    brush: {
      color: '#000000',
      baseLineWidth: 3,
      pressureEnabled: true,
      pressureFactor: 0.8,
      smartSmoothingEnabled: true,
    },
    eraser: {
      type: 'path',
      size: 20,
    },
    touchDrawingEnabled: true,
  };

  /**
   * 本地存储的工具配置（当没有 canvasData 时使用）
   */
  const localStorageToolConfig = useStorage<ToolConfig>(
    'whiteboard-tool-config',
    defaultToolConfig,
    localStorage,
    { mergeDefaults: true }
  );

  /**
   * 工具配置计算属性
   * 如果有 canvasData，使用其 toolConfig；否则使用 localStorage
   */
  const toolConfig = computed<ToolConfig>({
    get: () => {
      return props.canvasData?.toolConfig || localStorageToolConfig.value;
    },
    set: (value) => {
      if (props.canvasData) {
        // 同步到 canvasData
        props.canvasData.toolConfig = value;
      } else {
        // 同步到 localStorage
        localStorageToolConfig.value = value;
      }
    },
  });

  /**
   * 性能分析开关（持久化）
   */
  const performanceMonitorEnabled = useStorage('whiteboard-performance-monitor', false, localStorage);

  /**
   * 撤销重做功能开关（持久化，用于性能测试对比）
   */
  const undoRedoEnabled = useStorage('whiteboard-undo-redo-enabled', true, localStorage);

  /** Leafer实例（使用 shallowRef 避免深度响应式影响性能） */
  const leaferInstance = shallowRef<Leafer | null>(null);
  /** 主容器Group（使用 shallowRef 避免深度响应式影响性能） */
  const mainGroup = shallowRef<Group | null>(null);
  /** 画布容器ref */
  const canvasRef = ref<HTMLDivElement | null>(null);

  /** 绘图状态 */
  /** 每个指针的绘制状态 Map<pointerId, DrawingState> */
  const drawingStates = new Map<
    number,
    {
      path: Pen;
      isEraser: boolean;
      lastPressure: number;
      lastX: number;
      lastY: number;
      smoothedPressure: number;
      smoothedX: number;
      smoothedY: number;
      lastTimestamp: number;
      adaptiveSmoothingState: AdaptiveSmoothingState;
    }
  >();
  /** 是否正在使用压感笔（用于自动禁用触摸） */
  const isUsingPen = ref(false);
  /** 压感笔临时切换状态（null表示未临时切换） */
  const temporaryToolSwitch = ref<'pen' | 'eraser' | null>(null);

  /**
   * 批处理历史记录保存（防抖）
   * 只有在用户停止绘制一段时间后才保存状态
   */
  let historySaveTimer: ReturnType<typeof setTimeout> | null = null;
  const HISTORY_SAVE_DELAY = 500; // 延迟 500ms 保存

  /**
   * 保存历史记录状态（带防抖）
   */
  function saveHistoryState() {
    logEnable.undoRedo && console.log('[撤销重做] saveHistoryState 调用');

    // 如果撤销功能关闭，不进行任何序列化操作
    if (!undoRedoEnabled.value) {
      logEnable.undoRedo && console.log('[撤销重做] 撤销功能已关闭，跳过保存');
      return;
    }
    if (!mainGroup.value || !props.canvasData) return;

    // 清除之前的定时器
    if (historySaveTimer) {
      clearTimeout(historySaveTimer);
      logEnable.undoRedo && console.log('[撤销重做] 清除之前的定时器，重新计时');
    }

    // 延迟保存，等待用户停止绘制
    historySaveTimer = setTimeout(() => {
      if (!mainGroup.value || !props.canvasData) return;

      // 同时保存历史记录和画布数据
      saveCanvasData();
      logEnable.undoRedo && console.log('[撤销重做] 批处理保存历史记录');
      pushState(mainGroup.value, props.canvasData.undoStack, props.canvasData.redoStack, props.canvasData.maxHistory);

      historySaveTimer = null;
    }, HISTORY_SAVE_DELAY);
  }

  /**
   * 使用画布手势 composable
   */
  const {
    clientToCanvasCoordinates,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    touchStartCanvasState,
  } = useCanvasGestures(canvasRef, leaferInstance, toolConfig);

  /**
   * 是否可以撤回
   */
  const canUndo = computed(() => (props.canvasData?.undoStack.length ?? 0) > 0);

  /**
   * 是否可以重做
   */
  const canRedo = computed(() => (props.canvasData?.redoStack.length ?? 0) > 0);

  /**
   * 监听画布变换状态变化并保存到 canvasData
   * 当手势结束时保存变换状态
   */
  watch(touchStartCanvasState, (state, oldState) => {
    // 只在手势结束时（从有状态变为无状态）保存
    if (oldState && !state && leaferInstance.value && props.canvasData) {
      props.canvasData.transform = {
        scale: leaferInstance.value.scaleX || 1,
        offsetX: leaferInstance.value.x || 0,
        offsetY: leaferInstance.value.y || 0,
      };
    }
  });

  /**
   * 根据画笔粗细动态计算压感变化阈值
   * 粗笔使用更小的阈值，确保更早触发插值，得到更平滑的过渡
   */
  function getPressureThreshold(baseLineWidth: number): number {
    if (baseLineWidth < 10) {
      return 0.05; // 细笔：可以使用较大的阈值
    } else if (baseLineWidth < 30) {
      return 0.03; // 中等笔：中等阈值
    } else {
      return 0.015; // 粗笔：使用很小的阈值，确保平滑过渡
    }
  }

  /**
   * 获取笔刷大小（基于压感）
   */
  function getBrushSize(pressure: number, baseSize: number, pressureEnabled: boolean): number {
    if (!pressureEnabled) return baseSize;
    // 压感值 0-1，最小为 baseSize 的 50%，最大为 baseSize 的 300%
    return baseSize * (0.5 + pressure * 2.5);
  }

  /**
   * 计算当前生效的工具类型
   */
  const currentToolType = computed(() => {
    return temporaryToolSwitch.value || toolConfig.value.toolType;
  });

  /**
   * 切换触摸绘制是否启用
   */
  function setTouchDrawingEnabled(enabled: boolean) {
    toolConfig.value = {
      ...toolConfig.value,
      touchDrawingEnabled: enabled,
    };
  }

  /**
   * 开始绘制（创建新的路径）
   */
  function startPath(x: number, y: number, pressure: number, isEraser: boolean) {
    const t0 = performance.now();
    if (!mainGroup.value) return null;
    const { brush, eraser } = toolConfig.value;
    const brushSize =
      isEraser ? eraser.size : getBrushSize(pressure, brush.baseLineWidth, brush.pressureEnabled);

    const t1 = performance.now();

    // 创建路径
    const path = new Pen();
    path.setStyle({
      stroke: isEraser ? 'rgba(0,0,0,1)' : brush.color,
      strokeWidth: brushSize,
      strokeCap: 'round',
      strokeJoin: 'round',
    });

    const t2 = performance.now();

    if (isEraser) {
      // 使用 pixel 类型橡皮擦，效果更自然平滑
      path.eraser = 'pixel';
    }

    // 移动到起始点
    path.moveTo(x, y);
    path.lineTo(x, y); // 绘制一个点

    const t3 = performance.now();

    // 添加到 mainGroup
    mainGroup.value.add(path);

    const t4 = performance.now();
    logEnable.undoRedo && console.log(`[性能] startPath: 计算大小${(t1-t0).toFixed(2)}ms, 创建Pen${(t2-t1).toFixed(2)}ms, 设置样式${(t2-t1).toFixed(2)}ms, moveTo${(t3-t2).toFixed(2)}ms, add到Group${(t4-t3).toFixed(2)}ms, 总计${(t4-t0).toFixed(2)}ms`);

    return path;
  }

  /**
   * 原生 pointerdown 事件处理（支持多点触控）
   */
  function handlePointerDown(e: PointerEvent) {
    const t0 = performance.now();
    if (!canvasRef.value || !mainGroup) return;

    // 处理触控手势（在触摸绘制关闭时）
    handleTouchStart(e);

    // 如果是触摸输入且触摸绘制被禁用，则忽略（用于手势操作）
    if (e.pointerType === 'touch' && !toolConfig.value.touchDrawingEnabled) {
      return;
    }

    const t1 = performance.now();
    logEnable.undoRedo && console.log(`[性能] handleTouchStart: ${(t1 - t0).toFixed(2)}ms`);

    // 如果是压感笔，自动禁用触摸输入（防止手掌误触）
    if (e.pointerType === 'pen' && !isUsingPen.value) {
      isUsingPen.value = true;

      // 只在触摸绘制开启时才修改（避免不必要的响应式更新）
      if (toolConfig.value.touchDrawingEnabled) {
        toolConfig.value = {
          ...toolConfig.value,
          touchDrawingEnabled: false,
        };
      }

      // 检测压感笔橡皮擦端（buttons === 32 表示橡皮擦端）
      const isPenEraser = e.buttons === 32;

      // 设置临时切换状态：只在压感笔端与当前工具不一致时才临时切换
      if (isPenEraser && toolConfig.value.toolType !== 'eraser') {
        // 橡皮擦端但当前是画笔 → 临时切换到橡皮擦
        temporaryToolSwitch.value = 'eraser';
      } else if (!isPenEraser && toolConfig.value.toolType === 'eraser') {
        // 画笔端但当前是橡皮擦 → 临时切换到画笔
        temporaryToolSwitch.value = 'pen';
      }
    }

    const t2 = performance.now();
    logEnable.undoRedo && console.log(`[性能] 压感笔处理: ${(t2 - t1).toFixed(2)}ms`);

    // 确定是否使用橡皮擦（如果有临时切换状态则完全使用临时状态，否则使用配置状态）
    let isEraser = temporaryToolSwitch.value
      ? temporaryToolSwitch.value === 'eraser'
      : toolConfig.value.toolType === 'eraser';

    // 将客户端坐标转换为画布本地坐标
    const coords = clientToCanvasCoordinates(e.clientX, e.clientY);
    const x = coords.x;
    const y = coords.y;
    const pressure = e.pressure || 0.5;

    const t3 = performance.now();
    logEnable.undoRedo && console.log(`[性能] 坐标转换: ${(t3 - t2).toFixed(2)}ms`);

    // 捕获指针，防止压感笔事件被中断（解决绘制一小段就停顿的问题）
    canvasRef.value.setPointerCapture(e.pointerId);

    const t4 = performance.now();
    logEnable.undoRedo && console.log(`[性能] setPointerCapture: ${(t4 - t3).toFixed(2)}ms`);

    // 创建新路径（一次连续绘制只创建一个 Pen）
    const path = startPath(x, y, pressure, isEraser);
    if (!path) return;

    const t5 = performance.now();
    logEnable.undoRedo && console.log(`[性能] startPath: ${(t5 - t4).toFixed(2)}ms`);

    // 存储该指针的绘制状态
    drawingStates.set(e.pointerId, {
      path,
      isEraser,
      lastPressure: pressure,
      lastX: x,
      lastY: y,
      smoothedPressure: pressure,
      smoothedX: x,
      smoothedY: y,
      lastTimestamp: Date.now(),
      adaptiveSmoothingState: initAdaptiveSmoothingState(5),
    });

    const t6 = performance.now();
    logEnable.undoRedo && console.log(`[性能] 存储 state: ${(t6 - t5).toFixed(2)}ms, 总计: ${(t6 - t0).toFixed(2)}ms`);
  }

  /**
   * 原生 pointermove 事件处理（支持多点触控 + 动态压感）
   */
  function handlePointerMove(e: PointerEvent) {
    // 处理触控手势（在触摸绘制关闭时）
    handleTouchMove(e);

    // 如果是触摸输入且触摸绘制被禁用，则忽略（用于手势操作）
    if (e.pointerType === 'touch' && !toolConfig.value.touchDrawingEnabled) {
      return;
    }

    const drawingState = drawingStates.get(e.pointerId);
    if (!drawingState || !canvasRef.value) return;

    // 将客户端坐标转换为画布本地坐标
    const coords = clientToCanvasCoordinates(e.clientX, e.clientY);
    const rawX = coords.x;
    const rawY = coords.y;
    const rawPressure = e.pressure || 0.5;
    const currentTimestamp = Date.now();

    // 根据配置决定是否使用智能平滑处理
    const { brush } = toolConfig.value;
    let x = rawX;
    let y = rawY;
    let pressure = rawPressure;

    if (brush.smartSmoothingEnabled && !drawingState.isEraser) {
      // 消抖过滤：检查是否应该接受这个点
      const shouldAccept = shouldAcceptPoint(
        {
          x: drawingState.lastX,
          y: drawingState.lastY,
          pressure: drawingState.lastPressure,
          timestamp: drawingState.lastTimestamp,
        },
        {
          x: rawX,
          y: rawY,
          pressure: rawPressure,
          timestamp: currentTimestamp,
        }
      );

      // 如果不满足最小距离和时间间隔，跳过这个点
      if (!shouldAccept) {
        return;
      }

      // 位置平滑：使用指数移动平均
      const smoothedPos = smoothPosition(
        drawingState.smoothedX,
        drawingState.smoothedY,
        rawX,
        rawY,
        DEFAULT_POSITION_SMOOTHING_ALPHA
      );
      x = smoothedPos.x;
      y = smoothedPos.y;

      // 压感平滑：使用自适应系数
      const adaptiveAlpha = getAdaptivePressureAlpha(drawingState.adaptiveSmoothingState, rawPressure);
      pressure = exponentialMovingAverage(drawingState.smoothedPressure, rawPressure, adaptiveAlpha);

      // 更新平滑后的值
      drawingState.smoothedX = x;
      drawingState.smoothedY = y;
      drawingState.smoothedPressure = pressure;
      drawingState.lastTimestamp = currentTimestamp;
    }

    // 检查压力是否显著变化（根据画笔粗细动态调整阈值）
    const pressureThreshold = getPressureThreshold(brush.baseLineWidth);
    const pressureChanged =
      Math.abs(pressure - drawingState.lastPressure) > pressureThreshold;

    if (pressureChanged && !drawingState.isEraser) {
      // 压力变化显著，使用自适应插值生成平滑过渡
      const interpolationPoints = adaptiveInterpolatePressureTransition(
        drawingState.lastX,
        drawingState.lastY,
        drawingState.lastPressure,
        x,
        y,
        pressure,
        {
          baseLineWidth: brush.baseLineWidth,
          pressureEnabled: brush.pressureEnabled,
        }
      );

      if (interpolationPoints.length > 0) {
        // 有插值点：绘制每个插值点作为一个小路径段
        let currentX = drawingState.lastX;
        let currentY = drawingState.lastY;

        for (const point of interpolationPoints) {
          // 创建新的路径段
          const newPath = startPath(currentX, currentY, point.pressure, false);
          if (newPath) {
            newPath.lineTo(point.x, point.y);
            currentX = point.x;
            currentY = point.y;
            drawingState.path = newPath;
          }
        }

        // 最后连接到目标点
        const finalPath = startPath(currentX, currentY, pressure, false);
        if (finalPath) {
          finalPath.lineTo(x, y);
          drawingState.path = finalPath;
          drawingState.lastPressure = pressure;
        }
      } else {
        // 没有插值点，直接创建新路径
        const newPath = startPath(drawingState.lastX, drawingState.lastY, pressure, false);
        if (newPath) {
          newPath.lineTo(x, y);
          drawingState.path = newPath;
          drawingState.lastPressure = pressure;
        }
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
    // 处理触控手势结束
    handleTouchEnd(e);

    // 释放指针捕获
    canvasRef.value?.releasePointerCapture(e.pointerId);

    // 移除该指针的绘制状态
    drawingStates.delete(e.pointerId);

    // 如果所有指针都已释放，检查是否是压感笔操作结束
    if (drawingStates.size === 0 && isUsingPen.value) {
      isUsingPen.value = false;
      // 清除临时切换状态
      temporaryToolSwitch.value = null;
    }

    // 如果所有指针都已释放，使用批处理保存历史记录
    if (drawingStates.size === 0) {
      saveHistoryState();
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
      // 清除临时切换状态
      temporaryToolSwitch.value = null;
    }

    // 清理触控手势状态
    handleTouchEnd(e);
  }

  /**
   * 初始化画布
   */
  function initCanvas() {
    if (!canvasRef.value) return;

    // 销毁旧实例
    if (leaferInstance.value) {
      leaferInstance.value.destroy();
    }

    const leafer = new Leafer({
      view: canvasRef.value,
      type: 'design',
    });

    // 创建主容器Group（所有绘制内容和橡皮擦都在这里）
    // 注意：背景色已通过CSS设置在.whiteboard-canvas上，不再需要Leafer背景元素
    const group = new Group({
      x: 0,
      y: 0,
    });

    leafer.add(group);

    // 更新 ref
    leaferInstance.value = leafer;
    mainGroup.value = group;

    // 加载画布数据
    if (props.canvasData) {
      // 应用保存的变换状态
      const { transform } = props.canvasData;
      leafer.scaleX = transform.scale;
      leafer.scaleY = transform.scale;
      leafer.x = transform.offsetX;
      leafer.y = transform.offsetY;

      // 加载保存的 Leafer 数据
      if (props.canvasData.leaferData && props.canvasData.leaferData.length > 0) {
        // 遍历每个元素数据并添加到 group
        for (const elementData of props.canvasData.leaferData) {
          group.add(elementData);
        }
      }
    } else {
      // ===== 创建测试数据（仅在没有传入 canvasData 时） =====
      // 使用 realistic 模式，模拟真实绘制（多小段路径）
      createTestData(group, { realistic: true, segments: 20 });
    }
  }

  /**
   * 保存画布数据到 canvasData
   */
  function saveCanvasData() {
    if (!props.canvasData || !mainGroup.value) return;

    const startTime = performance.now();

    // 直接序列化整个 group
    const groupJson = mainGroup.value.toJSON() as { children?: Record<string, unknown>[] };
    props.canvasData.leaferData = groupJson.children || [];
    props.canvasData.updatedAt = Date.now();

    const serializeTime = performance.now() - startTime;
    logEnable.undoRedo && console.log(`[撤销重做] saveCanvasData: 序列化耗时 ${serializeTime.toFixed(2)}ms`);
  }

  /**
   * 切换工具
   */
  function setToolType(toolType: ToolType) {
    toolConfig.value = {
      ...toolConfig.value,
      toolType,
    };
  }

  /**
   * 设置画笔颜色
   */
  function setBrushColor(color: string) {
    toolConfig.value = {
      ...toolConfig.value,
      brush: {
        ...toolConfig.value.brush,
        color,
      },
    };
  }

  /**
   * 设置画笔粗细
   */
  function setBrushSize(size: number) {
    toolConfig.value = {
      ...toolConfig.value,
      brush: {
        ...toolConfig.value.brush,
        baseLineWidth: size,
      },
    };
  }

  /**
   * 设置橡皮擦粗细
   */
  function setEraserSize(size: number) {
    toolConfig.value = {
      ...toolConfig.value,
      eraser: {
        ...toolConfig.value.eraser,
        size,
      },
    };
  }

  /**
   * 清空画布
   */
  function clearCanvas() {
    if (!mainGroup.value || !props.canvasData) return;

    // 清空防抖定时器，清空操作应该立即保存
    if (historySaveTimer) {
      clearTimeout(historySaveTimer);
      historySaveTimer = null;
    }

    // 保存清空前的状态到历史记录（根据开关决定是否启用）
    if (undoRedoEnabled.value) {
      pushState(mainGroup.value, props.canvasData.undoStack, props.canvasData.redoStack, props.canvasData.maxHistory);
    }

    // LeaferJS 的正确清空方式：遍历删除所有子元素
    const children = [...mainGroup.value.children];
    for (const child of children) {
      mainGroup.value.remove(child);
    }

    // 保存画布数据
    saveCanvasData();
  }

  /**
   * 撤回操作
   */
  function handleUndo() {
    if (mainGroup.value && props.canvasData) {
      undo(mainGroup.value, props.canvasData.undoStack, props.canvasData.redoStack);
      // 撤回后保存画布数据
      saveCanvasData();
    }
  }

  /**
   * 重做操作
   */
  function handleRedo() {
    if (mainGroup.value && props.canvasData) {
      redo(mainGroup.value, props.canvasData.undoStack, props.canvasData.redoStack);
      // 重做后保存画布数据
      saveCanvasData();
    }
  }

  /**
   * 处理键盘快捷键
   */
  function handleKeyDown(e: KeyboardEvent) {
    // Ctrl+Z 撤回
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo.value) {
        handleUndo();
      }
    }
    // Ctrl+Y 或 Ctrl+Shift+Z 重做
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (canRedo.value) {
        handleRedo();
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

    // 添加键盘事件监听
    window.addEventListener('keydown', handleKeyDown);
  });

  // 组件卸载时清理
  onUnmounted(() => {
    // 清理防抖定时器
    if (historySaveTimer) {
      clearTimeout(historySaveTimer);
      historySaveTimer = null;
      // 如果撤销功能开启，组件卸载前立即保存数据
      if (undoRedoEnabled.value) {
        saveCanvasData();
      }
    }

    if (canvasRef.value) {
      canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
      canvasRef.value.removeEventListener('pointermove', handlePointerMove);
      canvasRef.value.removeEventListener('pointerup', handlePointerUp);
      canvasRef.value.removeEventListener('pointercancel', handlePointerCancel);
    }

    // 移除键盘事件监听
    window.removeEventListener('keydown', handleKeyDown);

    if (leaferInstance.value) {
      leaferInstance.value.destroy();
    }
  });

  // 暴露方法供父组件调用
  defineExpose({
    setToolType,
    setBrushColor,
    setBrushSize,
    setEraserSize,
    setTouchDrawingEnabled,
    clearCanvas,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  });
</script>

<template>
  <div class="whiteboard-container">
    <div ref="canvasRef" class="whiteboard-canvas"></div>

    <!-- 自定义光标组件 -->
    <CustomCursor :toolType="currentToolType as ToolType" :visible="isUsingPen" />

    <!-- 工具栏组件 -->
    <Toolbar
      v-model:toolConfig="toolConfig"
      v-model:performanceMonitorEnabled="performanceMonitorEnabled"
      v-model:undoRedoEnabled="undoRedoEnabled"
      :temporaryToolSwitch="temporaryToolSwitch"
      :show-back-button="showBackButton"
      :can-undo="canUndo"
      :can-redo="canRedo"
      @clearCanvas="clearCanvas"
      @back="emit('back')"
      @undo="handleUndo"
      @redo="handleRedo"
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
    /* 无限画布背景色 */
    background-color: #ffffff;
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
