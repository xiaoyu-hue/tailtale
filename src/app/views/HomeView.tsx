import { useRef, useState } from 'react';
import type { JSX } from 'react';
import type { TabKey } from '../../shared/ui/BottomNav';
import { ImportZone, ContinueReading, BookList, useRecentBook } from '../../modules/books';
import { TodayCard } from '../../modules/gamification';
import { useAiConfigured } from '../../modules/ai';
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
}

interface Feature {
  label: string;
  icon: JSX.Element;
  /** 里程碑编号，缺省表示已可用 */
  milestone?: string;
  action?: 'recent' | 'profile' | 'stats' | 'calendar' | 'pet' | 'shop' | 'ai';
}

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
    milestone: 'M4',
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
    milestone: 'M6',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5v11m0 0-4-4m4 4 4-4" />
        <path d="M4 17v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V17" />
      </svg>
    ),
  },
  {
    label: '公版书库',
    milestone: 'M7',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    label: '主题皮肤',
    milestone: 'M6',
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

/** 首页视图：导入 → 继续阅读 → 宠物预览 → 功能网格 → 全部书籍。书籍相关 UI 全部来自 books 模块。 */
export default function HomeView({ onOpenBook, onNavigateTab }: HomeViewProps) {
  const toastTimerRef = useRef<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const recentBook = useRecentBook();
  const aiConfigured = useAiConfigured();

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  const handleFeature = (feature: Feature) => {
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
    // 统计/日历在"我的"页：先切 Tab，再滚动到对应卡片（等视图渲染后定位）
    if (feature.action === 'stats' || feature.action === 'calendar') {
      onNavigateTab('profile');
      const sectionId = feature.action === 'stats' ? 'stats' : 'checkin-calendar';
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return;
    }
    if (feature.label === '书架') {
      document.getElementById('bookshelf')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    showToast(`「${feature.label}」规划中（${feature.milestone} 上线），敬请期待`);
  };

  return (
    <>
      <h1 className="page-title">书架</h1>

      <ImportZone onToast={showToast} />
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

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
