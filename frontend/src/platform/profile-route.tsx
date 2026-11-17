import { useEffect, useState } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import Profile from '@/pages/settings/profile';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

type ProfilePageProps = Omit<WelcomePageProps, 'auth' | 'localization'> & {
    auth: {
        canViewMediaPaths: boolean;
        user: {
            avatar: string | null;
            email: string;
            name: string;
            profile_image: string | null;
            username: string | null;
        };
    };
    localization: {
        locale: string;
        translations: Record<string, string>;
    };
};

type ProfileLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; appearance: 'dark' | 'light'; props: ProfilePageProps };

/**
 * The copied direct Profile document needs only its own account fields, the
 * safe current-user media-path flag/appearance, Settings presentation, and
 * platform translations. It deliberately does not admit the incomplete
 * Personal or root Settings documents.
 */
export function ProfileRoute() {
    const [state, setState] = useState<ProfileLoadState>({ kind: 'loading' });

    useEffect(() => {
        let isMounted = true;

        void Promise.all([
            apiClient.GET('/me'),
            apiClient.GET('/account/profile'),
            apiClient.GET('/public/welcome'),
            apiClient.GET('/learner/platform-translations'),
        ])
            .then(([currentUser, profile, welcome, translations]) => {
                if (!isMounted) {
                    return;
                }

                if (
                    !currentUser.response.ok ||
                    !currentUser.data ||
                    !profile.response.ok ||
                    !profile.data ||
                    !welcome.response.ok ||
                    !welcome.data ||
                    !translations.response.ok ||
                    !translations.data
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
                        auth: {
                            canViewMediaPaths:
                                currentUser.data.can_view_media_paths,
                            user: {
                                avatar: currentUser.data.avatar_url,
                                email: profile.data.email,
                                name: profile.data.name,
                                profile_image: profile.data.profile_image_url,
                                username: profile.data.username,
                            },
                        },
                        localization: {
                            locale: translations.data.locale,
                            translations: translations.data.translations,
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
                        title="Profile settings are unavailable."
                        errors={[
                            'The current profile or Settings presentation projection is currently unavailable.',
                        ]}
                    />
                </div>
            </main>
        );
    }

    return <MountedProfilePage {...state} />;
}

function MountedProfilePage({
    appearance,
    props,
}: Extract<ProfileLoadState, { kind: 'ready' }>) {
    useAppearancePageSync(true, appearance);

    return (
        <SourcePageProjectionProvider
            value={{ component: 'settings/profile', props }}
        >
            <Profile mustVerifyEmail={false} />
        </SourcePageProjectionProvider>
    );
}
