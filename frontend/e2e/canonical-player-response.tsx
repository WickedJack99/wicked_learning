import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Copied from '../canonical-source/resources/js/features/world/standard-activities';
import * as Main from '../../resources/js/features/world/standard-activities';
import { apiClient } from '../src/platform/api/client';
import { bindPlaybackDocument } from '../src/platform/playback-context';
import { completeResponseActivity } from '../src/platform/playback-response-api';
import { toPlaybackPageProps } from '../src/platform/playback-projection';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Whole exports, real projections and commands. This test host is not a
// substitute NodePlay page; it observes callback delivery without simulating
// the full page's check-in, Companion or navigation workflows.
function Evidence() {
    const [state, setState] = useState<any>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true; let release: (() => void) | undefined;
        const run = new URLSearchParams(location.search).get('run')!;
        void Promise.all([
            apiClient.GET('/learner/play-runs/{play_run_id}', { params: { path: { play_run_id: run } } }),
            apiClient.GET('/learner/platform-translations'), apiClient.GET('/me'),
        ]).then(([playback, translations, session]) => {
            if (!alive) return;
            if (!playback.data || !translations.data || !session.data || !playback.response.ok || !translations.response.ok || !session.response.ok) throw new Error('The player evidence projection is unavailable.');
            const props = toPlaybackPageProps(playback.data);
            const activity = props.node.activities.find((entry) => entry.id === props.playActivityId);
            if (!activity || !['question', 'reflection', 'review'].includes(activity.type)) throw new Error('Expected a real response activity.');
            release = bindPlaybackDocument(playback.data);
            setState({ props, activity, kind: playback.data.run_kind, localization: translations.data,
                answer: props.progress.answers[activity.id], queued: props.progress.recallQuestionIds.includes(activity.id) });
        }).catch((failure) => { if (alive) setError(failure.message); });
        return () => { alive = false; release?.(); };
    }, []);
    if (error) return <p role="alert">{error}</p>;
    if (!state) return <p>Loading evidence…</p>;
    const source = new URLSearchParams(location.search).has('original') ? Main : Copied;
    const Question = source.QuestionActivity; const Reflection = source.ReflectionActivity;
    const complete = async (activity: { id: unknown }, options?: Record<string, unknown>) => {
        (window as any).__responseCompletion = await completeResponseActivity(activity.id, state.props.playRunId, options);
    };
    const move = (id: unknown) => { (window as any).__responseDestination = { id }; };
    return <SourcePageProjectionProvider value={{ component: 'learning/node-play', props: { localization: state.localization } }}>
        <main data-testid="response-evidence" className="mx-auto max-w-3xl p-4">
            {state.activity.type === 'question' ? <Question activity={state.activity} answer={state.answer}
                canRecall={true} isCompleted={state.props.progress.activities[state.activity.id]?.status === 'completed'}
                onAnswer={(_, answer) => setState((current: any) => ({ ...current, answer }))}
                onRecallChange={(_, queued) => setState((current: any) => ({ ...current, queued }))}
                onComplete={complete} onMoveToActivity={move} playRunId={state.props.playRunId}
                isRecall={state.kind === 'recall'} isRevisit={state.kind === 'revisit'} recallQueued={state.queued} /> :
                <Reflection activity={state.activity} onComplete={complete} onMoveToActivity={move}
                    playRunId={state.props.playRunId} transition={state.activity.transitions[0] ?? null} />}
        </main>
    </SourcePageProjectionProvider>;
}
createRoot(document.getElementById('root')!).render(<Evidence />);
