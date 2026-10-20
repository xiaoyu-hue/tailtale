# 变更日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号规则见 [docs/书时-版本管理规范.md](docs/书时-版本管理规范.md)。
本文件随源代码采用 [Apache-2.0](LICENSE) 许可；docs/ 目录下的文档采用 CC BY-NC 4.0。

## [未发布]

（下一个版本的变更记录写在这里，发布时改为正式版本号与日期）

## [1.1.0] - 2026-10-20

多格式阅读：EPUB / PDF 双格式导入与渲染上线，书架与阅读器全链路适配。里程碑与版本号解耦——本次为 M2 之后的独立功能版本，M3 宠物系统顺延至下一版本。

### 新增

- **EPUB 导入与阅读**：epub.js 渲染，支持翻页 / 滚动、目录跳转、字号与主题跟随、CFI 精确续读（回到书架再进来停在原句）
- **PDF 导入与阅读**：pdf.js 按页渲染，页码指示（第 X/Y 页）、画布自适应缩放、恢复上次阅读页码
- **书架格式角标**：每本书标注 TXT / EPUB / PDF；体积显示按格式分流（TXT 按字数，EPUB / PDF 按 KB / MB）
- **导入区三格式**：支持拖入或选择 `.epub` / `.pdf`，不支持的格式给出明确提示

### 变更

- **书籍模型扩展为多格式**：`BookFormat = txt | epub | pdf`，内容存储分文本 / 二进制两路；旧数据（纯 TXT）自动兼容，无需迁移
- **进度指纹双路**：TXT 按字符内容、EPUB / PDF 按文件字节，各自计算指纹，去重与续读口径不变
- **读完判定适配**：EPUB 翻到最后一章最后一页、PDF 翻到最后一页，自动标记「读完」并发放奖励
- **技术栈新增两个渲染引擎**：epubjs 0.3.93 / pdfjs-dist 4.10.38，按格式动态加载，首屏体积不变
- **开源致谢与合规台账更新**：直接依赖补全至 11 项；**更正 epub.js 许可证误记**——规划文档记 MIT，随包 license 文件实为 BSD-2-Clause（Copyright (c) 2013, FuturePress），三处文档同步更正并留修正记录

### 技术内部

- 修复读完判定竞态：异步进度上报曾覆盖「读完」标记，改为在标记完成内部取最新状态并顺序化提交
- epub.js 已知坑处理：element 级 CFI 下 `location.start.percentage` 恒为 0，改用 spine 序号 + 页内进度加权估算
- pdf.js worker 经 Vite `?url` 导入随包分发；canvas 按 devicePixelRatio 适配，懒加载只渲染当前页
- `@types/epubjs` 上游不存在，自写最小类型声明 `src/types/epubjs.d.ts`

## [1.0.0] - 2026-10-20

首个正式版：M1 地基 + M2 阅读核心全部完成。以下为自 v0.1.0（2026-10-14 初始提交）起的累计变更。

### 新增

- **阅读计时**：打开书籍即计时，返回书架即停；切浏览器后台暂停；刷新后重开同一本书自动续计时（按内容指纹识别）
- **金币系统**：阅读每 30 分钟 +10 金币，顶栏实时显示
- **经验值（XP）**：每阅读 1 分钟 +1 XP，阅读统计卡展示累计
- **每日打卡**：当日阅读满 1 分钟可打卡，+5 金币起；连续打卡第 3 天起每天 +2（单日上限 +10）
- **读完奖励**：将书籍标记为读完 +100 金币
- **settings 模块**：正文字号全局记忆（4 档：小/默认/大/特大），主题三选（跟随系统 / 浅色 / 深色），localStorage 持久化，并自动迁移 M1 旧字号键
- **我的页阅读统计**：累计阅读分钟、金币、读完本数、打卡天数、最长连续、在读本数一格总览
- **打卡日历**：当月热力图，支持翻看历史月份，图例说明打卡规则
- **文档体系**：架构设计文档（四层模块化目标架构与迁移路径）、技术栈文档、PRD、开源组件与合规台账、版本管理规范
- **文档独立许可证**：docs/ 目录采用 CC BY-NC 4.0，官方法律文本见 [docs/LICENSE](docs/LICENSE)

### 变更

- **四层模块化架构落地**：app（外壳）/ modules（books/reader/gamification/settings）/ platform（db/store/events/hash）/ shared；模块间只经各自 index.ts 暴露公开 API，platform 不依赖 modules（App.tsx 114 → 67 行）
- **IndexedDB 升级 v1 → v2**：新增 wallet / checkins / reading_session 三张表；迁移按数组登记、按 `version > oldVersion` 过滤执行
- **事件总线**：统一 wallet:changed / checkin:done / book:finished 三个事件
- **未上线功能入口**（M3-M7 的宠物、商店等占位页）改为可点击，并提示所属里程碑
- **计时口径修正**：原设计稿"切 Tab 计时不停"与 PRD"页面可见且书籍打开时累计"矛盾，按 PRD 执行——离开阅读页即停表、切浏览器后台暂停

### 技术内部

- 零依赖状态管理：`useSyncExternalStore` + 自建 store 工厂
- 计时服务防作弊：单 tick 增量上限 5 秒（防睡眠唤醒虚增）、generation 计数器防 React StrictMode 双挂载、串行队列防并发结算、`pagehide` 兜底持久化
- 奖励增量发放：按累计时长推导应发值，只发「推导值 − 已发放值」，刷新不重发不漏发
- 阅读进度记忆改用文件内容指纹（SHA-256），同一文件换设备可续读

[1.0.0]: https://github.com/xiaoyu-hue/tailtale/releases/tag/v1.0.0
[1.1.0]: https://github.com/xiaoyu-hue/tailtale/releases/tag/v1.1.0
