interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  tabs: TabItem[];
  ariaLabel?: string;
}

/**
 * 标签页（通用原语）：下划线指示当前项，键盘左右方向键可切换（role=tablist）。
 * 令牌化配色，跟随三主题。用于书架「网格/列表」、设置分组等场景。
 */
export function Tabs({ value, onChange, tabs, ariaLabel }: TabsProps) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.value === value);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(tabs[(idx + 1) % tabs.length].value);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(tabs[(idx - 1 + tabs.length) % tabs.length].value);
    }
  };

  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          className={`tab-item${tab.value === value ? ' active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
