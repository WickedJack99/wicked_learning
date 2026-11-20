import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SharedTaskActivity as CopiedSharedTask } from '../canonical-source/resources/js/features/world/shared-task-activity';
import { SharedTaskActivity as MainSharedTask } from '../../resources/js/features/world/shared-task-activity';
import { apiClient } from '../src/platform/api/client';
import { toPlaybackPageProps } from '../src/platform/playback-projection';
import { bindSharedTaskPlayback } from '../src/platform/playback-shared-task-api';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Test-only host of the complete component. The normal resolver still keeps
// NodePlay unavailable. Shared completion/navigation are not simulated here.
function Evidence() {
    const [state, setState] = useState<any>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        let release: (() => void) | undefined;
        const run = new URLSearchParams(location.search).get('run')!;
        void Promise.all([
            apiClient.GET('/learner/play-runs/{play_run_id}', { params: { path: { play_run_id: run } } }),
            apiClient.GET('/learner/platform-translations'),
        ]).then(([playback, translations]) => {
            if (!alive) return;
            if (!playback.data || !translations.data || !playback.response.ok || !translations.response.ok) throw new Error('The player evidence projection is unavailable.');
            const props = toPlaybackPageProps(playback.data);
            const activity = props.node.activities.find((entry) => entry.id === props.playActivityId);
            if (activity?.type !== 'shared_task') throw new Error('Expected a real active Shared Task.');
            release = bindSharedTaskPlayback(playback.data);
            setState({ props, activity, localization: translations.data });
        }).catch((error) => { if (alive) setError(error.message); });
        return () => { alive = false; release?.(); };
    }, []);
    if (error) return <p role="alert">{error}</p>;
    if (!state) return <p>Loading evidence…</p>;
    const Component = new URLSearchParams(location.search).has('original') ? MainSharedTask : CopiedSharedTask;
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: { localization: state.localization } }}>
        <main data-testid="shared-task-evidence" className="mx-auto max-w-3xl p-4">
            <Component activity={state.activity} initialState={state.props.playState[state.activity.id]}
                playRunId={state.props.playRunId} transition={null}
                onComplete={async () => { throw new Error('Completion requires the complete player route.'); }}
                onMoveToActivity={() => { throw new Error('Navigation requires the complete player route.'); }} />
        </main>
    </SourcePageProjectionProvider>;
}
createRoot(document.getElementById('root')!).render(<Evidence />);
