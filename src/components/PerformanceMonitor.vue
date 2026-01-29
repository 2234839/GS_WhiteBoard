<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue';
  import { useInterval, useRafFn } from '@vueuse/core';
  import type { Leafer, Group } from 'leafer-ui';
  import { Pen } from 'leafer-ui';

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
   * 更新性能数据
   */
  function updatePerformanceData() {
    console.log('[性能监控] 开始更新性能数据...', {
      leaferInstance: !!props.leaferInstance,
      mainGroup: !!props.mainGroup,
      enabled: props.enabled,
    });

    if (!props.leaferInstance || !props.mainGroup) {
      console.warn('[性能监控] 实例未准备好，跳过更新');
      return;
    }

    // 计算总元素数量（Leafer 元素数量）
    const totalElements = props.leaferInstance.children?.reduce((count, child) => {
      return count + 1 + (child.children?.length || 0);
    }, 0) || 0;

    // 计算路径数量（只计算 mainGroup 中的 Pen 对象）
    const pathCount = props.mainGroup.children?.filter(
      (child) => child instanceof Pen
    ).length || 0;

    console.log('[性能监控] 性能数据更新:', {
      totalElements,
      pathCount,
      mainGroupChildren: props.mainGroup.children?.length,
    });

    performanceData.value.totalElements = totalElements;
    performanceData.value.pathCount = pathCount;
    performanceData.value.lastUpdateTime = Date.now();
  }

  /**
   * 使用 useRafFn 更新 FPS
   */
  const { pause: pauseRaf, resume: resumeRaf } = useRafFn(() => {
    frameCount.value++;
    const now = performance.now();

    // 每 1000ms 更新一次 FPS
    if (now - lastFpsUpdateTime.value >= 1000) {
      performanceData.value.fps = Math.round((frameCount.value * 1000) / (now - lastFpsUpdateTime.value));
      console.log('[性能监控] FPS 更新:', performanceData.value.fps);
      frameCount.value = 0;
      lastFpsUpdateTime.value = now;
    }
  }, {
    immediate: false,
  });

  /**
   * 使用 useInterval 定期更新性能数据（每秒更新一次）
   * useInterval 会自动运行，我们在 callback 中判断是否需要更新
   */
  useInterval(1000, {
    callback: () => {
      if (props.enabled) {
        updatePerformanceData();
      }
    },
  });

  /**
   * 启动性能监控
   */
  function startPerformanceMonitor() {
    console.log('[性能监控] 启动性能监控');

    // 重置 FPS 相关
    frameCount.value = 0;
    lastFpsUpdateTime.value = performance.now();

    // 启动 FPS 计算
    resumeRaf();

    // 立即更新一次性能数据，确保开启时能立即显示
    updatePerformanceData();
  }

  /**
   * 停止性能监控
   */
  function stopPerformanceMonitor() {
    console.log('[性能监控] 停止性能监控');
    pauseRaf();
  }

  /**
   * 监听启用状态变化
   */
  watch(
    () => props.enabled,
    (newValue) => {
      if (newValue) {
        startPerformanceMonitor();
      } else {
        stopPerformanceMonitor();
      }
    }
  );

  /**
   * 监听 leaferInstance 和 mainGroup 的变化
   * 当实例准备好时，立即更新性能数据
   */
  watch(
    [() => props.leaferInstance, () => props.mainGroup],
    () => {
      if (props.enabled && props.leaferInstance && props.mainGroup) {
        updatePerformanceData();
      }
    }
  );

  // 组件挂载时启动监控
  onMounted(() => {
    if (props.enabled) {
      startPerformanceMonitor();
    }
  });

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
