# 变更日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号规则见 [docs/书时-版本管理规范.md](docs/书时-版本管理规范.md)。
本文件随源代码采用 [Apache-2.0](LICENSE) 许可；docs/ 目录下的文档采用 CC BY-NC 4.0。

## [未发布]

（下一个版本的变更记录写在这里，发布时改为正式版本号与日期）

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
