import { useEffect, useState } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import Appearance from '@/pages/settings/appearance';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

type AppearanceLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; appearance: 'dark' | 'light'; props: WelcomePageProps };

/**
 * The copied direct Appearance document needs only the Rust-owned current
 * appearance and the public Settings palette. It intentionally does not admit
 * the source Settings index or any of its uncontracted panel data.
 */
export function AppearanceRoute() {
    const [state, setState] = useState<AppearanceLoadState>({ kind: 'loading' });

    useEffect(() => {
        let isMounted = true;

        void Promise.all([apiClient.GET('/me'), apiClient.GET('/public/welcome')])
            .then(([currentUser, welcome]) => {
                if (!isMounted) {
                    return;
                }

                if (
                    !currentUser.response.ok ||
                    !currentUser.data ||
                    !welcome.response.ok ||
                    !welcome.data
                ) {
                    setState({ kind: 'unavailable' });

                    return;
                }

                setState({
                    kind: 'ready',
                    appearance: currentUser.data.appearance,
                    props: toWelcomePageProps(
                        welcome.data as WelcomeWireProjection,
                    ),
                });
            })
            .catch(() => {
                if (isMounted) {
                    setState({ kind: 'unavailable' });
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (state.kind === 'loading') {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
                <Spinner className="size-6" />
            </main>
        );
    }

    if (state.kind === 'unavailable') {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background p-6">
                <div className="w-full max-w-xl">
                    <AlertError
                        title="Appearance settings are unavailable."
                        errors={[
                            'The current-user or Settings presentation projection is currently unavailable.',
                        ]}
                    />
                </div>
            </main>
        );
    }

    return <MountedAppearancePage {...state} />;
}

function MountedAppearancePage({
    appearance,
    props,
}: Extract<AppearanceLoadState, { kind: 'ready' }>) {
    useAppearancePageSync(true, appearance);

    return (
        <SourcePageProjectionProvider
            value={{ component: 'settings/appearance', props }}
        >
            <Appearance />
        </SourcePageProjectionProvider>
    );
}
