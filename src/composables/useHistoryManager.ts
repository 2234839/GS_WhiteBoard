import { ref, computed } from 'vue';
import type { Group } from 'leafer-ui';

/**
 * 历史记录状态数据
 * 存储 Leafer 元素的 JSON 数据
 */
type HistoryState = Record<string, unknown>[];

/**
 * 历史记录管理配置
 */
interface HistoryConfig {
  /** 最大历史记录数量 */
  maxHistory?: number;
}

/**
 * 历史记录管理 Composable
 * 提供撤回和重做功能
 */
export function useHistoryManager(config: HistoryConfig = {}) {
  /** 最大历史记录数量（默认 50） */
  const maxHistory = config.maxHistory || 50;

  /** 撤回栈 */
  const undoStack = ref<HistoryState[]>([]);

  /** 重做栈 */
  const redoStack = ref<HistoryState[]>([]);

  /** 是否可以撤回 */
  const canUndo = computed(() => undoStack.value.length > 0);

  /** 是否可以重做 */
  const canRedo = computed(() => redoStack.value.length > 0);

  /**
   * 保存当前状态到历史记录
   * @param group - Leafer Group 对象
   */
  function pushState(group: Group | null) {
    if (!group) return;

    // 获取当前所有子元素的 JSON 数据
    const currentState: HistoryState = group.children.map((child) => child.toJSON());

    // 添加到撤回栈
    undoStack.value.push(currentState);

    // 如果超过最大历史记录数量，移除最早的记录
    if (undoStack.value.length > maxHistory) {
      undoStack.value.shift();
    }

    // 新操作时清空重做栈
    redoStack.value = [];
  }

  /**
   * 撤回操作
   * @param group - Leafer Group 对象
   * @returns 撤回后的状态数据（如果有）
   */
  function undo(group: Group | null): HistoryState | null {
    if (!canUndo.value || !group) return null;

    // 从撤回栈弹出当前状态
    const currentState = undoStack.value.pop()!;

    // 将当前状态推入重做栈
    redoStack.value.push(currentState);

    // 获取上一个状态
    const previousState = undoStack.value[undoStack.value.length - 1] || [];

    // 恢复到上一个状态
    restoreState(group, previousState);

    return previousState;
  }

  /**
   * 重做操作
   * @param group - Leafer Group 对象
   * @returns 重做后的状态数据（如果有）
   */
  function redo(group: Group | null): HistoryState | null {
    if (!canRedo.value || !group) return null;

    // 从重做栈弹出状态
    const nextState = redoStack.value.pop()!;

    // 将状态推入撤回栈
    undoStack.value.push(nextState);

    // 恢复到该状态
    restoreState(group, nextState);

    return nextState;
  }

  /**
   * 恢复状态到 Group
   * @param group - Leafer Group 对象
   * @param state - 要恢复的状态数据
   */
  function restoreState(group: Group, state: HistoryState) {
    // 清空当前 Group 的所有子元素
    const children = [...group.children];
    for (const child of children) {
      group.remove(child);
    }

    // 从状态数据恢复子元素
    for (const elementData of state) {
      group.add(elementData);
    }
  }

  /**
   * 清空历史记录
   */
  function clear() {
    undoStack.value = [];
    redoStack.value = [];
  }

  /**
   * 获取当前历史记录数量
   */
  function getHistorySize() {
    return {
      undo: undoStack.value.length,
      redo: redoStack.value.length,
    };
  }

  return {
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    clear,
    getHistorySize,
  };
}
