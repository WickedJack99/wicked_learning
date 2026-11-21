import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router';
import { useState } from 'react';
import CopiedPage from '../canonical-source/resources/js/pages/learning/node-play';
import MainPage from '../../resources/js/pages/learning/node-play';
import CopiedLayout from '../canonical-source/resources/js/layouts/app-layout';
import MainLayout from '../../resources/js/layouts/app-layout';
import AlertError from '../canonical-source/resources/js/components/alert-error';
import { Spinner } from '../canonical-source/resources/js/components/ui/spinner';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import { usePlaybackPageDocument } from '../src/platform/playback-page-bootstrap';
import { PlaybackCompanionRecovery } from '../src/platform/playback-companion-recovery';
import { PlaybackPortalRecovery } from '../src/platform/playback-portal-recovery';
import '../canonical-source/resources/css/app.css';

// A whole-page source comparison, using real Rust documents/commands. The
// original URL and history replacement remain source-owned across refreshes.
const original = window.name === 'pinned-main';
function Evidence() {
    const [entry] = useState(() => new URL(location.href));
    const state = usePlaybackPageDocument(entry.searchParams.get('run'), entry.pathname.split('/')[3], entry.searchParams.get('route'));
    if (state.kind === 'loading') return <Spinner />;
    if (state.kind === 'unavailable') return <AlertError errors={[state.message]} />;
    const Page = original ? MainPage : CopiedPage;
    const Layout = original ? MainLayout : CopiedLayout;
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: state.props }}>
        <PlaybackCompanionRecovery state={state.companionRecovery} />
        <PlaybackPortalRecovery state={state.portalFailure} />
        <Layout><Page {...state.props as any} /></Layout>
    </SourcePageProjectionProvider>;
}
function RouteEvidence() {
    // Real source links change the route; local activity history replacement
    // must not remount the player and discard its check-in draft.
    const location = useLocation();
    return <Evidence key={location.key} />;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><RouteEvidence /></BrowserRouter>);
