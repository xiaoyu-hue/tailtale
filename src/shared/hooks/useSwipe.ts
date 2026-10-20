import { useCallback, useRef } from 'react';

/** 滑动方向：left / right 为横向，up / down 为竖向 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** 默认触发滑动的最小位移（px）：低于此距离视为点击，不触发翻页 */
const DEFAULT_THRESHOLD = 50;

/** 滑动结束后，紧随其后的 click 在此时间窗内被吞掉（防止滑动误触控件栏显隐） */
const CLICK_GUARD_MS = 400;

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
}

export interface SwipeHandlers {
  onTouchStart: (event: SwipeTouchEventLike) => void;
  onTouchMove: (event: SwipeTouchEventLike) => void;
  onTouchEnd: (event: SwipeTouchEventLike) => void;
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
  /** 触摸三事件处理器：可展开到 React JSX，也可交给 addEventListener */
  handlers: SwipeHandlers;
  /**
   * 在 onClick 里最先调用：若刚刚发生过滑动，返回 true 并消费掉标记，
   * 本次 click 是滑动的“尾随点击”，应直接忽略。
   */
  consumeSwipe: () => boolean;
}

/**
 * 自研滑动手势（零依赖）：touchstart 记录起点，touchend 按距离 + 主轴方向判定。
 * 只做“是否滑动、滑向哪”，不做位移跟手——阅读翻页不需要动画，一致性优先。
 */
export function useSwipe({
  threshold = DEFAULT_THRESHOLD,
  axis = 'both',
  onSwipe,
}: UseSwipeOptions): UseSwipeResult {
  const startRef = useRef<{ x: number; y: number } | null>(null);
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
  }, []);

  const handleTouchMove = useCallback((event: SwipeTouchEventLike) => {
    // 中途变成多指则放弃本轮判定
    if (startRef.current && event.touches.length !== 1) {
      startRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (event: SwipeTouchEventLike) => {
      const start = startRef.current;
      startRef.current = null;
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

  const consumeSwipe = useCallback(() => {
    if (Date.now() - lastSwipeAtRef.current <= CLICK_GUARD_MS) {
      lastSwipeAtRef.current = 0;
      return true;
    }
    return false;
  }, []);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    consumeSwipe,
  };
}
