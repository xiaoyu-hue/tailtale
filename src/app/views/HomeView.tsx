import { useRef, useState } from 'react';
import type { JSX } from 'react';
import type { TabKey } from '../../shared/ui/BottomNav';
import { ImportZone, ContinueReading, BookList, LibrarySection, useBooksLoaded, useRecentBook } from '../../modules/books';
import { TodayCard } from '../../modules/gamification';
import { useAiConfigured } from '../../modules/ai';
import { greetingForHour } from '../../shared/dates';
import { useTicker } from '../../shared/hooks/useTicker';
import {
  CatStage,
  MOOD_LABELS,
  STAGE_LABELS,
  currentStage,
  deriveMood,
  usePet,
} from '../../modules/pet';

interface HomeViewProps {
  onOpenBook: (bookId: string) => void;
  onNavigateTab: (tab: TabKey) => void;
  onOpenToolbox: () => void;
}

interface Feature {
  label: string;
  icon: JSX.Element;
  /** 里程碑编号，缺省表示已可用 */
  milestone?: string;
  action?: 'recent' | 'profile' | 'stats' | 'calendar' | 'pet' | 'shop' | 'ai' | 'backup' | 'skin' | 'library';
}

/** 落在「我的」页的功能 → 目标卡片 id（点击先切 Tab，再平滑滚动定位）。 */
const PROFILE_SECTIONS: Partial<Record<NonNullable<Feature['action']>, string>> = {
  stats: 'stats',
  calendar: 'checkin-calendar',
  backup: 'backup',
  skin: 'settings',
};

const FEATURES: Feature[] = [
  {
    label: '书架',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="7" height="16" rx="1" />
        <rect x="14" y="4" width="7" height="16" rx="1" />
      </svg>
    ),
  },
  {
    label: '继续阅读',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v14c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-14c-4.5 0-6.5.5-8 2Z" />
        <path d="M12 6.5v14" />
      </svg>
    ),
    action: 'recent',
  },
  { label: '宠物', icon: <PawIcon />, action: 'pet' },
  { label: '商店', icon: <BagIcon />, action: 'shop' },
  {
    label: 'AI 解读书',
    action: 'ai',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
        <path d="M18.5 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z" />
      </svg>
    ),
  },
  {
    label: '工具箱',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: '打卡日历',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      </svg>
    ),
    action: 'calendar',
  },
  {
    label: '阅读统计',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20V12M10 20V6M16 20v-6M22 20H2" />
      </svg>
    ),
    action: 'stats',
  },
  {
    label: '数据备份',
    action: 'backup',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5v11m0 0-4-4m4 4 4-4" />
        <path d="M4 17v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V17" />
      </svg>
    ),
  },
  {
    label: '公版书库',
    action: 'library',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    label: '主题皮肤',
    action: 'skin',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="10" cy="15" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: '关于',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5M12 8v.5" />
      </svg>
    ),
    action: 'profile',
  },
];

function PawIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <ellipse cx="7" cy="8.5" rx="2.1" ry="2.6" />
      <ellipse cx="17" cy="8.5" rx="2.1" ry="2.6" />
      <ellipse cx="4.6" cy="14" rx="2" ry="2.4" />
      <ellipse cx="19.4" cy="14" rx="2" ry="2.4" />
      <ellipse cx="12" cy="15.5" rx="4" ry="3.6" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1.2 12.2a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4L5 8Z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </svg>
  );
}

/** 首页宠物预览条：小猫近况 + 快捷入口（宠物页大图在宠物 Tab）。 */
function PetStrip({ onOpen }: { onOpen: () => void }) {
  const pet = usePet();
  if (!pet) return null;
  return (
    <section className="card pet-strip">
      <CatStage pet={pet} variant="sm" />
      <div className="pet-strip-info">
        <div className="pet-strip-name">
          {pet.name} · {STAGE_LABELS[currentStage(pet.growth)]}
        </div>
        <div className="muted">
          {MOOD_LABELS[deriveMood(pet)]} · 好感 {pet.affinity}
        </div>
      </div>
      <button type="button" className="btn btn-primary pet-strip-go" onClick={onOpen}>
        去看它
      </button>
    </section>
  );
}

const ONBOARD_KEY = 'tailtale:onboarded';

/** 新手引导卡：首用价值前置（导入 → 赚金币 → 养宠物），确认后 localStorage 记住不再显示。 */
function WelcomeCard() {
  const [visible, setVisible] = useState(() => {
    try {
      return !window.localStorage.getItem(ONBOARD_KEY);
    } catch {
      return false;
    }
  });
  if (!visible) return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      /* 存储不可用时仅在本次会话隐藏 */
    }
    setVisible(false);
  };
  return (
    <section className="card welcome-card" aria-label="新手引导">
      <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>欢迎使用书时</h2>
      <p className="muted" style={{ margin: '0 0 4px' }}>
        读书记时长换金币，金币养宠物——你的阅读时光，值得被看见。
      </p>
      <div className="welcome-steps">
        <div className="welcome-step">
          <span className="welcome-step-num">1</span>
          <span className="muted">导入一本 TXT / EPUB / PDF / FB2 / CBZ，或从公版书库领取经典</span>
        </div>
        <div className="welcome-step">
          <span className="welcome-step-num">2</span>
          <span className="muted">阅读自动计时，攒金币、续打卡</span>
        </div>
        <div className="welcome-step">
          <span className="welcome-step-num">3</span>
          <span className="muted">用金币在商店买零食，喂你的小猫</span>
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-block welcome-dismiss" onClick={dismiss}>
        开始阅读
      </button>
    </section>
  );
}

/** 书籍加载骨架屏：几何对齐真实卡片，加载完成即消失（避免 spinner 整屏等待感）。 */
function LoadingSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-line skeleton-line--w60" />
    </div>
  );
}

/** 首页视图：导入 → 继续阅读 → 宠物预览 → 功能网格 → 全部书籍。书籍相关 UI 全部来自 books 模块。 */
export default function HomeView({ onOpenBook, onNavigateTab, onOpenToolbox }: HomeViewProps) {
  const toastTimerRef = useRef<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const recentBook = useRecentBook();
  const aiConfigured = useAiConfigured();
  const booksLoaded = useBooksLoaded();
  // 分钟级刷新即可覆盖时段（问候语按小时切换），无需秒级
  const now = useTicker(30_000);
  const greeting = greetingForHour(new Date(now).getHours());

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  const handleFeature = (feature: Feature) => {
    if (feature.label === '工具箱') {
      onOpenToolbox();
      return;
    }
    if (feature.action === 'profile') {
      onNavigateTab('profile');
      return;
    }
    if (feature.action === 'pet' || feature.action === 'shop') {
      onNavigateTab(feature.action);
      return;
    }
    if (feature.action === 'recent') {
      if (recentBook) onOpenBook(recentBook.id);
      else showToast('还没有在读的书，先导入一本吧');
      return;
    }
    // AI 解读书：未配置密钥先去「我的」页填写；已配置则打开最近的书并提示入口
    if (feature.action === 'ai') {
      if (!aiConfigured) {
        onNavigateTab('profile');
        window.setTimeout(() => {
          document.getElementById('ai-settings')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
        return;
      }
      if (recentBook) {
        onOpenBook(recentBook.id);
        showToast('打开书籍后，点底部「AI」按钮开始解读');
        return;
      }
      showToast('还没有书，先导入一本吧');
      return;
    }
    // 落在「我的」页的功能：先切 Tab，再滚动到对应卡片（等视图渲染后定位）
    const profileSection = feature.action ? PROFILE_SECTIONS[feature.action] : undefined;
    if (profileSection) {
      onNavigateTab('profile');
      window.setTimeout(() => {
        document.getElementById(profileSection)?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return;
    }
    if (feature.label === '书架') {
      document.getElementById('bookshelf')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    // 公版书库：首页常驻板块，滚动定位（与「书架」同模式）
    if (feature.action === 'library') {
      document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    showToast(`「${feature.label}」规划中（${feature.milestone} 上线），敬请期待`);
  };

  return (
    <>
      <h1 className="page-title">
        书架
        <span className="greeting" key={greeting}>
          {greeting}
        </span>
      </h1>

      <WelcomeCard />
      <ImportZone onToast={showToast} />
      {!booksLoaded && <LoadingSkeleton />}
      <ContinueReading onOpenBook={onOpenBook} />
      <TodayCard onToast={showToast} />
      <PetStrip onOpen={() => onNavigateTab('pet')} />

      <h2 className="section-title">功能</h2>
      <div className="feature-grid">
        {FEATURES.map((feature) => (
          <button
            key={feature.label}
            type="button"
            className={`feature-cell${feature.milestone ? ' planned' : ''}`}
            onClick={() => handleFeature(feature)}
          >
            <span className="feature-icon">{feature.icon}</span>
            <span>{feature.label}</span>
            {feature.milestone && <span className="feature-badge">{feature.milestone}</span>}
          </button>
        ))}
      </div>

      <BookList onOpenBook={onOpenBook} onToast={showToast} />
      <LibrarySection onOpenBook={onOpenBook} onToast={showToast} />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
