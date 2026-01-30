import type { Group } from 'leafer-ui';
import { useLogControl } from '@/composables/useLogControl';

/**
 * 日志控制
 */
const logEnable = useLogControl();

/**
 * 历史记录项（使用完整状态快照）
 */
export interface HistoryEntry {
  /** 快照（完整状态） */
  snapshot: Record<string, unknown>[];
}

/**
 * 保存当前状态到历史记录
 */
export function pushState(
  group: Group | null,
  undoStack: HistoryEntry[],
  redoStack: HistoryEntry[],
  maxHistory: number
) {
  if (!group) return;

  const startTime = performance.now();
  const currentState = group.toJSON();
  const serializeTime = performance.now() - startTime;

  logEnable.undoRedo && console.log(`[撤销重做] pushState: 序列化耗时 ${serializeTime.toFixed(2)}ms`);

  // 将当前状态压入 undoStack（保存整个 group 的 JSON）
  undoStack.push({ snapshot: (currentState as { children?: Record<string, unknown>[] }).children || [] });

  // 如果超过最大历史记录数量，移除最早的记录
  if (undoStack.length > maxHistory) {
    undoStack.shift();
  }

  // 新操作时清空重做栈
  redoStack.length = 0;
}

/**
 * 撤回操作
 */
export function undo(
  group: Group | null,
  undoStack: HistoryEntry[],
  redoStack: HistoryEntry[]
) {
  if (undoStack.length === 0 || !group) return;

  const entry = undoStack.pop()!;

  // 将当前操作推入重做栈
  redoStack.push(entry);

  // 撤回后应该显示 undoStack 中最后一个状态（如果有的话）
  // 或者显示空状态（如果 undoStack 为空）
  const newState = undoStack.length > 0
    ? undoStack[undoStack.length - 1].snapshot
    : [];

  restoreState(group, newState);
}

/**
 * 重做操作
 */
export function redo(
  group: Group | null,
  undoStack: HistoryEntry[],
  redoStack: HistoryEntry[]
) {
  if (redoStack.length === 0 || !group) return;

  const entry = redoStack.pop()!;

  // 将操作推回撤回栈
  undoStack.push(entry);

  // 重做后应该显示刚推回的状态
  restoreState(group, entry.snapshot);
}

/**
 * 恢复状态到 Group
 */
export function restoreState(group: Group, state: Record<string, unknown>[]) {
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
