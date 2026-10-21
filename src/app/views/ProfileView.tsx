import { SettingsPanel, BackupSection } from '../../modules/settings';
import { AiSettingsSection } from '../../modules/ai';
import { StatsCard } from './StatsCard';
import { CheckinCalendar } from './CheckinCalendar';

interface Credit {
  name: string;
  detail: string;
}

const CREDITS: Credit[] = [
  { name: 'MindSpace', detail: 'MIT · Jabez · 打卡/经验值逻辑思路' },
  { name: 'kit', detail: 'MIT · aafnnp · 工具箱交互参考' },
  { name: 'Tamagochi', detail: 'MIT · Tech-aficionado · 宠物系统蓝本' },
  { name: 'NextChat', detail: 'MIT · ChatGPTNextWeb · AI 交互模式' },
  { name: 'epub.js', detail: 'BSD-2-Clause · FuturePress · EPUB 渲染（1.1.0 接入）' },
  { name: 'pdf.js', detail: 'Apache-2.0 · Mozilla · PDF 渲染（1.1.0 接入）' },
  { name: 'foliate-js', detail: 'MIT · johnfactotum · 备选渲染引擎' },
  { name: 'shiki-toolbox', detail: 'MIT · Elari39 · 设计系统思路参考' },
  { name: 'React / Vite / vite-plugin-pwa', detail: 'MIT · Facebook / Vite 团队' },
];

export default function Profile() {
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
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>开源致谢</h2>
        {CREDITS.map((credit) => (
          <div className="credit-row" key={credit.name}>
            <span className="credit-name">{credit.name}</span>
            <span className="credit-detail">{credit.detail}</span>
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
        书时 TailTale v1.5.1 · 界面皮肤与数据备份 · 首页入口已接通
      </p>
    </>
  );
}
