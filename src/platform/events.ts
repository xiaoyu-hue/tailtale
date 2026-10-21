/**
 * 类型化事件总线：跨模块广播的唯一通道。
 * 模块间不直接 import 对方内部实现，由消费方自行订阅（见架构文档第 3.1 节依赖规则）。
 */
type EventMap = {
  'wallet:changed': { coins: number; xp: number; todayMinutes: number };
  'checkin:done': { date: string; streak: number; bonus: number };
  'book:finished': { bookId: string };
  /** 羁绊时刻：阅读会话每跨满 30 分钟广播一次（PRD §5.2 情感钩子，pet 订阅后加好感） */
  'reading:bond_moment': { bookId: string; minutes: number };
};

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const handlers: { [K in keyof EventMap]: Set<Handler<K>> } = {
  'wallet:changed': new Set(),
  'checkin:done': new Set(),
  'book:finished': new Set(),
  'reading:bond_moment': new Set(),
};

/** 订阅事件，返回取消订阅函数。 */
export function on<K extends keyof EventMap>(event: K, handler: Handler<K>): () => void {
  handlers[event].add(handler);
  return () => {
    handlers[event].delete(handler);
  };
}

/** 广播事件；监听异常不影响其他监听者与发送方。 */
export function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
  handlers[event].forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error(`事件监听异常: ${event}`, error);
    }
  });
}
