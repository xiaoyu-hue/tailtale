# 书时 TailTale

[![Version](https://img.shields.io/badge/version-v1.8.0-orange)](https://github.com/xiaoyu-hue/tailtale/releases/tag/v1.8.0)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Docs License](https://img.shields.io/badge/docs-CC--BY--NC--4.0-lightgrey)](docs/LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-brightgreen)](https://tailtale-520.pages.dev/)
[![Data](https://img.shields.io/badge/data-100%25%20local-4c1)](#隐私与数据)

**游戏化阅读器 + 轻量工具箱**：读书记时长金币，金币养宠物，让读书像照顾一位小伙伴一样有牵挂。

- **本地优先**：电子书与全部用户数据不出浏览器，无需注册登录
- **零成本运营**：无服务器、无数据库、无 AI 费用（AI 采用 BYOK 模式，用户自带密钥）
- **无支付、无商业化**：金币只能靠阅读赚取，不可购买
- **PWA**：可"添加到主屏幕"，离线可用；「我的」页支持手动检查更新，新版本一键刷新加载

---

## 目录

- [在线体验](#在线体验)
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [开发约定](#开发约定)
- [开源致谢](#开源致谢)
- [仓库结构](#仓库结构)
- [版本与发布](#版本与发布)
- [路线图](#路线图)
- [许可证](#许可证分层)
- [隐私与数据](#隐私与数据)

---

## 在线体验

**主站地址：<https://tailtale-520.pages.dev/>**

- 当前部署内容为 `main` 分支最新构建（**v1.8.0 · 安全加固、无障碍与质量门禁**）
- 数据全部存储在你自己浏览器的本地空间（IndexedDB / localStorage），清除浏览器数据前记得先体验、后清理
- 建议用手机浏览器打开后「添加到主屏幕」，即可像原生 App 一样全屏离线使用
- 推荐浏览器：Chrome / Edge / Safari 近两年版本（依赖 IndexedDB 与 Service Worker）

> 站点定位：**https://tailtale-520.pages.dev/** 为当前主站（Cloudflare Pages 托管，`main` 分支构建自动发布）。后续如启用自定义域名将平滑迁移，并保留本地址可访问。

---

## 功能特性

### 书架

- 本地导入 **TXT / EPUB / PDF** 电子书（点击导入或拖拽到书架区域）
- 三种阅读状态：想读 / 在读 / 读完，一键切换
- 删除与续读：按**文件内容指纹**记忆进度，同一文件换设备可续读

### 阅读器

- TXT：章节自动拆分与章节导航，滚动阅读，左右横滑快速切章
- EPUB：流式分页渲染（epub.js），目录跳转，CFI 精确位置续读，横竖滑翻页
- PDF：按页渲染（pdf.js），大文件懒加载不卡顿，横竖滑翻页
- **滑动翻页**：三个阅读器统一手势——左滑 / 上滑 = 下一页，右滑 / 下滑 = 上一页；TXT 竖滑保持原生滚动，横滑切章；iOS Safari 与安卓均已适配（真机验证）
- 正文字号四档调节（小 / 默认 / 大 / 特大），全局记忆（TXT / EPUB 生效）
- 进度记忆：切到后台、刷新页面都不丢

### 游戏化

- **阅读计时**：打开书籍即计时，返回书架即停；切浏览器后台自动暂停；刷新后重开同一本书自动续计时
- **金币**：阅读每 30 分钟 +10 金币，顶栏实时显示
- **经验值（XP）**：每阅读 1 分钟 +1 XP
- **每日打卡**：当日阅读满 1 分钟可打卡，+5 金币起；连续打卡第 3 天起每天 +2（单日上限 +10）
- **读完奖励**：标记读完一本书 +100 金币

### 个性化与统计

- **主题三选**：跟随系统 / 浅色 / 深色
- **阅读统计**：累计阅读分钟、金币、读完本数、打卡天数、最长连续打卡、在读本数
- **打卡日历**：当月热力图，可翻看历史月份

### 工具箱（规划中）

番茄钟 / 白噪音 / 文本统计 / 书摘导出 / 今日一书等，见[路线图](#路线图)。

---

## 快速开始

环境要求：**Node.js 20+**。

```bash
git clone https://github.com/xiaoyu-hue/tailtale.git
cd tailtale
npm install        # 安装依赖
npm run dev        # 本地开发（默认 http://localhost:5173）
npm run build      # 类型检查 + 生产构建（输出 dist/）
npm run preview    # 预览生产构建（默认 http://localhost:4173）
```

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | `tsc --noEmit` 类型检查 + Vite 生产构建 |
| `npm run preview` | 本地预览生产构建（验证 PWA 需用此模式） |
| `npm run typecheck` | 仅跑 TypeScript 类型检查 |

导入书籍：首页点击「导入 TXT 书籍」或把 .txt / .epub / .pdf 文件拖入书架区域。

---

## 技术栈

| 类别 | 选型 | 版本 | 选型理由 |
|---|---|---|---|
| UI 框架 | React | 18.3.1 | 生态成熟，PWA 支持完善；函数组件 + Hooks |
| 开发语言 | TypeScript | 5.9.3 | 全量类型覆盖，编译期拦截绝大多数错误 |
| 构建工具 | Vite | 5.4.21 | 秒级冷启动的 dev server，产物体积小 |
| React 支持 | @vitejs/plugin-react | 4.7.0 | JSX 转换 + Fast Refresh |
| PWA | vite-plugin-pwa | 0.21.2 | 自动生成 Service Worker（底层 Workbox，MIT）与 Web Manifest |
| EPUB 引擎 | epub.js（npm 包 epubjs） | 0.3.93 | EPUB 解析与流式分页，BSD-2-Clause；按需动态加载 |
| PDF 引擎 | pdf.js（npm 包 pdfjs-dist） | 4.10.38 | PDF 解析与 canvas 按页渲染，Apache-2.0；按需动态加载 |
| 状态管理 | 自研零依赖 store | — | 基于 `useSyncExternalStore`，无 Redux/MobX 类依赖，包体与认知负担双低 |
| 本地存储 | IndexedDB + localStorage | — | 结构化数据用 IndexedDB（含版本迁移），偏好设置用 localStorage |

设计原则：**能自己写的绝不引依赖**。运行时核心依赖仅 React / React DOM；EPUB / PDF 渲染引擎（epubjs / pdfjs-dist）按格式动态加载，TXT 用户不会下载它们。

---

## 架构设计

四层架构，单向依赖（上层可以用下层，下层不许反向依赖）：

```
app/          应用外壳：App.tsx（导航 + 装配）/ views/（路由级视图）
modules/      领域模块：books（书架）/ reader（阅读器）/ gamification（游戏化）/ settings（设置）
platform/     平台能力：db（IndexedDB + 迁移）/ store（状态工厂）/ events（事件总线）/ hash（内容指纹）/ update（PWA 更新检查）
shared/       跨模块共享：ui（TopBar / BottomNav 等）
```

硬规则：

1. **模块自治**：每个模块只经各自的 `index.ts` 暴露公开 API，模块间禁止跨模块内部引用
2. **platform 不依赖 modules**：平台层对业务模块零感知
3. **模块内部四件套**：`model`（纯函数与类型）→ `service`（持久化与副作用）→ `store`（状态）→ `ui`（组件）
4. **数据演进**：数据库 schema 变更必须走迁移登记（`MIGRATIONS` 数组），禁止静默改表

目标架构、模块边界与迁移路径详见 [docs/书时-架构设计.md](docs/书时-架构设计.md)。

---

## 开发约定

- **模块边界**：新增功能优先落到对应 `modules/` 子模块；跨模块通信走 `platform/events` 事件总线或公开 API，不建隐藏耦合
- **状态管理**：全部状态经 `platform/store` 的 `createStore` 工厂创建，selector 必须返回引用稳定值（基本类型或 state 中已存在的对象引用）
- **计时与结算**：涉及计时发放奖励的逻辑必须防作弊（单 tick 增量上限）且幂等（刷新不重发不漏发），参考 `modules/gamification/service.ts`
- **测试**：核心纯函数有单元测试；每次改动跑 `npm run build` + 冒烟测试；涉及 UI 的改动附浏览器实时验收
- **版本管理**：语义化版本 + 本项目三级映射，发版流程与必改位置清单见 [docs/书时-版本管理规范.md](docs/书时-版本管理规范.md)
- **CI 质量门禁**：仓库已配置 GitHub Actions（`.github/workflows/ci.yml`），push / PR 自动执行类型检查、测试与构建；Cloudflare Pages 仍直接部署 `main`，CI 为质量可见性（详见 [docs/书时-技术栈.md](docs/书时-技术栈.md)）
- **提交规范**：conventional commits（`feat:` / `fix:` / `docs:` / `refactor:` / `release:` 等），与版本升级的对应关系见版本管理规范第 7 节
- **代码与文档同步**：功能变更必须同步更新 README 与 docs/ 相关文档后再提交
- **凭证安全**：代码中禁止出现任何密钥、令牌；涉及推送使用一次性令牌并限期吊销

---

## 开源致谢

书时站在开源社区的肩膀上。我们向下面每一个项目致以诚挚的谢意——它们或提供了可直接集成的组件，或贡献了关键的设计与工程思路。所有版权与许可证声明均从各项目随包分发的 LICENSE 文件原文摘录。

### 直接依赖（进入当前构建）

| 组件 | 作者 / 组织 | 许可证 | 用途 |
|---|---|---|---|
| [React](https://github.com/facebook/react) | Facebook, Inc. and its affiliates | MIT | UI 框架与浏览器渲染（React 18） |
| [React DOM](https://github.com/facebook/react) | Facebook, Inc. and its affiliates | MIT | React 的 DOM 渲染器 |
| [epub.js](https://github.com/futurepress/epub.js) | FuturePress | BSD-2-Clause | EPUB 解析与流式分页渲染（npm 包 `epubjs`，按需加载） |
| [pdf.js](https://github.com/mozilla/pdf.js) | Mozilla | Apache-2.0 | PDF 解析与 canvas 按页渲染（npm 包 `pdfjs-dist`，按需加载） |
| [Vite](https://github.com/vitejs/vite) | Vite 团队（Yuxi (Evan) You and contributors） | MIT | 开发服务器与生产构建 |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | Yuxi (Evan) You and Vite contributors | MIT | Vite 的 React 支持（JSX 转换、Fast Refresh） |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | Anthony Fu | MIT | Service Worker 生成与 PWA 清单配置（运行时打包 Workbox，MIT） |
| [TypeScript](https://github.com/microsoft/TypeScript) | Microsoft | Apache-2.0 | 类型检查（开发期依赖，不进入产物） |
| [Workbox](https://github.com/GoogleChrome/workbox) | Google | MIT | vite-plugin-pwa 底层：Service Worker 预缓存与运行时缓存 |
| [Desktop-Pixel-Pet](https://github.com/CanFlyhang/Desktop-Pixel-Pet)（pixel_cat.json） | CanFlyhang | MIT | 像素猫美术资产：32×32 二帧待机像素猫（非 npm 依赖，随源码分发；书时按调色板置换实现皮肤数据，未改动像素数据） |

### 间接依赖

构建期安装数百个间接依赖（含平台专用二进制），许可证以 MIT / ISC / BSD / Apache-2.0 等宽松许可为主，**无 GPL / LGPL / AGPL / MPL / SSPL 等传染性或限制性许可证组件**。完整依赖树以 `package-lock.json` 为准，逐包许可证统计见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 第 2 节。

### 计划引入（已核实许可证，尚未进入构建）

| 组件 | 作者 / 组织 | 许可证 | 用途 | 计划接入 |
|---|---|---|---|---|
| [foliate-js](https://github.com/johnfactotum/foliate-js) | johnfactotum | MIT | 备选渲染引擎（MOBI / AWZ3 / FB2 / CBZ） | 备用 |

### 设计参考（不集成代码，仅参考思路）

| 项目 | 作者 | 许可证 | 参考内容 |
|---|---|---|---|
| [MindSpace](https://github.com/jabez0701/MindSpace) | Jabez | MIT | 打卡 / 经验值 / 等级逻辑思路、公版书下载脚本思路、主题系统思路 |
| [kit](https://github.com/aafnnp/kit) | aafnnp | MIT | 工具箱交互：分类 / 收藏 / 最近使用 / 全局搜索 |
| [Tamagochi](https://github.com/Tech-aficionado/Tamagochi---Open-Source-Game) | Tech-aficionado | MIT | 宠物系统：属性衰减、成长阶段、喂食 / 玩耍 / 清洁 / 睡觉 |
| [NextChat](https://github.com/ChatGPTNextWeb/NextChat) | ChatGPTNextWeb | MIT | AI 交互模式：BYOK 设置页、多模型切换 |
| [shiki-toolbox（四季箱）](https://github.com/Elari39/shiki-toolbox) | Elari39 | MIT | 设计系统与算法工程思路（小程序原生代码，不集成） |

### 组件选用原则

- 只集成 MIT / Apache-2.0 / BSD 类宽松许可证组件；GPL / AGPL 组件一律不集成；无许可证代码一律不复制
- 经评估**不采用**的项目及原因（如 Koodo Reader、Readest、Anx Reader、Habitica 等）记录在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 第 5 节，以防后续误用

完整组件致谢、逐包许可证义务与合规台账见 [docs/书时-开源组件与合规.md](docs/书时-开源组件与合规.md)，应用内「我的 → 关于」页同步展示致谢清单。

---

## 仓库结构

```
├── CHANGELOG.md              版本演进记录（Keep a Changelog 风格）
├── LICENSE                   Apache-2.0 全文（覆盖自有源代码）
├── THIRD_PARTY_NOTICES.md    第三方组件版权与许可证声明
├── README.md                 本文件（Apache-2.0）
├── docs/                     项目文档（CC BY-NC 4.0，全文见 docs/LICENSE）
│   ├── LICENSE               CC BY-NC 4.0 官方法律文本（文档许可）
│   ├── 书时-PRD.md           产品需求文档
│   ├── 书时-技术栈.md         技术选型与架构
│   ├── 书时-架构设计.md       目标架构、模块边界与迁移路径
│   ├── 书时-版本管理规范.md   版本号规则、发版流程与 CHANGELOG 约定
│   └── 书时-开源组件与合规.md  组件致谢、许可证义务与合规台账
├── index.html
├── vite.config.ts            Vite + PWA 配置
└── src/
    ├── main.tsx              入口
    ├── vite-env.d.ts         Vite 客户端类型引用（?url 资源导入声明）
    ├── types/                第三方库最小类型声明（epubjs 等）
    ├── styles.css            设计变量（暖色主题 + 深色模式适配）
    ├── app/                  应用外壳：App.tsx（导航 + 装配）/ views/（路由级视图）
    ├── modules/              领域模块（自治，只经各自 index.ts 暴露公开 API）
    │   ├── books/            书架：model（类型 + 状态机 + 多格式）/ store / service / ui
    │   ├── reader/           阅读器：model（TXT 章节拆分）/ ui（TxtReader / EpubReader / PdfReader 按格式分流）
    │   ├── gamification/     游戏化：model（经济数值 + 纯函数）/ service（计时 + 持久化）/ store / ui
    │   ├── pet/              宠物：model（属性/好感/成长/羁绊纯函数）/ service（计时队列）/ store / ui（像素猫 canvas）
    │   ├── settings/         全局偏好：model（字号档位 + 主题）/ service（localStorage）/ store / ui
    │   └── ai/               AI 解读书：model（纯函数 + prompt）/ service（DeepSeek 直连）/ store / ui（设置 + 抽屉）
    ├── platform/             平台能力：db（IndexedDB + 迁移）/ store（状态工厂）/ events（事件总线）/ hash（内容指纹）/ update（PWA 更新检查）
    └── shared/               跨模块共享：ui（TopBar / BottomNav 等）/ hooks（useSwipe 手势）/ utils（dates 日期工具 / interactions 涟漪委托 / useTicker 时钟）
```

---

## 版本与发布

- **当前版本：v1.8.0**（2026-10-22 发布，全维度代码审查修复：安全加固——新增 CI 质量门禁与 CSP 响应头、备份导出前明文密钥警示、恢复备份白名单校验；无障碍——全局键盘焦点圈与浅色对比度达 WCAG AA；功能——经济核心补单测、减少动画开关实时生效、商店文案对齐、大文件导入异步进度、读完发币仅在持久化成功后触发；文档同步——CHANGELOG 指纹算法更正、技术栈文档 CI 描述对齐、README 补 pet 模块等）；v1.7.0 及更早版本演进见 [CHANGELOG](CHANGELOG.md)
- [Releases](https://github.com/xiaoyu-hue/tailtale/releases) · [CHANGELOG](CHANGELOG.md)
- 版本号规则与发版流程：[docs/书时-版本管理规范.md](docs/书时-版本管理规范.md)
  - 主版本号（X.0.0）= 架构级变更；次版本号（1.X.0）= 新功能上线；修订号（1.1.X）= 优化、修复、文档同步

---

## 路线图

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M1 地基 | 脚手架、书架、TXT 阅读器 | ✅ 已完成 |
| M2 阅读核心 | 四层架构迁移、阅读计时、金币 / XP / 打卡 / 读完奖励、设置、统计与日历 | ✅ 已完成（v1.0.0） |
| 多格式阅读 | EPUB / PDF 导入与渲染、格式角标、CFI 精确续读 | ✅ 已完成（v1.1.0） |
| 阅读手势 | 滑动翻页：三个阅读器统一手势，左滑/上滑 = 下一页 | ✅ 已完成（v1.2.0） |
| M3 宠物 | 喂食 / 玩耍 / 好感度 / 成长阶段、金币闭环 | ✅ 已完成（v1.3.0） |
| M4 工具箱 | 番茄钟 / 白噪音 / 文本统计 / 书摘导出 / 今日一书 | ⬜ 计划中 |
| M5 AI 解读书 | BYOK 设置、DeepSeek 直连（TXT + EPUB） | ✅ 已完成（v1.4.0） |
| M6 打磨 | 主题皮肤、商店、数据备份 | ✅ 已完成（v1.5.0 上线界面皮肤 + 数据备份，v1.5.1 首页入口接通；猫皮肤商店留待后续「商店」模块） |
| M7 作品化 | README 完善、demo 优化、内置公版书库 | ⬜ 计划中 |

---

## 许可证（分层）

| 对象 | 许可证 |
|---|---|
| 书时自有源代码（`src/`、`README.md`、`CHANGELOG.md`） | [Apache-2.0](LICENSE)，Copyright © 2026 xiaoyu-hue |
| 第三方组件 | 各自原许可证，见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) |
| docs/ 目录项目文档 | [CC BY-NC 4.0](docs/LICENSE)（署名 + 非商用），官方法律文本见 docs/LICENSE |

---

## 隐私与数据

- 书籍文件、阅读进度、设置、书摘等数据仅存储于浏览器本地（IndexedDB / localStorage），无任何服务端收集
- 不提供、不索引任何盗版书源；用户本地导入文件的来源合规责任由用户自行承担
- M5 上线后，AI 密钥同样仅存浏览器本地，代码中不存在上传或传输密钥的逻辑
- 数据备份为本地文件导出，**包含 AI 密钥等明文内容**；导出前会明确警示，请勿将备份文件分享给他人或上传到不受信任的位置

---

*书时 TailTale · 本地优先的游戏化阅读器 · [在线体验](https://tailtale-520.pages.dev/)*
