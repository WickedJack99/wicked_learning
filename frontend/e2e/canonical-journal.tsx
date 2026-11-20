import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import { initializeTheme } from '../canonical-source/resources/js/hooks/use-appearance';
import '../canonical-source/resources/css/app.css';

// Test-only mounting of the whole overlay. Production activation belongs to
// the whole shared layout once every one of its contracts is connected.
const original = new URLSearchParams(location.search).has('original');
const { JournalOverlay } = original
    ? await import('../../resources/js/features/journal/journal-overlay')
    : await import('../canonical-source/resources/js/features/journal/journal-overlay');
document.documentElement.dataset.appearance = 'light';
initializeTheme();
function Evidence() {
    const [open, setOpen] = useState(true);
    return (
    <BrowserRouter>
        <SourcePageProjectionProvider value={{ component: 'world', props: window.journalEvidenceProps ?? { localization: { translations: {} } } }}>
            {open ? <JournalOverlay onClose={() => setOpen(false)} /> : <button onClick={() => setOpen(true)}>Open journal evidence</button>}
        </SourcePageProjectionProvider>
    </BrowserRouter>
    );
}
const root = window.journalEvidenceRoot ??= createRoot(document.getElementById('root')!);
root.render(<Evidence />);
