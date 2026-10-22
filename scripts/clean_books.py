#!/usr/bin/env python3
"""书时内置书库：源文本清洗脚本（构建期离线执行）。

用途：从各来源的原始文本生成 public/library-books/ 的清洗后简体文本与指纹清单。
源文本不在仓库内（第三方数据），需自备并置于 src_txt/ 目录：

    src_txt/
      hlm_full/            HLM-txt 的 001.md–120.md（红楼梦分回）
      三國演義.txt 等      chtxt / tennessine / 古腾堡原始文件

用法（在仓库根目录执行）：

    pip install opencc           # 唯一依赖
    TAILTALE_SRC_TXT=path/to/src_txt TAILTALE_OUT=path/to/clean python3 scripts/clean_books.py

输出：clean/ 下 10 个简体 txt + manifest.json（含每本字数、章数、hashText 指纹、
来源登记）。指纹与 public/library-manifest.json 须一致，否则领取会被拒。

清洗规则（与《docs/书时-内置书库版权核查.md》第 4 节对齐）：
 1. chtxt 文件头（# 注释块）删除
 2. 标题行去 markdown/项目符号前缀（"## " / "○ " / "### "）
 3. HLM 拼装：去 ### 前缀、---- 分隔线、<p> 标签
 4. 古腾堡：提取 START/END 标记之间的正文；《阿Q正传》从混合文件中定位提取
 5. 通用：去 BOM、CRLF→LF、去控制字符、行尾空格、连续空行压缩
 6. 繁转简（OpenCC t2s；对简体文本为恒等操作）
 7. 不做繁简以外的任何内容改动
"""
import json
import os
import re
import sys

from opencc import OpenCC

SRC = os.environ.get("TAILTALE_SRC_TXT", "/workspace/cache/src_txt")
OUT = os.environ.get("TAILTALE_OUT", "/workspace/cache/clean")
HLM_DIR = os.path.join(SRC, "hlm_full")
CC = OpenCC("t2s")

# 阅读器章节识别正则（与 src/modules/reader/model.ts HEADING_RE 保持一致，用于验证）
HEADING_RE = re.compile(
    r"^[ \t\u3000]*(第[零一二三四五六七八九十百千万0-9]+[章节卷回部篇集][^\n]{0,60}"
    r"|序章|序言|序|前言|楔子|引子|尾声|后记|番外[^\n]{0,40}|附录[^\n]{0,60}"
    r"|[Cc]hapter[ \t]+\d+[^\n]{0,60}|Prologue|Epilogue)[ \t\u3000]*$"
)


def hash_text(text: str) -> str:
    """与 src/platform/hash.ts hashText 完全一致的 FNV-1a 变体指纹（Python 复刻）。

    注意：JS 端按 charCodeAt（UTF-16 码元）迭代，Python 必须同步按 UTF-16 码元
    迭代（text.encode('utf-16-le') 逐两字节取码元），否则含 BMP 外生僻字
    （如《红楼梦》人名用字 𤇄、𬙋）的文本指纹会不一致。
    """
    def s32(x: int) -> int:
        x &= 0xFFFFFFFF
        return x - (1 << 32) if x >= (1 << 31) else x

    def imul(a: int, b: int) -> int:
        return s32((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF))

    h1 = s32(0x811C9DC5)
    h2 = s32(0x9E3779B9)
    raw = text.encode("utf-16-le")
    for i in range(0, len(raw), 2):
        c = raw[i] | (raw[i + 1] << 8)
        h1 = imul((h1 & 0xFFFFFFFF) ^ c, 0x01000193)
        h2 = imul((h2 & 0xFFFFFFFF) ^ c, 0x85EBCA6B) & 0xFFFFFFFF
    hx = lambda n: format(n & 0xFFFFFFFF, "08x")
    return hx(h1) + hx(h2) + format(len(raw) // 2, "x")


def count_chapters(text: str) -> int:
    return sum(1 for line in text.split("\n") if HEADING_RE.match(line))


def strip_chtxt_header(text: str) -> str:
    """删除 chtxt 开头的 # 注释块。"""
    lines = text.split("\n")
    i = 0
    while i < len(lines) and (lines[i].startswith("#") or lines[i].strip() == ""):
        i += 1
    return "\n".join(lines[i:])


def strip_gutenberg(text: str) -> str:
    """提取 *** START/END OF ... *** 之间的正文。"""
    m = re.search(r"\*\*\* START OF .*? \*\*\*(.*?)\*\*\* END OF", text, re.S)
    return m.group(1) if m else text


def clean_common(text: str) -> str:
    """通用清洗：编码痕迹 / 换行 / 控制字符 / 行尾空格 / 空行压缩。"""
    text = text.replace("\uFEFF", "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = re.sub(r"[ \t\u3000]+$", "", text, flags=re.M)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip("\n")


def strip_packaging(text: str) -> str:
    """去来源包装：HTML 标签 / 古腾堡署名行 / 全文完标记 / 段首缩进 / 注释符号 / 相邻重复行。"""
    text = re.sub(r"</?(?:p|br|hr|blockquote|div|span|em|strong|i|b)[^>]*>", "", text, flags=re.I)
    text = re.sub(r"^Produced by .*$", "", text, flags=re.M)
    text = re.sub(r"^〔全文完〕\s*$", "", text, flags=re.M)
    text = re.sub(r"^[ \t\u3000]+", "", text, flags=re.M)  # 段首缩进（水浒 / 古腾堡版式）
    text = re.sub(r"[ヾおぉぺ]", "", text)  # 古腾堡脚注标记符号（旧版，保留兼容）
    # 古腾堡该版脚注以日文假名逐条编号（か/え/ぎ/く/き/ぇ…），散落正文行内行首；
    # 中文正文不含日文假名，按 Unicode 假名区块整体剔除（长音符 ー / 々 等同理）。
    text = re.sub(r"[ぁ-ゖゝ-ゟァ-ヺー々〆]", "", text)
    # 相邻重复行折叠（古腾堡「标题/标题」排版，如《呐喊》自序）
    text = re.sub(r"^(.*)\n\n?\1$", r"\1", text, flags=re.M)
    return text


def title_line(line: str) -> str:
    """去标题行的 markdown / 项目符号前缀，保留标题文字。"""
    line = re.sub(r"^(#{1,6}\s*|○\s*|※\s*)", "", line)
    return line.strip()


def clean_chtxt(text: str) -> str:
    body = strip_chtxt_header(text)
    out = []
    for line in body.split("\n"):
        if line.startswith("## "):
            out.append(title_line(line))
        elif line.startswith("○ "):
            out.append(title_line(line))
        else:
            out.append(line)
    return strip_packaging(clean_common("\n".join(out)))


def clean_hlm() -> str:
    """拼装 HLM-txt 的 120 个分回 md。"""
    parts = []
    for i in range(1, 121):
        p = os.path.join(HLM_DIR, f"{i:03d}.md")
        raw = open(p, encoding="utf-8", errors="ignore").read()
        for line in raw.split("\n"):
            line = line.strip()
            if not line or line == "----":
                continue
            if line.startswith("### "):
                parts.append("")
                parts.append(line[4:].strip())
            else:
                parts.append(line.strip())
    return strip_packaging(clean_common("\n".join(parts)))


def clean_gutenberg(text: str) -> str:
    body = strip_gutenberg(text)
    out = []
    for line in body.split("\n"):
        # 古腾堡版段首缩进（空格/全角空格）去除，保留正文
        out.append(line)
    return strip_packaging(clean_common("\n".join(out)))


def extract_aq(text: str) -> str:
    """从古腾堡 #27166（《呐喊》混合文件：自序 + 注释 + 《阿Q正传》全文 + 更多注释）
    中提取《阿Q正传》部分：自「第一章序」标题行至「他們白跟一趟了……」正文结尾，
    剔除前后的大段古腾堡注释（后者占全文三分之一以上，不能整体上架为《呐喊》）。
    注意从第一章而非书名行起切：书名行不匹配阅读器 HEADING_RE，会被 splitChapters
    切成一个几乎空白的「引首」章（体验劣化），且书架/顶栏另有书名展示，无需书名行。"""
    body = strip_gutenberg(text)
    lines = body.split("\n")
    start = end = None
    for i, line in enumerate(lines):
        s = line.strip()
        if start is None and s.startswith("第一章序"):
            start = i
        elif s.startswith("他們白跟一趟了"):
            end = i
            break
    if start is None or end is None:
        raise SystemExit("阿Q正传边界定位失败：古腾堡文件结构可能已变化")
    return strip_packaging(clean_common("\n".join(lines[start : end + 1])))


def clean_tennessine(text: str) -> str:
    # 源文件首行「《水浒传》施耐庵」是书名署名行，非正文：不删会被阅读器
    # splitChapters 切成一个几乎空白的「引首」章（下一行「楔子」才是真标题）。
    text = re.sub(r"^《[^》]{1,10}》[^\n]{0,10}\n+", "", text, count=1)
    return strip_packaging(clean_common(text))


BOOKS = [
    # (输出文件名, 书名, 作者, 朝代, 源文件, 清洗函数, 来源登记)
    ("hongloumeng.txt", "红楼梦", "曹雪芹 / 高鹗", "清", None, clean_hlm,
     "github.com/buobao/HLM-txt（full/001.md–120.md 拼装，简体）"),
    ("sanguoyanyi.txt", "三国演义", "罗贯中", "元末明初", "三國演義.txt", clean_chtxt,
     "github.com/JasonWade001/chtxt（x.小說/三國演義.txt，繁体）"),
    ("xiyouji.txt", "西游记", "吴承恩", "明", "西遊記.txt", clean_chtxt,
     "github.com/JasonWade001/chtxt（x.小說/西遊記.txt，繁体）"),
    ("shuihuzhuan.txt", "水浒传", "施耐庵", "元末明初", "水浒传.txt", clean_tennessine,
     "github.com/tennessine/corpus（水浒传.txt）"),
    ("daodejing.txt", "道德经", "老子", "先秦", "道德經.txt", clean_chtxt,
     "github.com/JasonWade001/chtxt（b.道家/道德經.txt，繁体）"),
    ("lunyu.txt", "论语", "孔子及弟子", "先秦", "論語.txt", clean_chtxt,
     "github.com/JasonWade001/chtxt（a.儒家/論語.txt，繁体）"),
    ("shishuoxinyu.txt", "世说新语", "刘义庆", "南朝宋", "世說新語.txt", clean_chtxt,
     "github.com/JasonWade001/chtxt（x.小說/世說新語.txt，繁体）"),
    ("tangshi300.txt", "唐诗三百首", "孙洙（蘅塘退士） 编", "清", "唐詩三百首.txt", clean_chtxt,
     "github.com/JasonWade001/chtxt（n.蒙學/唐詩三百首.txt，繁体）"),
    ("songci300.txt", "宋词三百首", "朱祖谋 编", "清末", "宋詞三百首.txt", clean_chtxt,
     "github.com/JasonWade001/chtxt（n.蒙學/宋詞三百首.txt，繁体）"),
    ("aqzhengzhuan.txt", "阿Q正传", "鲁迅", "民国", "呐喊_gb.txt", extract_aq,
     "gutenberg.org（eBook #27166 中《阿Q正傳》部分提取，繁体）"),
]


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for fname, title, author, dynasty, src, cleaner, origin in BOOKS:
        if src is None:  # 红楼梦：分回拼装
            text = clean_hlm()
        else:
            raw = open(os.path.join(SRC, src), encoding="utf-8", errors="ignore").read()
            text = cleaner(raw)
        text = CC.convert(text)  # 繁转简（对简体恒等）
        text = clean_common(text)

        out_path = os.path.join(OUT, fname)
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)

        chapters = count_chapters(text)
        fingerprint = hash_text(text)
        manifest.append({
            "file": fname,
            "title": title,
            "author": author,
            "dynasty": dynasty,
            "chars": len(text),
            "chapters": chapters,
            "fingerprint": fingerprint,
            "origin": origin,
        })
        print(f"{fname:20s} chars={len(text):>8} chapters={chapters:>4} fp={fingerprint[:12]}…")

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"books": manifest}, f, ensure_ascii=False, indent=2)
    print(f"\nmanifest.json 写出，共 {len(manifest)} 本")


if __name__ == "__main__":
    sys.exit(main())
