import { useEffect, useState } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import Welcome from '@/pages/welcome';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

type WelcomeLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable'; message: string }
    | { kind: 'ready'; props: WelcomePageProps };

export function WelcomeRoute() {
    const [state, setState] = useState<WelcomeLoadState>({ kind: 'loading' });

    useEffect(() => {
        let isMounted = true;

        void apiClient.GET('/public/welcome').then(({ data, response }) => {
            if (!isMounted) {
                return;
            }

            if (!response.ok || !data) {
                setState({
                    kind: 'unavailable',
                    message: 'The public Welcome projection is currently unavailable.',
                });

                return;
            }

            setState({
                kind: 'ready',
                props: toWelcomePageProps(data as WelcomeWireProjection),
            });
        }).catch(() => {
            if (isMounted) {
                setState({
                    kind: 'unavailable',
                    message: 'The public Welcome projection is currently unavailable.',
                });
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
        return <WelcomeUnavailable message={state.message} />;
    }

    return (
        <SourcePageProjectionProvider
            value={{ component: 'Welcome', props: state.props }}
        >
            <Welcome />
        </SourcePageProjectionProvider>
    );
}

function WelcomeUnavailable({ message }: { message: string }) {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-xl">
                <AlertError title="Welcome is unavailable." errors={[message]} />
            </div>
        </main>
    );
}
