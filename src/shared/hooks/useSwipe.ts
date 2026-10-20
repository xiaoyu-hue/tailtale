import { useCallback, useRef } from 'react';

/** 滑动方向：left / right 为横向，up / down 为竖向 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** 默认触发滑动的最小位移（px）：低于此距离视为点击，不触发翻页 */
const DEFAULT_THRESHOLD = 50;

/** 滑动结束后，紧随其后的 click 在此时间窗内被吞掉（防止滑动误触控件栏显隐） */
const CLICK_GUARD_MS = 400;

/**
 * 移动定型阈值（px）：手指移动超过此距离才判定方向。
 * 在此之前不阻止默认行为，避免把轻触/抖动也当成滑动。
 */
const MOVE_SLOP = 10;

/** 触摸点：只取判定需要的坐标 */
interface SwipeTouch {
  clientX: number;
  clientY: number;
}

/**
 * 与 React 合成事件、原生 TouchEvent 双兼容的触摸事件结构。
 * EPUB 的触摸事件在 iframe 文档内，只能用 addEventListener 绑原生监听器，
 * 因此处理器不依赖 React 事件类型；changedTouches 在 touchend 时才有值。
 * 注意用结构化类型而非 DOM TouchList——React.TouchList 不带迭代器，二者不互认。
 */
export interface SwipeTouchEventLike {
  touches: { length: number; [index: number]: SwipeTouch };
  changedTouches?: { length: number; [index: number]: SwipeTouch };
  /** 原生事件才有的字段；React 合成事件没有，统一走可选链调用 */
  preventDefault?: () => void;
  stopImmediatePropagation?: () => void;
  cancelable?: boolean;
}

export interface SwipeHandlers {
  onTouchStart: (event: SwipeTouchEventLike) => void;
  onTouchMove: (event: SwipeTouchEventLike) => void;
  onTouchEnd: (event: SwipeTouchEventLike) => void;
  onTouchCancel: (event: SwipeTouchEventLike) => void;
}

export interface BindOptions {
  /** 捕获阶段绑定（EPUB：抢在 epub.js 内置滑动监听之前） */
  capture?: boolean;
  /** 绑定后阻止同节点同阶段的后续监听器（EPUB：禁用内置 snap_Snap 防双翻页） */
  stopImmediate?: boolean;
}

export interface UseSwipeOptions {
  /** 触发滑动的最小距离（px），默认 50 */
  threshold?: number;
  /**
   * 识别轴：
   * - 'both'：横竖都认（EPUB / PDF 分页阅读）
   * - 'horizontal'：只认横向，竖向交还原生滚动（TXT 章内滚动阅读）
   */
  axis?: 'both' | 'horizontal';
  /** 滑动确认后的回调，参数为四向之一 */
  onSwipe: (direction: SwipeDirection) => void;
}

export interface UseSwipeResult {
  /**
   * 原生绑定到元素：以非被动（passive: false）监听 touch 事件，
   * 手指移动方向一旦明确就 preventDefault() 抢先扼杀系统滚动——
   * iOS Safari 的规矩是「一旦进入滚动模式，touchend 不再派发、改派 touchcancel」，
   * 不阻止滚动就等不到松手，滑动必然失效；安卓与桌面无此行为，但同样受益。
   * 接收 Element 或 Document（EPUB 绑 iframe 的 contentDocument）。
   * 返回解绑函数（useEffect 里调用并 return 它）。
   */
  bind: (target: EventTarget | null | undefined, options?: BindOptions) => () => void;
  /**
   * React 合成事件 handlers（可展开到 JSX）。
   * 注意 React 18 的 touchstart/touchmove 监听器固定 passive，无法阻止默认行为，
   * 仅作兜底路径；需要 iOS 兼容的调用方请用 bind()。
   */
  handlers: SwipeHandlers;
  /**
   * 在 onClick 里最先调用：若刚刚发生过滑动，返回 true 并消费掉标记，
   * 本次 click 是滑动的“尾随点击”，应直接忽略。
   */
  consumeSwipe: () => boolean;
}

/**
 * 自研滑动手势（零依赖）：touchstart 记录起点，touchmove 定型方向并阻止系统滚动，
 * touchend 按距离 + 主轴方向判定是否翻页。只做“是否滑动、滑向哪”，
 * 不做位移跟手——阅读翻页不需要动画，一致性优先。
 */
export function useSwipe({
  threshold = DEFAULT_THRESHOLD,
  axis = 'both',
  onSwipe,
}: UseSwipeOptions): UseSwipeResult {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  /** 本轮是否已阻止过默认行为（防止重复 preventDefault 无谓开销） */
  const blockedRef = useRef(false);
  const lastSwipeAtRef = useRef(0);
  // 回调每次渲染都是新闭包，用 ref 持最新值，避免重复绑定后拿到过期状态
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const handleTouchStart = useCallback((event: SwipeTouchEventLike) => {
    // 多指手势（如双指缩放）不参与滑动判定
    startRef.current =
      event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null;
    blockedRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (event: SwipeTouchEventLike) => {
      // 中途变成多指则放弃本轮判定
      if (startRef.current && event.touches.length !== 1) {
        startRef.current = null;
        return;
      }
      const start = startRef.current;
      if (!start || blockedRef.current) return;
      const current = event.touches[0];
      if (!current) return;
      const dx = current.clientX - start.x;
      const dy = current.clientY - start.y;
      // 移动距离还不够定型：不阻止默认行为（可能是轻触或手抖），继续观察
      if (Math.max(Math.abs(dx), Math.abs(dy)) < MOVE_SLOP) return;

      const horizontal = Math.abs(dx) >= Math.abs(dy);
      // 定型。是否阻止默认行为的策略：
      // - 'horizontal'（TXT）：只在横向时阻止，竖向交还原生滚动
      // - 'both'（EPUB/PDF）：横竖都翻页，一律阻止
      const shouldBlock = axis === 'both' || horizontal;
      if (shouldBlock && event.cancelable !== false) {
        event.preventDefault?.();
        blockedRef.current = true;
      } else {
        // 竖向滚动方向：本轮判定作废（TXT 场景松手后会走 touchend，由轴向过滤兜底）
        startRef.current = null;
      }
    },
    [axis]
  );

  const handleTouchEnd = useCallback(
    (event: SwipeTouchEventLike) => {
      const start = startRef.current;
      startRef.current = null;
      blockedRef.current = false;
      if (!start) return;
      // touchend 时 touches 已空，终点取 changedTouches
      const end = event.changedTouches?.[0];
      if (!end) return;
      const dx = end.clientX - start.x;
      const dy = end.clientY - start.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (Math.max(adx, ady) < threshold) return; // 位移不足：点击或误触
      const direction: SwipeDirection =
        adx >= ady ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      // TXT 场景：竖向位移是原生滚动，不当作滑动
      if (axis === 'horizontal' && (direction === 'up' || direction === 'down')) return;
      lastSwipeAtRef.current = Date.now();
      onSwipeRef.current(direction);
    },
    [threshold, axis]
  );

  // 滚动接管时 iOS 改派 touchcancel：此时移动已被放行（竖向滚动场景），放弃本轮
  const handleTouchCancel = useCallback((_event?: SwipeTouchEventLike) => {
    startRef.current = null;
    blockedRef.current = false;
  }, []);

  const consumeSwipe = useCallback(() => {
    if (Date.now() - lastSwipeAtRef.current <= CLICK_GUARD_MS) {
      lastSwipeAtRef.current = 0;
      return true;
    }
    return false;
  }, []);

  const bind = useCallback(
    (target: EventTarget | null | undefined, options?: BindOptions) => {
      if (!target) return () => {};
      const capture = options?.capture ?? false;
      const stopImmediate = options?.stopImmediate ?? false;
      // 包装一次并缓存引用：removeEventListener 必须用同一个函数引用才能解绑干净
      const asSwipeEvent = (event: Event) =>
        event as unknown as SwipeTouchEventLike & { stopImmediatePropagation?: () => void };
      const wrapped = {
        start: (event: Event) => {
          const e = asSwipeEvent(event);
          if (stopImmediate) e.stopImmediatePropagation?.();
          handleTouchStart(e);
        },
        move: (event: Event) => {
          const e = asSwipeEvent(event);
          if (stopImmediate) e.stopImmediatePropagation?.();
          handleTouchMove(e);
        },
        end: (event: Event) => {
          const e = asSwipeEvent(event);
          if (stopImmediate) e.stopImmediatePropagation?.();
          handleTouchEnd(e);
        },
        cancel: (event: Event) => {
          const e = asSwipeEvent(event);
          if (stopImmediate) e.stopImmediatePropagation?.();
          handleTouchCancel(e);
        },
      };
      // passive: false 是 iOS 适配的关键——passive 监听器里 preventDefault 会被浏览器无视
      const opts: AddEventListenerOptions = { passive: false, capture };
      target.addEventListener('touchstart', wrapped.start, opts);
      target.addEventListener('touchmove', wrapped.move, opts);
      target.addEventListener('touchend', wrapped.end, opts);
      target.addEventListener('touchcancel', wrapped.cancel, opts);
      return () => {
        target.removeEventListener('touchstart', wrapped.start, opts);
        target.removeEventListener('touchmove', wrapped.move, opts);
        target.removeEventListener('touchend', wrapped.end, opts);
        target.removeEventListener('touchcancel', wrapped.cancel, opts);
      };
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]
  );

  return {
    bind,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    consumeSwipe,
  };
}
