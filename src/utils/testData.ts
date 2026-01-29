import { Group, Pen } from 'leafer-ui';
import { useLogControl } from '@/composables/useLogControl';

/**
 * 绘制路径点
 */
interface DrawPoint {
  x: number;
  y: number;
  pressure?: number;
}

/**
 * 绘制路径配置
 */
interface DrawPathConfig {
  type: 'draw' | 'erase';
  color?: string;
  strokeWidth: number;
  eraserType?: 'pixel' | 'path';
  points: DrawPoint[];
}

/**
 * 生成平滑的路径点（模拟真实绘制）
 * @param start 起点
 * @param end 终点
 * @param segments 分段数量（越多越平滑）
 */
function generateSmoothPoints(start: DrawPoint, end: DrawPoint, segments: number = 20): DrawPoint[] {
  const points: DrawPoint[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      pressure: 0.5, // 默认压感
    });
  }

  return points;
}

/**
 * 创建一条绘制路径
 */
function createPath(mainGroup: Group, config: DrawPathConfig): void {
  const { type, color, strokeWidth, eraserType, points } = config;

  if (points.length < 2) return;

  const path = new Pen();
  path.setStyle({
    stroke: type === 'erase' ? 'rgba(0,0,0,1)' : color || '#000000',
    strokeWidth,
    strokeCap: 'round',
    strokeJoin: 'round',
  });

  if (type === 'erase' && eraserType) {
    path.eraser = eraserType;
  }

  // 移动到第一个点
  path.moveTo(points[0].x, points[0].y);

  // 依次连接所有点
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }

  mainGroup.add(path);
}

/**
 * 创建测试数据
 * @param mainGroup 主容器 Group
 * @param options 配置选项
 */
export function createTestData(
  mainGroup: Group,
  options: {
    /** 是否使用真实模拟（多小段，更接近实际绘制） */
    realistic?: boolean;
    /** 路径分段数量（realistic 模式下） */
    segments?: number;
  } = {}
): void {
  const { realistic = true, segments = 20 } = options;
  const logEnable = useLogControl();

  logEnable.testData && console.log('创建测试数据...');

  // 1. 红色线 (100,100) -> (300,100)
  const line1Points = realistic
    ? generateSmoothPoints({ x: 100, y: 100 }, { x: 300, y: 100 }, segments)
    : [{ x: 100, y: 100 }, { x: 300, y: 100 }];

  createPath(mainGroup, {
    type: 'draw',
    color: '#FF0000',
    strokeWidth: 10,
    points: line1Points,
  });
  logEnable.testData && console.log('✓ 红色线 (100,100) -> (300,100)');

  // 2. 蓝色线 (100,150) -> (300,150)
  const line2Points = realistic
    ? generateSmoothPoints({ x: 100, y: 150 }, { x: 300, y: 150 }, segments)
    : [{ x: 100, y: 150 }, { x: 300, y: 150 }];

  createPath(mainGroup, {
    type: 'draw',
    color: '#0000FF',
    strokeWidth: 10,
    points: line2Points,
  });
  logEnable.testData && console.log('✓ 蓝色线 (100,150) -> (300,150)');

  // 3. 橡皮擦竖线 - 应该擦除红色和蓝色线
  const eraser1Points = realistic
    ? generateSmoothPoints({ x: 150, y: 80 }, { x: 150, y: 170 }, segments)
    : [{ x: 150, y: 80 }, { x: 150, y: 170 }];

  createPath(mainGroup, {
    type: 'erase',
    strokeWidth: 30,
    eraserType: 'pixel',
    points: eraser1Points,
  });
  logEnable.testData && console.log('✓ 橡皮擦竖线 (150,80) -> (150,170)，应该擦除红色和蓝色线');

  // 4. 绿色线 (100,200) -> (300,200)
  const line3Points = realistic
    ? generateSmoothPoints({ x: 100, y: 200 }, { x: 300, y: 200 }, segments)
    : [{ x: 100, y: 200 }, { x: 300, y: 200 }];

  createPath(mainGroup, {
    type: 'draw',
    color: '#00FF00',
    strokeWidth: 10,
    points: line3Points,
  });
  logEnable.testData && console.log('✓ 绿色线 (100,200) -> (300,200)');

  // 5. 橡皮擦竖线 - 应该擦除绿色线
  const eraser2Points = realistic
    ? generateSmoothPoints({ x: 200, y: 180 }, { x: 200, y: 220 }, segments)
    : [{ x: 200, y: 180 }, { x: 200, y: 220 }];

  createPath(mainGroup, {
    type: 'erase',
    strokeWidth: 30,
    eraserType: 'pixel',
    points: eraser2Points,
  });
  logEnable.testData && console.log('✓ 橡皮擦竖线 (200,180) -> (200,220)，应该擦除绿色线');

  logEnable.testData && console.log('测试数据创建完成');
}

/**
 * 清空测试数据
 */
export function clearTestData(mainGroup: Group): void {
  const children = [...mainGroup.children];
  for (const child of children) {
    mainGroup.remove(child);
  }
  const logEnable = useLogControl();
  logEnable.testData && console.log('测试数据已清空');
}
