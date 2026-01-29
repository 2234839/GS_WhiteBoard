<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useCanvasData } from '@/composables/useCanvasData';

const router = useRouter();
const { canvases, createCanvas, deleteCanvas, switchCanvas } = useCanvasData();

/**
 * 创建新画布并跳转到编辑页
 */
function handleCreateCanvas() {
  const newCanvas = createCanvas(`画布 ${canvases.value.length + 1}`);
  switchCanvas(newCanvas.id);
  router.push(`/canvas/${newCanvas.id}`);
}

/**
 * 打开画布
 */
function handleOpenCanvas(id: string) {
  switchCanvas(id);
  router.push(`/canvas/${id}`);
}

/**
 * 删除画布
 */
function handleDeleteCanvas(id: string, event: Event) {
  event.stopPropagation();
  if (confirm('确定要删除这个画布吗？')) {
    deleteCanvas(id);
  }
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes} 分钟前`;
  } else if (hours < 24) {
    return `${hours} 小时前`;
  } else if (days < 7) {
    return `${days} 天前`;
  } else {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
</script>

<template>
  <div class="canvas-list-view">
    <div class="header">
      <h1>我的画布</h1>
      <button class="create-btn" @click="handleCreateCanvas">
        + 新建画布
      </button>
    </div>

    <div v-if="canvases.length === 0" class="empty-state">
      <p>还没有画布，创建一个开始绘画吧！</p>
      <button class="create-btn large" @click="handleCreateCanvas">
        + 新建画布
      </button>
    </div>

    <div v-else class="canvas-grid">
      <div
        v-for="canvas in canvases"
        :key="canvas.id"
        class="canvas-card"
        @click="handleOpenCanvas(canvas.id)"
      >
        <div class="canvas-thumbnail">
          <div class="thumbnail-placeholder">
            <span>画布预览</span>
          </div>
        </div>
        <div class="canvas-info">
          <h3>{{ canvas.name }}</h3>
          <p class="time">更新于 {{ formatTime(canvas.updatedAt) }}</p>
        </div>
        <button class="delete-btn" @click="handleDeleteCanvas(canvas.id, $event)">
          删除
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-list-view {
  width: 100%;
  height: 100vh;
  padding: 40px;
  background: #f5f5f5;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 32px;
  font-weight: 600;
  color: #333;
}

.create-btn {
  padding: 12px 24px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.create-btn:hover {
  background: #40a9ff;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  color: #999;
}

.empty-state p {
  font-size: 18px;
  margin-bottom: 20px;
}

.create-btn.large {
  font-size: 18px;
  padding: 16px 32px;
}

.canvas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.canvas-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}

.canvas-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.canvas-thumbnail {
  width: 100%;
  height: 200px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-placeholder {
  color: #999;
  font-size: 14px;
}

.canvas-info {
  padding: 16px;
}

.canvas-info h3 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.time {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.delete-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  background: rgba(255, 77, 79, 0.9);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.canvas-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #ff4d4f;
}
</style>
