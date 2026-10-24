interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

/**
 * 滑块（通用原语）：基于原生 range input，配色走令牌（accent-color = 主色）。
 * 原生控件自带键盘可达性与 aria，无需额外封装。用于连续值调节（如未来亮度/进度）。
 */
export function Slider({ value, min, max, step = 1, onChange, ariaLabel }: SliderProps) {
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
