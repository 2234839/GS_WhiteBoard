import { useStorage } from '@vueuse/core';
import { reactive } from 'vue';

/**
 * 日志开关配置
 */
interface LogEnableConfig {
  /** 性能监控日志 */
  performanceMonitor: boolean;
  /** 绘制事件日志 */
  drawEvent: boolean;
  /** 压感笔日志 */
  penEvent: boolean;
}

/**
 * 日志控制 Composable
 *
 * 提供全局日志开关控制，所有开关持久化到 localStorage
 *
 * @example
 * ```ts
 * const logEnable = useLogControl();
 *
 * // 使用日志控制
 * logEnable.performanceMonitor && console.log('[性能监控]', data);
 * logEnable.drawEvent && console.log('[绘制事件]', event);
 * ```
 */
export function useLogControl() {
  /** 从 localStorage 读取日志配置，默认全部关闭 */
  const config = useStorage<LogEnableConfig>('whiteboard-log-config', {
    performanceMonitor: false,
    drawEvent: false,
    penEvent: false,
  }, localStorage, { mergeDefaults: true });

  /** 返回 reactive 对象，方便使用 */
  return reactive(config);
}
