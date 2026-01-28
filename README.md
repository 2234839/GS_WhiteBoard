# GS Whiteboard - 压感笔白板应用

基于 Vue3 + LeaferJS + TypeScript + Vite 构建的专业白板应用，支持压感笔和橡皮擦功能。

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **LeaferJS** - 高性能 Canvas 2D 图形渲染引擎
- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 下一代前端构建工具

## 核心功能

### ✨ 压感笔支持
- 支持压感笔的 `pressure` 属性（0-1 范围）
- 根据压感动态调整线条粗细
- 可配置压感影响系数
- 自动识别 `pointerType: 'pen'`

### 🧽 橡皮擦功能
- 支持 `path` 模式 - 高性能路径擦除
- 支持 `pixel` 模式 - 像素级擦除
- 可调节橡皮擦大小

### 🎨 绘图工具
- 画笔/橡皮擦快速切换
- 自定义画笔颜色
- 可调节画笔粗细（1-50px）
- 一键清空画布

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm run dev
```

访问 http://localhost:3000 查看应用

### 构建生产版本

```bash
pnpm run build
```

### 预览生产构建

```bash
pnpm run preview
```

## 项目结构

```
src/
├── components/
│   └── Whiteboard.vue      # 主白板组件
├── types/
│   └── index.ts            # TypeScript 类型定义
├── App.vue                 # 根组件
├── main.ts                 # 应用入口
└── vite-env.d.ts          # Vite 环境类型声明
```

## 核心实现

### 压感笔绘图

```typescript
// 根据压感动态调整线宽
const dynamicLineWidth = baseLineWidth * (1 + e.pressure * pressureFactor)
currentPath.setStyle({
  lineWidth: dynamicLineWidth
})
```

### 橡皮擦实现

```typescript
const eraser = new Pen()
eraser.setStyle({
  stroke: '#ffffff',
  lineWidth: size,
  eraser: 'path' // 或 'pixel'
})
```

## 压感笔 API

LeaferJS PointerEvent 提供的压感相关属性：

- **pressure**: number - 按压力值，范围 0 ~ 1
- **tangentialPressure**: number - 切向压力，范围 -1 ~ 1（仅 pen 类型）
- **tiltX**: number - 笔绕 X 轴倾斜角度，范围 -90 ~ 90
- **tiltY**: number - 笔绕 Y 轴倾斜角度，范围 -90 ~ 90
- **twist**: number - 笔绕主轴旋转角度，范围 0 ~ 359

## 浏览器兼容性

需要支持 ES2015+ 语法和 Pointer Events API：

- Chrome >= 51
- Firefox >= 53
- Safari >= 10
- Edge >= 79
- Opera >= 36

## 开发建议

1. **压感笔测试**：建议使用 Wacom、Apple Pencil 或支持压感的触摸屏设备
2. **性能优化**：大量绘图时建议使用 `path` 模式橡皮擦
3. **类型安全**：所有组件都使用 TypeScript 编写，提供完整的类型提示

## 许可证

MIT

## 参考资源

- [LeaferJS 官方文档](https://www.leaferjs.com/)
- [Vue 3 文档](https://cn.vuejs.org/)
- [Pointer Events API](https://developer.mozilla.org/zh-CN/docs/Web/API/Pointer_events)
