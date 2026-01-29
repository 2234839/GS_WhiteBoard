<script setup lang="ts">
  import type { ToolConfig, ToolType } from '../types';

  /**
   * Emits 定义
   */
  interface Emits {
    (e: 'clearCanvas'): void;
  }

  const emit = defineEmits<Emits>();

  /**
   * 使用 defineModel 定义双向绑定的工具配置
   * 父组件传入持久化的 toolConfig，自动实现双向绑定
   */
  const toolConfig = defineModel<ToolConfig>('toolConfig', { required: true });

  /**
   * 使用 defineModel 定义双向绑定的性能监控开关
   * 父组件传入持久化的 performanceMonitorEnabled，自动实现双向绑定
   */
  const performanceMonitorEnabled = defineModel<boolean>('performanceMonitorEnabled', {
    default: false,
  });

  /**
   * 切换工具类型
   */
  function setToolType(toolType: ToolType) {
    toolConfig.value.toolType = toolType;
  }

  /**
   * 切换触摸输入是否启用
   */
  function setTouchEnabled(enabled: boolean) {
    toolConfig.value.touchEnabled = enabled;
  }

  /**
   * 清空画布
   */
  function handleClearCanvas() {
    emit('clearCanvas');
  }
</script>

<template>
  <div class="toolbar">
    <button
      :class="['tool-btn', { active: toolConfig.toolType === 'pen' }]"
      @click="setToolType('pen' as ToolType)"
    >
      画笔
    </button>
    <button
      :class="['tool-btn', { active: toolConfig.toolType === 'eraser' }]"
      @click="setToolType('eraser' as ToolType)"
    >
      橡皮擦
    </button>
    <button
      :class="['tool-btn', { active: toolConfig.touchEnabled }]"
      @click="setTouchEnabled(!toolConfig.touchEnabled)"
      title="切换触摸输入"
    >
      触摸: {{ toolConfig.touchEnabled ? '开' : '关' }}
    </button>
    <button
      :class="['tool-btn', { active: performanceMonitorEnabled }]"
      @click="performanceMonitorEnabled = !performanceMonitorEnabled"
      title="切换性能分析"
    >
      性能
    </button>
    <button class="tool-btn" @click="handleClearCanvas">清空</button>
  </div>
</template>

<style scoped>
  .toolbar {
    position: absolute;
    top: 20px;
    left: 20px;
    display: flex;
    gap: 10px;
    padding: 10px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .tool-btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tool-btn:hover {
    background-color: #f5f5f5;
  }

  .tool-btn.active {
    background-color: #1890ff;
    color: white;
    border-color: #1890ff;
  }
</style>
