import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './app';
import { CurrentUserProvider } from './current-user';
import { OriginalPlatformTranslationProvider } from './original-platform-translation';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <OriginalPlatformTranslationProvider>
        <CurrentUserProvider>
          <App />
        </CurrentUserProvider>
      </OriginalPlatformTranslationProvider>
    </BrowserRouter>
  </StrictMode>,
);
