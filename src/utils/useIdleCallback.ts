import { ref, onUnmounted } from 'vue';

/**
 * RequestIdleCallback 的配置选项
 */
export interface UseIdleCallbackOptions {
  /**
   * 超时时间（毫秒）
   * 如果浏览器在此时间内未调用 idle callback，则强制执行
   * @default 3000
   */
  timeout?: number;

  /**
   * 窗口对象
   * @default globalThis.window
   */
  window?: Window;
}

/**
 * 使用 requestIdleCallback 的 Composable
 *
 * 在浏览器主线程空闲时执行回调函数
 * 如果浏览器不支持 requestIdleCallback，则使用 setTimeout 降级
 *
 * @param callback - 在空闲时执行的回调函数
 * @param options - 配置选项
 * @returns 控制对象
 *
 * @example
 * ```ts
 * const { pause, resume } = useIdleCallback(() => {
 *   console.log('主线程空闲，执行更新');
 *   updatePerformanceData();
 * });
 * ```
 */
export function useIdleCallback(callback: () => void, options: UseIdleCallbackOptions = {}) {
  const { timeout = 3000, window: win = globalThis.window } = options;

  /** 是否暂停 */
  const paused = ref(false);

  /** timeout ID（用于降级方案） */
  let timeoutId: number | null = null;

  /** requestIdleCallback ID */
  let idleCallbackId: number | null = null;

  /**
   * 执行回调
   */
  function executeCallback() {
    if (paused.value) return;

    try {
      callback();
    } finally {
      // 如果未暂停，继续安排下一次执行
      if (!paused.value) {
        schedule();
      }
    }
  }

  /**
   * 安排下一次执行
   */
  function schedule() {
    if (paused.value) return;

    // 清除之前的定时器
    if (timeoutId !== null) {
      win.clearTimeout(timeoutId);
      timeoutId = null;
    }

    // 检查是否支持 requestIdleCallback
    if ('requestIdleCallback' in win) {
      idleCallbackId = win.requestIdleCallback(
        () => {
          idleCallbackId = null;
          executeCallback();
        },
        { timeout },
      );
    } else {
      // 降级方案：使用 setTimeout
      timeoutId = setTimeout(() => {
        timeoutId = null;
        executeCallback();
      }, timeout);
    }
  }

  /**
   * 暂停
   */
  function pause() {
    paused.value = true;

    // 清除待执行的回调
    if (idleCallbackId !== null && 'cancelIdleCallback' in win) {
      win.cancelIdleCallback(idleCallbackId);
      idleCallbackId = null;
    }

    if (timeoutId !== null) {
      win.clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  /**
   * 恢复
   */
  function resume() {
    if (paused.value) {
      paused.value = false;
      schedule();
    }
  }

  /**
   * 立即执行一次
   */
  function flush() {
    pause();
    executeCallback();
  }

  // 组件卸载时清理
  onUnmounted(() => {
    pause();
  });

  return {
    pause,
    resume,
    flush,
  };
}
