<script setup lang="ts">
  import { ref, onUnmounted, watch } from 'vue';
  import { useRafFn, useThrottleFn } from '@vueuse/core';
  import type { Leafer, Group } from 'leafer-ui';
  import { Pen } from 'leafer-ui';
  import { useIdleCallback } from '../utils/useIdleCallback';
  import { useLogControl } from '../composables/useLogControl';

  /** 性能数据接口 */
  interface PerformanceData {
    /** 总元素数量 */
    totalElements: number;
    /** 路径数量 */
    pathCount: number;
    /** 帧率 */
    fps: number;
    /** 上次更新时间 */
    lastUpdateTime: number;
  }

  /** Props */
  interface Props {
    /** 是否启用性能监控 */
    enabled: boolean;
    /** Leafer 实例 */
    leaferInstance?: Leafer | null;
    /** 主容器 Group */
    mainGroup?: Group | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    enabled: false,
    leaferInstance: null,
    mainGroup: null,
  });

  /** 日志控制对象 */
  const logEnable = useLogControl();

  /** 性能数据 */
  const performanceData = ref<PerformanceData>({
    totalElements: 0,
    pathCount: 0,
    fps: 0,
    lastUpdateTime: 0,
  });

  /** FPS 计算相关 */
  const frameCount = ref(0);
  const lastFpsUpdateTime = ref(0);

  /**
   * 更新性能数据（节流版本，每 1000ms 最多执行一次）
   */
  const updatePerformanceData = useThrottleFn(() => {
    if (!props.leaferInstance || !props.mainGroup) {
      logEnable.performanceMonitor && console.warn('[性能监控] 实例未准备好，跳过更新');
      return;
    }

    // 计算总元素数量（Leafer 元素数量）
    const totalElements = (props.leaferInstance.children as unknown[] | undefined)?.reduce(
      (count: number, child: unknown) => {
        const childWithChildren = child as { children?: unknown[] | null };
        return count + 1 + (childWithChildren.children?.length || 0);
      },
      0
    ) ?? 0;

    // 计算路径数量（只计算 mainGroup 中的 Pen 对象）
    const pathCount = (props.mainGroup.children as unknown[] | undefined)?.filter(
      (child): child is Pen => child instanceof Pen
    ).length ?? 0;

    logEnable.performanceMonitor && console.log('[性能监控] 性能数据更新:', {
      totalElements,
      pathCount,
      mainGroupChildren: props.mainGroup.children?.length,
    });

    performanceData.value.totalElements = totalElements;
    performanceData.value.pathCount = pathCount;
    performanceData.value.lastUpdateTime = Date.now();
  }, 1000);

  /**
   * 使用 useRafFn 更新 FPS
   */
  const { pause: pauseRaf, resume: resumeRaf } = useRafFn(() => {
    frameCount.value++;
    const now = performance.now();

    // 每 1000ms 更新一次 FPS
    if (now - lastFpsUpdateTime.value >= 1000) {
      performanceData.value.fps = Math.round((frameCount.value * 1000) / (now - lastFpsUpdateTime.value));
      frameCount.value = 0;
      lastFpsUpdateTime.value = now;
    }
  }, {
    immediate: false,
  });

  /**
   * 使用 useIdleCallback 在主线程空闲时更新性能数据
   */
  const { pause: pauseIdleCallback, resume: resumeIdleCallback } = useIdleCallback(() => {
    if (props.enabled) {
      updatePerformanceData();
    }
  });

  /**
   * 启动性能监控
   */
  function startPerformanceMonitor() {
    logEnable.performanceMonitor && console.log('[性能监控] 启动性能监控');

    // 重置 FPS 相关
    frameCount.value = 0;
    lastFpsUpdateTime.value = performance.now();

    // 启动 FPS 计算
    resumeRaf();

    // 启动空闲时更新性能数据
    resumeIdleCallback();
  }

  /**
   * 停止性能监控
   */
  function stopPerformanceMonitor() {
    logEnable.performanceMonitor && console.log('[性能监控] 停止性能监控');
    pauseRaf();
    pauseIdleCallback();
  }

  /**
   * 监听启用状态变化
   */
  watch(
    () => props.enabled,
    (newValue) => {
      logEnable.performanceMonitor && console.log('[性能监控] enabled 状态变化:', newValue);
      if (newValue) {
        startPerformanceMonitor();
      } else {
        stopPerformanceMonitor();
      }
    },
    { immediate: true } // 立即执行，确保组件初始化时正确设置状态
  );

  /**
   * 监听 leaferInstance 和 mainGroup 的变化
   * 当实例准备好时，立即更新性能数据
   */
  watch(
    [() => props.leaferInstance, () => props.mainGroup],
    ([newLeafer, newMainGroup]) => {
      logEnable.performanceMonitor && console.log('[性能监控] 实例变化:', {
        leaferInstance: !!newLeafer,
        mainGroup: !!newMainGroup,
        enabled: props.enabled,
      });
    }
  );

  // 组件卸载时清理
  onUnmounted(() => {
    stopPerformanceMonitor();
  });
</script>

<template>
  <div v-if="enabled" class="performance-monitor">
    <div class="performance-title">性能分析</div>
    <div class="performance-item">
      <span class="performance-label">总元素:</span>
      <span class="performance-value">{{ performanceData.totalElements }}</span>
    </div>
    <div class="performance-item">
      <span class="performance-label">路径数:</span>
      <span class="performance-value">{{ performanceData.pathCount }}</span>
    </div>
    <div class="performance-item">
      <span class="performance-label">FPS:</span>
      <span class="performance-value">{{ performanceData.fps }}</span>
    </div>
  </div>
</template>

<style scoped>
  .performance-monitor {
    position: absolute;
    top: 20px;
    right: 20px;
    padding: 8px 12px;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border-radius: 6px;
    font-size: 11px;
    pointer-events: none;
    min-width: 100px;
    backdrop-filter: blur(4px);
  }

  .performance-title {
    font-weight: bold;
    margin-bottom: 6px;
    font-size: 12px;
    color: #1890ff;
  }

  .performance-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .performance-label {
    color: rgba(255, 255, 255, 0.7);
    margin-right: 8px;
  }

  .performance-value {
    font-family: 'Courier New', monospace;
    font-weight: bold;
    color: #52c41a;
  }
</style>
