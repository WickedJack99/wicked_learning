import { useEffect, useState } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import About from '@/pages/info/about';
import DataProtection from '@/pages/info/data-protection';
import Imprint from '@/pages/info/imprint';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toPublicInformationPageProps } from './public-information-projection';
import type {
    PublicInformationPageProps,
    PublicInformationWirePage,
} from './public-information-projection';
import type { WelcomeWireProjection } from './welcome-projection';

type SupportedPublicInformationSlug =
    | 'about'
    | 'data-protection'
    | 'imprint';

type PublicInformationLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable'; message: string }
    | { kind: 'ready'; props: PublicInformationPageProps };

const sourcePages: Record<SupportedPublicInformationSlug, typeof About> = {
    about: About,
    'data-protection': DataProtection,
    imprint: Imprint,
};

export function PublicInformationRoute({
    slug,
}: {
    slug: SupportedPublicInformationSlug;
}) {
    const [state, setState] = useState<PublicInformationLoadState>({
        kind: 'loading',
    });

    useEffect(() => {
        let isMounted = true;

        void Promise.all([
            apiClient.GET('/public/welcome'),
            apiClient.GET('/public/pages/{slug}', { params: { path: { slug } } }),
        ])
            .then(([welcomeResponse, pageResponse]) => {
                if (!isMounted) {
                    return;
                }

                if (
                    !welcomeResponse.response.ok ||
                    !welcomeResponse.data ||
                    !pageResponse.response.ok ||
                    !pageResponse.data
                ) {
                    setState({
                        kind: 'unavailable',
                        message:
                            'The public information projection is currently unavailable.',
                    });

                    return;
                }

                setState({
                    kind: 'ready',
                    props: toPublicInformationPageProps(
                        welcomeResponse.data as WelcomeWireProjection,
                        pageResponse.data as PublicInformationWirePage,
                    ),
                });
            })
            .catch(() => {
                if (isMounted) {
                    setState({
                        kind: 'unavailable',
                        message:
                            'The public information projection is currently unavailable.',
                    });
                }
            });

        return () => {
            isMounted = false;
        };
    }, [slug]);

    if (state.kind === 'loading') {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
                <Spinner className="size-6" />
            </main>
        );
    }

    if (state.kind === 'unavailable') {
        return <PublicInformationUnavailable message={state.message} />;
    }

    const SourcePage = sourcePages[slug];

    return (
        <SourcePageProjectionProvider
            value={{ component: `Info/${slug}`, props: state.props }}
        >
            <SourcePage />
        </SourcePageProjectionProvider>
    );
}

function PublicInformationUnavailable({ message }: { message: string }) {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-xl">
                <AlertError title="Information page is unavailable." errors={[message]} />
            </div>
        </main>
    );
}
