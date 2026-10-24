import { useEffect, useState } from 'react';
import { Slider } from '../../../components';
import { toast } from '../../../components';
import { useRecentBook, readBookContent } from '../../books';
import type { ToolProps } from './ToolboxView';

const MAX_CHARS = 20000;

/** 朗读：基于浏览器内置语音合成（Web Speech API），离线可用、零依赖、零联网。 */
export function TtsTool({ onClose: _onClose }: ToolProps) {
  const [text, setText] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const recentBook = useRecentBook();

  useEffect(() => {
    const synth = window.speechSynthesis;
    const update = () => {
      const vs = synth.getVoices();
      setVoices(vs);
      setVoiceURI((cur) => {
        if (cur && vs.some((v) => v.voiceURI === cur)) return cur;
        const zh = vs.find((v) => /zh|cmn|Chinese|Yue/i.test(v.lang)) ?? vs[0];
        return zh ? zh.voiceURI : '';
      });
    };
    update();
    synth.onvoiceschanged = update;
    return () => {
      synth.onvoiceschanged = null;
      synth.cancel();
    };
  }, []);

  function speak() {
    const t = text.trim();
    if (!t) {
      toast.info('请先输入或载入文本');
      return;
    }
    const u = new SpeechSynthesisUtterance(t);
    u.rate = rate;
    u.pitch = pitch;
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) u.voice = v;
    u.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };
    u.onerror = () => {
      setSpeaking(false);
      setPaused(false);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
    setPaused(false);
  }

  function togglePause() {
    const synth = window.speechSynthesis;
    if (paused) {
      synth.resume();
      setPaused(false);
    } else {
      synth.pause();
      setPaused(true);
    }
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }

  async function loadRecent() {
    if (!recentBook) {
      toast.info('还没有在读的书');
      return;
    }
    try {
      const content = await readBookContent(recentBook.id);
      setText(content.slice(0, MAX_CHARS));
      toast.success(`已载入《${recentBook.title}》正文（前 ${MAX_CHARS / 1000} 千字）`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const zhVoices = voices.filter((v) => /zh|cmn|Chinese|Yue/i.test(v.lang));

  return (
    <div className="tts">
      <textarea
        className="textstats-input"
        placeholder="粘贴文本，或点「载入当前书」朗读正在读的书…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
      />

      <div className="tts-controls">
        <button type="button" className="btn btn-primary" onClick={speak} disabled={speaking && !paused}>
          {speaking && !paused ? '朗读中' : '朗读'}
        </button>
        <button type="button" className="btn" onClick={togglePause} disabled={!speaking}>
          {paused ? '继续' : '暂停'}
        </button>
        <button type="button" className="btn" onClick={stop} disabled={!speaking}>
          停止
        </button>
        <button type="button" className="btn" onClick={loadRecent}>
          载入当前书
        </button>
      </div>

      <div className="tts-row">
        <span className="muted">语速</span>
        <Slider min={0.5} max={2} step={0.1} value={rate} onChange={setRate} ariaLabel="朗读语速" />
        <span className="tts-num">{rate.toFixed(1)}×</span>
      </div>

      <div className="tts-row">
        <span className="muted">音调</span>
        <Slider min={0} max={2} step={0.1} value={pitch} onChange={setPitch} ariaLabel="朗读音调" />
        <span className="tts-num">{pitch.toFixed(1)}</span>
      </div>

      <div className="tts-row">
        <span className="muted">音色</span>
        <select className="tts-select" value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
          {(zhVoices.length ? zhVoices : voices).map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}（{v.lang}）
            </option>
          ))}
        </select>
      </div>

      <p className="muted noise-tip">
        使用设备自带语音引擎，离线朗读；中文音色取决于系统是否已安装中文语音包。
      </p>
    </div>
  );
}
