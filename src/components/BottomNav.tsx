export type TabKey = 'home' | 'pet' | 'shop' | 'profile';

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; icon: JSX.Element }[] = [
  {
    key: 'home',
    label: '首页',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11.5 12 3l9 8.5" />
        <path d="M5.5 10.5V20h13v-9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    ),
  },
  {
    key: 'pet',
    label: '宠物',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <ellipse cx="7" cy="8.5" rx="2.1" ry="2.6" />
        <ellipse cx="17" cy="8.5" rx="2.1" ry="2.6" />
        <ellipse cx="4.6" cy="14" rx="2" ry="2.4" />
        <ellipse cx="19.4" cy="14" rx="2" ry="2.4" />
        <ellipse cx="12" cy="15.5" rx="4" ry="3.6" />
      </svg>
    ),
  },
  {
    key: 'shop',
    label: '商店',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 8h14l-1.2 12.2a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4L5 8Z" />
        <path d="M9 10V6a3 3 0 0 1 6 0v4" />
      </svg>
    ),
  },
  {
    key: 'profile',
    label: '我的',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" />
      </svg>
    ),
  },
];

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`nav-item${active === tab.key ? ' active' : ''}`}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
