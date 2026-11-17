import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import '../canonical-source/resources/css/app.css';
import { initializeTheme } from '@/hooks/use-appearance';
import { CanonicalSourceResolver } from './platform/canonical-resolver';

initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <CanonicalSourceResolver />
    </BrowserRouter>,
);
