import { useSyncExternalStore } from 'react';

/**
 * 极简外挂 store：基于 React 18 官方的 useSyncExternalStore 模式，零依赖。
 * 适用于模块级共享状态（见《书时-架构设计.md》第 7 节选型决策）。
 */
export interface Store<T> {
  getState: () => T;
  setState: (updater: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (updater: T | ((prev: T) => T)) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater;
      if (next !== state) {
        state = next;
        listeners.forEach((listener) => listener());
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * 订阅 store 切片。
 * 约束：selector 必须返回引用稳定的值（基本类型，或 state 中已存在的对象引用），
 * 否则每次调用返回新对象会触发无限重渲染。
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
