import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ItemObstacleActivity as CopiedItem } from '../canonical-source/resources/js/features/world/item-obstacle-activity';
import { ObstacleActivity as CopiedTool } from '../canonical-source/resources/js/features/world/obstacle-activity';
import { AppSideActionBar as CopiedActions } from '../canonical-source/resources/js/components/app-side-action-bar';
import { ItemObstacleActivity as MainItem } from '../../resources/js/features/world/item-obstacle-activity';
import { ObstacleActivity as MainTool } from '../../resources/js/features/world/obstacle-activity';
import { AppSideActionBar as MainActions } from '../../resources/js/components/app-side-action-bar';
import { apiClient } from '../src/platform/api/client';
import { bindPlaybackDocument } from '../src/platform/playback-context';
import { completeObstacleActivity } from '../src/platform/playback-obstacle-api';
import { toPlaybackPageProps, toSourcePlaybackItem, toSourcePlaybackTool } from '../src/platform/playback-projection';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Whole controls and whole source item/tool bar. Only the component callback
// boundary is observed: this is not a replacement NodePlay page or a simulated
// check-in, Companion, route advance or navigation implementation.
function Evidence() {
    const [state, setState] = useState<any>(null);
    const [error, setError] = useState('');
    const [finished, setFinished] = useState(false);
    useEffect(() => {
        let alive = true; let release: (() => void) | undefined;
        const run = new URLSearchParams(location.search).get('run')!;
        void Promise.all([
            apiClient.GET('/learner/play-runs/{play_run_id}', { params: { path: { play_run_id: run } } }),
            apiClient.GET('/learner/platform-translations'), apiClient.GET('/me'),
            apiClient.GET('/learner/shell'), apiClient.GET('/learner/sound-preferences'),
        ]).then(([playback, translations, session, shell, sound]) => {
            if (!alive) return;
            if (!playback.data || !translations.data || !session.data || !shell.data || !sound.data ||
                [playback, translations, session, shell, sound].some((result) => !result.response.ok)) throw new Error('The obstacle evidence projection is unavailable.');
            const props = toPlaybackPageProps(playback.data);
            const activity = props.node.activities.find((entry) => entry.id === props.playActivityId);
            if (!activity || !['item_obstacle', 'obstacle'].includes(activity.type)) throw new Error('Expected a real obstacle activity.');
            release = bindPlaybackDocument(playback.data);
            setState({ props, activity, localization: translations.data,
                auth: { user: { id: session.data.subject_id, name: session.data.name }, items: shell.data.items.map(toSourcePlaybackItem), tools: shell.data.tools.map(toSourcePlaybackTool) },
                soundPreferences: { ambienceVolume: sound.data.ambience_volume, effectsVolume: sound.data.effects_volume, muted: sound.data.muted },
            });
        }).catch((failure) => { if (alive) setError(failure.message); });
        return () => { alive = false; release?.(); };
    }, []);
    const complete = useCallback(async (activity: { id: unknown }) => {
        (window as any).__obstacleCompletion = await completeObstacleActivity(activity.id, state.props.playRunId);
    }, [state]);
    const move = useCallback((id: unknown) => {
        (window as any).__obstacleDestination = { id }; setFinished(true);
    }, []);
    if (error) return <p role="alert">{error}</p>;
    if (!state) return <p>Loading evidence…</p>;
    const original = new URLSearchParams(location.search).has('original');
    const Item = original ? MainItem : CopiedItem; const Tool = original ? MainTool : CopiedTool; const Actions = original ? MainActions : CopiedActions;
    const common = { activity: state.activity, progress: state.props.progress.activities[state.activity.id], onComplete: complete, onMoveToActivity: move, transition: state.activity.transitions[0] ?? null };
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: {
        ...state.props, localization: state.localization, auth: state.auth, soundPreferences: state.soundPreferences,
    } }}>
        <main data-testid="obstacle-evidence" className="mx-auto max-w-3xl p-4">
            {!finished && (state.activity.type === 'item_obstacle' ? <Item {...common} /> : <Tool {...common} />)}
        </main>
        <Actions />
    </SourcePageProjectionProvider>;
}
createRoot(document.getElementById('root')!).render(<Evidence />);
