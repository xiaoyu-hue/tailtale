import { useEffect, useRef, useState } from 'react';
import { awardCoins } from '../../gamification';
import { toast } from '../../../components';

interface Preset {
  label: string;
  focus: number; // 分钟
  brk: number; // 休息分钟
}

const PRESETS: Preset[] = [
  { label: '经典', focus: 25, brk: 5 },
  { label: '深度', focus: 50, brk: 10 },
  { label: '轻松', focus: 15, brk: 3 },
];

type Phase = 'idle' | 'focus' | 'break';

const FOCUS_COINS = 5;

/** 专注番茄钟：本地计时，完成一轮专注奖励金币。零依赖，复用 gamification.awardCoins。 */
export function PomodoroTool() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(preset.focus * 60);
  const [running, setRunning] = useState(false);
  const endRef = useRef(0);
  const timerRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('idle');

  phaseRef.current = phase;

  // 倒计时：基于目标结束时间戳轮询，避免 setInterval 漂移
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        finishPhase();
        return;
      }
      timerRef.current = window.setTimeout(tick, 250);
    };
    timerRef.current = window.setTimeout(tick, 250);
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function start(next: Phase) {
    setPhase(next);
    const secs = next === 'focus' ? preset.focus * 60 : preset.brk * 60;
    setRemaining(secs);
    endRef.current = Date.now() + secs * 1000;
    setRunning(true);
  }

  function finishPhase() {
    setRunning(false);
    if (phaseRef.current === 'focus') {
      void awardCoins(FOCUS_COINS);
      toast.success(`专注完成，+${FOCUS_COINS} 金币`);
      start('break'); // 自动进入休息
    } else {
      toast.info('休息结束，开始下一段吧');
      setPhase('idle');
      setRemaining(preset.focus * 60);
    }
  }

  function toggle() {
    if (running) {
      setRunning(false);
      return;
    }
    if (phase === 'idle') {
      start('focus');
      return;
    }
    endRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setPhase('idle');
    setRemaining(preset.focus * 60);
  }

  function pickPreset(p: Preset) {
    setPreset(p);
    if (!running) {
      setPhase('idle');
      setRemaining(p.focus * 60);
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const total = (phase === 'focus' ? preset.focus : preset.brk) * 60;
  const progress = total > 0 ? 1 - remaining / total : 0;

  return (
    <div className="pomodoro">
      <div className="pomodoro-presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`chip${preset.label === p.label ? ' active' : ''}`}
            onClick={() => pickPreset(p)}
          >
            {p.label}
            <span className="chip-sub">
              {p.focus}/{p.brk}
            </span>
          </button>
        ))}
      </div>

      <div
        className="pomodoro-ring"
        style={{
          background: `conic-gradient(var(--primary) ${progress * 360}deg, var(--surface-soft) 0deg)`,
        }}
      >
        <div className="pomodoro-face">
          <div className="pomodoro-phase">
            {phase === 'focus' ? '专注中' : phase === 'break' ? '休息中' : '准备'}
          </div>
          <div className="pomodoro-time">
            {mm}:{ss}
          </div>
        </div>
      </div>

      <div className="pomodoro-actions">
        <button type="button" className="btn btn-primary" onClick={toggle}>
          {running ? '暂停' : phase === 'idle' ? '开始专注' : '继续'}
        </button>
        <button type="button" className="btn" onClick={reset}>
          重置
        </button>
      </div>

      <p className="muted pomodoro-tip">完成一轮专注奖励 {FOCUS_COINS} 金币。</p>
    </div>
  );
}
