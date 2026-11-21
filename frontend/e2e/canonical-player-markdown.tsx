import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MarkdownActivity as Copied } from '../canonical-source/resources/js/features/world/markdown-activity';
import { MarkdownActivity as Main } from '../../resources/js/features/world/markdown-activity';
import { apiClient } from '../src/platform/api/client';
import { bindPlaybackDocument } from '../src/platform/playback-context';
import { completeMarkdownActivity } from '../src/platform/playback-markdown-api';
import { toPlaybackPageProps } from '../src/platform/playback-projection';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Whole source component with actual Rust reads/receipts. This host observes
// parent callbacks; it does not activate or emulate the NodePlay lifecycle.
function Evidence() {
    const [state, setState] = useState<any>(null);
    const [error, setError] = useState('');
    const [finished, setFinished] = useState(false);
    useEffect(() => {
        let alive = true; let release: (() => void) | undefined;
        const run = new URLSearchParams(location.search).get('run')!;
        void Promise.all([
            apiClient.GET('/learner/play-runs/{play_run_id}', { params: { path: { play_run_id: run } } }),
            apiClient.GET('/learner/platform-translations'),
        ]).then(([playback, translations]) => {
            if (!alive) return;
            if (!playback.data || !translations.data || !playback.response.ok || !translations.response.ok) throw new Error('The Markdown activity is currently unavailable.');
            const props = toPlaybackPageProps(playback.data);
            const activity = props.node.activities.find((entry) => entry.id === props.playActivityId);
            if (activity?.type !== 'markdown') throw new Error('Expected an actual Markdown activity.');
            release = bindPlaybackDocument(playback.data);
            setState({ props, activity, localization: translations.data });
        }).catch((failure) => { if (alive) setError(failure.message); });
        return () => { alive = false; release?.(); };
    }, []);
    if (error) return <p role="alert">{error}</p>;
    if (!state) return <p>Loading evidence…</p>;
    const Player = new URLSearchParams(location.search).has('original') ? Main : Copied;
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: { localization: state.localization } }}>
        <main data-testid="markdown-evidence" className="mx-auto flex h-screen max-w-5xl flex-col p-4">
            {!finished && <Player activity={state.activity} transition={state.activity.transitions.find((entry: any) => entry.trigger === 'completed') ?? null}
                onComplete={async (activity) => { (window as any).__markdownCompletion = await completeMarkdownActivity(activity.id, state.props.playRunId); }}
                onMoveToActivity={(id) => { (window as any).__markdownDestination = { id }; setFinished(true); }} />}
        </main>
    </SourcePageProjectionProvider>;
}
createRoot(document.getElementById('root')!).render(<Evidence />);
