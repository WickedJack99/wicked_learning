import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessagePromptActivity as CopiedPrompt, MessageWallActivity as CopiedWall } from '../canonical-source/resources/js/features/world/message-activities';
import { MessagePromptActivity as MainPrompt, MessageWallActivity as MainWall } from '../../resources/js/features/world/message-activities';
import { apiClient } from '../src/platform/api/client';
import { bindPlaybackDocument } from '../src/platform/playback-context';
import { completeMessageActivity } from '../src/platform/playback-message-api';
import { toPlaybackPageProps } from '../src/platform/playback-projection';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Whole source controls with actual Rust data. Observe their callbacks without
// replacing the owning NodePlay/check-in/navigation implementation.
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
            if (!playback.data || !translations.data || !playback.response.ok || !translations.response.ok) throw new Error('The message evidence projection is unavailable.');
            const props = toPlaybackPageProps(playback.data);
            const activity = props.node.activities.find((entry) => entry.id === props.playActivityId);
            if (!activity || !['message_prompt', 'message_wall'].includes(activity.type)) throw new Error('Expected a real message activity.');
            release = bindPlaybackDocument(playback.data);
            setState({ props, activity, localization: translations.data });
        }).catch((failure) => { if (alive) setError(failure.message); });
        return () => { alive = false; release?.(); };
    }, []);
    const complete = useCallback(async (activity: { id: unknown }) => {
        (window as any).__messageCompletion = await completeMessageActivity(activity.id, state.props.playRunId);
    }, [state]);
    const move = useCallback((id: unknown) => { (window as any).__messageDestination = { id }; setFinished(true); }, []);
    if (error) return <p role="alert">{error}</p>;
    if (!state) return <p>Loading evidence…</p>;
    const original = new URLSearchParams(location.search).has('original');
    const Prompt = original ? MainPrompt : CopiedPrompt; const Wall = original ? MainWall : CopiedWall;
    const common = { activity: state.activity, onComplete: complete, onMoveToActivity: move, transition: state.activity.transitions[0] ?? null };
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: { ...state.props, localization: state.localization } }}>
        <main data-testid="message-evidence" className="mx-auto flex h-screen max-w-5xl flex-col p-4">
            {!finished && (state.activity.type === 'message_prompt' ? <Prompt {...common} /> : <Wall {...common} />)}
        </main>
    </SourcePageProjectionProvider>;
}
createRoot(document.getElementById('root')!).render(<Evidence />);
