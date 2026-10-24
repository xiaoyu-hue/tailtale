import { useEffect, useState } from 'react';
import { toast } from '../../../components';
import {
  loadHighlights,
  onHighlightsChanged,
  removeHighlight,
  clearHighlights,
  highlightsToMarkdown,
  downloadText,
  type Highlight,
} from '../highlights';

/** 书摘导出：列出已收藏高亮，可单条删除、批量导出 Markdown、整库清空。 */
export function HighlightExportTool() {
  const [items, setItems] = useState<Highlight[]>(() => loadHighlights());

  useEffect(() => {
    const refresh = () => setItems(loadHighlights());
    refresh();
    return onHighlightsChanged(refresh);
  }, []);

  function exportAll() {
    if (!items.length) return;
    const md = highlightsToMarkdown(items);
    const name = `书摘导出_${new Date().toISOString().slice(0, 10)}.md`;
    downloadText(name, md);
    toast.success(`已导出 ${items.length} 条书摘`);
  }

  function del(id: string) {
    removeHighlight(id);
    toast.info('已删除该书摘');
  }

  function clearAll() {
    clearHighlights();
    toast.info('已清空全部书摘');
  }

  if (!items.length) {
    return (
      <div className="hl-empty">
        <p className="muted">还没有收藏的书摘。</p>
        <p className="muted">在书架打开一本 EPUB，用鼠标或手指选中正文文字，即可收藏到这里。</p>
      </div>
    );
  }

  const groups = new Map<string, Highlight[]>();
  for (const h of items) {
    const arr = groups.get(h.bookTitle) ?? [];
    arr.push(h);
    groups.set(h.bookTitle, arr);
  }

  return (
    <div className="hl">
      <div className="hl-actions">
        <button type="button" className="btn btn-primary" onClick={exportAll}>
          导出 Markdown
        </button>
        <button type="button" className="btn" onClick={clearAll}>
          清空
        </button>
      </div>
      <div className="hl-list">
        {[...groups].map(([book, list]) => (
          <div key={book} className="hl-group">
            <div className="hl-group-title">
              {book}（{list.length}）
            </div>
            {list.map((h) => (
              <div key={h.id} className="hl-item">
                <div className="hl-text">{h.text}</div>
                <div className="hl-foot">
                  <span className="muted">{new Date(h.createdAt).toLocaleString()}</span>
                  <button type="button" className="hl-del" onClick={() => del(h.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
