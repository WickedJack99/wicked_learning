import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import '../canonical-source/resources/css/app.css';
import { CanonicalSourceResolver } from './platform/canonical-resolver';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <CanonicalSourceResolver />
    </BrowserRouter>,
);
