import { FONT_SIZES, THEME_CHOICES } from '../model';
import { setFontSizeIndex, setTheme, useFontSizeIndex, useTheme } from '../store';

const FONT_LABELS = ['小', '标准', '大', '特大'];

/** 设置面板：正文字号 + 主题（我的页入口，全站生效）。 */
export function SettingsPanel() {
  const fontSizeIndex = useFontSizeIndex();
  const theme = useTheme();

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
    </section>
  );
}
