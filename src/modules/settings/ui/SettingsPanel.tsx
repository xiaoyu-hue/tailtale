import { FONT_SIZES, LINE_HEIGHTS, MARGINS, THEME_CHOICES, THEME_SKINS } from '../model';
import {
  setFontSizeIndex,
  setLineHeightIndex,
  setMarginIndex,
  setReduceMotion,
  setSkin,
  setTheme,
  useFontSizeIndex,
  useLineHeightIndex,
  useMarginIndex,
  useReduceMotion,
  useSkin,
  useTheme,
} from '../store';

const FONT_LABELS = ['小', '标准', '大', '特大'];
const LINE_HEIGHT_LABELS = ['紧凑', '标准', '宽松', '特松'];
const MARGIN_LABELS = ['窄', '标准', '宽', '特宽'];

/** 设置面板：正文字号 + 行距 + 页边距 + 主题 + 界面皮肤 + 减少动画（我的页入口，全站生效）。 */
export function SettingsPanel() {
  const fontSizeIndex = useFontSizeIndex();
  const lineHeightIndex = useLineHeightIndex();
  const marginIndex = useMarginIndex();
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
        <span className="settings-label">行距</span>
        <div className="segmented" role="group" aria-label="行距">
          {LINE_HEIGHTS.map((lh, index) => (
            <button
              key={lh}
              type="button"
              className={`segmented-item${index === lineHeightIndex ? ' active' : ''}`}
              aria-pressed={index === lineHeightIndex}
              onClick={() => setLineHeightIndex(index)}
            >
              {LINE_HEIGHT_LABELS[index]}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">页边距</span>
        <div className="segmented" role="group" aria-label="页边距">
          {MARGINS.map((m, index) => (
            <button
              key={m}
              type="button"
              className={`segmented-item${index === marginIndex ? ' active' : ''}`}
              aria-pressed={index === marginIndex}
              onClick={() => setMarginIndex(index)}
            >
              {MARGIN_LABELS[index]}
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
