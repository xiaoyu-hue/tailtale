interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * 错误态（通用原语）：图标 + 标题 + 说明 + 重试按钮。
 * 大厂气质分水岭：每个错误都给「发生了什么 + 下一步」，而非白屏或裸文字。
 * 替换此前阅读器内联的 loadError 写法。
 */
export function ErrorState({
  title = '出错了',
  message,
  onRetry,
  retryLabel = '重试',
}: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state-icon" aria-hidden="true">
        ⚠
      </div>
      <div className="error-state-title">{title}</div>
      {message && <div className="error-state-message">{message}</div>}
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
