import { useEffect, useState } from 'react';
import { initializeTheme } from '@/hooks/use-appearance';
import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { loadCompanion } from './companion-api';
import { JsonRequestError } from './json-request-error';
import { toLearnerShellProps } from './learner-shell-projection';
import { bindPlaybackPage } from './playback-page-api';
import { playbackIdentity } from './playback-context';
import { toPlaybackPageProps } from './playback-projection';

type Props = ReturnType<typeof toPlaybackPageProps> & ReturnType<typeof toLearnerShellProps> & {
    appearance: components['schemas']['CurrentUser']['appearance'];
    localization: components['schemas']['LearnerPlatformTranslationResponse'];
    soundPreferences: { ambienceVolume: number; effectsVolume: number; muted: boolean };
};
type State = { kind: 'loading' } | { kind: 'unavailable'; message: string } | { kind: 'ready'; props: Props };

/** A real run bootstrap for the whole copied page. An explicit source route
 * can start/resume only inside its URL node; no default route is fabricated. */
export function usePlaybackPageDocument(run: string | null, node: string, start: string | null) {
    const [state, setState] = useState<State>({ kind: 'loading' });
    useEffect(() => {
        let alive = true; let release: (() => void) | undefined;
        const controller = new AbortController(); const signal = controller.signal;
        let companionController: AbortController | undefined;
        setState({ kind: 'loading' });
        void (async () => {
            playbackIdentity(node);
            if (start !== null) playbackIdentity(start);
            let activeRun = run;
            if (activeRun === null) {
                if (start === null) throw new JsonRequestError('The player entry is currently unavailable.', 501);
                const entered = await apiClient.POST('/learner/activity-starts/{start_id}/start', {
                    signal,
                    params: { path: { start_id: start }, query: { node_id: node }, header: { 'X-CSRF-Token': await getCsrfToken() } },
                });
                if (!entered.response.ok || !entered.data || entered.data.start_id !== start) {
                    throw new JsonRequestError('The player entry is currently unavailable.', entered.response.status);
                }
                activeRun = entered.data.play_run_id;
            }
            playbackIdentity(activeRun);
            const [playback, currentUser, shell, translations, sound] = await Promise.all([
                apiClient.GET('/learner/play-runs/{play_run_id}', { signal, params: { path: { play_run_id: activeRun } } }),
                apiClient.GET('/me', { signal }), apiClient.GET('/learner/shell', { signal }),
                apiClient.GET('/learner/platform-translations', { signal }), apiClient.GET('/learner/sound-preferences', { signal }),
            ]);
            if (!alive) return;
            if (!playback.response.ok || !playback.data || !currentUser.response.ok || !currentUser.data ||
                !shell.response.ok || !shell.data || !translations.response.ok || !translations.data || !sound.response.ok || !sound.data) {
                throw new JsonRequestError('The player is currently unavailable.', 503);
            }
            const document = playback.data;
            if (document.play_run_id !== activeRun || document.node.id !== node || (start !== null && document.start_id !== start)) {
                throw new JsonRequestError('The player context is unavailable.', 503);
            }
            const page = toPlaybackPageProps(document);
            const companionFor = async (activity: string, signal: AbortSignal) => {
                const companion = await loadCompanion({ surface: 'activity', activity_id: activity, play_run_id: activeRun }, signal);
                if (companion && (companion.context.activity?.id !== activity || companion.context.playRunId !== activeRun)) {
                    throw new JsonRequestError('The Companion does not match this player.', 503);
                }
                return companion;
            };
            const companion = await companionFor(document.activity.id, signal);
            if (!alive) return;
            const shellProps = toLearnerShellProps(shell.data, currentUser.data, companion, false);
            const invitation = await apiClient.POST('/learner/feedback-prompt/claim', {
                params: { header: { 'X-CSRF-Token': await getCsrfToken() } }, body: { surface: 'learning' }, signal,
            });
            if (!invitation.response.ok || !invitation.data) throw new JsonRequestError('The learner invitation is unavailable.', invitation.response.status);
            if (!alive) return;
            release = bindPlaybackPage(document, async (activity) => {
                companionController?.abort(); const refresh = new AbortController(); companionController = refresh;
                const companion = await companionFor(activity, refresh.signal);
                if (!alive || refresh.signal.aborted) return;
                setState((previous) => previous.kind === 'ready' ? { ...previous, props: { ...previous.props, companion } } : previous);
            });
            window.localStorage.setItem('appearance', currentUser.data.appearance);
            initializeTheme();
            setState({ kind: 'ready', props: {
                ...page, ...shellProps, feedbackPrompt: invitation.data.show,
                appearance: currentUser.data.appearance, localization: translations.data,
                soundPreferences: { ambienceVolume: sound.data.ambience_volume, effectsVolume: sound.data.effects_volume, muted: sound.data.muted },
            } });
        })().catch((error: unknown) => {
            if (alive) setState({ kind: 'unavailable', message: error instanceof Error ? error.message : 'The player is currently unavailable.' });
        });
        return () => { alive = false; controller.abort(); companionController?.abort(); release?.(); };
    }, [run, node, start]);
    return state;
}
