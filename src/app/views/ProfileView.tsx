import { useRef, useState } from 'react';
import { SettingsPanel, BackupSection } from '../../modules/settings';
import { AiSettingsSection } from '../../modules/ai';
import { applyUpdate, checkForUpdate, type UpdateCheckResult } from '../../platform/update';
import { StatsCard } from './StatsCard';
import { CheckinCalendar } from './CheckinCalendar';

interface Credit {
  name: string;
  detail: string;
}

interface CreditGroup {
  title: string;
  items: Credit[];
}

/** 与 README「开源致谢」及 docs/书时-开源组件与合规.md 第 1 节保持一致（React / React DOM 已拆分为两行）；逐包许可证全文见仓库 THIRD_PARTY_NOTICES.md。 */
const CREDIT_GROUPS: CreditGroup[] = [
  {
    title: '组件与资产（进入当前构建）',
    items: [
      { name: 'React', detail: 'MIT · Facebook, Inc. · UI 框架' },
      { name: 'React DOM', detail: 'MIT · Facebook, Inc. · 浏览器渲染' },
      { name: 'epub.js', detail: 'BSD-2-Clause · FuturePress · EPUB 解析与分页渲染' },
      { name: 'pdf.js', detail: 'Apache-2.0 · Mozilla · PDF 按页渲染' },
      { name: 'Vite', detail: 'MIT · Vite 团队 · 开发服务器与生产构建' },
      { name: '@vitejs/plugin-react', detail: 'MIT · Evan You and Vite contributors · JSX 转换与 Fast Refresh' },
      { name: 'vite-plugin-pwa', detail: 'MIT · Anthony Fu · Service Worker 与 PWA 清单配置' },
      { name: 'Workbox', detail: 'MIT · Google · vite-plugin-pwa 底层：预缓存与运行时缓存' },
      { name: 'TypeScript', detail: 'Apache-2.0 · Microsoft · 类型检查（开发期依赖）' },
      { name: 'Desktop-Pixel-Pet', detail: 'MIT · CanFlyhang · 像素猫美术资产 pixel_cat.json（随源码分发）' },
    ],
  },
  {
    title: '设计参考（不集成代码，仅参考思路）',
    items: [
      { name: 'MindSpace', detail: 'MIT · Jabez · 打卡/经验值逻辑、公版书下载脚本、主题系统思路' },
      { name: 'kit', detail: 'MIT · aafnnp · 工具箱交互：分类/收藏/最近使用/全局搜索' },
      { name: 'Tamagochi', detail: 'MIT · Tech-aficionado · 宠物系统蓝本：属性衰减/成长/喂食/睡觉' },
      { name: 'NextChat', detail: 'MIT · ChatGPTNextWeb · AI 交互模式：BYOK 设置页' },
      { name: 'shiki-toolbox', detail: 'MIT · Elari39 · 设计系统与算法工程思路（四季箱）' },
      { name: 'foliate-js', detail: 'MIT · johnfactotum · 备选渲染引擎（计划引入，尚未进入构建）' },
    ],
  },
];

export default function Profile() {
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | UpdateCheckResult>('idle');
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const updateTimerRef = useRef(0);

  const handleCheckUpdate = async () => {
    if (updateState === 'checking') return;
    window.clearTimeout(updateTimerRef.current);
    setUpdateState('checking');
    setUpdateMessage(null);
    const result = await checkForUpdate();
    setUpdateState(result);
    if (result === 'latest') {
      setUpdateMessage(`当前已是最新版本 v${__APP_VERSION__}`);
      updateTimerRef.current = window.setTimeout(() => setUpdateMessage(null), 5000);
    } else if (result === 'failed') {
      setUpdateMessage('检查失败：网络异常，或当前环境未启用离线缓存');
      updateTimerRef.current = window.setTimeout(() => setUpdateMessage(null), 5000);
    }
    // available：保留「立即刷新」按钮等用户操作，不自动清除
  };

  return (
    <>
      <h1 className="page-title">我的</h1>

      <StatsCard />
      <CheckinCalendar />
      <SettingsPanel />
      <BackupSection />
      <AiSettingsSection />

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 17 }}>关于书时</h2>
        <p className="muted" style={{ margin: 0 }}>
          书时（TailTale）是一款游戏化阅读器 + 轻量工具箱：读书积累时长换取金币，金币养育一只永远陪伴你的猫。
          本地优先、无需登录、无支付，AI 功能采用 BYOK 模式（用户自带密钥，密钥仅存本机浏览器）。
        </p>
        <a
          className="repo-link"
          href="https://github.com/xiaoyu-hue/tailtale"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="repo-link-github" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="repo-link-text">
            <span className="repo-link-title">GitHub 仓库</span>
            <span className="repo-link-url">github.com/xiaoyu-hue/tailtale</span>
          </span>
          <svg className="repo-link-arrow" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 11.5 11.5 4.5M11.5 4.5H6.5M11.5 4.5V9.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <div className="update-check">
          <button
            type="button"
            className="btn update-check-btn"
            onClick={() => void handleCheckUpdate()}
            disabled={updateState === 'checking'}
          >
            {updateState === 'checking'
              ? '检查中…'
              : updateState === 'available'
                ? '发现新版本'
                : '检查更新'}
          </button>
          {updateState === 'available' && (
            <span className="update-check-latest">
              发现新版本，刷新即可使用
              <button type="button" className="btn btn-primary update-check-refresh" onClick={applyUpdate}>
                立即刷新
              </button>
            </span>
          )}
          {updateMessage && <span className="update-check-message">{updateMessage}</span>}
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>开源致谢</h2>
        {CREDIT_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="credit-group-title">{group.title}</div>
            {group.items.map((credit) => (
              <div className="credit-row" key={credit.name}>
                <span className="credit-name">{credit.name}</span>
                <span className="credit-detail">{credit.detail}</span>
              </div>
            ))}
          </div>
        ))}
        <p className="muted" style={{ marginBottom: 0 }}>
          完整版权与许可证声明见仓库 THIRD_PARTY_NOTICES.md 与
          docs/书时-开源组件与合规.md。
        </p>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>许可证</h2>
        <p className="muted" style={{ margin: 0 }}>
          自有源代码：Apache-2.0；项目文档（docs/）：CC BY-NC 4.0（署名 + 非商用）；
          第三方组件保持各自原许可证。
        </p>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>隐私说明</h2>
        <p className="muted" style={{ margin: 0 }}>
          书籍文件、阅读进度与设置仅存储于本机浏览器（IndexedDB / localStorage），
          无任何服务端数据收集；AI 密钥同样只保存在本机浏览器，不会上传。
          请勿在公共电脑上填写任何密钥。
        </p>
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        书时 TailTale v{__APP_VERSION__}
      </p>
    </>
  );
}
