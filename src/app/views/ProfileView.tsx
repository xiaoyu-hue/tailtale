import { SettingsPanel } from '../../modules/settings';
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

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 17 }}>关于书时</h2>
        <p className="muted" style={{ margin: 0 }}>
          书时（TailTale）是一款游戏化阅读器 + 轻量工具箱：读书积累时长换取金币，金币养育一只永远陪伴你的猫。
          本地优先、无需登录、无支付，AI 功能采用 BYOK 模式（用户自带密钥，M5 上线）。
        </p>
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
          无任何服务端数据收集。请勿在公共电脑上填写任何密钥（M5 起适用）。
        </p>
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        书时 TailTale v1.0.0 · M2 阅读核心
      </p>
    </>
  );
}
