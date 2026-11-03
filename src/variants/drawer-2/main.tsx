import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { VariantBar } from '@prototype/VariantBar'
import { App } from './App'
import './styles/tokens.css'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VariantBar current="drawer-2" />
    <App />
  </StrictMode>,
)
