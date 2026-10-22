/**
 * 全局点击涟漪（事件委托）：为可点击元素在按下位置注入水波纹。
 * 不逐组件改代码——在 document 上委托一次即可覆盖现有与未来的按钮类元素。
 * 尊重系统「减少动态效果」设置；禁用态（disabled / aria-disabled）不响应。
 */

/** 需要涟漪反馈的选择器（与 .btn / .feature-cell 的 overflow:hidden 配套）。 */
const RIPPLE_TARGETS = '.btn, .feature-cell, .segmented-item, .icon-btn';

/** 同一元素上残留涟漪的兜底清理时长（略长于 CSS 动画 0.55s）。 */
const RIPPLE_FALLBACK_MS = 800;

function prefersReducedMotion(): boolean {
  // 用户设置（<html data-reduce-motion>）优先于系统偏好判断：两者任一开启即不播动画
  if (document.documentElement.dataset.reduceMotion === 'on') return true;
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * 挂载涟漪委托，返回卸载函数（useEffect cleanup 用）。
 * root 默认 document；测试环境可传入局部容器。
 */
export function installRipple(root: ParentNode = document): () => void {
  // ParentNode 的 addEventListener 只有通用 Event 签名（PointerEvent 收窄在 Document/HTMLElement 上），
  // 故入参按 Event 收、内部断言为 PointerEvent（pointerdown 事件的运行时保证）。
  const onPointerDown = (event: Event) => {
    if (prefersReducedMotion()) return;

    const pointerEvent = event as PointerEvent;
    const target = pointerEvent.target as HTMLElement | null;
    const host = target?.closest?.(RIPPLE_TARGETS) as HTMLElement | null;
    if (!host) return;
    // 禁用态：原生 disabled 属性 + aria-disabled（自定义禁用按钮）
    if (host.hasAttribute('disabled') || host.getAttribute('aria-disabled') === 'true') return;

    const rect = host.getBoundingClientRect();
    // 直径取宽高较大者的两倍，保证涟漪能覆盖整个元素
    const size = Math.max(rect.width, rect.height) * 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${pointerEvent.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${pointerEvent.clientY - rect.top - size / 2}px`;

    ripple.addEventListener('animationend', () => ripple.remove());
    // 兜底：动画未触发（如元素被移出渲染树）时也要清理，避免泄漏
    window.setTimeout(() => ripple.remove(), RIPPLE_FALLBACK_MS);

    host.appendChild(ripple);
  };

  root.addEventListener('pointerdown', onPointerDown);
  return () => root.removeEventListener('pointerdown', onPointerDown);
}
