<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useIdleStorage } from '@/composables/useIdleStorage';

  /**
   * 使用 defineModel 定义双向绑定的颜色值
   */
  const model = defineModel<string>({ required: true });

  /** 常用颜色预设 */
  const commonColors = [
    '#000000', // 黑色
    '#434343', // 深灰
    '#666666', // 中灰
    '#999999', // 浅灰
    '#B7B7B7', // 银灰
    '#CCCCCC', // 淡灰
    '#FFFFFF', // 白色
    '#FF0000', // 红色
    '#FF5722', // 橙红
    '#FF9800', // 橙色
    '#FFC107', // 琥珀
    '#FFEB3B', // 黄色
    '#CDDC39', // 黄绿
    '#8BC34A', // 浅绿
    '#4CAF50', // 绿色
    '#009688', // 青色
    '#00BCD4', // 青蓝
    '#2196F3', // 蓝色
    '#3F51B5', // 靛蓝
    '#673AB7', // 紫色
    '#9C27B0', // 深紫
    '#E91E63', // 粉红
    '#F44336', // 深红
    '#795548', // 棕色
  ];

  /** 历史颜色（最多保存 12 个） */
  const colorHistory = useIdleStorage<string[]>('whiteboard-color-history', {
    defaultValue: []
  });

  /** 色板输入的引用 */
  const colorInputRef = ref<HTMLInputElement | null>(null);

  /** 是否展开颜色选择器 */
  const isExpanded = ref(false);

  /** 当前显示的颜色（处理白色边框） */
  const displayColor = computed(() => model.value);

  /**
   * 选择颜色
   */
  function selectColor(color: string) {
    model.value = color;
    addToHistory(color);
  }

  /**
   * 添加到历史记录
   */
  function addToHistory(color: string) {
    // 如果颜色已存在，先移除
    const index = colorHistory.value.indexOf(color);
    if (index > -1) {
      colorHistory.value.splice(index, 1);
    }
    // 添加到开头
    colorHistory.value.unshift(color);
    // 最多保留 12 个
    if (colorHistory.value.length > 12) {
      colorHistory.value = colorHistory.value.slice(0, 12);
    }
  }

  /**
   * 打开色板
   */
  function openColorPicker() {
    colorInputRef.value?.click();
  }

  /**
   * 色板颜色变化
   */
  function handleColorInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    selectColor(target.value);
  }

  /**
   * 切换展开状态
   */
  function toggleExpanded() {
    isExpanded.value = !isExpanded.value;
  }

  /**
   * 判断是否为当前选中的颜色
   */
  function isSelected(color: string): boolean {
    return color.toLowerCase() === model.value.toLowerCase();
  }
</script>

<template>
  <div class="color-picker-container">
    <!-- 当前颜色按钮 -->
    <button
      class="current-color-btn"
      :class="{ expanded: isExpanded }"
      @click="toggleExpanded"
      title="点击展开颜色选择器"
    >
      <span
        class="color-preview"
        :style="{ backgroundColor: displayColor }"
      ></span>
      <span class="arrow-icon">▼</span>
    </button>

    <!-- 隐藏的色板输入 -->
    <input
      ref="colorInputRef"
      type="color"
      :value="model"
      @input="handleColorInputChange"
      class="hidden-color-input"
    />

    <!-- 颜色选择面板 -->
    <Transition name="dropdown">
      <div v-if="isExpanded" class="color-panel">
        <!-- 色板选色 -->
        <div class="panel-section">
          <div class="section-title">色板选色</div>
          <button class="color-picker-btn" @click="openColorPicker" title="打开色板">
            <span class="color-icon">🎨</span>
            <span>选择颜色</span>
          </button>
        </div>

        <!-- 常用颜色 -->
        <div class="panel-section">
          <div class="section-title">常用颜色</div>
          <div class="color-grid">
            <button
              v-for="color in commonColors"
              :key="color"
              :class="['color-swatch', { active: isSelected(color) }]"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="selectColor(color)"
            ></button>
          </div>
        </div>

        <!-- 历史颜色 -->
        <div v-if="colorHistory.length > 0" class="panel-section">
          <div class="section-title">最近使用</div>
          <div class="color-grid">
            <button
              v-for="color in colorHistory"
              :key="color"
              :class="['color-swatch', { active: isSelected(color) }]"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="selectColor(color)"
            ></button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
  .color-picker-container {
    position: relative;
    display: inline-block;
  }

  .current-color-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 60px;
  }

  .current-color-btn:hover {
    background-color: #f5f5f5;
  }

  .color-preview {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  }

  .arrow-icon {
    font-size: 10px;
    transition: transform 0.3s ease;
  }

  .current-color-btn.expanded .arrow-icon {
    transform: rotate(180deg);
  }

  .hidden-color-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .color-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 280px;
    max-width: 320px;
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

  .color-picker-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
  }

  .color-picker-btn:hover {
    background-color: #f5f5f5;
    border-color: #1890ff;
  }

  .color-icon {
    font-size: 18px;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  }

  .color-swatch {
    aspect-ratio: 1;
    border: 2px solid transparent;
    background-color: #ccc;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .color-swatch:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .color-swatch.active {
    border-color: #1890ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.3);
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
