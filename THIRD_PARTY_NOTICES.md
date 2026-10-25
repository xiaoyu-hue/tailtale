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

### epub.js（1.1.0 引入，EPUB 渲染引擎）

```
Copyright (c) 2013, FuturePress

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

- 许可证：BSD-2-Clause（包 `epubjs`，随包 `license` 文件原文摘录）
- 项目地址：https://github.com/futurepress/epub.js
- 用途：EPUB 解析与流式分页渲染（按需动态加载，仅打开 EPUB 时下载）
- 备注：**修正记录**：1.1.0 实际引入时核实，本组件为 BSD-2-Clause（此前规划文档中误记为 MIT，特此更正）；BSD-2-Clause 与 Apache-2.0 兼容

### pdf.js（1.1.0 引入，PDF 渲染引擎）

- 许可证：Apache-2.0（`node_modules/pdfjs-dist/LICENSE` 为 Apache-2.0 全文，不含单独版权行）
- 项目地址：https://github.com/mozilla/pdf.js
- 用途：PDF 解析与 canvas 按页渲染（引擎与 worker 按需动态加载）
- 备注：npm 包名为 `pdfjs-dist`

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

### 像素猫美术资产 pixel_cat.json（1.3.0 引入，非 npm 依赖：随源码分发的美术资产）

```
MIT License

Copyright (c) 2025 CanFlyhang

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

- 许可证：MIT（LICENSE 原文随资产分发于 `src/modules/pet/ui/assets/pixel_cat.LICENSE`）
- 项目地址：https://github.com/CanFlyhang/Desktop-Pixel-Pet
- 用途：宠物形象（32×32 二帧待机像素猫，JSON 帧数据 + 调色板；书时按调色板置换实现皮肤数据，未改动像素数据）
- 备注：MIT 与 Apache-2.0 兼容；该资产不进入 npm 依赖树，构建时由 Vite 直接打包 JSON

### MiniSearch（1.13.0 引入，全文搜索引擎）

- 许可证：MIT（LICENSE.txt 为 MIT 全文，版权行 `Copyright 2022 Luca Ongaro`）
- 项目地址：https://github.com/lucaong/minisearch
- 用途：工具箱「全文搜索」——本地索引书名/作者/正文，字段加权 + 模糊搜索，ESM 零依赖（运行时依赖，进入构建）
- 备注：MIT 与 Apache-2.0 兼容；运行时依赖、进入产物（gzip 约 18KB）；无子依赖（`package.json` `dependencies: {}`）

### JSZip（1.14.0 引入，ZIP 打包 / 解包引擎）

```
JSZip is dual licensed. At your choice you may use it under the MIT license *or* the GPLv3
license.

The MIT License
===============

Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso

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

- 许可证：双许可「MIT **或** GPLv3」二选一，书时**选用 MIT 分支**（GPL 分支不启用，无传染性）
- 项目地址：https://github.com/Stuk/jszip
- 用途：FB2 → EPUB 导入期打包（确定性 ZIP：mimetype 首位 + STORE + 固定日期，保证同输入同字节、跨设备续读一致）；CBZ 漫画图片解包；MOBI 容器解析
- 备注：1.13.0 及以前仅作为 epubjs 的传递依赖存在，1.14.0 起成为直接依赖；其依赖 pako 为「MIT AND Zlib」双许可（两种许可均为宽松型）

### fflate（1.14.0 引入，高性能压缩 / 解压库）

```
MIT License

Copyright (c) 2026 Arjun Barrett

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

- 项目地址：https://github.com/101arrowz/fflate
- 用途：MOBI / AZW3 的 PalmDOC 记录解压（构造 vendored foliate-js `mobi.js` 时注入 `unzlib`）
- 备注：MIT 与 Apache-2.0 兼容；零依赖、ESM；运行时依赖、进入产物（gzip 约 8KB）

### foliate-js（vendored mobi.js，1.14.0 引入，MOBI / AZW3 解析器）

```
MIT License

Copyright (c) 2022 John Factotum

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

- 项目地址：https://github.com/johnfactotum/foliate-js
- 用途：MOBI / AZW3 解析（PDB 容器 → PalmDOC 记录 → KF8 HTML 切片），供书时自渲染
- 备注：**仅 vendored 单文件** `src/vendor/foliate/mobi.js`（约 1200 行，文件头保留完整 MIT 版权声明），未引入 foliate-js 其余部分、不替换 epubjs（EPUB 仍走 epub.js）；依赖浏览器 DOM 与 fflate，按需动态加载（仅打开 MOBI/AZW3 时下载）

### gomoku-ai（vendored gomoku.js + ai.js，1.15.0 引入，五子棋 AI 对手）

```
MIT License

Copyright (c) 2026 SEN LLC (SEN 合同会社)

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

- 项目地址：https://github.com/sen-ltd/gomoku-ai
- 用途：五子棋 AI 对手（minimax + alpha-beta 剪枝，简单 / 中等 / 困难三档难度）
- 备注：**仅 vendored 两文件** `src/vendor/gomoku/gomoku.js`（棋盘 / 落子校验 / 胜负判定，不可变操作）与 `src/vendor/gomoku/ai.js`（AI 搜索），LICENSE 原文同目录保存，文件头保留完整 MIT 版权声明；未引入 upstream 其余部分（示例与文档）；随游戏模块主包加载（无独立动态分包，两文件合计约 6KB）

### linkedom（开发期依赖，测试环境 DOM 垫片）

- 许可证：ISC
- Copyright (c) 2021, Andrea Giammarchi, @WebReflection
- 项目地址：https://github.com/WebReflection/linkedom
- 用途：Node 测试环境提供 `DOMParser` / DOM，使 FB2 → EPUB 转换纯函数在测试与浏览器两端复用同一套逻辑
- 备注：ISC 与 Apache-2.0 兼容；仅 devDependencies，不进入产物

---

## 二、间接依赖（传递依赖）总览

构建期共安装 467 个包（含平台专用二进制），许可证分布（按各包 package.json 声明字段扫描）：

| 许可证 | 数量 |
|---|---|
| MIT | 349 |
| ISC | 25 |
| BlueOak-1.0.0 | 7 |
| Apache-2.0 | 7（typescript、ejs、jake、filelist、localforage、@trickfilm400/rollup-plugin-off-main-thread、pdfjs-dist） |
| BSD-2-Clause / BSD-3-Clause | 21（16 个 BSD-2 + 5 个 BSD-3；含 epubjs 及其依赖、linkedom 的解析器依赖树 htmlparser2 / css-select / domhandler 等） |
| CC-BY-4.0 | 1（caniuse-lite，浏览器兼容性数据） |
| MIT OR CC0-1.0（双许可） | 1（type-fest） |
| MIT OR GPL-3.0-or-later（双许可） | 1（jszip，epubjs 的依赖、1.14.0 起同时为直接依赖；**选用 MIT 分支**，无传染性） |
| MIT AND Zlib（双许可叠加） | 1（pako，jszip 的依赖；MIT 与 zlib 许可均为宽松型，须同时遵守，无传染性） |
| 未声明 license 字段 | 54（@babel/* 构建期工具链为主，Babel 项目整体 MIT，不进入运行产物） |

**无 GPL / LGPL / AGPL / MPL / SSPL 等单一传染性或限制性许可证组件。** 唯一涉及 GPL 字样的 jszip 为「MIT 或 GPL-3.0 二选一」双许可，按宽松分支 MIT 使用；pako 为「MIT 与 zlib 许可叠加」，两者均为宽松许可。

需注意的一项：`caniuse-lite` 的数据文件采用 CC-BY-4.0，要求署名。书时不直接引用该数据，仅作为构建工具链的传递依赖存在；上述表述即满足其署名要求。完整依赖树以 `package-lock.json` 为准。

---

## 三、计划引入的组件（尚未进入构建）

以下组件已确定选型并核实许可证，将在对应里程碑接入；接入时本文件同步更新。

**（暂无）**。原计划备选的 foliate-js 已于 1.14.0 以 vendored 单文件形式接入（仅 `src/vendor/foliate/mobi.js`，用于 MOBI / AZW3 解析），见第一节「foliate-js」条目；其余候选组件均在许可证或架构评估后未采用，见第五节。

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
