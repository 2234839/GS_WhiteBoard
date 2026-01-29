import { ref, type Ref } from 'vue';
import type { Leafer } from 'leafer-ui';
import type { ToolConfig } from '@/types';

/**
 * 画布触控手势状态
 */
interface TouchGestureState {
  /** 触控指针的初始位置 Map<pointerId, {x, y}> */
  touchStartPositions: Ref<Map<number, { x: number; y: number }>>;
  /** 触控开始时的画布状态 */
  touchStartCanvasState: Ref<{ scale: number; offsetX: number; offsetY: number } | null>;
}

/**
 * 画布手势处理的 composable
 * 提供触控手势识别、画布平移和缩放、坐标转换等功能
 */
export function useCanvasGestures(
  canvasRef: Ref<HTMLDivElement | null>,
  leaferInstance: Ref<Leafer | null>,
  toolConfig: Ref<ToolConfig>
) {
  /** 触控指针的初始位置 */
  const touchStartPositions = ref<Map<number, { x: number; y: number }>>(new Map());
  /** 触控开始时的画布状态 */
  const touchStartCanvasState = ref<{ scale: number; offsetX: number; offsetY: number } | null>(null);

  /**
   * 将客户端坐标转换为画布本地坐标
   * 考虑画布的平移和缩放变换
   */
  function clientToCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    if (!canvasRef.value || !leaferInstance.value) {
      return { x: clientX, y: clientY };
    }

    const rect = canvasRef.value.getBoundingClientRect();
    const leafer = leaferInstance.value;

    // 考虑画布的平移和缩放
    // localX = (clientX - rect.left - leafer.x) / leafer.scaleX
    const scale = leafer.scaleX || 1;
    const x = (clientX - rect.left - (leafer.x || 0)) / scale;
    const y = (clientY - rect.top - (leafer.y || 0)) / scale;

    return { x, y };
  }

  /**
   * 处理触控手势开始
   */
  function handleTouchStart(e: PointerEvent) {
    // 只在触摸绘制关闭时处理手势
    if (e.pointerType !== 'touch' || toolConfig.value.touchDrawingEnabled) return;

    const rect = canvasRef.value?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 记录触控点位置
    touchStartPositions.value.set(e.pointerId, { x, y });

    // 如果是第一个触控点，记录当前画布状态
    if (touchStartPositions.value.size === 1 && leaferInstance.value) {
      touchStartCanvasState.value = {
        scale: leaferInstance.value.scaleX || 1,
        offsetX: leaferInstance.value.x || 0,
        offsetY: leaferInstance.value.y || 0,
      };
    }
  }

  /**
   * 处理触控手势移动
   */
  function handleTouchMove(e: PointerEvent) {
    // 只在触摸绘制关闭时处理手势
    if (e.pointerType !== 'touch' || toolConfig.value.touchDrawingEnabled) return;
    if (!leaferInstance.value || !touchStartCanvasState.value) return;

    const rect = canvasRef.value?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const startPos = touchStartPositions.value.get(e.pointerId);

    if (!startPos) return;

    const touches = Array.from(touchStartPositions.value.entries());

    if (touches.length === 1) {
      // 单指拖动 - 平移画布
      const deltaX = x - startPos.x;
      const deltaY = y - startPos.y;

      leaferInstance.value.x = touchStartCanvasState.value.offsetX + deltaX;
      leaferInstance.value.y = touchStartCanvasState.value.offsetY + deltaY;
    } else if (touches.length === 2 && e.pointerId === touches[1][0]) {
      // 双指缩放 - 使用第二个触控点计算
      const touch1 = touches[0][1];
      const touch2 = touches[1][1];

      // 计算初始距离
      const initialDistance = Math.sqrt(
        Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2)
      );

      // 计算当前距离
      const currentDistance = Math.sqrt(
        Math.pow(x - touch1.x, 2) + Math.pow(y - touch1.y, 2)
      );

      if (initialDistance > 0) {
        // 计算缩放比例
        const scaleRatio = currentDistance / initialDistance;
        const newScale = touchStartCanvasState.value.scale * scaleRatio;

        // 限制缩放范围（0.1-10倍）
        const clampedScale = Math.max(0.1, Math.min(10, newScale));

        leaferInstance.value.scaleX = clampedScale;
        leaferInstance.value.scaleY = clampedScale;
      }
    }
  }

  /**
   * 处理触控手势结束
   */
  function handleTouchEnd(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;

    // 移除该触控点
    touchStartPositions.value.delete(e.pointerId);

    // 如果所有触控点都已释放，重置状态
    if (touchStartPositions.value.size === 0) {
      touchStartCanvasState.value = null;
    }
  }

  return {
    touchStartPositions,
    touchStartCanvasState,
    clientToCanvasCoordinates,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
