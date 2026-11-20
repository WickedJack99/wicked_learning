import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import World from '../../resources/js/pages/world';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Test-only original page; production resolves exclusively canonical-source.
// The comparison supplies independently authored, Laravel-shaped props.
const props = window.sourceWorldEvidence;
createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <SourcePageProjectionProvider value={{ component: 'world', props }}>
            <World {...props} />
        </SourcePageProjectionProvider>
    </BrowserRouter>,
);
