import { useEffect, useState } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import SourcePage from '@/pages/source';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toSourceCodePageProps } from './source-code-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';
import type { SourceLinksWireProjection } from './source-code-projection';

type SourceCodeLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable'; message: string }
    | { kind: 'ready'; props: WelcomePageProps };

export function SourceCodeRoute() {
    const [state, setState] = useState<SourceCodeLoadState>({
        kind: 'loading',
    });

    useEffect(() => {
        let isMounted = true;

        void Promise.all([
            apiClient.GET('/public/welcome'),
            apiClient.GET('/public/source-links'),
        ])
            .then(([welcomeResponse, sourceLinksResponse]) => {
                if (!isMounted) {
                    return;
                }

                if (
                    !welcomeResponse.response.ok ||
                    !welcomeResponse.data ||
                    !sourceLinksResponse.response.ok ||
                    !sourceLinksResponse.data
                ) {
                    setState({
                        kind: 'unavailable',
                        message:
                            'The public source-code projection is currently unavailable.',
                    });

                    return;
                }

                setState({
                    kind: 'ready',
                    props: toSourceCodePageProps(
                        welcomeResponse.data as WelcomeWireProjection,
                        sourceLinksResponse.data as SourceLinksWireProjection,
                    ),
                });
            })
            .catch(() => {
                if (isMounted) {
                    setState({
                        kind: 'unavailable',
                        message:
                            'The public source-code projection is currently unavailable.',
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
        return <SourceCodeUnavailable message={state.message} />;
    }

    return (
        <SourcePageProjectionProvider
            value={{ component: 'Source', props: state.props }}
        >
            <SourcePage />
        </SourcePageProjectionProvider>
    );
}

function SourceCodeUnavailable({ message }: { message: string }) {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-xl">
                <AlertError title="Source code is unavailable." errors={[message]} />
            </div>
        </main>
    );
}
