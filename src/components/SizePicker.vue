<script setup lang="ts">
  import { ref, computed } from 'vue';

  /**
   * 使用 defineModel 定义双向绑定的值
   */
  const model = defineModel<number>({ required: true });

  /**
   * Props 定义
   */
  interface Props {
    /** 最小值 */
    min?: number;
    /** 最大值 */
    max?: number;
    /** 预设值 */
    presets?: number[];
    /** 单位标签 */
    unit?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    min: 1,
    max: 50,
    presets: () => [2, 5, 10, 20, 30],
    unit: 'px',
  });

  /** 是否展开面板 */
  const isExpanded = ref(false);

  /** 当前显示的值 */
  const displayValue = computed(() => model.value);

  /** 判断预设值是否被选中 */
  function isPresetSelected(size: number): boolean {
    return size === model.value;
  }

  /**
   * 选择预设值
   */
  function selectPreset(size: number) {
    model.value = size;
  }

  /**
   * 切换展开状态
   */
  function toggleExpanded() {
    isExpanded.value = !isExpanded.value;
  }

  /**
   * 计算预览圆的大小
   */
  const previewSize = computed(() => {
    // 限制预览最大显示为 40px，避免过大
    return Math.min(model.value, 40);
  });
</script>

<template>
  <div class="size-picker-container">
    <!-- 当前值按钮 -->
    <button
      class="current-size-btn"
      :class="{ expanded: isExpanded }"
      @click="toggleExpanded"
      title="点击展开粗细选择器"
    >
      <span class="size-preview" :style="{ width: previewSize + 'px', height: previewSize + 'px' }"></span>
      <span class="size-label">{{ displayValue }}{{ unit }}</span>
      <span class="arrow-icon">▼</span>
    </button>

    <!-- 粗细选择面板 -->
    <Transition name="dropdown">
      <div v-if="isExpanded" class="size-panel">
        <!-- 预设值 -->
        <div class="panel-section">
          <div class="section-title">快速选择</div>
          <div class="preset-grid">
            <button
              v-for="size in presets"
              :key="size"
              :class="['preset-btn', { active: isPresetSelected(size) }]"
              @click="selectPreset(size)"
            >
              <span class="preset-dot" :style="{ width: Math.min(size, 20) + 'px', height: Math.min(size, 20) + 'px' }"></span>
              <span class="preset-label">{{ size }}{{ unit }}</span>
            </button>
          </div>
        </div>

        <!-- 滑块调节 -->
        <div class="panel-section">
          <div class="section-title">精确调节</div>
          <div class="slider-container">
            <input
              type="range"
              :min="min"
              :max="max"
              v-model.number="model"
              class="size-slider"
            />
            <div class="slider-value">{{ displayValue }}{{ unit }}</div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
  .size-picker-container {
    position: relative;
    display: inline-block;
  }

  .current-size-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 80px;
  }

  .current-size-btn:hover {
    background-color: #f5f5f5;
  }

  .size-preview {
    border-radius: 50%;
    background-color: #333;
    flex-shrink: 0;
  }

  .size-label {
    font-size: 13px;
    color: #333;
    flex: 1;
    text-align: left;
  }

  .arrow-icon {
    font-size: 10px;
    transition: transform 0.3s ease;
  }

  .current-size-btn.expanded .arrow-icon {
    transform: rotate(180deg);
  }

  .size-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 200px;
    padding: 16px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 1000;
  }

  .panel-section {
    margin-bottom: 16px;
  }

  .panel-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 12px;
    font-weight: 500;
    color: #666;
    margin-bottom: 8px;
  }

  .preset-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .preset-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    background-color: #f5f5f5;
    border-color: #1890ff;
  }

  .preset-btn.active {
    background-color: #e6f7ff;
    border-color: #1890ff;
    color: #1890ff;
  }

  .preset-dot {
    border-radius: 50%;
    background-color: #333;
    flex-shrink: 0;
  }

  .preset-label {
    font-size: 12px;
  }

  .slider-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .size-slider {
    width: 100%;
    cursor: pointer;
  }

  .slider-value {
    text-align: center;
    font-size: 13px;
    color: #333;
    padding: 4px;
    background-color: #f5f5f5;
    border-radius: 4px;
  }

  /* 下拉动画 */
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: all 0.2s ease;
    transform-origin: top left;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }

  .dropdown-enter-to,
  .dropdown-leave-from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
</style>
