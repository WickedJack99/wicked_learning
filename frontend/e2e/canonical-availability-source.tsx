import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Component evidence only: the pinned World currently refuses locked-node
// selection. Mount the whole drawer to inspect its existing requirements UI;
// this is neither a production route nor proof of reachable World navigation.
const original = new URL(location.href).searchParams.has('original');
const [{ NodeDetailDrawer }, { default: AppLayout }] = await Promise.all(original ? [
    import('../../resources/js/features/world/node-detail-drawer'),
    import('../../resources/js/layouts/app-layout'),
] : [
    import('../canonical-source/resources/js/features/world/node-detail-drawer'),
    import('../canonical-source/resources/js/layouts/app-layout'),
]);
const props = window.sourceWorldEvidence;
window.__INITIAL_AUTHENTICATED__ = true;
window.__INITIAL_APPEARANCE__ = props.appearance;
history.replaceState(history.state, '', '/world?map=orientation-map');
createRoot(document.getElementById('root')!).render(
    <BrowserRouter><SourcePageProjectionProvider value={{ component: 'world', props }}>
        <AppLayout><NodeDetailDrawer node={props.world.maps[0].nodes[0]} canBookmark={true} isBookmarked={false} isCompleted={false}
            onClose={() => {}} onStart={() => {}} onSwipeChange={() => {}} onToggleBookmark={() => {}} swipe={null} theme={null} /></AppLayout>
    </SourcePageProjectionProvider></BrowserRouter>,
);
