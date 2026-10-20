export default function Shop() {
  return (
    <>
      <div className="placeholder-hero">
        <div className="placeholder-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8h14l-1.2 12.2a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4L5 8Z" />
            <path d="M9 10V6a3 3 0 0 1 6 0v4" />
          </svg>
        </div>
        <h2>宠物商店</h2>
        <p className="muted">M3 上线 · 金币只能靠阅读赚取，不可购买</p>
      </div>

      <div className="card">
        <ul className="placeholder-list">
          <li>每日一次免费抚摸（好感度 +1）</li>
          <li>小鱼干 20 币 · 逗猫棒 30 币 · 猫条 50 币 · 猫薄荷 80 币</li>
          <li>皮肤：橘猫 200 / 三花 400 / 黑猫 600，阅读主题皮肤 300</li>
          <li>日收入与日常消耗大致持平，基础皮肤约两周可攒出</li>
          <li>无任何充值入口，不涉及支付</li>
        </ul>
      </div>
    </>
  );
}
