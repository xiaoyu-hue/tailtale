# THIRD-PARTY NOTICES

本文件列出书时（TailTale）实际引入的第三方组件版权与许可证声明，以及计划引入组件的许可信息。所有版权行均从各组件随包分发的 LICENSE 文件原文摘录，未做改写。

书时自有源代码采用 Apache-2.0（见根目录 `LICENSE`）。第三方组件保留其原作者的版权声明与许可证，本文件随依赖演进更新。

---

## 一、当前构建引入的直接依赖

### React / React DOM

```
MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- 项目地址：https://github.com/facebook/react
- 用途：UI 框架与浏览器渲染（React 18）

### Vite

- 许可证：MIT（LICENSE.md 中不含单独版权行，为纯 MIT 许可文本）
- 项目地址：https://github.com/vitejs/vite
- 用途：开发服务器与生产构建

### @vitejs/plugin-react

- 许可证：MIT
- Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors
- 项目地址：https://github.com/vitejs/vite-plugin-react
- 用途：Vite 的 React 支持（JSX 转换、Fast Refresh）

### vite-plugin-pwa

- 许可证：MIT
- Copyright (c) 2020-PRESENT Anthony Fu <https://github.com/antfu>
- 项目地址：https://github.com/vite-pwa/vite-plugin-pwa
- 用途：Service Worker 生成与 PWA 清单配置
- 备注：运行时打包 Google Workbox（MIT，https://github.com/GoogleChrome/workbox）

### TypeScript（开发期依赖）

- 许可证：Apache-2.0（LICENSE.txt 为 Apache-2.0 全文，不含单独版权行）
- 项目地址：https://github.com/microsoft/TypeScript
- 用途：类型检查（不进入产物）

---

## 二、间接依赖（传递依赖）总览

构建期共安装 344 个包（含平台专用二进制），许可证分布（按各包 package.json 声明字段扫描）：

| 许可证 | 数量 |
|---|---|
| MIT | 308 |
| ISC | 13 |
| BlueOak-1.0.0 | 7 |
| Apache-2.0 | 6（typescript、ejs、jake、filelist、baseline-browser-mapping、@trickfilm400/rollup-plugin-off-main-thread，均为构建工具） |
| BSD-2-Clause / BSD-3-Clause | 8 |
| CC-BY-4.0 | 1（caniuse-lite，浏览器兼容性数据） |
| MIT OR CC0-1.0（双许可） | 1（type-fest） |

**无 GPL / LGPL / AGPL / MPL / SSPL 等传染性或限制性许可证组件。**

需注意的一项：`caniuse-lite` 的数据文件采用 CC-BY-4.0，要求署名。书时不直接引用该数据，仅作为构建工具链的传递依赖存在；上述表述即满足其署名要求。完整依赖树以 `package-lock.json` 为准。

---

## 三、计划引入的组件（尚未进入构建）

以下组件已确定选型并核实许可证，将在对应里程碑接入；接入时本文件同步更新。

| 组件 | 作者/组织 | 许可证 | 用途 | 计划接入 |
|---|---|---|---|---|
| epub.js | FuturePress | MIT | EPUB 解析与渲染 | M2 |
| pdf.js | Mozilla | Apache-2.0 | PDF 渲染 | M2 |
| foliate-js | johnfactotum | MIT | 备选渲染引擎（MOBI/AZW3/FB2/CBZ） | 备用 |

---

## 四、设计参考（不集成代码）

以下项目仅作设计与交互参考，书时不复制其代码、不打包其资源。

| 项目 | 作者 | 许可证 | 参考内容 |
|---|---|---|---|
| MindSpace | Jabez | MIT | 打卡/经验值逻辑思路、公版书下载脚本思路、主题系统思路 |
| kit | aafnnp | MIT | 工具箱交互：分类/收藏/最近使用/全局搜索 |
| Tamagochi | Tech-aficionado | MIT | 宠物系统：属性衰减、成长阶段、喂食/玩耍/清洁/睡觉 |
| NextChat | ChatGPTNextWeb | MIT | AI 交互模式：BYOK 设置页、多模型切换 |
| shiki-toolbox（四季箱） | Elari39 | MIT | 设计系统与算法工程思路（小程序原生代码，不集成） |

各项目地址与许可证原文见 `docs/书时-开源组件与合规.md` 第 1 节，或：

- MindSpace：https://github.com/jabez0701/MindSpace
- kit：https://github.com/aafnnp/kit
- Tamagochi：https://github.com/Tech-aficionado/Tamagochi---Open-Source-Game
- NextChat：https://github.com/ChatGPTNextWeb/NextChat
- shiki-toolbox：https://github.com/Elari39/shiki-toolbox

---

## 五、禁用组件记录

以下项目经评估**不采用**，记录原因以防后续误用：

| 组件 | 许可证 | 不采用原因 |
|---|---|---|
| Koodo Reader | AGPL-3.0 | 传染性许可证：使用其代码则书时整体必须同样以 AGPL 开源 |
| Readest | AGPL-3.0 | 同上 |
| Anx Reader | GPL-3.0 | 同上（GPL 传染性） |
| Habitica | GPL v3（素材 CC-BY-NC-SA） | 代码传染；美术素材禁止商用，仅可参考其金币/经验设计思路 |
| Sube3494/toolsbox | 无许可证文件 | 无许可证即"保留所有权利"，法律上不可复制，仅可参考设计 |

**原则**：书时只集成 MIT / Apache-2.0 / BSD 类宽松许可证组件；GPL/AGPL 组件一律不集成；无许可证代码一律不复制。
