// @ts-expect-error - JS axios instance
import api from "@/lib/api";

const KEY_PREFIX = "taskflow_ai_chat_v1";

function keyFor(userId: string | number) {
  return `${KEY_PREFIX}_${userId}`;
}

/**
 * Chat history is kept in-memory for the current browser session only,
 * scoped per account so one user's conversation never leaks into another's.
 */
export function loadHistory(userId: string | number): Promise<unknown[]> {
  try {
    const raw = sessionStorage.getItem(keyFor(userId));
    return Promise.resolve(raw ? JSON.parse(raw) : []);
  } catch {
    return Promise.resolve([]);
  }
}

export function saveHistory(messages: unknown[], userId: string | number): void {
  try {
    sessionStorage.setItem(keyFor(userId), JSON.stringify(messages));
  } catch {
    /* ignore quota errors */
  }
}

export function clearHistory(userId: string | number): void {
  try {
    sessionStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}