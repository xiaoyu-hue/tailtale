/**
 * PWA 更新检查（platform 层，零模块依赖——符合「platform 不准依赖上层」硬规则）。
 *
 * 背景：vite-plugin-pwa 为 autoUpdate 模式——新版本 Service Worker 安装后自动
 * 激活接管，用户下次打开 App 即生效，但用户本人无感知。本项目发版节奏快，
 * 需要「手动检查更新」把新版本触达给用户。
 *
 * 三态语义（对用户说人话）：
 * - available：服务器上有新版本，刷新后生效（autoUpdate 已代为激活新 SW）
 * - latest：当前已是最新版本（本地视角，不下「服务器没有新版本」的绝对判断，
 *   避免 CDN 边缘缓存滞后时误导用户）
 * - failed：网络异常，或当前环境未启用 Service Worker（如 npm run dev）
 *
 * 已知限制：iOS Safari 对 PWA 的 SW 更新时机不完全受控，本检查在 iOS 上
 * 最坏表现为 latest（无害）；上线前真机验证清单含 iOS 项。
 */

export type UpdateCheckResult = 'available' | 'latest' | 'failed';

/** 检查超时：update() 在网络黑洞时可能长时间 pending，超时收敛为 failed。 */
const DEFAULT_TIMEOUT_MS = 10_000;

/** 强制 Service Worker 向服务器检查更新（绕过浏览器内置的周期性检查节流）。 */
export async function checkForUpdate(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<UpdateCheckResult> {
  if (!('serviceWorker' in navigator)) return 'failed';

  let registration: ServiceWorkerRegistration;
  try {
    const found = await navigator.serviceWorker.getRegistration();
    if (!found) return 'failed'; // 开发环境（vite dev 不注册 SW）或尚未注册
    registration = found;
  } catch {
    return 'failed';
  }

  return new Promise<UpdateCheckResult>((resolve) => {
    let settled = false;
    const settle = (result: UpdateCheckResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      registration.removeEventListener('updatefound', onUpdateFound);
      resolve(result);
    };
    const timer = window.setTimeout(() => settle('failed'), timeoutMs);

    // 并发兜底：检查时已有安装中/等待中的新 SW（另一路径刚发现更新）
    if (registration.installing || registration.waiting) {
      settle('available');
      return;
    }

    function onUpdateFound() {
      const worker = registration.installing;
      if (!worker) return;
      const isNew = () =>
        worker.state === 'installed' ||
        worker.state === 'activating' ||
        worker.state === 'activated';
      if (isNew()) {
        settle('available');
        return;
      }
      // autoUpdate 模式下新 SW 走 skipWaiting 快速通道，installed 可能一闪而过，
      // 故 installed/activating/activated 三态均视为「有新版本」。
      worker.addEventListener('statechange', () => {
        if (isNew()) settle('available');
      });
    }
    registration.addEventListener('updatefound', onUpdateFound);

    // update() 是真正的检查动作：resolve 表示检查完成。若期间未派发
    // updatefound（无字节差异）→ latest；派发过则已被 settle('available')
    // 短路，此处重复 settle 无效。reject → failed。
    registration.update().then(
      () => settle('latest'),
      () => settle('failed'),
    );
  });
}

/** 应用已发现的新版本：整页刷新，由已激活的新 SW 接管并加载最新资源。 */
export function applyUpdate(): void {
  location.reload();
}
