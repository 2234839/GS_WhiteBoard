import { useStorage, toReactive } from '@vueuse/core';

/**
 * 日志类别元数据
 */
interface LogCategoryMeta {
  /** 显示名称 */
  label: string;
  /** 描述信息 */
  description: string;
  /** 默认开启状态 */
  defaultEnabled: boolean;
}

/**
 * 日志类别配置
 *
 * 所有日志类别在此定义，添加新日志类别时只需在此添加配置即可
 */
export const LOG_CATEGORIES = {
  performanceMonitor: {
    label: '性能监控日志',
    description: '记录性能相关的监控数据',
    defaultEnabled: false,
  },
  drawEvent: {
    label: '绘制事件日志',
    description: '记录绘制相关的事件',
    defaultEnabled: false,
  },
  penEvent: {
    label: '压感笔日志',
    description: '记录压感笔相关的事件',
    defaultEnabled: false,
  },
  testData: {
    label: '测试数据日志',
    description: '记录测试数据相关信息',
    defaultEnabled: false,
  },
  undoRedo: {
    label: '撤销重做性能日志',
    description: '记录撤销重做相关的性能数据',
    defaultEnabled: true,
  },
} satisfies Record<string, LogCategoryMeta>;

/**
 * 日志开关配置类型
 * 根据配置对象自动推导
 */
export type LogEnableConfig = {
  [K in keyof typeof LOG_CATEGORIES]: boolean;
};

/**
 * 根据配置生成默认日志开关配置
 */
function getDefaultLogConfig(): LogEnableConfig {
  const config = {} as LogEnableConfig;

  for (const key in LOG_CATEGORIES) {
    config[key as keyof typeof LOG_CATEGORIES] = LOG_CATEGORIES[key as keyof typeof LOG_CATEGORIES].defaultEnabled;
  }

  return config;
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
 * // 使用日志控制（直接访问属性，不需要 .value）
 * logEnable.performanceMonitor && console.log('[性能监控]', data);
 * logEnable.drawEvent && console.log('[绘制事件]', event);
 * ```
 */
export function useLogControl() {
  /** 从 localStorage 读取日志配置，使用配置对象生成的默认值 */
  const config = useStorage<LogEnableConfig>(
    'whiteboard-log-config',
    getDefaultLogConfig(),
    localStorage,
    { mergeDefaults: true }
  );

  /** 使用 toReactive 将 Ref 转换为响应式对象，同时保持响应性 */
  return toReactive<LogEnableConfig>(config);
}
