import { useState, type ComponentType, type JSX } from 'react';
import { Sheet } from '../../../components';
import { PomodoroTool } from './PomodoroTool';
import { WhiteNoiseTool } from './WhiteNoiseTool';
import { TextStatsTool } from './TextStatsTool';
import { BookOfDayTool } from './BookOfDayTool';
import { ReadingCalendarTool } from './ReadingCalendarTool';
import { HighlightExportTool } from './HighlightExportTool';
import { TtsTool } from './TtsTool';
import { SearchTool } from './SearchTool';

/** 工具组件统一接收的可选参数（搜索工具用它打开书籍、关闭抽屉）。 */
export interface ToolProps {
  onOpenBook?: (bookId: string) => void;
  onClose?: () => void;
}

interface ToolDef {
  key: string;
  label: string;
  desc: string;
  icon: JSX.Element;
  component: ComponentType<ToolProps>;
}

const TOOLS: ToolDef[] = [
  {
    key: 'pomodoro',
    label: '专注番茄钟',
    desc: '25/5 可配，完成奖金币',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 13V9M9 2h6" />
      </svg>
    ),
    component: PomodoroTool,
  },
  {
    key: 'noise',
    label: '白噪音',
    desc: '雨声·海浪·森林·篝火',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
        <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      </svg>
    ),
    component: WhiteNoiseTool,
  },
  {
    key: 'calendar',
    label: '阅读日历',
    desc: '月度热力图',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      </svg>
    ),
    component: ReadingCalendarTool,
  },
  {
    key: 'text',
    label: '文本统计',
    desc: '字数·预计阅读时长',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
    component: TextStatsTool,
  },
  {
    key: 'bookaday',
    label: '今日一书',
    desc: '公版经典随机推荐',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v14c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-14c-4.5 0-6.5.5-8 2Z" />
        <path d="M12 6.5v14" />
      </svg>
    ),
    component: BookOfDayTool,
  },
  {
    key: 'highlight',
    label: '书摘导出',
    desc: '收藏高亮·导出 Markdown',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19l9-9 3 3-9 9H4v-3Z" />
        <path d="M14 6l3 3" />
      </svg>
    ),
    component: HighlightExportTool,
  },
  {
    key: 'tts',
    label: '朗读',
    desc: '听书·Web Speech',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        <path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
      </svg>
    ),
    component: TtsTool,
  },
  {
    key: 'search',
    label: '全文搜索',
    desc: '搜书名·搜正文',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    ),
    component: SearchTool,
  },
];

/** 工具箱主页：8 宫格入口，点击经底部抽屉展开具体工具。 */
export function ToolboxView({
  onBack,
  onOpenBook,
}: {
  onBack: () => void;
  onOpenBook: (bookId: string) => void;
}) {
  const [active, setActive] = useState<ToolDef | null>(null);
  const [open, setOpen] = useState(false);

  const openTool = (tool: ToolDef) => {
    setActive(tool);
    setOpen(true);
  };

  // 关闭：先收起抽屉，等滑出动画结束再清空内容，避免内容瞬间空白
  const closeTool = () => {
    setOpen(false);
    window.setTimeout(() => setActive(null), 220);
  };

  const Active = active?.component;

  return (
    <>
      <div className="toolbox-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="返回首页">
          ‹
        </button>
        <h1 className="page-title">工具箱</h1>
      </div>

      <p className="muted toolbox-sub">本地优先的小工具，无需联网、不上传数据。</p>

      <div className="feature-grid toolbox-grid">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            className="feature-cell"
            onClick={() => openTool(tool)}
          >
            <span className="feature-icon">{tool.icon}</span>
            <span className="feature-label">{tool.label}</span>
            <span className="feature-desc">{tool.desc}</span>
          </button>
        ))}
      </div>

      <Sheet open={open} onClose={closeTool} title={active?.label}>
        {active && Active && <Active onOpenBook={onOpenBook} onClose={closeTool} />}
      </Sheet>
    </>
  );
}
