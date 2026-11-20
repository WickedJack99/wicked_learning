import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import { loadCompanion } from '../src/platform/companion-api';
import '../canonical-source/resources/css/app.css';

const modules = import.meta.glob([
    '../canonical-source/resources/js/features/world/learning-companion-panel.tsx',
    '../../resources/js/features/world/learning-companion-panel.tsx',
]);
const original = new URLSearchParams(location.search).has('original');
const module = original ? '../../resources/js/features/world/learning-companion-panel.tsx'
    : '../canonical-source/resources/js/features/world/learning-companion-panel.tsx';
const Launcher = lazy(async () => ({ default: (await modules[module]()).LearningCompanionLauncher }));

function Evidence() {
    const [companion, setCompanion] = useState(original ? window.sourceCompanionEvidence : undefined);
    const [error, setError] = useState('');
    useEffect(() => {
        if (original) return;
        const signal = new AbortController();
        loadCompanion(window.companionQueryEvidence ?? { surface: 'desk' }, signal.signal)
            .then(setCompanion).catch((error) => { if (!signal.signal.aborted) setError(error.message); });
        return () => signal.abort();
    }, []);
    return <SourcePageProjectionProvider value={{ component: 'world', props: { localization: { translations: {} } } }}>
        {error ? <p role="alert">{error}</p> : companion === undefined ? <p>Loading Companion</p>
            : companion === null ? <p>No Companion configured</p>
                : <Suspense fallback={<p>Loading source</p>}><Launcher companion={companion} /></Suspense>}
    </SourcePageProjectionProvider>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><Evidence /></BrowserRouter>);
