export default function Pet() {
  return (
    <>
      <div className="placeholder-hero">
        <div className="placeholder-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <ellipse cx="7" cy="8.5" rx="2.1" ry="2.6" />
            <ellipse cx="17" cy="8.5" rx="2.1" ry="2.6" />
            <ellipse cx="4.6" cy="14" rx="2" ry="2.4" />
            <ellipse cx="19.4" cy="14" rx="2" ry="2.4" />
            <ellipse cx="12" cy="15.5" rx="4" ry="3.6" />
          </svg>
        </div>
        <h2>宠物系统</h2>
        <p className="muted">M3 上线 · 你的第一只小伙伴是一只猫</p>
      </div>

      <div className="card">
        <ul className="placeholder-list">
          <li>阅读计时与打卡产生金币，金币用于喂食与玩耍</li>
          <li>三项属性：饱食度、心情、精力，按天缓慢下降</li>
          <li>无死亡机制：不喂食只会降低好感度，宠物永远陪伴</li>
          <li>成长阶段：少年猫 → 成年猫 → 完全体，外观随阶段变化</li>
          <li>金币解锁皮肤：橘猫 / 三花 / 黑猫</li>
        </ul>
      </div>
    </>
  );
}
