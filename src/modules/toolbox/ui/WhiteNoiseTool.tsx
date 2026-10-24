import { useEffect, useRef, useState } from 'react';
import { Slider } from '../../../components';

interface NoisePreset {
  key: string;
  label: string;
  filterType: BiquadFilterType;
  freq: number;
  q: number;
  /** 可选：缓慢振荡频率（Hz），调制音量营造海浪/风声起伏 */
  lfo?: number;
}

const PRESETS: NoisePreset[] = [
  { key: 'rain', label: '雨声', filterType: 'lowpass', freq: 1200, q: 0.7 },
  { key: 'waves', label: '海浪', filterType: 'lowpass', freq: 600, q: 0.9, lfo: 0.12 },
  { key: 'forest', label: '森林', filterType: 'bandpass', freq: 1800, q: 0.5 },
  { key: 'fire', label: '篝火', filterType: 'lowpass', freq: 760, q: 0.6 },
];

interface AudioGraph {
  ctx: AudioContext;
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfo?: OscillatorNode;
}

/** 白噪音环境音：Web Audio 程序化合成，零音频文件、零依赖、零联网。 */
export function WhiteNoiseTool() {
  const [preset, setPreset] = useState<NoisePreset>(PRESETS[0]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const graphRef = useRef<AudioGraph | null>(null);

  function buildGraph(p: NoisePreset, vol: number): AudioGraph {
    const Ctx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    // 2 秒白噪声缓冲，循环播放
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = p.filterType;
    filter.frequency.value = p.freq;
    filter.Q.value = p.q;

    const gain = ctx.createGain();
    gain.gain.value = vol;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    let lfo: OscillatorNode | undefined;
    if (p.lfo) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = p.lfo;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = vol * 0.4;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
    }

    source.start();
    return { ctx, source, gain, lfo };
  }

  function stopGraph() {
    const g = graphRef.current;
    if (!g) return;
    try {
      g.source.stop();
      g.lfo?.stop();
      void g.ctx.close();
    } catch {
      /* 已停止 */
    }
    graphRef.current = null;
  }

  function play(p: NoisePreset, vol: number) {
    stopGraph();
    graphRef.current = buildGraph(p, vol);
    setPlaying(true);
  }

  function stop() {
    stopGraph();
    setPlaying(false);
  }

  function changePreset(p: NoisePreset) {
    setPreset(p);
    if (playing) play(p, volume); // 实时切换音色
  }

  function changeVolume(v: number) {
    setVolume(v);
    const g = graphRef.current;
    if (g) g.gain.gain.value = v;
  }

  // 卸载时清理音频资源
  useEffect(() => () => stopGraph(), []);

  return (
    <div className="noise">
      <div className="noise-presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`chip${preset.key === p.key ? ' active' : ''}`}
            onClick={() => changePreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`noise-toggle${playing ? ' playing' : ''}`}
        onClick={() => (playing ? stop() : play(preset, volume))}
        aria-pressed={playing}
      >
        {playing ? '停止' : '播放'}
      </button>

      <div className="noise-volume">
        <span className="muted">音量</span>
        <Slider min={0} max={1} step={0.01} value={volume} onChange={changeVolume} ariaLabel="白噪音音量" />
      </div>

      <p className="muted noise-tip">程序实时合成的环境音，不下载任何音频文件。</p>
    </div>
  );
}
