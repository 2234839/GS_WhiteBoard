<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import type { ToolType } from '@/types';

  /**
   * Props 定义
   */
  interface Props {
    /** 当前工具类型 */
    toolType: ToolType;
    /** 是否显示（只在压感笔模式且橡皮擦状态显示） */
    visible?: boolean;
  }

  withDefaults(defineProps<Props>(), {
    visible: true,
  });

  /** 光标位置 */
  const cursorPosition = ref({ x: 0, y: 0 });

  /**
   * 更新光标位置
   */
  function updateCursorPosition(e: PointerEvent) {
    cursorPosition.value = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  // 监听全局指针移动，更新光标位置
  onMounted(() => {
    window.addEventListener('pointermove', updateCursorPosition);
  });

  onUnmounted(() => {
    window.removeEventListener('pointermove', updateCursorPosition);
  });
</script>

<template>
  <div
    v-if="visible && toolType === 'eraser'"
    class="custom-cursor cursor-eraser"
    :style="{
      left: cursorPosition.x + 'px',
      top: cursorPosition.y + 'px',
    }"
  ></div>
</template>

<style scoped>
  .custom-cursor {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%);
    transition: none;
  }

  .cursor-eraser::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(0, 0, 0, 0.8);
    background-color: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
  }
</style>
