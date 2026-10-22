# 变更日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号规则见 [docs/书时-版本管理规范.md](docs/书时-版本管理规范.md)。
本文件随源代码采用 [Apache-2.0](LICENSE) 许可；docs/ 目录下的文档采用 CC BY-NC 4.0。

## [未发布]

## [1.7.0] - 2026-10-22

### 新增

- **实时时间（v1.7.0 打磨）**：顶栏时钟由 30 秒刷新升级为**秒级实时**——秒位变化时轻跳、冒号每秒呼吸闪烁；日期随秒级 tick 自然跨天切换，无需额外逻辑
- **时段问候语**：首页标题行右侧随时段切换（夜深了 / 早上好 / 上午好 / 中午好 / 下午好 / 晚上好），切换时淡入；纯函数 `greetingForHour(hour)` 置于 `shared/dates.ts`（可单测），由分钟级 ticker 驱动
- **全局点击涟漪**：`.btn` / `.feature-cell` / `.segmented-item` / `.icon-btn` 按下位置注入水波纹。实现为 `document` 级 pointerdown 事件委托（`src/shared/interactions.ts`），不逐组件改代码即覆盖现有与未来的按钮类元素；禁用态（disabled / aria-disabled）不响应
- **金币飘字**：顶栏金币余额变化时飘出 `+N` / `-N`（购入零食扣费亦可感知），0.9s 上浮淡出后自动清除
- **氛围背景层**：`app-shell` 内新增纯装饰光斑层（`.ambient`，三团径向渐变色斑 26~40s 缓慢漂移），`pointer-events: none` 且绘制于内容层之下；像素皮肤自动隐藏（气质不符）
- **动画总开关（v1.7.0 打磨）**：「我的 → 设置」新增「减少动画」开关——开启后全局关闭动画与过渡（等效系统「减少动态效果」），照顾对动效敏感或低性能设备用户；落 `<html data-reduce-motion>`，与 `prefers-reduced-motion` 媒体查询并列生效，持久化随数据备份

### 变更

- **按钮与功能格按压反馈**：`.btn` / `.feature-cell` 按压由 scale(0.96~0.97) 加深为 scale(0.94)，回弹曲线改为 `cubic-bezier(0.34, 1.56, 0.64, 1)`（弹性收敛）；功能格在指针设备上新增悬浮微抬（translateY(-2px) + 描边高亮），移动端无 hover 不受影响
- **底部导航**：活动图标弹跳一次（nav-pop）+ 底部小指示条弹性展开；指示条随 active 状态滑动切换
- **卡片进场**：切换 Tab 时 `.page` 子元素错落淡入（stagger 40ms/项，0.4s 收敛），利用条件渲染重挂载自然触发，零 JS
- **宠物舞台**：猫脚下新增椭圆地面投影，随待机呼吸同步缩放（2.6s 循环）；首页宠物预览条内投影隐藏（空间局促）
- **今日分钟数**：数值变化时数字轻弹一次（scale 1.22 → 1，回弹曲线），阅读计时增长可感知

### 技术内部

- 新增 `src/shared/interactions.ts`（零依赖，符合 shared 层规则）：`installRipple(root)` 挂载/卸载事件委托；涟漪尺寸取点击点至元素边缘覆盖全元素的直径，`animationend` + 800ms 兜底双清理防泄漏
- `TopBar` 改用既有 `useTicker(1000)`（原自建 30s interval 删除，逻辑收敛）；秒 span 与金币飘字均以 key 变化驱动重挂载动画，动画结束回调清理状态
- `shared/dates.ts` 新增 `greetingForHour` 纯函数；`tests/dates.test.mjs` 新增 1 项用例（六时段 13 个边界值），测试总数 72 → 73
- 样式集中于 `styles.css` 末尾「微交互与实时时间（v1.7.0）」章节；`.page` 补 `position: relative; z-index: 1`——定位绘制的氛围层默认盖在普通流卡片之上，需显式抬升内容层
- **全量尊重 `prefers-reduced-motion: reduce`**：文末统一媒体查询关闭本章全部动画（氛围漂移、卡片进场、导航弹跳、秒跳、闪烁、飘字、轻弹、投影呼吸、Zzz），并静态呈现终态，不留半透明残影；该降级路径经既有 `.repo-link` 规则延续，本次集中收口
- **动画总开关技术内部**：设置模型新增 `reduceMotion` 字段（旧设置无此键 → 默认 false，向后兼容）；`<html data-reduce-motion>` 与系统媒体查询经通配选择器 `*` + `!important` 双重通道通杀全部动画/过渡（覆盖本章与既有 `.btn`/抽屉/toast 等），比原先仅覆盖 `.repo-link` 的降级更完整；JS 侧三处动画驱动同步尊重该开关——涟漪委托（`installRipple`）、像素猫 canvas 渲染循环（`CatStage`）、金币飘字（`TopBar`，关闭时不渲染，避免 `animationend` 不触发导致残留）；备份经 localStorage 全量快照自动覆盖，无需改备份格式

## [1.6.0] - 2026-10-22

手动检查更新上线 + 版本号单点管理 + 首页日期格式升级。

### 新增

- **手动检查更新**：「我的 → 关于书时」卡片新增「检查更新」按钮。点击后强制 Service Worker 向服务器检查新版本，三态提示——「发现新版本，刷新即可使用」（附「立即刷新」按钮，一键加载最新版）/「当前已是最新版本」/「检查失败：网络异常，或当前环境未启用离线缓存」。PWA 底层的 autoUpdate 自动更新机制保持不变（手动检查是主动触达的补充，不替换兜底）
- **版本号单点管理（工程）**：`package.json` 的 `version` 成为唯一版本号来源，构建时由 vite.config.ts 注入为全局常量 `__APP_VERSION__`，「我的」页版本脚注自动同步。发版时版本号手改位置从两处减为一处（package.json），阶段主题文案仍需手改。详见 docs/书时-版本管理规范.md v1.4

### 变更

- **首页顶栏日期格式升级**：由「10月22日 周三 07:10」升级为「2026年10月22日 周四 07:10」——补全年份，跨年场景（尤其翻看打卡日历历史月份时）语境更明确；展示逻辑收敛至 shared/dates.ts 的 `formatDateLabel`（新增，带单测）

### 技术内部

- 新增 `src/platform/update.ts`（零模块依赖，符合 platform 层规则）：`checkForUpdate` 经 `registration.update()` 强制检查 + `updatefound` 监听，10s 超时收敛；并发兜底（检查时已有 installing/waiting 中的新 SW）；`applyUpdate` 整页刷新由新 SW 接管
- ProfileView「关于书时」卡片内联更新区：按钮三态（检查更新 / 检查中… / 发现新版本）+ available 时的「立即刷新」动作 + latest/failed 消息 5s 自动消失；样式走既有 `.btn` 体系（含像素皮肤适配）
- `tests/dates.test.mjs` 新增 6 项用例（formatDateLabel 跨月/周末/前导零 + formatKey/todayKey/shiftDay 跨月跨年闰日边界）；package.json 的 test 脚本扩展为两段 tsc 编译（dates.ts 单独输出 `.test-dist/shared/`，不动既有三个 model 测试的导入路径）
- 已知限制（借本次更新功能顺带记录，本次不修）：localStorage 中的设置键暂无迁移机制——IndexedDB 有 MIGRATIONS 登记制，若未来版本改设置键名，老用户设置会静默丢失；数据备份导出/导入的版本校验（parseBackupBundle）是现有兜底

## [1.5.2] - 2026-10-21

开源致谢三处表面对齐补全（文档修订）。

### 文档

- **README「开源致谢」**：直接依赖表补登记 Desktop-Pixel-Pet 像素猫美术资产（CanFlyhang，MIT，随源码分发）
- **应用内「我的 → 开源致谢」**：改为分组展示（组件与资产 / 设计参考），补 Desktop-Pixel-Pet 与 Workbox 独立行，原「React / Vite / vite-plugin-pwa」合并行拆为 React / React DOM、Vite、@vitejs/plugin-react、vite-plugin-pwa、TypeScript 独立行
- **docs/书时-开源组件与合规.md**：第 1 节同步拆行补全（文档版本 v1.6），并更正 NextChat 作者名拼写（ChatGPTNextweb → ChatGPTNextWeb）
- THIRD_PARTY_NOTICES.md 此前已完整（含 pixel_cat.json 许可证原文），本次无需改动

## [1.5.1] - 2026-10-21

v1.5.0 的入口修复：首页功能网格中「数据备份」「主题皮肤」两格此前挂着 M6「规划中」角标且点击无反应，实际功能已在「我的」页上线。

### 修复

- **首页「数据备份」「主题皮肤」入口接通**：两格移除 M6 规划角标，点击后跳转「我的」页并平滑滚动到对应卡片（数据备份 / 设置-界面皮肤），与既有「阅读统计」「打卡日历」的跳转模式一致
- 「阅读统计」「打卡日历」的跳转逻辑收敛为统一的 `PROFILE_SECTIONS` 映射表，新增入口只需在表中登记卡片 id

### 技术内部

- `HomeView` 的 `Feature.action` 联合类型扩展 `backup`/`skin`；`handleFeature` 中 stats/calendar 的专用分支替换为查表分支，行为不变

## [1.5.0] - 2026-10-21

M6 打磨（第一部分）：界面皮肤（液态玻璃 / 像素风）+ 本地数据备份。

### 新增

- **界面皮肤（M6 主题皮肤）**：「我的 → 设置」新增「界面皮肤」三选一——默认 / 液态玻璃 / 像素风。液态玻璃为毛玻璃质感（半透明表面 + 背景模糊 + 柔和渐变 + 大圆角），像素风为硬边直角 + 粗描边 + 硬阴影 + 等宽字体复古配色；两套皮肤均可叠加在浅色 / 深色 / 跟随系统之上，切换即时生效、刷新保留（落 `tailtale:settings`）。经用户决策，皮肤定位为**免费 UI 个性化**（非 PRD 原稿「阅读主题皮肤 300 币」的商品化形态），接入金币解锁待「商店」模块建成后
- **数据备份（M6）**：「我的 → 数据备份」卡片支持一键导出 / 导入。导出把全部本地数据打包为 JSON（`tailtale-backup-YYYYMMDD.json`）：含 IndexedDB 六个 store（books / contents / wallet / checkins / reading_session / pet）全量行，以及 localStorage 中所有 `tailtale:*` 键（设置、AI 密钥等）；导入经格式校验后覆盖写回，并整页刷新重水合。用于换设备与清理缓存后的恢复

### 技术内部

- settings 模块扩展承载 M6 两块功能（路线图将「主题/字号/数据备份」归 settings 所有）：`model` 增 `UiSkin`/`THEME_SKINS` 与 `BackupBundle`/`parseBackupBundle` 纯函数；`store` 增 `useSkin`/`setSkin`/`applySkin`（`<html data-skin>` 镜像，与 `data-theme` 并列）；`service` 增 `collectBackup`/`restoreBackup`/`exportBackupToFile`/`importBackupFromFile`
- 皮肤样式复用现有 `--bg/--surface/--border/--shadow/--primary` 等 CSS 变量，覆盖块写在 `data-theme` 区块之后并按浅/深/跟随系统三态分支，保证「浅深 × 玻璃/像素」四组合均成立，不引入新变量名
- 备份导入为覆盖式（先清后写），导入前 `confirm` 提示，不做合并以免冲突
- 新增 `tests/backup-model.test.mjs`（node:test，零新依赖）：非法 JSON / 来源错误 / 版本过高 / 字段缺失 / 正常包 6 项判定；`package.json` test 脚本把 `src/modules/settings/model.ts` 一并编译进 `.test-dist`

## [1.4.0] - 2026-10-21

### 新增

- **「我的」页新增 GitHub 仓库入口**：「关于书时」卡片内展示仓库地址 github.com/xiaoyu-hue/tailtale（新标签页打开），用户可直达源码、许可与致谢信息
- **M5 AI 解读书（BYOK + DeepSeek 直连）**：新增 `src/modules/ai/` 模块，支持用户在「我的」页填入自有 DeepSeek API Key（密钥仅存浏览器 localStorage，代码中无上传/传输逻辑）；阅读器底部「AI 解读」入口唤起抽屉，提供「全书大纲/摘要」（2.4 万字以上走 map-reduce 分组摘要再合并）与「针对本书提问」两项能力；调用前弹窗预估 token 数与参考费用，生成内容标注「AI 生成，仅供参考」。首期支持 TXT 与 EPUB（PDF 暂不支持）；思维导图列入 v1.5.0

### 改进

- **AI 解读书健壮性优化**：单次调用超时 60s→25s（快速失败，不再让用户干等）；EPUB 全文提取加 25s 超时防畸形文件卡死；`fetch` 网络层错误与超时精确区分并给出中文诊断（去掉误导性的"改用 DeepSeek 预设"，改为检查网络/代理/CORS）；新增「测试连接」按钮，填完密钥可一键预检端点连通性与密钥有效性，无需读完书点生成才发现失败

## [1.3.0] - 2026-10-21

M3 宠物系统完整上线：S1 数据与逻辑层 + S2 商店与金币闭环 + S3 像素猫渲染器与界面 + S4 羁绊时刻。宠物三属性、好感度/成长、睡觉态与全部互动规则落地为可单测的纯函数 + store + service，数据库升至 v3；商店四件零食接通金币消费，读书赚币喂猫的循环闭合；零依赖 canvas 渲染器把 MIT 像素猫资产带进界面；连续阅读 30 分钟触发羁绊时刻，猫会蹭屏幕撒娇。

### 新增

- **pet 模块（数据与逻辑层）**：`src/modules/pet/`（model 纯函数 / store / service / index）。三属性（饱食度/心情/精力）按天级衰减，离线按时间戳差分结算、一次最多结算 7 天（防设备长期关机或改时钟造成属性断崖）；饱食度 ≤20 时每过一整天好感 -2 的"想念"惩罚（无死亡机制，永远存活）
- **睡觉行动**（免费，用户 2026-10-21 决策）：睡觉时饱食衰减减半、心情不衰减、精力每小时 +10（单次封顶 +40）；睡醒好感 +1 且计入每日上限；睡觉中不能喂食/玩耍/抚摸——既是精力见底后的恢复手段，也堵死挂机刷属性
- **商店与金币闭环（S2）**：四件零食/玩具（小鱼干 20 / 逗猫棒 30 / 猫条 50 / 猫薄荷 80 金币）按 PRD §3.1.2 实现效果与冷却；gamification 新增 `spendCoins`/`refundCoins`（原子校验余额，成功后广播 wallet:changed）；app 层 `commerce.ts` 编排跨模块购买事务——扣币 → 使用零食 → 使用失败立即回滚（补偿事务，防白送零食）
- **好感度双轨**：当前好感度（被冷落会下降）与成长值（累计获得、只增不减、封顶 400）分离，成长阶段四档：小猫 <50 / 少年猫 50–149 / 成年猫 150–399 / 完全体 400；好感每日获取上限 +10 防刷
- **免费抚摸每日 2 次**（用户决策；PRD 原稿两处分别记 3 次与 1 次，本版统一修正）
- **像素猫渲染器与宠物/商店界面（S3）**：零依赖 canvas 渲染器（`src/modules/pet/ui/`）——Desktop-Pixel-Pet 的 32×32 二帧资产（JSON 帧数据 + 调色板，MIT）随仓库分发；离屏帧缓存 + 整数倍放大 + `image-rendering: pixelated`，杜绝抗锯齿模糊；情绪驱动动画节奏（开心快晃 / 难过慢眨 / 没精神下沉 1 像素 / 饿坏快速眨眼），睡觉为静态帧 + 透明度呼吸 + Zzz 气泡；皮肤 = 调色板置换（橘猫/三花/黑猫数据已定义，解锁入口属装扮线、M3 未上）；`prefers-reduced-motion` 时完全静止。界面：宠物页（形象 / 三属性条 / 成长进度 / 抚摸 / 睡觉 / 羁绊横幅）、商店页（余额 / 四件零食 / 冷却倒计时 / 禁用原因 / 装扮线规划）、首页宠物预览条；功能网格「宠物 / 商店」两格接通
- **羁绊时刻（S4）**：新事件类型 `reading:bond_moment`——阅读会话每跨满 30 分钟广播一次（含刷新恢复的会话，已触发计数落库、刷新不重触发）；pet 订阅后好感 +5（计入每日上限）、未看计数 +1；猫视图 / 首页预览挂载时播放「蹭屏幕」动画并展示横幅。跨 30 分钟块同时照常发放 10 金币（与阅读奖励同口径）
- **单元测试基础设施**：`tests/pet-model.test.mjs`，37 项用例覆盖衰减/睡觉/限次/冷却/日限/成长/情绪/羁绊时刻；用 Node 内置 `node:test` + tsc 单文件编译（`.test-dist/`，已 gitignore），**零新依赖**——项目仍不引任何测试框架
- **shared/dates.ts**：本地时区日期键工具（formatKey/todayKey/shiftDay）从 gamification 模块上移 shared 层——pet 成为第二个消费者，兑现架构文档"出现第二个消费者时上移"的预设

### 技术内部

- **IndexedDB 升级 v2 → v3**：新增 pet store（单例行）；fake-indexeddb 冒烟验证三条路径——v1 老库直升 v3、v2 库升级后钱包/打卡数据无损、v3 重复打开幂等
- **pet 不走事件总线**：经评估无跨模块消费者（首页速览等直接订阅 pet store），互动动作经 store 层封装、DB 读写成功后以返回值同步内存；判定标准记入架构文档 6.2：有跨模块副作用才用事件，纯状态展示用订阅
- **model.ts 零 import**：时间（now）与日期键（today）由调用方注入，保证可独立编译单测；service 层串行队列读-改-写防并发互动竞态，拒绝路径也会落库衰减结果
- **购买事务顺序**：先扣币后使用（而非先用后扣）——后者会在使用成功但扣款失败时白送零食；补偿回滚仅覆盖并发竞态与 IO 异常，正常流程 UI 已按同样规则禁用按钮
- 启动装配：App.tsx 增一行 `refreshPet()`（与 refreshGamification 并列），首次启动创建宠物数据并结算离线衰减
- **UI 侧禁用规则与模型同源**：SnackButtons 的禁用判断（睡觉 / 精力不足 / 冷却中 / 余额不足）为展示层预检，authoritative 判定仍在 pet 模型——UI 预检只为体验，防正常路径；并发竞态与 IO 异常由 app 层补偿回滚兜底
- **属性值展示取整**：衰减按天的小数累加（模型保持浮点精度），UI 层 `Math.round` 展示，避免出现 61.9999993 式的数值
- **会话新增 bondsAwarded 计数**：gamification 阅读会话记录已触发的羁绊时刻次数（旧行无此字段按 0 兼容，无需 DB 迁移）；触发点选在 settle 的分钟奖励之后，与金币/XP 同一把串行队列
- **assets 目录随源码分发第三方资产**：`pixel_cat.json` + `pixel_cat.LICENSE`（MIT 原文同目录），THIRD_PARTY_NOTICES 第 1 节与合规文档同步登记
- **已知取舍**：资产仅 2 帧待机动画，本版全部动画为节奏变化（眨眼/摇尾/浮动）而非补帧（调研报告曾建议程序化补帧）；帧数据即 JSON，后续补帧不换架构
- **视觉与交互验收**：无头 Chromium 截图 + 断言——购买流（扣币 / 属性变化 / 好感日限 / 冷却倒计时 / 余额不足禁用）、羁绊时刻端到端（30 分钟块触发、横幅、刷新不重触发）、深色模式、reduced-motion 静止（帧差为 0）

### 修复

- **PRD 抚摸次数自相矛盾**：§3.1.2 记"每日 3 次"、§5.2 记"每天 1 次"，按用户决策统一为 2 次（决策记录已留痕）

## [1.2.2] - 2026-10-20

移动端适配：修复 iOS Safari 下滑动翻页失效的问题。安卓与桌面行为不变。

### 修复

- **iOS 端滑动翻页失效**（真机测试发现，Safari 下三个阅读器滑动均无响应）：根因是 iOS Safari 的规矩——手指一动系统即开始判定「这是滚动吧」，一旦进入滚动模式，`touchend`（松手）不再派发、改派 `touchcancel`，翻页判定等不到松手；而原实现中 TXT / PDF 走 React 合成事件（touchmove 固定 passive）、EPUB 走 passive 原生监听，两条路都无法阻止系统滚动。修复：三个阅读器统一改为原生 `addEventListener` + `passive: false`，手指移动超过 10px 定型后立即 `preventDefault()` 扼杀滚动（TXT 只拦横向、竖滑放行原生滚动；EPUB / PDF 横竖全拦）；`touchcancel` 仅重置状态不误触发翻页；另补 CSS `touch-action`（TXT pan-y / PDF 与 EPUB iframe none）作 iOS 13+ 渐进增强。安卓与桌面行为不变

## [1.2.1] - 2026-10-20

继续阅读卡片可读性优化：间距拉开、进度条加粗。

### 优化

- **继续阅读卡片可读性**：书名、进度条、按钮三者间距从 0 拉开到 12px，进度条从 6px 加粗到 10px——此前三者紧贴、进度条在手机上几乎看不见；改动为作用域样式（`.continue-card`），不影响书架书籍列表的细进度条

## [1.2.0] - 2026-10-20

滑动翻页：三个阅读器统一支持手势翻页，自研零依赖 hook，不引任何新依赖。M3 宠物系统顺延至下一版本。

### 新增

- **滑动翻页**：三个阅读器统一支持手势翻页——左滑 / 上滑 = 下一页，右滑 / 下滑 = 上一页；EPUB / PDF 横竖滑均可翻页，TXT 左右横滑快速切章（竖滑保持原生滚动）
- **自研手势 hook**：`src/shared/hooks/useSwipe.ts`（shared/hooks 目录首个真实文件），零新依赖；含防误触设计——小位移视为点击不翻页，滑动后 400ms 内吞掉浏览器合成的尾随 click（不误触控件栏显隐）

### 技术内部

- 修复 EPUB 阅读器遗留死代码：原「rendered」回调把 click 监听绑在不含 `addEventListener` 方法的 IframeView 实例上，点击正文切换控件栏实际从未生效；改绑 iframe 的 `contentDocument` 后恢复
- 以捕获阶段监听 + `stopImmediatePropagation` 禁用 epub.js 内置滑动（snap_Snap），避免与自研手势双翻页；iframe `documentElement` 设 `touch-action: none` 禁原生平移

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
[1.2.0]: https://github.com/xiaoyu-hue/tailtale/releases/tag/v1.2.0
[1.2.1]: https://github.com/xiaoyu-hue/tailtale/releases/tag/v1.2.1
[1.2.2]: https://github.com/xiaoyu-hue/tailtale/releases/tag/v1.2.2
[1.3.0]: https://github.com/xiaoyu-hue/tailtale/releases/tag/v1.3.0
