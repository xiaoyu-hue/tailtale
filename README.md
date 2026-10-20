# 书时 TailTale

**游戏化阅读器 + 轻量工具箱**：读书记时长金币，金币养宠物，让读书像照顾一位小伙伴一样有牵挂。

- 本地优先：电子书与全部用户数据不出浏览器，无需注册登录
- 零成本运营：无服务器、无数据库、无 AI 费用（AI 采用 BYOK 模式，用户自带密钥）
- 无支付、无商业化：金币只能靠阅读赚取，不可购买
- PWA：可"添加到主屏幕"，离线可用

## 当前进度（M1 地基）

本仓库处于 **M1（第 1 个月）** 阶段，已交付第一个可运行版本：

- [x] 项目脚手架：React 18 + TypeScript + Vite + PWA
- [x] 书架：本地导入 TXT、删除、三种状态（想读 / 在读 / 读完）
- [x] 阅读器：章节自动拆分、章节导航、字号调节、进度记忆（按文件内容指纹，同一文件换设备可续读）
- [x] 页面骨架：顶栏（日期时间）、底部四 Tab、宠物 / 商店占位页、关于页（含完整开源致谢）
- [ ] M2 阅读核心：阅读计时、打卡、经验值
- [ ] M3 宠物：喂食 / 玩耍 / 好感度 / 成长阶段、金币闭环
- [ ] M4 工具箱：番茄钟 / 白噪音 / 统计日历 / 文本统计 / 书摘导出 / 今日一书
- [ ] M5 AI 解读书：BYOK 设置、DeepSeek 直连
- [ ] M6 打磨：主题皮肤、商店、数据备份
- [ ] M7 作品化：README 完善、demo 优化、内置公版书库

> 部署策略：开发期使用 Cloudflare Pages 免费 `*.pages.dev` 二级域名内部预览，自定义域名与公开上架待可用版本完成后启动。

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
├── LICENSE                 Apache-2.0 全文（覆盖自有源代码）
├── THIRD_PARTY_NOTICES     第三方组件版权与许可证声明
├── README.md               本文件（Apache-2.0）
├── docs/                   项目文档（CC BY-NC 4.0）
│   ├── 书时-PRD.md          产品需求文档
│   ├── 书时-技术栈.md        技术选型与架构
│   └── 书时-开源组件与合规.md 组件致谢、许可证义务与合规台账
├── index.html
├── vite.config.ts          Vite + PWA 配置
└── src/
    ├── main.tsx / App.tsx   入口与路由（无路由库，页面级状态切换）
    ├── styles.css           设计变量（暖色主题 + 深色模式适配）
    ├── types.ts             Book / BookContent 数据模型
    ├── lib/
    │   ├── db.ts            IndexedDB 封装（书籍元信息 + 全文）
    │   ├── hash.ts          文本内容指纹（进度跨设备续读的定位依据）
    │   ├── chapters.ts      TXT 章节拆分
    │   └── books.ts         导入 / 读取 / 删除 / 进度保存
    ├── components/          TopBar（日期时间）/ BottomNav（四 Tab）
    └── pages/               Home（书架）/ Reader / Pet / Shop / Profile
```

## 许可证（分层）

| 对象 | 许可证 |
|---|---|
| 书时自有源代码 | [Apache-2.0](LICENSE)，Copyright © 2026 xiaoyu-hue |
| 第三方组件 | 各自原许可证，见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES) |
| docs/ 目录项目文档 | CC BY-NC 4.0（署名 + 非商用） |

完整组件致谢、许可证义务与禁用组件记录见 [docs/书时-开源组件与合规.md](docs/书时-开源组件与合规.md)，应用内「我的 → 关于」页同步展示致谢清单。

## 隐私说明

- 书籍文件、阅读进度、书摘等数据仅存储于浏览器本地（IndexedDB / localStorage），无任何服务端收集
- 不提供、不索引任何盗版书源；用户本地导入文件的来源合规责任由用户自行承担
- M5 上线后，AI 密钥同样仅存浏览器本地，代码中不存在上传或传输密钥的逻辑

## 致谢

书时站在开源项目肩膀上，主要参考与依赖（完整声明见 THIRD_PARTY_NOTICES）：

[MindSpace](https://github.com/jabez0701/MindSpace)（MIT）· [kit](https://github.com/aafnnp/kit)（MIT）· [Tamagochi](https://github.com/Tech-aficionado/Tamagochi---Open-Source-Game)（MIT）· [NextChat](https://github.com/ChatGPTNextWeb/NextChat)（MIT）· [epub.js](https://github.com/futurepress/epub.js)（MIT）· [pdf.js](https://github.com/mozilla/pdf.js)（Apache-2.0）· [foliate-js](https://github.com/johnfactotum/foliate-js)（MIT）· [shiki-toolbox](https://github.com/Elari39/shiki-toolbox)（MIT）· React / Vite / vite-plugin-pwa（MIT）
