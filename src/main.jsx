import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Self-hosted fonts — bundled so the hub renders identically with no network.
import '@fontsource-variable/fraunces'
import '@fontsource-variable/inter'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'

import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
