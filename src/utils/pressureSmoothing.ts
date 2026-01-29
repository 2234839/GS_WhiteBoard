// ==================== 自适应平滑配置 ====================

/**
 * 默认压感平滑系数（指数移动平均的 alpha 值）
 * 范围 0-1，值越小平滑效果越强
 * 实际使用时会根据输入抖动程度动态调整
 */
export const DEFAULT_PRESSURE_SMOOTHING_ALPHA = 0.3;

/**
 * 默认位置平滑系数
 */
export const DEFAULT_POSITION_SMOOTHING_ALPHA = 0.3;

/**
 * 自适应平滑状态
 */
export interface AdaptiveSmoothingState {
  /** 最近N个点的压感值（用于计算方差） */
  pressureHistory: number[];
  /** 最大历史记录数量 */
  maxHistorySize: number;
  /** 上一次的压感值 */
  lastPressure: number;
}

/**
 * 初始化自适应平滑状态
 */
export function initAdaptiveSmoothingState(maxHistorySize: number = 5): AdaptiveSmoothingState {
  return {
    pressureHistory: [],
    maxHistorySize,
    lastPressure: 0.5,
  };
}

/**
 * 计算自适应压感平滑系数
 * 根据输入抖动程度（压感方差）动态调整平滑系数
 *
 * 策略：
 * - 抖动越大（方差大），alpha 越小（更平滑）
 * - 抖动越小（方差小），alpha 越大（保持响应性）
 *
 * @param state 平滑状态
 * @param currentPressure 当前压感值
 * @returns 自适应平滑系数 alpha（0-1）
 */
export function getAdaptivePressureAlpha(state: AdaptiveSmoothingState, currentPressure: number): number {
  // 更新历史记录
  state.pressureHistory.push(currentPressure);
  if (state.pressureHistory.length > state.maxHistorySize) {
    state.pressureHistory.shift();
  }

  // 如果历史记录不足，返回默认值
  if (state.pressureHistory.length < 3) {
    return DEFAULT_PRESSURE_SMOOTHING_ALPHA;
  }

  // 计算压感方差（衡量抖动程度）
  const mean = state.pressureHistory.reduce((sum, p) => sum + p, 0) / state.pressureHistory.length;
  const variance = state.pressureHistory.reduce((sum, p) => sum + (p - mean) ** 2, 0) / state.pressureHistory.length;

  /**
   * 根据方差动态调整 alpha
   * 方差 < 0.001：几乎无抖动，alpha = 0.4（高响应性）
   * 方差 0.001-0.005：轻微抖动，alpha = 0.3
   * 方差 0.005-0.01：中等抖动，alpha = 0.2
   * 方差 > 0.01：严重抖动，alpha = 0.1（强平滑）
   */
  let alpha: number;
  if (variance < 0.001) {
    alpha = 0.4;
  } else if (variance < 0.005) {
    alpha = 0.3;
  } else if (variance < 0.01) {
    alpha = 0.2;
  } else {
    alpha = 0.1;
  }

  return alpha;
}

// ==================== 绘制消抖优化配置 ====================

/**
 * 最小采样距离（像素）
 * 当两个点之间的距离小于此值时，忽略新点
 * 用于减少点位数量和防止抖动
 */
export const MIN_SAMPLING_DISTANCE = 3;

/**
 * 最小采样时间间隔（毫秒）
 * 当两个点之间的时间间隔小于此值时，忽略新点
 * 用于限制采样频率，减少计算量
 */
export const MIN_SAMPLING_INTERVAL = 8; // 约120fps

/**
 * 对压感值进行指数移动平均平滑处理
 * 这是专业绘图软件（如 OpenTabletDriver）使用的算法
 *
 * 指数移动平均的优点：
 * - 更新的值权重更大，响应更快
 * - 计算简单，不需要维护数组
 * - 内存效率高
 * - 在专业绘图软件中被广泛采用
 *
 * @param smoothed 上一次平滑后的值
 * @param current 当前原始压感值
 * @param alpha 平滑系数，越小平滑效果越强
 * @returns 平滑后的压感值
 */
export function exponentialMovingAverage(smoothed: number, current: number, alpha: number): number {
  // EMA 公式: new_value = alpha * current + (1 - alpha) * old_value
  return alpha * current + (1 - alpha) * smoothed;
}

/**
 * 线性插值函数
 * @param start 起始值
 * @param end 结束值
 * @param t 插值参数（0-1）
 * @returns 插值结果
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 计算两点之间的距离
 * @param x1 点1的X坐标
 * @param y1 点1的Y坐标
 * @param x2 点2的X坐标
 * @param y2 点2的Y坐标
 * @returns 距离
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 插值点信息
 */
export interface InterpolationPoint {
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 压感值 */
  pressure: number;
}

/**
 * 自适应压感插值配置
 */
export interface InterpolationConfig {
  /** 画笔基础粗细 */
  baseLineWidth: number;
  /** 压感是否启用 */
  pressureEnabled: boolean;
}

/**
 * 自适应压感插值函数
 * 根据实际数据动态决定是否插值以及插值点数量
 *
 * 自适应策略：
 * 1. 计算压感变化梯度（压感变化/距离）
 * 2. 计算实际线条粗细变化幅度（像素）
 * 3. 根据梯度、幅度、距离综合判断是否需要插值
 * 4. 动态计算插值点数量
 *
 * @param x1 起点X坐标
 * @param y1 起点Y坐标
 * @param pressure1 起点压感值
 * @param x2 终点X坐标
 * @param y2 终点Y坐标
 * @param pressure2 终点压感值
 * @param config 插值配置
 * @returns 插值点数组（不包括起点和终点）
 */
export function adaptiveInterpolatePressureTransition(
  x1: number,
  y1: number,
  pressure1: number,
  x2: number,
  y2: number,
  pressure2: number,
  config: InterpolationConfig
): InterpolationPoint[] {
  const { baseLineWidth, pressureEnabled } = config;

  // 如果压感未启用，不需要插值
  if (!pressureEnabled) {
    return [];
  }

  /** 压感差异的绝对值 */
  const pressureDiff = Math.abs(pressure2 - pressure1);

  // 如果压感差异很小，不需要插值
  if (pressureDiff < 0.01) {
    return [];
  }

  /** 两点之间的距离 */
  const dist = distance(x1, y1, x2, y2);

  // 如果距离太近（小于2像素），不需要插值
  if (dist < 2) {
    return [];
  }

  /**
   * 计算实际线条粗细变化（像素）
   * 公式：baseLineWidth * pressureDiff * 2.5
   * 2.5 是压感对粗细的影响系数（见 getBrushSize 函数）
   */
  const actualSizeChange = baseLineWidth * pressureDiff * 2.5;

  /**
   * 计算压感变化梯度（每像素的压感变化）
   */
  const pressureGradient = pressureDiff / dist;

  /**
   * 自适应判断：是否需要插值
   * 满足以下任一条件即插值：
   * 1. 实际粗细变化超过阈值（对任何画笔大小都有意义）
   * 2. 压感变化梯度超过阈值（每像素压感变化）
   *
   * 对于粗笔，降低插值门槛，确保更早触发插值
   */
  const sizeChangeThreshold = baseLineWidth > 30 ? 2 : 3;
  const gradientThreshold = baseLineWidth > 30 ? 0.015 : 0.02;
  const needsInterpolation = actualSizeChange > sizeChangeThreshold || pressureGradient > gradientThreshold;

  if (!needsInterpolation) {
    return [];
  }

  /**
   * 动态计算插值点数量
   * 考虑因素：
   * 1. 压感变化梯度：梯度越大，插值越密集
   * 2. 实际粗细变化：变化越大，插值越密集
   * 3. 距离：距离越远，可以插入更多点
   * 4. 画笔粗细：粗笔需要更密集的插值以掩盖边界
   *
   * 基础插值点数：根据梯度计算
   * 梯度 < 0.02：每 3-5 像素一个插值点
   * 梯度 0.02-0.05：每 2-3 像素一个插值点
   * 梯度 0.05-0.1：每 1-2 像素一个插值点
   * 梯度 > 0.1：每 0.5-1 像素一个插值点
   *
   * 粗笔（>30px）额外增加插值密度
   */
  const isThickBrush = baseLineWidth > 30;
  let basePoints: number;
  if (pressureGradient < 0.02) {
    basePoints = Math.max(isThickBrush ? 4 : 2, Math.floor(dist / (isThickBrush ? 3 : 5)));
  } else if (pressureGradient < 0.05) {
    basePoints = Math.max(isThickBrush ? 5 : 3, Math.floor(dist / (isThickBrush ? 2 : 2.5)));
  } else if (pressureGradient < 0.1) {
    basePoints = Math.max(isThickBrush ? 8 : 5, Math.floor(dist / (isThickBrush ? 1 : 1.5)));
  } else {
    basePoints = Math.max(isThickBrush ? 12 : 8, Math.floor(dist / (isThickBrush ? 0.5 : 0.8)));
  }

  /**
   * 根据实际粗细变化调整插值点数量
   * 变化越大，插值点越多
   * 粗笔使用更大的系数
   */
  const sizeFactor = Math.min(isThickBrush ? 3 : 2, Math.max(0.5, actualSizeChange / 5));
  const numPoints = Math.ceil(basePoints * sizeFactor);

  /** 插值点数组 */
  const points: InterpolationPoint[] = [];

  for (let i = 1; i < numPoints; i++) {
    /** 插值参数 t（0-1） */
    const t = i / numPoints;

    points.push({
      x: lerp(x1, x2, t),
      y: lerp(y1, y2, t),
      pressure: lerp(pressure1, pressure2, t),
    });
  }

  return points;
}

// ==================== 绘制消抖优化功能 ====================

/**
 * 绘制点信息（包含时间戳）
 */
export interface DrawingPoint {
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 压感值 */
  pressure: number;
  /** 时间戳（毫秒） */
  timestamp: number;
}

/**
 * 检查是否应该接受新的绘制点
 * 基于距离和时间间隔进行过滤，减少点位数量和抖动
 *
 * @param lastPoint 上一个点
 * @param newPoint 新点
 * @returns 是否应该接受新点
 */
export function shouldAcceptPoint(lastPoint: DrawingPoint, newPoint: DrawingPoint): boolean {
  /** 距离 */
  const dist = distance(lastPoint.x, lastPoint.y, newPoint.x, newPoint.y);

  /** 时间间隔 */
  const timeDiff = newPoint.timestamp - lastPoint.timestamp;

  // 如果距离和时间都未达到阈值，拒绝该点
  return dist >= MIN_SAMPLING_DISTANCE || timeDiff >= MIN_SAMPLING_INTERVAL;
}

/**
 * 对位置进行指数移动平均平滑
 * 用于减少位置抖动，使曲线更平滑
 *
 * @param lastX 上一次的X坐标
 * @param lastY 上一次的Y坐标
 * @param newX 新的X坐标
 * @param newY 新的Y坐标
 * @param alpha 平滑系数
 * @returns 平滑后的位置 {x, y}
 */
export function smoothPosition(
  lastX: number,
  lastY: number,
  newX: number,
  newY: number,
  alpha: number
): { x: number; y: number } {
  return {
    x: alpha * newX + (1 - alpha) * lastX,
    y: alpha * newY + (1 - alpha) * lastY,
  };
}
