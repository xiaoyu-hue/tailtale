import { useEffect, useRef, useState } from 'react';
import { Slider, toast } from '../../../components';
import { NOISE_PRESETS, type NoisePreset } from '../noise-model';

/** 白噪音环境音：四段 CC0 公共领域循环录音（OpenGameArt / Freesound），
 *  单 audio 元素循环播放，素材随 Service Worker 预缓存、完全离线可用。 */
export function WhiteNoiseTool() {
  const [preset, setPreset] = useState<NoisePreset>(NOISE_PRESETS[0]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedSrcRef = useRef('');

  function play(p: NoisePreset, vol: number) {
    const a = audioRef.current;
    if (!a) return;
    const src = `${import.meta.env.BASE_URL}${p.src}`;
    if (loadedSrcRef.current !== src) {
      a.src = src;
      loadedSrcRef.current = src;
    }
    a.volume = vol;
    a.loop = true;
    void a.play().then(
      () => setPlaying(true),
      (err: unknown) => {
        // 用户快速点了停止会抛 AbortError，属正常交互，不当错误处理
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPlaying(false);
        toast.error('环境音播放失败，请重试');
      },
    );
  }

  function stop() {
    const a = audioRef.current;
    if (a) {
      a.pause();
      // 归零播放进度：仅 pause 的话再点「播放」会从中断处续播（loadedSrcRef
      // 守卫使相同 src 不重载、currentTime 保持），不符合「停止」的语义
      a.currentTime = 0;
    }
    setPlaying(false);
  }

  function changePreset(p: NoisePreset) {
    setPreset(p);
    if (playing) play(p, volume); // 播放中切换音色，保持播放状态
  }

  function changeVolume(v: number) {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  // 卸载时停止播放并释放音频资源
  useEffect(
    () => () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
      }
      loadedSrcRef.current = '';
    },
    [],
  );

  return (
    <div className="noise">
      <div className="noise-presets">
        {NOISE_PRESETS.map((p) => (
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

      <audio ref={audioRef} loop preload="none" hidden />

      <p className="muted noise-tip">
        四段环境音均为 CC0 公共领域素材（OpenGameArt / Freesound），已随应用离线打包，详情见「我的」页开源致谢。
      </p>
    </div>
  );
}
