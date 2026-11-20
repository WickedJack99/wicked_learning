import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import AppLayout from '../../resources/js/layouts/app-layout';
import World from '../../resources/js/pages/world';
import { initializeTheme } from '../../resources/js/hooks/use-appearance';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Source app.tsx wraps World with this whole layout. This evidence-only entry
// supplies independently mapped shell props; it is not a production resolver.
const props = window.sourceWorldEvidence;
window.__INITIAL_AUTHENTICATED__ = true;
window.__INITIAL_APPEARANCE__ = props.appearance;
initializeTheme();
history.replaceState(history.state, '', window.sourceWorldEvidenceUrl);
createRoot(document.getElementById('root')!).render(
    <BrowserRouter><SourcePageProjectionProvider value={{ component: 'world', props }}>
        <AppLayout><World {...props} /></AppLayout>
    </SourcePageProjectionProvider></BrowserRouter>,
);
