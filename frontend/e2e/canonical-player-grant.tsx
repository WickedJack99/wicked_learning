import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ItemGrantActivity as CopiedItem } from '../canonical-source/resources/js/features/world/item-grant-activity';
import { ToolGrantActivity as CopiedTool } from '../canonical-source/resources/js/features/world/tool-grant-activity';
import { ItemGrantActivity as MainItem } from '../../resources/js/features/world/item-grant-activity';
import { ToolGrantActivity as MainTool } from '../../resources/js/features/world/tool-grant-activity';
import * as copiedItems from '../canonical-source/resources/js/features/items/item-inventory';
import * as mainItems from '../../resources/js/features/items/item-inventory';
import * as copiedTools from '../canonical-source/resources/js/features/tools/tool-selection';
import * as mainTools from '../../resources/js/features/tools/tool-selection';
import { apiClient } from '../src/platform/api/client';
import { bindPlaybackDocument } from '../src/platform/playback-context';
import { completeGrantActivity } from '../src/platform/playback-grant-api';
import { toPlaybackPageProps, toSourcePlaybackTool } from '../src/platform/playback-projection';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

const original = new URLSearchParams(location.search).has('original');
const items = original ? mainItems : copiedItems;
const tools = original ? mainTools : copiedTools;
function InventoryProbe() {
    const inventory = items.useAvailableLearningItems([]);
    useEffect(() => { (window as any).__grantInventory = inventory; }, [inventory]);
    return null;
}

// Whole source controls on real Rust projections/commands. This host observes
// callbacks and unmounts on movement; it does not emulate the owning NodePlay
// page, its navigation, check-in or Companion lifecycle.
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
        ]).then(async ([playback, translations, session]) => {
            if (!playback.data || !translations.data || !session.data || !playback.response.ok || !translations.response.ok || !session.response.ok) throw new Error('The player evidence projection is unavailable.');
            const props = toPlaybackPageProps(playback.data);
            const activity = props.node.activities.find((entry) => entry.id === props.playActivityId);
            if (!activity || !['item_grant', 'tool_grant'].includes(activity.type)) throw new Error('Expected a real grant activity.');
            let ownedTools: any[] = [];
            if (activity.type === 'tool_grant') {
                const shell = await apiClient.GET('/learner/shell');
                if (!shell.data || !shell.response.ok) throw new Error('The player evidence inventory is unavailable.');
                ownedTools = shell.data.tools.map(toSourcePlaybackTool);
            }
            if (!alive) return;
            release = bindPlaybackDocument(playback.data);
            setState({ props, activity, localization: translations.data, ownedTools });
        }).catch((failure) => { if (alive) setError(failure.message); });
        return () => { alive = false; release?.(); };
    }, []);
    const complete = useCallback(async (activity: { id: unknown }) => {
        (window as any).__grantCompletion = await completeGrantActivity(activity.id, state.props.playRunId);
    }, [state]);
    const move = useCallback((id: unknown) => {
        (window as any).__grantDestination = { id };
        (window as any).__grantSelectedTool = tools.selectedLearningTool();
        setFinished(true);
    }, []);
    if (error) return <p role="alert">{error}</p>;
    if (!state) return <p>Loading evidence…</p>;
    const Item = original ? MainItem : CopiedItem; const Tool = original ? MainTool : CopiedTool;
    const common = { activity: state.activity, onComplete: complete, onMoveToActivity: move, transition: state.activity.transitions[0] ?? null };
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: {
        localization: state.localization, playRunId: state.props.playRunId, auth: { tools: state.ownedTools },
    } }}>
        <InventoryProbe />
        <main data-testid="grant-evidence" className="mx-auto max-w-3xl p-4">
            {!finished && (state.activity.type === 'item_grant' ? <Item {...common} playRunId={state.props.playRunId} /> : <Tool {...common} />)}
        </main>
    </SourcePageProjectionProvider>;
}
createRoot(document.getElementById('root')!).render(<Evidence />);
