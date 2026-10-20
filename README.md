# 书时 TailTale

**游戏化阅读器 + 轻量工具箱**：读书记时长金币，金币养宠物，让读书像照顾一位小伙伴一样有牵挂。

- 本地优先：电子书与全部用户数据不出浏览器，无需注册登录
- 零成本运营：无服务器、无数据库、无 AI 费用（AI 采用 BYOK 模式，用户自带密钥）
- 无支付、无商业化：金币只能靠阅读赚取，不可购买
- PWA：可"添加到主屏幕"，离线可用

## 当前进度（v1.0.0 · M2 已完成）

v1.0.0（2026-10-20 发布）：M1 地基 + M2 阅读核心全部完成，首个正式版。已交付：

- [x] 项目脚手架：React 18 + TypeScript + Vite + PWA
- [x] 书架：本地导入 TXT、删除、三种状态（想读 / 在读 / 读完）
- [x] 阅读器：章节自动拆分、章节导航、字号调节、进度记忆（按文件内容指纹，同一文件换设备可续读）
- [x] 页面骨架：顶栏（日期时间 + 金币）、底部四 Tab、宠物 / 商店占位页、关于页（含完整开源致谢）
- [x] 四层模块化架构：app / modules / platform / shared（见 [docs/书时-架构设计.md](docs/书时-架构设计.md)）
- [x] 阅读计时：打开书籍即计时，返回书架即停；切浏览器后台暂停；刷新后重开同一本书续计时
- [x] 金币与经验：阅读每 30 分钟 +10 金币，每阅读 1 分钟 +1 XP，顶栏实时显示金币
- [x] 每日打卡：当日阅读满 1 分钟可打卡，+5 金币起，连续打卡第 3 天起每天 +2（上限 +10）
- [x] 读完奖励：读完一本书 +100 金币
- [x] M2 收尾：settings 模块（正文字号全局记忆、主题三选：跟随系统/浅色/深色）；我的页阅读统计与打卡日历（当月热力图）
- [ ] M3 宠物：喂食 / 玩耍 / 好感度 / 成长阶段、金币闭环
- [ ] M4 工具箱：番茄钟 / 白噪音 / 统计日历 / 文本统计 / 书摘导出 / 今日一书
- [ ] M5 AI 解读书：BYOK 设置、DeepSeek 直连
- [ ] M6 打磨：主题皮肤、商店、数据备份
- [ ] M7 作品化：README 完善、demo 优化、内置公版书库

> 部署策略：开发期使用 Cloudflare Pages 免费 `*.pages.dev` 二级域名内部预览，自定义域名与公开上架待可用版本完成后启动。当前内部预览地址：**https://tailtale-520.pages.dev/**（部署内容为 `main` 分支最新构建，含 M2 游戏化功能）

## 快速开始

环境要求：Node.js 20+。

```bash
npm install        # 安装依赖
npm run dev        # 本地开发（默认 http://localhost:5173）
npm run build      # 类型检查 + 生产构建（输出 dist/）
npm run preview    # 预览生产构建（默认 http://localhost:4173）
```

导入书籍：首页点击「导入 TXT 书籍」或把 .txt 文件拖入书架区域。EPUB / PDF 渲染在 M2 接入。

## 仓库结构

```
├── CHANGELOG.md           版本演进记录（Keep a Changelog 风格）
├── LICENSE                 Apache-2.0 全文（覆盖自有源代码）
├── THIRD_PARTY_NOTICES.md   第三方组件版权与许可证声明
├── README.md               本文件（Apache-2.0）
├── docs/                   项目文档（CC BY-NC 4.0，全文见 docs/LICENSE）
│   ├── LICENSE              CC BY-NC 4.0 官方法律文本（文档许可）
│   ├── 书时-PRD.md          产品需求文档
│   ├── 书时-技术栈.md        技术选型与架构
│   ├── 书时-架构设计.md      目标架构、模块边界与迁移路径
│   ├── 书时-版本管理规范.md  版本号规则、发版流程与 CHANGELOG 约定
│   └── 书时-开源组件与合规.md 组件致谢、许可证义务与合规台账
├── index.html
├── vite.config.ts          Vite + PWA 配置
└── src/
    ├── main.tsx             入口
    ├── styles.css           设计变量（暖色主题 + 深色模式适配）
    ├── app/                 应用外壳：App.tsx（导航+装配）/ views/（路由级视图）
    ├── modules/             领域模块（自治，只经各自 index.ts 暴露公开 API）
    │   ├── books/           书架：model（类型+状态机）/ store（状态）/ service（持久化）/ ui
    │   ├── reader/          阅读器：model（章节拆分）/ ui（ReaderPage）
    │   ├── gamification/    游戏化：model（经济数值+纯函数）/ service（计时+持久化）/ store / ui（今日阅读卡片）
    │   └── settings/        全局偏好：model（字号档位+主题）/ service（localStorage）/ store / ui（设置面板）
    ├── platform/            平台能力：db（IndexedDB+迁移）/ store（状态工厂）/ events（事件总线）/ hash（内容指纹）
    └── shared/              跨模块共享：ui（TopBar / BottomNav 等）
```

## 许可证（分层）

| 对象 | 许可证 |
|---|---|
| 书时自有源代码 | [Apache-2.0](LICENSE)，Copyright © 2026 xiaoyu-hue |
| 第三方组件 | 各自原许可证，见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) |
| docs/ 目录项目文档 | CC BY-NC 4.0（署名 + 非商用），[全文见 docs/LICENSE](docs/LICENSE) |

完整组件致谢、许可证义务与禁用组件记录见 [docs/书时-开源组件与合规.md](docs/书时-开源组件与合规.md)，应用内「我的 → 关于」页同步展示致谢清单。

## 隐私说明

- 书籍文件、阅读进度、书摘等数据仅存储于浏览器本地（IndexedDB / localStorage），无任何服务端收集
- 不提供、不索引任何盗版书源；用户本地导入文件的来源合规责任由用户自行承担
- M5 上线后，AI 密钥同样仅存浏览器本地，代码中不存在上传或传输密钥的逻辑

## 致谢

书时站在开源项目肩膀上，主要参考与依赖（完整声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)）：

[MindSpace](https://github.com/jabez0701/MindSpace)（MIT）· [kit](https://github.com/aafnnp/kit)（MIT）· [Tamagochi](https://github.com/Tech-aficionado/Tamagochi---Open-Source-Game)（MIT）· [NextChat](https://github.com/ChatGPTNextWeb/NextChat)（MIT）· [epub.js](https://github.com/futurepress/epub.js)（MIT）· [pdf.js](https://github.com/mozilla/pdf.js)（Apache-2.0）· [foliate-js](https://github.com/johnfactotum/foliate-js)（MIT）· [shiki-toolbox](https://github.com/Elari39/shiki-toolbox)（MIT）· React / Vite / vite-plugin-pwa（MIT）
