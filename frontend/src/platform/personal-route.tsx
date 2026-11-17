import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { useLocation, useNavigate } from 'react-router';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import { PersonalSettingsContent } from '@/pages/settings/personal';
import type { PersonalSection } from '@/pages/settings/personal';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

const personalSections: PersonalSection[] = [
    'appearance',
    'delete-account',
    'feedback',
    'language',
    'notifications',
    'profile',
    'security',
    'sound',
];

type PersonalPageProps = Omit<WelcomePageProps, 'auth' | 'localization'> & {
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
    availableLanguages: Array<{ code: string; name: string; nativeName: string }>;
    canManagePasskeys: true;
    canManageTwoFactor: true;
    feedbackPromptStatus: 'declined' | 'enabled' | 'snoozed';
    locale: string;
    localization: { locale: string; translations: Record<string, string> };
    mustVerifyEmail: false;
    passkeys: Array<{
        authenticator: string | null;
        created_at_diff: string;
        id: string;
        last_used_at_diff: string | null;
        name: string;
    }>;
    passwordRules: string;
    requiresConfirmation: true;
    soundPreferences: {
        ambienceVolume: number;
        effectsVolume: number;
        muted: boolean;
    };
    twoFactorEnabled: boolean;
};

type LoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; appearance: 'dark' | 'light'; props: PersonalPageProps };

export function PersonalRoute() {
    const [state, setState] = useState<LoadState>({ kind: 'loading' });
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const requestedSection = params.get('personal');
    const activeSection = personalSections.includes(requestedSection as PersonalSection)
        ? (requestedSection as PersonalSection)
        : 'profile';

    useEffect(() => {
        let isMounted = true;
        void Promise.all([
            apiClient.GET('/me'),
            apiClient.GET('/account/profile'),
            apiClient.GET('/account/security'),
            apiClient.GET('/public/welcome'),
            apiClient.GET('/learner/language-preference'),
            apiClient.GET('/learner/platform-translations'),
            apiClient.GET('/learner/sound-preferences'),
            apiClient.GET('/learner/feedback-prompt-preference'),
        ]).then(([currentUser, profile, security, welcome, language, translations, sound, feedback]) => {
            if (!isMounted) return;
            if (!currentUser.response.ok || !currentUser.data || !profile.response.ok || !profile.data || !security.response.ok || !security.data || !welcome.response.ok || !welcome.data || !language.response.ok || !language.data || !translations.response.ok || !translations.data || !sound.response.ok || !sound.data || !feedback.response.ok || !feedback.data) {
                setState({ kind: 'unavailable' });
                return;
            }
            setState({
                kind: 'ready',
                appearance: currentUser.data.appearance,
                props: {
                    ...toWelcomePageProps(welcome.data as WelcomeWireProjection),
                    auth: {
                        canViewMediaPaths: currentUser.data.can_view_media_paths,
                        user: { avatar: currentUser.data.avatar_url, email: profile.data.email, name: profile.data.name, profile_image: profile.data.profile_image_url, username: profile.data.username },
                    },
                    availableLanguages: language.data.available_languages.map((item) => ({ code: item.code, name: item.name, nativeName: item.native_name })),
                    canManagePasskeys: security.data.can_manage_passkeys,
                    canManageTwoFactor: security.data.can_manage_two_factor,
                    feedbackPromptStatus: feedback.data.status,
                    locale: language.data.locale,
                    localization: { locale: translations.data.locale, translations: translations.data.translations },
                    mustVerifyEmail: false,
                    passkeys: security.data.passkeys,
                    passwordRules: security.data.password_rules,
                    requiresConfirmation: security.data.requires_confirmation,
                    soundPreferences: { ambienceVolume: sound.data.ambience_volume, effectsVolume: sound.data.effects_volume, muted: sound.data.muted },
                    twoFactorEnabled: security.data.two_factor_enabled,
                },
            });
        }).catch(() => { if (isMounted) setState({ kind: 'unavailable' }); });
        return () => { isMounted = false; };
    }, []);

    if (state.kind === 'loading') return <main className="flex min-h-svh items-center justify-center bg-background text-foreground"><Spinner className="size-6" /></main>;
    if (state.kind === 'unavailable') return <main className="flex min-h-svh items-center justify-center bg-background p-6"><div className="w-full max-w-xl"><AlertError title="Personal settings are unavailable." errors={['The Personal settings projection is currently unavailable.']} /></div></main>;

    return <MountedPersonal activeSection={activeSection} navigate={navigate} props={state.props} appearance={state.appearance} />;
}

function MountedPersonal({ activeSection, appearance, navigate, props }: { activeSection: PersonalSection; appearance: 'dark' | 'light'; navigate: ReturnType<typeof useNavigate>; props: PersonalPageProps }) {
    useAppearancePageSync(true, appearance);
    return <SourcePageProjectionProvider value={{ component: 'settings/personal', props }}><PersonalSettingsContent {...(props as unknown as ComponentProps<typeof PersonalSettingsContent>)} activeSection={activeSection} initialSection={activeSection} onSelectSection={(section) => navigate(`/settings?panel=personal&personal=${section}`)} /></SourcePageProjectionProvider>;
}
