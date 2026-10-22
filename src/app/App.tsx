import { useEffect, useState } from 'react';
import TopBar from '../shared/ui/TopBar';
import BottomNav, { type TabKey } from '../shared/ui/BottomNav';
import { installRipple } from '../shared/interactions';
import { refreshBooks, useBooks, useBooksLoaded } from '../modules/books';
import { refreshGamification, useCoins } from '../modules/gamification';
import { refreshPet } from '../modules/pet';
import { ReaderPage } from '../modules/reader';
import HomeView from './views/HomeView';
import PetView from './views/PetView';
import ShopView from './views/ShopView';
import ProfileView from './views/ProfileView';

type Route =
  | { name: 'home' }
  | { name: 'reader'; bookId: string }
  | { name: 'pet' }
  | { name: 'shop' }
  | { name: 'profile' };

const TAB_OF_ROUTE: Record<Route['name'], TabKey> = {
  home: 'home',
  reader: 'home',
  pet: 'pet',
  shop: 'shop',
  profile: 'profile',
};

const ROUTE_STORAGE_KEY = 'tailtale:route';

/** 从 sessionStorage 恢复上次路由（刷新保持阅读页位置；sessionStorage 不跨标签页持久）。 */
function loadRoute(): Route {
  try {
    const raw = window.sessionStorage.getItem(ROUTE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Route;
      if (parsed && typeof parsed.name === 'string') return parsed;
    }
  } catch {
    /* 忽略损坏的存储 */
  }
  return { name: 'home' };
}

/** 应用外壳：只负责导航与全局装配，业务状态归各模块。 */
export default function App() {
  const books = useBooks();
  const booksLoaded = useBooksLoaded();
  const coins = useCoins();
  const [route, setRoute] = useState<Route>(loadRoute);

  useEffect(() => {
    void refreshBooks();
    void refreshGamification();
    void refreshPet();
    return installRipple(); // 全局点击涟漪（事件委托，卸载时解绑）
  }, []);

  // 路由变化即持久化，刷新后可恢复（如阅读页）
  useEffect(() => {
    try {
      window.sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
    } catch {
      /* 忽略写入失败 */
    }
  }, [route]);

  const currentBook =
    route.name === 'reader' ? books.find((book) => book.id === route.bookId) : undefined;

  const goTab = (tab: TabKey) => {
    if (tab === 'home') setRoute({ name: 'home' });
    else if (tab === 'pet') setRoute({ name: 'pet' });
    else if (tab === 'shop') setRoute({ name: 'shop' });
    else setRoute({ name: 'profile' });
  };

  // 阅读页为全屏沉浸形态：不显示顶栏与底部导航
  if (route.name === 'reader' && currentBook) {
    return <ReaderPage book={currentBook} onBack={() => setRoute({ name: 'home' })} />;
  }

  // 阅读路由但书籍不存在：书籍已加载则提示缺失，未加载则等待（避免刷新瞬间闪现空屏）
  if (route.name === 'reader' && !currentBook) {
    return (
      <div className="app-shell">
        <TopBar coins={coins} />
        <main className="page">
          <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
            {booksLoaded ? '未找到该书籍，可能已被删除' : '正在打开…'}
          </div>
        </main>
        <BottomNav active="home" onChange={goTab} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* 氛围背景层：纯装饰，pointer-events:none，位于内容之下 */}
      <div className="ambient" aria-hidden="true">
        <span className="ambient-dot" />
        <span className="ambient-dot" />
        <span className="ambient-dot" />
      </div>
      <TopBar coins={coins} />
      <main className="page">
        {route.name === 'home' && (
          <HomeView
            onOpenBook={(bookId) => setRoute({ name: 'reader', bookId })}
            onNavigateTab={goTab}
          />
        )}
        {route.name === 'pet' && <PetView onOpenShop={() => setRoute({ name: 'shop' })} />}
        {route.name === 'shop' && <ShopView />}
        {route.name === 'profile' && <ProfileView />}
      </main>
      <BottomNav active={TAB_OF_ROUTE[route.name]} onChange={goTab} />
    </div>
  );
}
