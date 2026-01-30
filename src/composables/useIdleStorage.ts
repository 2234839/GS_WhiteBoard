import { ref, computed, type Ref } from 'vue';
import { createGlobalState, tryOnUnmounted } from '@vueuse/core';
import { useIdleCallback } from '@/utils/useIdleCallback';

/**
 * 全局状态工厂缓存
 * 为每个 key 创建一个全局状态工厂，确保同一个 key 返回同一个 ref 实例
 */
const globalStateFactories = new Map<string, () => Ref<any>>();

/**
 * 闲时存储管理器
 *
 * 通过内存缓存 + 闲时写入机制，在浏览器空闲时才写入 localStorage
 * 避免阻塞主线程，提升绘制性能
 *
 * 使用 createGlobalState 确保同一个 key 返回同一个 ref 实例，
 * 避免多个组件读写不一致导致的数据覆盖问题
 *
 * @example
 * ```ts
 * // 读取：立即从内存读取（首次从 localStorage）
 * const storage = useIdleStorage('my-key', { defaultValue: 'hello' });
 * console.log(storage.value); // 'hello'
 *
 * // 写入：立即更新内存，浏览器空闲时才写入 localStorage
 * storage.value = 'world'; // 内存立即更新，localStorage 延迟写入
 *
 * // 多个组件使用同一个 key 时，返回同一个 ref 实例
 * const storage1 = useIdleStorage('shared-key', { defaultValue: 123 });
 * const storage2 = useIdleStorage('shared-key', { defaultValue: 456 });
 * console.log(storage1 === storage2); // true
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

  /**
   * 从 localStorage 读取初始值（仅在初始化时执行一次）
   */
  const readFromStorage = (): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`[IdleStorage] 读取 localStorage[${key}] 失败:`, error);
      return defaultValue;
    }
  };

  /**
   * 写入 localStorage
   */
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

  /**
   * 为该 key 创建全局状态工厂（如果不存在）
   * 使用 createGlobalState 确保所有调用返回同一个 ref 实例
   */
  if (!globalStateFactories.has(key)) {
    const stateFactory = createGlobalState(() => {
      /** 内部状态存储 */
      const internalState = ref<T>(readFromStorage());

      /** 待写入的值 */
      let pendingValue: T | null = null;

      /** 使用闲时回调执行写入 */
      const { schedule, flush } = useIdleCallback(
        () => {
          if (pendingValue !== null) {
            writeToStorage(pendingValue);
            pendingValue = null;
          }
        },
        { timeout, loop: false } // 按需调度，不循环
      );

      /** 使用可写 computed 替代 ref + watch，更简洁 */
      const state = computed<T>({
        get: () => internalState.value,
        set: (newValue) => {
          internalState.value = newValue;
          pendingValue = newValue;
          if (enabled) {
            schedule(); // 调度闲时写入
          } else {
            // 如果禁用闲时写入，立即写入
            writeToStorage(newValue);
            pendingValue = null;
          }
        }
      });

      /** 组件卸载时立即写入（确保数据不丢失） */
      tryOnUnmounted(() => {
        if (pendingValue !== null) {
          flush(); // 立即执行待写入的数据
        }
      });

      return state as Ref<T>;
    });

    globalStateFactories.set(key, stateFactory);
  }

  /**
   * 调用全局状态工厂，返回该 key 的全局 ref 实例
   */
  return globalStateFactories.get(key)!() as Ref<T>;
}

