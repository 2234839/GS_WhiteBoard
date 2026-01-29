import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

/**
 * 路由配置
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    redirect: '/canvases',
  },
  {
    path: '/canvases',
    name: 'canvas-list',
    component: () => import('@/views/CanvasListView.vue'),
  },
  {
    path: '/canvas/:id',
    name: 'canvas-edit',
    component: () => import('@/views/CanvasEditView.vue'),
    props: true,
  },
];

/**
 * 创建路由实例
 * 使用 Hash 模式以支持 GitHub Pages 部署
 * GitHub Pages 不支持 SPA 的 History 模式
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
