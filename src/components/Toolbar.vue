<script setup lang="ts">
  import { ref } from 'vue';
  import type { ToolConfig, ToolType } from '../types';
  import { useLogControl } from '../composables/useLogControl';

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

  /** 日志控制对象 */
  const logEnable = useLogControl();

  /** 日志控制面板是否展开 */
  const logPanelExpanded = ref(false);

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

  /**
   * 切换日志控制面板展开状态
   */
  function toggleLogPanel() {
    logPanelExpanded.value = !logPanelExpanded.value;
  }
</script>

<template>
  <div class="toolbar-container">
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
      <button
        :class="['tool-btn', { active: logPanelExpanded }]"
        @click="toggleLogPanel"
        title="日志控制"
      >
        日志
        <span :class="['arrow-icon', { expanded: logPanelExpanded }]">▼</span>
      </button>
      <button class="tool-btn" @click="handleClearCanvas">清空</button>
    </div>

    <!-- 日志控制面板 -->
    <div v-if="logPanelExpanded" class="log-panel">
      <div class="log-panel-title">日志控制</div>
      <div class="log-panel-item">
        <input
          id="log-performance"
          type="checkbox"
          v-model="logEnable.performanceMonitor"
        />
        <label for="log-performance">性能监控日志</label>
      </div>
      <div class="log-panel-item">
        <input
          id="log-draw"
          type="checkbox"
          v-model="logEnable.drawEvent"
        />
        <label for="log-draw">绘制事件日志</label>
      </div>
      <div class="log-panel-item">
        <input
          id="log-pen"
          type="checkbox"
          v-model="logEnable.penEvent"
        />
        <label for="log-pen">压感笔日志</label>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .toolbar-container {
    position: absolute;
    top: 20px;
    left: 20px;
  }

  .toolbar {
    display: flex;
    gap: 10px;
    padding: 10px;
    background-color: white;
    border-radius: 8px 8px 0 0;
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

  .arrow-icon {
    display: inline-block;
    margin-left: 6px;
    font-size: 10px;
    transition: transform 0.3s ease;
  }

  .arrow-icon.expanded {
    transform: rotate(180deg);
  }

  .log-panel {
    margin-top: 0;
    padding: 12px;
    background-color: white;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .log-panel-title {
    font-weight: bold;
    margin-bottom: 10px;
    font-size: 14px;
    color: #333;
    border-bottom: 1px solid #eee;
    padding-bottom: 8px;
  }

  .log-panel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    transition: background-color 0.2s;
    padding: 4px;
    border-radius: 4px;
  }

  .log-panel-item:hover {
    background-color: #f5f5f5;
  }

  .log-panel-item:last-child {
    margin-bottom: 0;
  }

  .log-panel-item input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .log-panel-item label {
    cursor: pointer;
    user-select: none;
    flex: 1;
  }
</style>
