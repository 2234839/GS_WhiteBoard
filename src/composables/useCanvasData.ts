import { useIdleStorage } from '@/composables/useIdleStorage';
import { computed } from 'vue';
import type { ToolConfig, ToolType } from '@/types';

/**
 * 历史记录项（使用完整状态快照）
 */
interface HistoryEntry {
  /** 快照（完整状态） */
  snapshot: Record<string, unknown>[];
}

/**
 * 画布变换状态（缩放和移动）
 */
interface CanvasTransform {
  /** 缩放比例 */
  scale: number;
  /** X轴偏移 */
  offsetX: number;
  /** Y轴偏移 */
  offsetY: number;
}

/**
 * 单个画布数据
 */
export interface CanvasData {
  /** 画布ID */
  id: string;
  /** 画布名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** Leafer 画布数据 */
  leaferData: Record<string, unknown>[];
  /** 画布变换状态 */
  transform: CanvasTransform;
  /** 工具配置 */
  toolConfig: ToolConfig;
  /** 撤回栈 */
  undoStack: HistoryEntry[];
  /** 重做栈 */
  redoStack: HistoryEntry[];
  /** 最大历史记录数量 */
  maxHistory: number;
}

/**
 * 画布数据存储管理
 */
export function useCanvasData() {
  /**
   * 所有画布数据列表
   */
  const canvases = useIdleStorage<CanvasData[]>('whiteboard-canvases', {
    defaultValue: []
  });

  /**
   * 当前选中的画布ID
   */
  const currentCanvasId = useIdleStorage<string | null>('whiteboard-current-canvas', {
    defaultValue: null
  });

  /**
   * 当前画布数据
   */
  const currentCanvas = computed(() => {
    if (!currentCanvasId.value) return null;
    return canvases.value.find((c) => c.id === currentCanvasId.value) || null;
  });

  /**
   * 创建新画布
   */
  function createCanvas(name: string = '新建画布'): CanvasData {
    const newCanvas: CanvasData = {
      id: `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      leaferData: [],
      transform: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
      toolConfig: {
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
      },
      undoStack: [],
      redoStack: [],
      maxHistory: 50,
    };

    canvases.value = [...canvases.value, newCanvas];
    return newCanvas;
  }

  /**
   * 删除画布
   */
  function deleteCanvas(id: string) {
    canvases.value = canvases.value.filter((c) => c.id !== id);
    if (currentCanvasId.value === id) {
      currentCanvasId.value = canvases.value[0]?.id || null;
    }
  }

  /**
   * 切换当前画布
   */
  function switchCanvas(id: string) {
    currentCanvasId.value = id;
  }

  /**
   * 更新画布数据
   */
  function updateCanvas(id: string, updates: Partial<CanvasData>) {
    const index = canvases.value.findIndex((c) => c.id === id);
    if (index !== -1) {
      canvases.value[index] = {
        ...canvases.value[index],
        ...updates,
        updatedAt: Date.now(),
      };
    }
  }

  /**
   * 保存画布 Leafer 数据
   */
  function saveCanvasLeaferData(canvasId: string, data: Record<string, unknown>[]) {
    const canvas = canvases.value.find((c) => c.id === canvasId);
    if (canvas) {
      canvas.leaferData = data;
      canvas.updatedAt = Date.now();
    }
  }

  /**
   * 清空画布 Leafer 数据
   */
  function clearCanvasLeaferData(canvasId: string) {
    const canvas = canvases.value.find((c) => c.id === canvasId);
    if (canvas) {
      canvas.leaferData = [];
      canvas.updatedAt = Date.now();
    }
  }

  /**
   * 更新画布变换状态
   */
  function updateCanvasTransform(canvasId: string, transform: Partial<CanvasTransform>) {
    const canvas = canvases.value.find((c) => c.id === canvasId);
    if (canvas) {
      canvas.transform = { ...canvas.transform, ...transform };
      canvas.updatedAt = Date.now();
    }
  }

  return {
    canvases,
    currentCanvasId,
    currentCanvas,
    createCanvas,
    deleteCanvas,
    switchCanvas,
    updateCanvas,
    saveCanvasLeaferData,
    clearCanvasLeaferData,
    updateCanvasTransform,
  };
}
