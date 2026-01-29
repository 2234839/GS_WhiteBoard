<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCanvasData, type CanvasData } from '@/composables/useCanvasData';
import { Leafer, Group } from 'leafer-ui';
// 导入 export 插件（会自动注册）
import '@leafer-in/export';

const router = useRouter();
const { canvases, createCanvas, deleteCanvas, switchCanvas } = useCanvasData();

/**
 * 预览图 URL 映射（画布ID -> 预览图URL）
 */
const previewUrls = ref<Map<string, string>>(new Map());

/**
 * 为单个画布生成预览图
 */
async function generatePreview(canvas: CanvasData): Promise<string | null> {
  // 如果画布没有内容，返回 null
  if (!canvas.leaferData || canvas.leaferData.length === 0) {
    return null;
  }

  let leafer: Leafer | null = null;
  let group: Group | null = null;

  try {
    // 创建离屏 Leafer 实例用于生成预览图
    leafer = new Leafer();

    // 加载画布数据到 group
    const elementsData = canvas.leaferData;
    if (elementsData.length > 0) {
      group = new Group();
      for (const elementData of elementsData) {
        group.add(elementData);
      }
      leafer.add(group);

      // 直接导出 group，使用 trim 自动裁剪透明像素
      const result = await group.export('png', {
        blob: true,
        scale: 0.5, // 缩放比例，生成更清晰的缩略图
        trim: true, // 自动裁剪透明像素
        fill: 'white', // 背景填充白色
      });

      // 创建 object URL
      const blob = result.data as Blob;
      return URL.createObjectURL(blob);
    }

    return null;
  } catch (error) {
    console.error('生成预览图失败:', error);
    return null;
  } finally {
    // 确保销毁 Leafer 实例
    if (leafer) {
      leafer.destroy();
      leafer = null;
    }
  }
}

/**
 * 串行生成所有画布的预览图
 */
async function generateAllPreviews() {
  // 清理旧的预览图 URL
  for (const url of previewUrls.value.values()) {
    URL.revokeObjectURL(url);
  }
  previewUrls.value.clear();

  // 串行生成预览图
  for (const canvas of canvases.value) {
    const url = await generatePreview(canvas);
    if (url) {
      previewUrls.value.set(canvas.id, url);
    }
  }
}

/**
 * 组件挂载时生成预览图
 */
onMounted(() => {
  generateAllPreviews();
});

/**
 * 组件卸载时清理所有 object URL
 */
onUnmounted(() => {
  for (const url of previewUrls.value.values()) {
    URL.revokeObjectURL(url);
  }
  previewUrls.value.clear();
});

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
    // 清理对应的预览图 URL
    const url = previewUrls.value.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrls.value.delete(id);
    }
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
      <div class="header-actions">
        <a
          href="https://github.com/2234839/GS_WhiteBoard"
          target="_blank"
          rel="noopener noreferrer"
          class="github-star-btn"
        >
          <svg height="16" viewBox="0 0 16 16" width="16" class="github-icon">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          Star on GitHub
        </a>
        <button class="create-btn" @click="handleCreateCanvas">
          + 新建画布
        </button>
      </div>
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
          <img
            v-if="previewUrls.get(canvas.id)"
            :src="previewUrls.get(canvas.id)"
            :alt="canvas.name"
            class="thumbnail-image"
          />
          <div v-else class="thumbnail-placeholder">
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

.header-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.github-star-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #24292e;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
  text-decoration: none;
}

.github-star-btn:hover {
  background: #3b434a;
}

.github-icon {
  fill: currentColor;
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
  overflow: hidden;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: white;
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
