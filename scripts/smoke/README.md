# 冒烟测试（端到端最后一道门禁）

`smoke.py` 用 Playwright 驱动真实 Chromium，覆盖**单测覆盖不到的面**：UI 渲染与遮挡、
下载文件、WebCrypto 在浏览器里的实际行为、导入后应用重载。v1.11.0 修复的“加密导出口令框
被卡片动画遮挡点不动”就是它抓出来的——node:test 的单测对这类问题天然失明。

## 依赖安装（一次性）

```bash
pip install playwright
playwright install chromium        # 或 playwright install --with-deps chromium（CI 推荐）
```

## 运行

```bash
# 推荐：一条命令自包含（自动在后台服务 dist/，跑完自动关服务器）
npm run smoke

# 等价于
python3 scripts/smoke/smoke.py --serve dist

# 服务器已在别处运行（如 npm run preview 的 4173 端口）
python3 scripts/smoke/smoke.py --base http://localhost:4173
```

前提：`--serve dist` 模式需要先 `npm run build` 产出 `dist/`。

## 覆盖的断言（14 项）

| 分组 | 断言 |
|---|---|
| 导出对话框 | 弹出；三档选项齐全 |
| 加密档 | 口令字段展开；不一致警示；“无后门”警示；不一致时禁用导出 |
| 加密导出 | 文件名规范；信封结构（PBKDF2 60 万次 + AES-GCM + 密文非空）；成功提示 |
| 标准档 | 导出为明文包（含 stores/localStorage、无 encrypted 字段） |
| 加密导入 | 弹口令框；错口令提示且可重试；对口令解密导入；应用正常重载 |
| 全局 | 全程无页面 JS 错误 |

退出码 0 = 全过，1 = 有失败（明细逐行打印）。CI 中由 `.github/workflows/ci.yml`
的 smoke 作业调用。

## 维护约定

- 断言文案与 `src/modules/settings/ui/` 下的组件实现联动：改了口令校验提示语、
  档位标题、信封字段，都要同步改本脚本，否则冒烟会假失败。
- 新增长期功能链路时（如未来的“应用锁”），优先在这里补断言，而不是加组件单测——
  本层的定位就是“用户视角的关键路径”。
