import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到挂载节点 #root');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
