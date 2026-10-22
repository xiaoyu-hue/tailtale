import { FONT_SIZES, THEME_CHOICES, THEME_SKINS } from '../model';
import {
  setFontSizeIndex,
  setReduceMotion,
  setSkin,
  setTheme,
  useFontSizeIndex,
  useReduceMotion,
  useSkin,
  useTheme,
} from '../store';

const FONT_LABELS = ['小', '标准', '大', '特大'];

/** 设置面板：正文字号 + 主题 + 界面皮肤 + 减少动画（我的页入口，全站生效）。 */
export function SettingsPanel() {
  const fontSizeIndex = useFontSizeIndex();
  const theme = useTheme();
  const skin = useSkin();
  const reduceMotion = useReduceMotion();

  return (
    <section className="card settings-panel" id="settings">
      <h2 style={{ margin: '0 0 4px', fontSize: 17 }}>设置</h2>

      <div className="settings-row">
        <span className="settings-label">正文字号</span>
        <div className="segmented" role="group" aria-label="正文字号">
          {FONT_SIZES.map((size, index) => (
            <button
              key={size}
              type="button"
              className={`segmented-item${index === fontSizeIndex ? ' active' : ''}`}
              aria-pressed={index === fontSizeIndex}
              onClick={() => setFontSizeIndex(index)}
            >
              {FONT_LABELS[index]}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">主题</span>
        <div className="segmented" role="group" aria-label="主题">
          {THEME_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className={`segmented-item${choice.value === theme ? ' active' : ''}`}
              aria-pressed={choice.value === theme}
              onClick={() => setTheme(choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row settings-row--skin">
        <span className="settings-label">界面皮肤</span>
        <div className="segmented" role="group" aria-label="界面皮肤">
          {THEME_SKINS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented-item${option.value === skin ? ' active' : ''}`}
              aria-pressed={option.value === skin}
              onClick={() => setSkin(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">
          减少动画
          <span className="settings-hint">关闭界面动画与过渡效果</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={reduceMotion}
          aria-label="减少动画"
          className={`switch${reduceMotion ? ' on' : ''}`}
          onClick={() => setReduceMotion(!reduceMotion)}
        >
          <span className="switch-knob" />
        </button>
      </div>
    </section>
  );
}
