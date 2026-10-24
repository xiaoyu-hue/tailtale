#!/usr/bin/env python3
"""
书时 TailTale 端到端冒烟测试（Playwright + Chromium，覆盖加密备份全链路）。

背景：加密备份（v1.11.0）的口令错误、文件篡改、导入重载等行为只在真实浏览器里
才能验证——node:test 的单测覆盖不到 UI 与 WebCrypto 的集成面。本脚本即"最后一道
质量门禁"：推送前跑一遍，UI 真问题（如 v1.11.0 修复的对话框被卡片动画遮挡）在本地
就被拦下，而不是等用户点不到按钮才发现。

用法：
    # 一条命令自包含：自动构建静态服务跑冒烟（需先 npm run build 产出 dist/）
    npm run smoke
    python3 scripts/smoke/smoke.py --serve dist

    # 服务器已在别处运行（如 vite preview）
    python3 scripts/smoke/smoke.py --base http://localhost:4173

依赖：pip install playwright && playwright install chromium
退出码：0 = 全部通过；1 = 有失败项（明细逐行打印）。
"""
import argparse
import contextlib
import functools
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

results = []
failed = False


def check(name, ok, extra=""):
    global failed
    results.append(("PASS" if ok else "FAIL") + " " + name + ((" — " + extra) if extra else ""))
    if not ok:
        failed = True


def launch(p):
    try:
        return p.chromium.launch()
    except Exception:
        return p.chromium.launch(channel="chrome")


class QuietHandler(SimpleHTTPRequestHandler):
    """静默访问日志，避免冒烟输出被 GET 请求行淹没。"""

    def log_message(self, format, *args):
        pass


def serve(directory, port):
    """在后台线程起一个静态文件服务器，返回 (server, base_url)。"""
    handler = functools.partial(QuietHandler, directory=directory)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, f"http://127.0.0.1:{port}"


def run_smoke(base):
    with sync_playwright() as p:
        browser = launch(p)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        page.goto(base, wait_until="networkidle")

        # —— 游戏模块：首页入口 → 游戏页 → 猜数字对局展开 → 返回（离开不判负）——
        page.get_by_role("button", name="游戏").click()
        page.get_by_role("heading", name="游戏").wait_for()
        check("游戏入口可见可点", True)
        page.get_by_role("button", name="猜数字").click()
        sheet = page.locator(".sheet.open")
        sheet.wait_for()
        check(
            "猜数字对局展开（输入框 + 7 次机会）",
            sheet.get_by_label("你的猜测").is_visible() and "还剩 7 次机会" in sheet.text_content(),
        )
        # 关抽屉回游戏页，再返回首页；离开视为无结果，不写库不判负
        page.locator(".sheet-mask.open").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="返回首页").click()
        page.get_by_role("heading", name="书架").wait_for()
        check("术语统一：页面无「游戏币」字样", "游戏币" not in page.content())

        page.get_by_role("button", name="我的").click()
        page.get_by_role("button", name="导出备份").wait_for()

        # —— 导出对话框：三档选项 ——
        page.get_by_role("button", name="导出备份").click()
        dialog = page.get_by_role("alertdialog", name="导出备份选项")
        dialog.wait_for()
        check("导出对话框弹出", True)
        titles = [t.strip() for t in dialog.locator(".backup-option-title").all_text_contents()]
        check(
            "三档选项齐全",
            titles == ["标准备份（推荐）", "加密备份", "完整备份（含密钥，不加密）"],
            " | ".join(titles),
        )

        # —— 加密档：口令字段与校验 ——
        dialog.locator("input[value='encrypted']").check()
        check("口令字段展开", dialog.locator("#backup-password").is_visible())
        dialog.locator("#backup-password").fill("12345678")
        dialog.locator("#backup-password-confirm").fill("12345679")
        page.wait_for_timeout(150)
        warns = dialog.locator(".ai-dialog-warning").all_text_contents()
        check("口令不一致警示", any("两次输入的口令不一致" in w for w in warns))
        check("忘记口令无后门警示", any("没有任何后门" in w for w in warns))
        check("口令不一致时导出禁用", dialog.get_by_role("button", name="导出备份").is_disabled())

        # —— 加密导出：下载 + 信封结构 ——
        dialog.locator("#backup-password-confirm").fill("12345678")
        with page.expect_download() as dl_info:
            dialog.get_by_role("button", name="导出备份").click()
        download = dl_info.value
        enc = json.loads(open(download.path(), "rb").read().decode("utf-8"))
        fname = download.suggested_filename
        check(
            "加密备份文件名",
            fname.startswith("tailtale-backup-") and fname.endswith(".json"),
            fname,
        )
        check(
            "加密信封结构（PBKDF2 60 万次 + AES-GCM）",
            enc.get("app") == "tailtale"
            and enc.get("encrypted") is True
            and enc["kdf"]["algorithm"] == "PBKDF2"
            and enc["kdf"]["iterations"] == 600000
            and enc["cipher"]["algorithm"] == "AES-GCM"
            and len(enc.get("ciphertext", "")) > 0,
        )
        # 注：toast 现在含装饰图标（.toast-icon，aria-hidden），文本断言须 targeting
        # 真正的消息节点 .toast-message，否则图标会被拼进 text_content 导致误判。
        toast_msg = page.locator(".toast-message")
        toast_text = toast_msg.last.text_content() if toast_msg.count() else ""
        check("加密导出成功提示", bool(toast_text) and toast_text.startswith("已导出加密备份"), toast_text)

        # —— 标准档导出（默认档，直接点导出）——
        page.get_by_role("button", name="导出备份").click()
        dialog2 = page.get_by_role("alertdialog", name="导出备份选项")
        dialog2.wait_for()
        with page.expect_download() as dl2_info:
            dialog2.get_by_role("button", name="导出备份").click()
        plain = json.loads(open(dl2_info.value.path(), "rb").read().decode("utf-8"))
        check(
            "标准备份为明文包",
            plain.get("app") == "tailtale"
            and "encrypted" not in plain
            and isinstance(plain.get("stores"), dict)
            and isinstance(plain.get("localStorage"), dict),
        )

        # —— 导入加密包：错口令 → 对口令 → 成功刷新 ——
        page.on("dialog", lambda d: d.accept())
        page.locator("input[type='file']").set_input_files(download.path())
        pwd = page.get_by_role("alertdialog", name="输入备份口令")
        pwd.wait_for()
        check("加密导入弹口令框", True)
        pwd.locator("#backup-import-password").fill("wrong-pass")
        pwd.get_by_role("button", name="解密并导入").click()
        page.wait_for_timeout(500)
        warns2 = pwd.locator(".ai-dialog-warning").all_text_contents()
        check(
            "错口令提示且可重试",
            any("口令错误或备份文件已被篡改" in w for w in warns2),
            " | ".join(warns2),
        )
        with page.expect_navigation(wait_until="networkidle", timeout=25000):
            pwd.locator("#backup-import-password").fill("12345678")
            pwd.get_by_role("button", name="解密并导入").click()
        page.get_by_role("button", name="我的").click()
        page.get_by_role("button", name="导出备份").wait_for()
        check("导入成功后应用正常重载", True)

        check("无页面 JS 错误", len(errors) == 0, " ; ".join(errors[:3]))
        browser.close()


def main():
    parser = argparse.ArgumentParser(description="书时 TailTale 端到端冒烟测试")
    parser.add_argument("--base", default="http://127.0.0.1:8901", help="应用基地址（默认 http://127.0.0.1:8901）")
    parser.add_argument("--serve", metavar="DIR", help="在本机静态服务 DIR 目录后跑冒烟（一条命令自包含）")
    parser.add_argument("--port", type=int, default=8901, help="--serve 模式使用的端口（默认 8901）")
    args = parser.parse_args()

    base = args.base
    server = None
    if args.serve:
        server, base = serve(args.serve, args.port)
        print(f"[smoke] 静态服务已启动：{base} → {args.serve}")

    try:
        run_smoke(base)
    finally:
        if server:
            server.shutdown()

    print("\n".join(results))
    print("SMOKE", "FAILED" if failed else "ALL PASS")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
