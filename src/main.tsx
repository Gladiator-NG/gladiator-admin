import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Restore saved font scale before first paint
const savedScale = localStorage.getItem('gladiator_font_scale');
if (savedScale) {
  const n = parseFloat(savedScale);
  if (!isNaN(n) && n >= 62.5 && n <= 80) {
    document.documentElement.style.fontSize = `${n}%`;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
