/**
 * 工具类型枚举
 */
export enum ToolType {
  PEN = 'pen',
  ERASER = 'eraser'
}

/**
 * 橡皮擦类型
 */
export type EraserType = 'path' | 'pixel'

/**
 * 画笔配置
 */
export interface BrushConfig {
  /** 笔触颜色 */
  color: string
  /** 基础线条宽度 */
  baseLineWidth: number
  /** 是否启用压感 */
  pressureEnabled: boolean
  /** 压感影响系数（0-1） */
  pressureFactor: number
  /** 是否启用智能平滑（压感平滑+插值优化） */
  smartSmoothingEnabled: boolean
}

/**
 * 橡皮擦配置
 */
export interface EraserConfig {
  /** 橡皮擦类型 */
  type: EraserType
  /** 橡皮擦大小 */
  size: number
}

/**
 * 工具配置
 */
export interface ToolConfig {
  /** 当前工具类型 */
  toolType: ToolType
  /** 画笔配置 */
  brush: BrushConfig
  /** 橡皮擦配置 */
  eraser: EraserConfig
  /** 是否启用触摸输入（手指） */
  touchEnabled: boolean
}
