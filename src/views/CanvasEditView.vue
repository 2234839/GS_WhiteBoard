<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Whiteboard from '@/components/Whiteboard.vue';
import { useCanvasData } from '@/composables/useCanvasData';

const router = useRouter();
const route = useRoute();
const { canvases, switchCanvas } = useCanvasData();

/**
 * 从路由参数获取画布ID
 */
const canvasId = computed(() => route.params.id as string);

/**
 * 当前画布数据
 */
const canvasData = computed(() => canvases.value.find(c => c.id === canvasId.value));

/**
 * 返回画布列表
 */
function handleBackToList() {
  router.push('/canvases');
}

/**
 * 组件挂载时切换到当前画布
 */
onMounted(() => {
  if (canvasId.value) {
    switchCanvas(canvasId.value);
  }
});

/**
 * 监听画布变化，更新当前选中
 */
watch(canvasId, (newId) => {
  if (newId) {
    switchCanvas(newId);
  }
});
</script>

<template>
  <div class="canvas-edit-view">
    <div v-if="!canvasData" class="loading-state">
      <p>画布不存在或已被删除</p>
      <button class="back-btn" @click="handleBackToList">
        返回列表
      </button>
    </div>

    <template v-else>
      <Whiteboard
        :canvas-data="canvasData"
        :show-back-button="true"
        @back="handleBackToList"
      />
    </template>
  </div>
</template>

<style scoped>
.canvas-edit-view {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.back-btn {
  padding: 8px 16px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 16px;
}

.back-btn:hover {
  background: #40a9ff;
}
</style>
