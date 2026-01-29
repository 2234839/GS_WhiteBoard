<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue';
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
  let frameCount = 0;
  let lastFpsUpdateTime = 0;
  let animationFrameId: number | null = null;

  /**
   * 更新性能数据
   */
  function updatePerformanceData() {
    if (!props.leaferInstance || !props.mainGroup) return;

    // 计算总元素数量（Leafer 元素数量）
    const totalElements = props.leaferInstance.children?.reduce((count, child) => {
      return count + 1 + (child.children?.length || 0);
    }, 0) || 0;

    // 计算路径数量（只计算 mainGroup 中的 Pen 对象）
    const pathCount = props.mainGroup.children?.filter(
      (child) => child instanceof Pen
    ).length || 0;

    performanceData.value.totalElements = totalElements;
    performanceData.value.pathCount = pathCount;
    performanceData.value.lastUpdateTime = Date.now();
  }

  /**
   * 更新 FPS
   */
  function updateFPS() {
    const now = performance.now();
    frameCount++;

    // 每 1000ms 更新一次 FPS
    if (now - lastFpsUpdateTime >= 1000) {
      performanceData.value.fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
      frameCount = 0;
      lastFpsUpdateTime = now;
    }

    // 继续下一帧
    if (props.enabled) {
      animationFrameId = requestAnimationFrame(updateFPS);
    }
  }

  /**
   * 在主线程空闲时更新性能数据
   */
  function schedulePerformanceUpdate() {
    if (!props.enabled) return;

    // 使用 requestIdleCallback 在主线程空闲时更新
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(
        () => {
          if (props.enabled) {
            updatePerformanceData();
            // 安排下一次更新
            schedulePerformanceUpdate();
          }
        },
        { timeout: 3000 } // 设置超时，确保至少每秒更新一次
      );
    } else {
      // 降级方案：使用 setTimeout 模拟
      setTimeout(() => {
        if (props.enabled) {
          updatePerformanceData();
          schedulePerformanceUpdate();
        }
      }, 500);
    }
  }

  /**
   * 启动性能监控
   */
  function startPerformanceMonitor() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    frameCount = 0;
    lastFpsUpdateTime = performance.now();

    // 启动 FPS 计算
    animationFrameId = requestAnimationFrame(updateFPS);

    // 启动性能数据更新（在主线程空闲时）
    schedulePerformanceUpdate();
  }

  /**
   * 停止性能监控
   */
  function stopPerformanceMonitor() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
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
