import { useMemo, useState } from 'react';

const CJK = /[㐀-䶿一-鿿豈-﫿]/g;
const EN_WORD = /[a-zA-Z0-9]+(?:['’-][a-zA-Z0-9]+)*/g;
const WS = /\s/g;

const CN_PER_MIN = 300; // 中文阅读速度（字/分钟）
const EN_PER_MIN = 200; // 英文阅读速度（词/分钟）

interface Stats {
  charsTotal: number;
  charsNoSpace: number;
  chinese: number;
  enWords: number;
  minutes: number;
}

function compute(text: string): Stats {
  const charsTotal = text.length;
  const charsNoSpace = text.replace(WS, '').length;
  const chinese = (text.match(CJK) ?? []).length;
  const enWords = (text.match(EN_WORD) ?? []).length;
  const minutes = Math.max(1, Math.ceil(chinese / CN_PER_MIN + enWords / EN_PER_MIN));
  return { charsTotal, charsNoSpace, chinese, enWords, minutes };
}

/** 文本统计：CJK 按字计数 + 预计阅读时长。零依赖，纯函数计算。 */
export function TextStatsTool() {
  const [text, setText] = useState('');
  const stats = useMemo(() => compute(text), [text]);

  return (
    <div className="textstats">
      <textarea
        className="textstats-input"
        placeholder="粘贴任意文本，实时统计字数与阅读时长…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
      />

      <div className="textstats-grid">
        <Stat label="总字符" value={stats.charsTotal} />
        <Stat label="去空白" value={stats.charsNoSpace} />
        <Stat label="中文字" value={stats.chinese} />
        <Stat label="英文词" value={stats.enWords} />
      </div>

      <div className="textstats-time">
        预计阅读时长 <strong>{stats.minutes}</strong> 分钟
        <span className="muted">（中文 {CN_PER_MIN}/分，英文 {EN_PER_MIN}/分）</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="textstats-cell">
      <div className="textstats-value">{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}
