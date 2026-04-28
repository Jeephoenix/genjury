// TEMP: surface boot errors on the page so we can debug white-screen.
if (typeof window !== 'undefined') {
  const showError = (msg) => {
    const root = document.getElementById('root') || document.body
    root.innerHTML = `
      <div style="background:#1a0000;color:#ffb4b4;padding:24px;font:14px/1.5 ui-monospace,monospace;min-height:100vh;white-space:pre-wrap;word-break:break-word;">
        <div style="font-weight:700;margin-bottom:12px;color:#ff6464;">App failed to start</div>
        ${String(msg)}
      </div>
    `
  }
  window.addEventListener('error', (e) =>
    showError((e.error?.stack) || e.message || 'Unknown error'))
  window.addEventListener('unhandledrejection', (e) =>
    showError((e.reason?.stack) || e.reason?.message || String(e.reason)))
}
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
