import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Note: StrictMode disabled due to compatibility issues with gaussian-splats-3d library
// The library's cleanup code conflicts with React 18's double-mount behavior in dev mode
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
