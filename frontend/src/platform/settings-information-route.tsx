import { useEffect, useState } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import SettingsAbout from '@/pages/settings/about';
import SettingsDataProtection from '@/pages/settings/data-protection';
import SettingsImprint from '@/pages/settings/imprint';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

type SettingsInformationSlug = 'about' | 'data-protection' | 'imprint';

type SettingsInformationPageProps = WelcomePageProps & {
    canEditPlatformInfo: false;
    platformInfoContent: {
        markdown: string;
    };
};

type SettingsInformationLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | {
          kind: 'ready';
          appearance: 'dark' | 'light';
          props: SettingsInformationPageProps;
      };

const sourcePages: Record<SettingsInformationSlug, typeof SettingsAbout> = {
    about: SettingsAbout,
    'data-protection': SettingsDataProtection,
    imprint: SettingsImprint,
};

/**
 * The copied Settings information pages are deliberately read-only: their
 * pinned Laravel controllers also supplied `canEditPlatformInfo: false`.
 * This route consequently does not reach into the separate administrator
 * public-information editor contract.
 */
export function SettingsInformationRoute({
    slug,
}: {
    slug: SettingsInformationSlug;
}) {
    const [state, setState] = useState<SettingsInformationLoadState>({
        kind: 'loading',
    });

    useEffect(() => {
        let isMounted = true;

        void Promise.all([
            apiClient.GET('/me'),
            apiClient.GET('/public/welcome'),
            apiClient.GET('/public/pages/{slug}', { params: { path: { slug } } }),
        ])
            .then(([currentUser, welcome, page]) => {
                if (!isMounted) {
                    return;
                }

                if (
                    !currentUser.response.ok ||
                    !currentUser.data ||
                    !welcome.response.ok ||
                    !welcome.data ||
                    !page.response.ok ||
                    !page.data
                ) {
                    setState({ kind: 'unavailable' });

                    return;
                }

                setState({
                    kind: 'ready',
                    appearance: currentUser.data.appearance,
                    props: {
                        ...toWelcomePageProps(
                            welcome.data as WelcomeWireProjection,
                        ),
                        canEditPlatformInfo: false,
                        platformInfoContent: {
                            markdown: page.data.body,
                        },
                    },
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
    }, [slug]);

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
                        title="Settings information is unavailable."
                        errors={[
                            'The current-user or information-page projection is currently unavailable.',
                        ]}
                    />
                </div>
            </main>
        );
    }

    return <MountedSettingsInformationPage slug={slug} {...state} />;
}

function MountedSettingsInformationPage({
    appearance,
    props,
    slug,
}: Extract<SettingsInformationLoadState, { kind: 'ready' }> & {
    slug: SettingsInformationSlug;
}) {
    useAppearancePageSync(true, appearance);
    const SourcePage = sourcePages[slug];

    return (
        <SourcePageProjectionProvider
            value={{ component: `settings/${slug}`, props }}
        >
            <SourcePage />
        </SourcePageProjectionProvider>
    );
}
