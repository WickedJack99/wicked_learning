import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWorldPageProps, type WorldPageProps } from './world-projection';

const worldModules = import.meta.glob<{
    default: ComponentType<Record<string, unknown>>;
}>('../../canonical-source/resources/js/pages/world.tsx');
const loadWorld = worldModules['../../canonical-source/resources/js/pages/world.tsx'];

if (!loadWorld) {
    throw new Error('The copied World source module is unavailable.');
}

const SourceWorld = lazy(loadWorld);

type WorldLoadState =
    | { kind: 'loading' }
    | { kind: 'empty'; appearance: 'dark' | 'light'; props: WorldPageProps }
    | { kind: 'ready'; props: WorldPageProps }
    | { kind: 'unavailable'; message: string };

export function WorldRoute() {
    const [state, setState] = useState<WorldLoadState>({ kind: 'loading' });
    const [operationMessage, setOperationMessage] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        void Promise.all([
            apiClient.GET('/learner/world'),
            apiClient.GET('/learner/groups', { params: { query: { page: 1, per_page: 1 } } }),
            apiClient.GET('/me'),
            apiClient.GET('/learner/platform-translations'),
            apiClient.GET('/learner/sound-preferences'),
        ]).then(([world, groups, currentUser, translations, soundPreferences]) => {
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
                !soundPreferences.data
            ) {
                setState({
                    kind: 'unavailable',
                    message: unavailableMessageFor(world.response.status),
                });
                return;
            }

            if (world.response.status === 404) {
                setState({
                    kind: 'empty',
                    appearance: currentUser.data.appearance,
                    props: emptyWorldProps(
                        currentUser.data.appearance,
                        translations.data,
                        soundPreferences.data,
                    ),
                });
                return;
            }

            if (!world.response.ok || !world.data) {
                setState({
                    kind: 'unavailable',
                    message: unavailableMessageFor(world.response.status),
                });
                return;
            }

            setState({
                kind: 'ready',
                props: toWorldPageProps(
                    world.data,
                    groups.data,
                    currentUser.data,
                    translations.data,
                    soundPreferences.data,
                ),
            });
        }).catch(() => {
            if (isMounted) {
                setState({
                    kind: 'unavailable',
                    message: 'The learner World projection is currently unavailable.',
                });
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const showUnavailableOperation = (event: Event) => {
            const message = (event as CustomEvent<{ message?: string }>).detail?.message;
            setOperationMessage(message ?? 'This World action is currently unavailable.');
        };
        window.addEventListener('world:source-operation-unavailable', showUnavailableOperation);

        return () => window.removeEventListener('world:source-operation-unavailable', showUnavailableOperation);
    }, []);

    if (state.kind === 'loading') {
        return <LoadingWorld />;
    }

    if (state.kind === 'unavailable') {
        return <WorldUnavailable message={state.message} />;
    }

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
    props: WorldPageProps;
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
                <SourceWorld {...(props as Record<string, unknown>)} />
            </Suspense>
        </SourcePageProjectionProvider>
    );
}

function emptyWorldProps(
    appearance: 'dark' | 'light',
    translations: { locale: string; translations: Record<string, string> },
    soundPreferences: {
        ambience_volume: number;
        effects_volume: number;
        muted: boolean;
    },
): WorldPageProps {
    return {
        appearance,
        auth: { user: { subjectId: '' } },
        bookmarkedNodeIds: [],
        groups: [],
        groupsPagination: { currentPage: 1, lastPage: 1, perPage: 1, total: 0 },
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
