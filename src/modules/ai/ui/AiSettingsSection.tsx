import { useState } from 'react';
import { useAiConfig, useAiConfigured, patchAiConfig, resetAiConfig, testConnection } from '../store';
import { DEEPSEEK_PRESET, type AiErrorInfo } from '../model';

type EndpointMode = 'preset' | 'custom';

/**
 * 「我的」页 AI 设置卡片：BYOK 密钥配置（PRD §5.3）。
 * 密钥只存本机浏览器（localStorage，键 tailtale:ai），代码中无任何上传逻辑。
 * 支持 DeepSeek 预设与任意 OpenAI 兼容自定义端点（base_url / api_key / model）。
 */
export function AiSettingsSection() {
  const config = useAiConfig();
  const configured = useAiConfigured();
  const [mode, setMode] = useState<EndpointMode>(() =>
    config.baseUrl && config.baseUrl !== DEEPSEEK_PRESET.baseUrl ? 'custom' : 'preset'
  );
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: AiErrorInfo } | null>(null);

  const runTest = async (): Promise<void> => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(config);
    setTestResult(result);
    setTesting(false);
  };

  const switchMode = (next: EndpointMode): void => {
    setMode(next);
    // 切回预设：写入预设端点（保留已填密钥，避免用户重复输入）
    if (next === 'preset') {
      patchAiConfig({ baseUrl: DEEPSEEK_PRESET.baseUrl, model: DEEPSEEK_PRESET.model });
      // 切到自定义：若当前仍是预设地址，清空让用户填自己的端点，
      // 避免「选了自定义却显示预设地址」的歧义（与切预设对称）
    } else if (config.baseUrl === DEEPSEEK_PRESET.baseUrl) {
      patchAiConfig({ baseUrl: '' });
    }
  };

  return (
    <div className="card" id="ai-settings">
      <div className="ai-settings-head">
        <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>AI 解读书</h2>
        <span className={`ai-chip${configured ? ' on' : ''}`}>
          {configured ? '已配置' : '未配置'}
        </span>
      </div>

      <div className="segmented">
        <button
          type="button"
          className={`segmented-item${mode === 'preset' ? ' active' : ''}`}
          onClick={() => switchMode('preset')}
        >
          DeepSeek 预设
        </button>
        <button
          type="button"
          className={`segmented-item${mode === 'custom' ? ' active' : ''}`}
          onClick={() => switchMode('custom')}
        >
          自定义端点
        </button>
      </div>

      {mode === 'preset' ? (
        <>
          <div className="settings-row">
            <span className="settings-label">接口地址</span>
            <span className="muted">{DEEPSEEK_PRESET.baseUrl}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">模型</span>
            <span className="muted">{DEEPSEEK_PRESET.model}</span>
          </div>
        </>
      ) : (
        <>
          <label className="ai-field">
            <span className="settings-label">接口地址（base_url）</span>
            <input
              className="ai-input"
              type="url"
              value={config.baseUrl}
              placeholder="https://api.deepseek.com/v1"
              spellCheck={false}
              onChange={(e) => patchAiConfig({ baseUrl: e.target.value })}
            />
          </label>
          <label className="ai-field">
            <span className="settings-label">模型</span>
            <input
              className="ai-input"
              value={config.model}
              placeholder="deepseek-chat"
              spellCheck={false}
              onChange={(e) => patchAiConfig({ model: e.target.value })}
            />
          </label>
        </>
      )}

      <label className="ai-field">
        <span className="settings-label">API 密钥</span>
        <div className="ai-key-row">
          <input
            className="ai-input"
            type={showKey ? 'text' : 'password'}
            value={config.apiKey}
            placeholder="sk-…"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => patchAiConfig({ apiKey: e.target.value })}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? '隐藏密钥' : '显示密钥'}
          >
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </label>

      <p className="ai-note">
        不要在公共电脑上填写密钥；密钥仅保存在本机浏览器，不会上传。支持任意 OpenAI
        兼容端点，切换即时保存。
      </p>

      <div className="ai-test-row">
        <button
          type="button"
          className="btn"
          disabled={!configured || testing}
          onClick={runTest}
        >
          {testing ? '测试中…' : '测试连接'}
        </button>
        {testResult &&
          (testResult.ok ? (
            <span className="ai-test-ok">✓ 连接成功，可以开始解读</span>
          ) : (
            <span className="ai-test-fail" title={testResult.error?.hint}>
              ✕ {testResult.error?.message}
            </span>
          ))}
      </div>
      {testResult && !testResult.ok && testResult.error?.hint && (
        <p className="ai-test-hint">{testResult.error.hint}</p>
      )}

      {configured && (
        <button type="button" className="btn btn-danger" onClick={resetAiConfig}>
          清除配置
        </button>
      )}
    </div>
  );
}
