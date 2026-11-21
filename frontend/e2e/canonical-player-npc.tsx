import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NpcDialogueActivity as Copied } from '../canonical-source/resources/js/features/world/npc-dialogue-player';
import { NpcDialogueActivity as Main } from '../../resources/js/features/world/npc-dialogue-player';
import * as copiedTools from '../canonical-source/resources/js/features/tools/tool-selection';
import * as mainTools from '../../resources/js/features/tools/tool-selection';
import { apiClient } from '../src/platform/api/client';
import { bindPlaybackDocument } from '../src/platform/playback-context';
import { completeNpcActivity } from '../src/platform/playback-npc-api';
import { toPlaybackPageProps, toSourcePlaybackTool } from '../src/platform/playback-projection';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

const original = new URLSearchParams(location.search).has('original');
const tools = original ? mainTools : copiedTools;
function InventoryProbe({ base }: { base: any[] }) {
    const inventory = tools.useAvailableLearningTools(base);
    useEffect(() => { (window as any).__npcInventory = inventory; }, [inventory]);
    return null;
}
// Mount the complete source control with Rust data. Observe its parent callbacks;
// this is not a replacement NodePlay page or a production route activation.
function Evidence() {
    const [state, setState] = useState<any>(null);
    const [error, setError] = useState('');
    const [finished, setFinished] = useState(false);
    useEffect(() => {
        let alive = true; let release: (() => void) | undefined;
        const run = new URLSearchParams(location.search).get('run')!;
        const failed = (event: Event) => { (window as any).__npcUnavailable = (event as CustomEvent).detail.message; };
        window.addEventListener('world:source-operation-unavailable', failed);
        void Promise.all([
            apiClient.GET('/learner/play-runs/{play_run_id}', { params: { path: { play_run_id: run } } }),
            apiClient.GET('/learner/platform-translations'), apiClient.GET('/learner/shell'),
            apiClient.GET('/learner/sound-preferences'),
        ]).then(([playback, translations, shell, sound]) => {
            if (!alive) return;
            if (!playback.data || !translations.data || !shell.data || !sound.data ||
                ![playback, translations, shell, sound].every((result) => result.response.ok)) throw new Error('The dialogue is currently unavailable.');
            const props = toPlaybackPageProps(playback.data);
            const activity = props.node.activities.find((entry) => entry.id === props.playActivityId);
            if (!activity || activity.type !== 'npc_dialogue') throw new Error('Expected an actual NPC dialogue.');
            release = bindPlaybackDocument(playback.data);
            setState({ props, activity, localization: translations.data, tools: shell.data.tools.map(toSourcePlaybackTool),
                soundPreferences: { ambienceVolume: sound.data.ambience_volume, effectsVolume: sound.data.effects_volume, muted: sound.data.muted } });
        }).catch((failure) => { if (alive) setError(failure.message); });
        return () => { alive = false; release?.(); window.removeEventListener('world:source-operation-unavailable', failed); };
    }, []);
    const complete = useCallback(async (activity: { id: unknown }, options?: { transitionLabel?: string | null }) => {
        (window as any).__npcCompletion = await completeNpcActivity(activity.id, state.props.playRunId, options);
    }, [state]);
    const move = useCallback((id: unknown) => { (window as any).__npcDestination = { id }; setFinished(true); }, []);
    if (error) return <p role="alert">{error}</p>;
    if (!state) return <p>Loading evidence…</p>;
    const Player = original ? Main : Copied;
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: {
        ...state.props, localization: state.localization, auth: { tools: state.tools }, soundPreferences: state.soundPreferences,
    } }}>
        <InventoryProbe base={state.tools} />
        <main data-testid="npc-evidence" className="mx-auto flex h-screen max-w-5xl flex-col p-4">
            {!finished && <Player activity={state.activity} initialState={state.props.playState[state.activity.id]} onComplete={complete} onMoveToActivity={move} playRunId={state.props.playRunId} />}
        </main>
    </SourcePageProjectionProvider>;
}
createRoot(document.getElementById('root')!).render(<Evidence />);
