export interface Chapter {
  title: string;
  /** 章节起始字符偏移（含标题行） */
  start: number;
  /** 章节结束字符偏移（不含） */
  end: number;
}

const HEADING_RE =
  /^[ \t\u3000]*(第[零一二三四五六七八九十百千万0-9]+[章节卷回部篇集][^\n]{0,60}|序章|序言|序|前言|楔子|引子|尾声|后记|番外[^\n]{0,40}|附录[^\n]{0,60}|[Cc]hapter[ \t]+\d+[^\n]{0,60}|Prologue|Epilogue)[ \t\u3000]*$/;

/** 按行扫描标题，把纯文本拆成章节；无标题时整体作为单章。 */
export function splitChapters(text: string): Chapter[] {
  const lines = text.split('\n');
  const headings: { title: string; start: number }[] = [];
  let offset = 0;
  for (const line of lines) {
    if (HEADING_RE.test(line)) {
      headings.push({ title: line.trim(), start: offset });
    }
    offset += line.length + 1;
  }

  if (headings.length === 0) {
    return [{ title: '全文', start: 0, end: text.length }];
  }

  const chapters: Chapter[] = [];
  if (headings[0].start > 0) {
    chapters.push({ title: '引首', start: 0, end: headings[0].start });
  }
  headings.forEach((heading, i) => {
    chapters.push({
      title: heading.title,
      start: heading.start,
      end: i + 1 < headings.length ? headings[i + 1].start : text.length,
    });
  });
  return chapters;
}
