<script setup lang="ts">
  import { ref, computed } from 'vue';
  import type { ToolConfig } from '@/types';
  import { ToolType } from '@/types';
  import { useLogControl, LOG_CATEGORIES } from '@/composables/useLogControl';
  import ColorPicker from './ColorPicker.vue';
  import SizePicker from './SizePicker.vue';

  /**
   * Emits 定义
   */
  interface Emits {
    (e: 'clearCanvas'): void;
    (e: 'back'): void;
  }

  const emit = defineEmits<Emits>();

  /**
   * Props 定义
   */
  interface Props {
    /** 压感笔临时切换的状态（null 表示未临时切换） */
    temporaryToolSwitch?: 'pen' | 'eraser' | null;
    /** 是否显示返回按钮 */
    showBackButton?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    temporaryToolSwitch: null,
    showBackButton: false,
  });

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
   * 计算实际生效的工具类型（优先使用临时切换状态）
   */
  const effectiveToolType = computed(() => {
    return props.temporaryToolSwitch || toolConfig.value.toolType;
  });

  /**
   * 判断工具是否被临时激活
   */
  function isToolTemporarilyActive(toolType: ToolType): boolean {
    return props.temporaryToolSwitch === toolType && toolConfig.value.toolType !== toolType;
  }

  /**
   * 切换工具类型
   */
  function setToolType(toolType: ToolType) {
    toolConfig.value.toolType = toolType;
  }

  /**
   * 切换触摸绘制是否启用
   */
  function setTouchDrawingEnabled(enabled: boolean) {
    toolConfig.value.touchDrawingEnabled = enabled;
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
      <!-- 返回按钮（如果需要显示） -->
      <button
        v-if="showBackButton"
        class="tool-btn back-btn"
        @click="emit('back')"
        title="返回画布列表"
      >
        ←
      </button>

      <button
        :class="['tool-btn', {
          active: effectiveToolType === ToolType.PEN,
          'temp-active': isToolTemporarilyActive(ToolType.PEN)
        }]"
        @click="setToolType(ToolType.PEN)"
      >
        画笔
      </button>
      <button
        :class="['tool-btn', {
          active: effectiveToolType === ToolType.ERASER,
          'temp-active': isToolTemporarilyActive(ToolType.ERASER)
        }]"
        @click="setToolType(ToolType.ERASER)"
      >
        橡皮擦
      </button>

      <!-- 颜色选择器（仅画笔模式显示） -->
      <div v-if="effectiveToolType === ToolType.PEN" class="toolbar-divider"></div>
      <ColorPicker
        v-if="effectiveToolType === ToolType.PEN"
        v-model="toolConfig.brush.color"
      />

      <!-- 粗细选择器 -->
      <div class="toolbar-divider"></div>
      <SizePicker
        v-if="effectiveToolType === ToolType.PEN"
        v-model="toolConfig.brush.baseLineWidth"
        :min="1"
        :max="50"
        :presets="[2, 5, 10, 20, 30]"
      />
      <SizePicker
        v-if="effectiveToolType === ToolType.ERASER"
        v-model="toolConfig.eraser.size"
        :min="5"
        :max="100"
        :presets="[10, 20, 30, 50, 80]"
        unit="px"
      />

      <div class="toolbar-divider"></div>
      <button
        :class="['tool-btn', { active: toolConfig.touchDrawingEnabled }]"
        @click="setTouchDrawingEnabled(!toolConfig.touchDrawingEnabled)"
        title="切换触摸绘制"
      >
        触摸绘制: {{ toolConfig.touchDrawingEnabled ? '开' : '关' }}
      </button>
      <button
        :class="['tool-btn', { active: toolConfig.brush.smartSmoothingEnabled }]"
        @click="toolConfig.brush.smartSmoothingEnabled = !toolConfig.brush.smartSmoothingEnabled"
        title="切换智能平滑（压感平滑+插值优化）"
      >
        智能平滑: {{ toolConfig.brush.smartSmoothingEnabled ? '开' : '关' }}
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
      <div
        v-for="[key, category] in Object.entries(LOG_CATEGORIES)"
        :key="key"
        class="log-panel-item"
      >
        <input
          :id="`log-${key}`"
          type="checkbox"
          v-model="logEnable[key as keyof typeof logEnable]"
        />
        <label :for="`log-${key}`">{{ category.label }}</label>
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
    align-items: center;
    flex-wrap: wrap;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background-color: #e8e8e8;
    margin: 0 4px;
  }

  .tool-btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tool-btn.back-btn {
    padding: 8px 14px;
    font-size: 16px;
    font-weight: bold;
  }

  .tool-btn.back-btn:hover {
    background-color: #1890ff;
    color: white;
    border-color: #1890ff;
  }

  .tool-btn:hover {
    background-color: #f5f5f5;
  }

  .tool-btn.active {
    background-color: #1890ff;
    color: white;
    border-color: #1890ff;
  }

  .tool-btn.temp-active {
    background-color: #52c41a;
    color: white;
    border-color: #52c41a;
    box-shadow: 0 0 8px rgba(82, 196, 26, 0.6);
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
