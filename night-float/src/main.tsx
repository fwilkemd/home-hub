import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { hubActions } from './bridge/store';
import { installTestApi } from './bridge/test-api';

hubActions.loadSettings();
installTestApi();

const uiRoot = document.getElementById('ui');
if (!uiRoot) throw new Error('missing #ui root');

createRoot(uiRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
