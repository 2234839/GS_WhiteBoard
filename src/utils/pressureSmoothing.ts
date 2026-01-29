/**
 * 压感平滑系数（指数移动平均的 alpha 值）
 * 范围 0-1，值越小平滑效果越强
 * 参考 OpenTabletDriver 的推荐值：0.1-0.3
 */
export const PRESSURE_SMOOTHING_ALPHA = 0.2;

/**
 * 压感变化插值阈值
 * 当两个点之间的压感差异超过此值时，进行插值处理
 */
export const PRESSURE_INTERPOLATION_THRESHOLD = 0.1;

/**
 * 插值点之间的最小距离（像素）
 * 避免生成过于密集的插值点
 */
export const MIN_INTERPOLATION_DISTANCE = 5;

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
 * 位置平滑系数（指数移动平均的 alpha 值）
 * 用于平滑位置的抖动，范围 0-1
 * 值越小平滑效果越强，但响应越慢
 * 0.3 是较好的平衡点
 */
export const POSITION_SMOOTHING_ALPHA = 0.3;

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
 * 当压感变化不连续时，生成插值点以实现平滑过渡
 * 这个函数解决了压感突变导致的线条粗细跳变问题
 *
 * @param x1 起点X坐标
 * @param y1 起点Y坐标
 * @param pressure1 起点压感值
 * @param x2 终点X坐标
 * @param y2 终点Y坐标
 * @param pressure2 终点压感值
 * @returns 插值点数组（不包括起点和终点）
 */
export function interpolatePressureTransition(
  x1: number,
  y1: number,
  pressure1: number,
  x2: number,
  y2: number,
  pressure2: number
): InterpolationPoint[] {
  /** 压感差异的绝对值 */
  const pressureDiff = Math.abs(pressure2 - pressure1);

  // 如果压感差异小于阈值，不需要插值
  if (pressureDiff < PRESSURE_INTERPOLATION_THRESHOLD) {
    return [];
  }

  /** 两点之间的距离 */
  const dist = distance(x1, y1, x2, y2);

  // 如果距离太近，不需要插值
  if (dist < MIN_INTERPOLATION_DISTANCE) {
    return [];
  }

  /**
   * 根据压感差异和距离计算插值点数量
   * 压感差异越大，插值点越多
   * 距离越远，可以插入更多的点
   */
  const numPoints = Math.ceil(Math.max(pressureDiff * 10, dist / MIN_INTERPOLATION_DISTANCE));

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
