import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { Navigate } from 'react-router';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { initializeTheme } from '@/hooks/use-appearance';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { SourcePageProjectionProvider } from './page-props';
import { toWorldPageProps, type WorldPageProps } from './world-projection';
import { toSourceGroupPage } from './world-groups';
import { loadCompanion } from './companion-api';
import { toLearnerShellProps, toSourceMenuTheme, type LearnerShellProps } from './learner-shell-projection';
import { JsonRequestError } from './json-request-error';
import { searchUnavailableMessage } from './world-search-projection';
import { bookmarkUnavailableMessage } from './world-bookmarks';

const worldModules = import.meta.glob<{
    default: ComponentType<Record<string, unknown>>;
}>('../../canonical-source/resources/js/pages/world.tsx');
const loadWorld = worldModules['../../canonical-source/resources/js/pages/world.tsx'];

if (!loadWorld) {
    throw new Error('The copied World source module is unavailable.');
}

const SourceWorld = lazy(loadWorld);
const layoutModules = import.meta.glob<{ default: ComponentType<{ children: React.ReactNode }> }>(
    '../../canonical-source/resources/js/layouts/app-layout.tsx',
);
const SourceLayout = lazy(layoutModules['../../canonical-source/resources/js/layouts/app-layout.tsx']);

type WorldLoadState =
    | { kind: 'loading' }
    | { kind: 'ready'; props: WorldPageProps & LearnerShellProps }
    | { kind: 'redirect'; to: string }
    | { kind: 'unavailable'; message: string };

export function WorldRoute() {
    const [state, setState] = useState<WorldLoadState>({ kind: 'loading' });
    const [operationMessage, setOperationMessage] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();
        const signal = controller.signal;

        void Promise.all([
            apiClient.GET('/learner/world', { signal }),
            apiClient.GET('/learner/groups', { params: { query: { page: 1, per_page: 1 } }, signal }),
            apiClient.GET('/me', { signal }),
            apiClient.GET('/learner/platform-translations', { signal }),
            apiClient.GET('/learner/sound-preferences', { signal }),
            apiClient.GET('/learner/shell', { signal }),
        ]).then(async ([world, groups, currentUser, translations, soundPreferences, shell]) => {
            if (!isMounted) {
                return;
            }

            if (
                !groups.response.ok ||
                !groups.data ||
                !currentUser.response.ok ||
                !currentUser.data ||
                !translations.response.ok ||
                !translations.data ||
                !soundPreferences.response.ok ||
                !soundPreferences.data ||
                !shell.response.ok || !shell.data
            ) {
                const failedDependency = [groups, currentUser, translations, soundPreferences, shell]
                    .find((result) => !result.response.ok || !result.data);
                setState({
                    kind: 'unavailable',
                    message: unavailableMessageFor(failedDependency?.response.status ?? 503),
                });
                return;
            }

            const emptyWorld = world.response.status === 404 && world.error?.code === 'not_found';
            if (!emptyWorld && (!world.response.ok || !world.data)) {
                setState({
                    kind: 'unavailable',
                    message: unavailableMessageFor(world.response.status),
                });
                return;
            }

            const maps = world.data?.graph.maps ?? [];
            const url = new URL(window.location.href);
            const requested = url.searchParams.get('map');
            const requestedMap = maps.find((map) => map.slug === requested || map.id === requested);
            const preferred = maps.find((map) => map.id === shell.data.menu_theme?.map_id);
            // Mirrors source syncMapLocation before claiming a feedback prompt.
            // Explicit unknown references retain the source first-map fallback.
            if (!url.searchParams.has('map') && preferred && preferred.id !== maps[0]?.id) {
                url.searchParams.set('map', preferred.slug);
                setState({ kind: 'redirect', to: `${url.pathname}${url.search}${url.hash}` });
                return;
            }
            const selected = requestedMap ?? maps[0];
            const companion = world.data
                ? await loadCompanion({ surface: 'world', map_slug: selected?.slug }, signal)
                : null;
            const worldProps = world.data ? toWorldPageProps(
                world.data, groups.data, currentUser.data, translations.data, soundPreferences.data,
            ) : emptyWorldProps(currentUser.data, groups.data, translations.data, soundPreferences.data);
            // Validate all required source props before consuming a session invitation.
            const shellProps = toLearnerShellProps(shell.data, currentUser.data, companion, false);
            if (!isMounted) return;
            const headers = { 'X-CSRF-Token': await getCsrfToken() };
            if (!isMounted) return;
            const remember = requestedMap ?? (!url.searchParams.has('map') ? selected : undefined);
            if (remember) {
                const saved = await apiClient.POST('/learner/map-location', {
                    params: { header: headers }, body: { map: remember.id }, signal,
                });
                if (!saved.response.ok || !saved.data) throw new JsonRequestError('The current map could not be remembered.', saved.response.status);
                shellProps.menuTheme = toSourceMenuTheme(saved.data);
            }
            if (!isMounted) return;
            const invitation = await apiClient.POST('/learner/feedback-prompt/claim', {
                params: { header: headers }, body: { surface: 'world' }, signal,
            });
            if (!invitation.response.ok || !invitation.data) throw new JsonRequestError('The learner invitation could not be loaded.', invitation.response.status);
            if (!isMounted) return;
            initializeWorldAppearance(currentUser.data.appearance);
            setState({
                kind: 'ready',
                props: { ...worldProps, ...shellProps, feedbackPrompt: invitation.data.show },
            });
        }).catch((error: unknown) => {
            if (isMounted) {
                setState({
                    kind: 'unavailable',
                    message: error instanceof JsonRequestError ? unavailableMessageFor(error.status) : 'The learner World projection is currently unavailable.',
                });
            }
        });

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

    useEffect(() => {
        const showUnavailableOperation = (event: Event) => {
            const message = (event as CustomEvent<{ message?: string }>).detail?.message;
            setOperationMessage(message ?? 'This World action is currently unavailable.');
        };
        const clearSearchUnavailable = () => setOperationMessage((message) =>
            message === searchUnavailableMessage ? null : message,
        );
        const clearBookmarkUnavailable = () => setOperationMessage((message) =>
            message === bookmarkUnavailableMessage ? null : message,
        );
        window.addEventListener('world:bookmark-available', clearBookmarkUnavailable);
        window.addEventListener('world:source-operation-unavailable', showUnavailableOperation);
        window.addEventListener('world:search-available', clearSearchUnavailable);

        return () => {
            window.removeEventListener('world:bookmark-available', clearBookmarkUnavailable);
            window.removeEventListener('world:source-operation-unavailable', showUnavailableOperation);
            window.removeEventListener('world:search-available', clearSearchUnavailable);
        };
    }, []);

    if (state.kind === 'loading') {
        return <LoadingWorld />;
    }

    if (state.kind === 'unavailable') {
        return <WorldUnavailable message={state.message} />;
    }

    if (state.kind === 'redirect') return <Navigate to={state.to} replace />;

    return (
        <MountedWorld
            operationMessage={operationMessage}
            props={state.props}
        />
    );
}

function MountedWorld({
    operationMessage,
    props,
}: {
    operationMessage: string | null;
    props: WorldPageProps & LearnerShellProps;
}) {
    return (
        <SourcePageProjectionProvider
            value={{ component: 'world', props }}
        >
            {operationMessage ? (
                <div
                    aria-live="polite"
                    className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg dark:border-amber-200/30 dark:bg-amber-950 dark:text-amber-50"
                    role="alert"
                >
                    {operationMessage}
                </div>
            ) : null}
            <Suspense fallback={<LoadingWorld />}>
                <SourceLayout><SourceWorld {...(props as Record<string, unknown>)} /></SourceLayout>
            </Suspense>
        </SourcePageProjectionProvider>
    );
}

function emptyWorldProps(
    currentUser: components['schemas']['CurrentUser'],
    groups: components['schemas']['LearnerGroupPage'],
    translations: { locale: string; translations: Record<string, string> },
    soundPreferences: {
        ambience_volume: number;
        effects_volume: number;
        muted: boolean;
    },
): WorldPageProps {
    const sourceGroups = toSourceGroupPage(groups);
    return {
        appearance: currentUser.appearance,
        auth: { user: { subjectId: currentUser.subject_id } },
        bookmarkedNodeIds: [],
        groups: sourceGroups.groups,
        groupsPagination: sourceGroups.pagination,
        localization: translations,
        progress: { activities: {} },
        soundPreferences: {
            ambienceVolume: soundPreferences.ambience_volume,
            effectsVolume: soundPreferences.effects_volume,
            muted: soundPreferences.muted,
        },
        world: null,
    };
}

function initializeWorldAppearance(appearance: components['schemas']['CurrentUser']['appearance']) {
    // Replaces the authenticated Blade bootstrap, using the exact copied
    // theme initializer. Server preference wins over anonymous browser state.
    window.__INITIAL_AUTHENTICATED__ = true;
    window.__INITIAL_APPEARANCE__ = appearance;
    initializeTheme();
}

function unavailableMessageFor(status: number): string {
    if (status === 401) {
        return 'Sign in is required before the learner World can be opened.';
    }
    if (status === 403) {
        return 'The learner World is not available for this account.';
    }

    return 'The learner World projection is currently unavailable.';
}

function LoadingWorld() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
            <Spinner className="size-6" />
        </main>
    );
}

function WorldUnavailable({ message }: { message: string }) {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-xl">
                <AlertError title="World is unavailable." errors={[message]} />
            </div>
        </main>
    );
}
