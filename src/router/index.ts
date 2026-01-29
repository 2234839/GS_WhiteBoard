import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

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
 */
const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
