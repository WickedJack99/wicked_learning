import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import Security from '@/pages/settings/security';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

type SecurityPageProps = Omit<WelcomePageProps, 'localization'> & {
    canManagePasskeys: true;
    canManageTwoFactor: true;
    localization: {
        locale: string;
        translations: Record<string, string>;
    };
    passkeys: Array<{
        authenticator: string | null;
        created_at_diff: string;
        id: string;
        last_used_at_diff: string | null;
        name: string;
    }>;
    passwordRules: string;
    requiresConfirmation: true;
    twoFactorEnabled: boolean;
};

type SecurityLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; appearance: 'dark' | 'light'; props: SecurityPageProps };

/** Mounts the copied direct Security document only after its complete source
 * prop aggregate is available from typed Rust reads. */
export function SecurityRoute() {
    const [state, setState] = useState<SecurityLoadState>({ kind: 'loading' });

    useEffect(() => {
        let isMounted = true;

        void Promise.all([
            apiClient.GET('/me'),
            apiClient.GET('/account/security'),
            apiClient.GET('/public/welcome'),
            apiClient.GET('/learner/platform-translations'),
        ])
            .then(([currentUser, security, welcome, translations]) => {
                if (!isMounted) {
                    return;
                }
                if (
                    !currentUser.response.ok ||
                    !currentUser.data ||
                    !security.response.ok ||
                    !security.data ||
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
                        canManagePasskeys: security.data.can_manage_passkeys,
                        canManageTwoFactor: security.data.can_manage_two_factor,
                        localization: {
                            locale: translations.data.locale,
                            translations: translations.data.translations,
                        },
                        passkeys: security.data.passkeys,
                        passwordRules: security.data.password_rules,
                        requiresConfirmation: security.data.requires_confirmation,
                        twoFactorEnabled: security.data.two_factor_enabled,
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
                        title="Security settings are unavailable."
                        errors={[
                            'The Security settings projection is currently unavailable.',
                        ]}
                    />
                </div>
            </main>
        );
    }

    return <MountedSecurityPage {...state} />;
}

function MountedSecurityPage({
    appearance,
    props,
}: Extract<SecurityLoadState, { kind: 'ready' }>) {
    useAppearancePageSync(true, appearance);

    return (
        <SourcePageProjectionProvider
            value={{ component: 'settings/security', props }}
        >
            {/* The copied type declares Laravel's numeric passkey primary key.
                Rust intentionally retains its opaque UUID at runtime; the
                matching narrow route facade carries it unchanged to DELETE. */}
            <Security {...(props as unknown as ComponentProps<typeof Security>)} />
        </SourcePageProjectionProvider>
    );
}
