import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { ToastViewport } from './components';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到挂载节点 #root');
}

// 全局兜底：捕获任何未处理 Promise 异常，避免静默失败且无日志
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 异常', event.reason);
});

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
    <ToastViewport />
  </React.StrictMode>
);
