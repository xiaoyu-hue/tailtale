import { useEffect, useState } from 'react';
import TopBar from '../shared/ui/TopBar';
import BottomNav, { type TabKey } from '../shared/ui/BottomNav';
import { installRipple } from '../shared/interactions';
import { refreshBooks, useBooks } from '../modules/books';
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

/** 应用外壳：只负责导航与全局装配，业务状态归各模块。 */
export default function App() {
  const books = useBooks();
  const coins = useCoins();
  const [route, setRoute] = useState<Route>({ name: 'home' });

  useEffect(() => {
    void refreshBooks();
    void refreshGamification();
    void refreshPet();
    return installRipple(); // 全局点击涟漪（事件委托，卸载时解绑）
  }, []);

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
