import { ref, watch, onUnmounted, type Ref } from 'vue';
import { useIdleCallback } from '@/utils/useIdleCallback';

/**
 * 闲时存储管理器
 *
 * 通过内存缓存 + 闲时写入机制，在浏览器空闲时才写入 localStorage
 * 避免阻塞主线程，提升绘制性能
 *
 * @example
 * ```ts
 * // 读取：立即从内存读取（首次从 localStorage）
 * const storage = useIdleStorage('my-key', { defaultValue: 'hello' });
 * console.log(storage.value); // 'hello'
 *
 * // 写入：立即更新内存，浏览器空闲时才写入 localStorage
 * storage.value = 'world'; // 内存立即更新，localStorage 延迟写入
 * ```
 */
export function useIdleStorage<T>(
  key: string,
  options: { defaultValue: T; timeout?: number; enabled?: boolean }
): Ref<T> {
  const {
    defaultValue,
    timeout = 2000,
    enabled = true,
  } = { ...options, timeout: options.timeout ?? 2000, enabled: options.enabled ?? true };

  // 从 localStorage 读取初始值（仅在初始化时执行一次）
  const readFromStorage = (): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`[IdleStorage] 读取 localStorage[${key}] 失败:`, error);
      return defaultValue;
    }
  };

  // 写入 localStorage
  const writeToStorage = (value: T) => {
    try {
      const startTime = performance.now();
      localStorage.setItem(key, JSON.stringify(value));
      const elapsed = performance.now() - startTime;
      if (elapsed > 10) {
        console.warn(`[IdleStorage] 写入 localStorage[${key}] 耗时 ${elapsed.toFixed(2)}ms，可能阻塞主线程`);
      }
    } catch (error) {
      console.error(`[IdleStorage] 写入 localStorage[${key}] 失败:`, error);
    }
  };

  // 创建响应式变量（初始值从 localStorage 读取）
  const state = ref<T>(readFromStorage());

  // 待写入的值
  let pendingValue: T | null = null;

  // 使用闲时回调执行写入
  const { schedule, flush } = useIdleCallback(
    () => {
      if (pendingValue !== null) {
        writeToStorage(pendingValue);
        pendingValue = null;
      }
    },
    { timeout, loop: false } // 按需调度，不循环
  );

  // 监听值变化，闲时写入
  watch(
    state,
    (newValue) => {
      pendingValue = newValue;
      if (enabled) {
        schedule(); // 调度闲时写入
      } else {
        // 如果禁用闲时写入，立即写入
        writeToStorage(newValue);
        pendingValue = null;
      }
    },
    { deep: true }
  );

  // 组件卸载时立即写入（确保数据不丢失）
  onUnmounted(() => {
    if (pendingValue !== null) {
      flush(); // 立即执行待写入的数据
    }
  });

  return state as Ref<T>;
}

