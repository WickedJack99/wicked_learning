import { apiClient } from './api/client';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

export type PersonalPageProps = Omit<WelcomePageProps, 'auth' | 'localization'> & {
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

export type PersonalSettingsProjection = {
    appearance: 'dark' | 'light';
    props: PersonalPageProps;
};

/**
 * One explicit document made from the already-audited owner-scoped reads.
 * Both direct Personal URLs and the copied root Settings workspace use this
 * exact projection so their visible source props cannot drift apart.
 */
export async function loadPersonalSettingsProjection(): Promise<PersonalSettingsProjection | null> {
    const [currentUser, profile, security, welcome, language, translations, sound, feedback] = await Promise.all([
        apiClient.GET('/me'),
        apiClient.GET('/account/profile'),
        apiClient.GET('/account/security'),
        apiClient.GET('/public/welcome'),
        apiClient.GET('/learner/language-preference'),
        apiClient.GET('/learner/platform-translations'),
        apiClient.GET('/learner/sound-preferences'),
        apiClient.GET('/learner/feedback-prompt-preference'),
    ]);

    if (
        !currentUser.response.ok || !currentUser.data ||
        !profile.response.ok || !profile.data ||
        !security.response.ok || !security.data ||
        !welcome.response.ok || !welcome.data ||
        !language.response.ok || !language.data ||
        !translations.response.ok || !translations.data ||
        !sound.response.ok || !sound.data ||
        !feedback.response.ok || !feedback.data
    ) {
        return null;
    }

    return {
        appearance: currentUser.data.appearance,
        props: {
            ...toWelcomePageProps(welcome.data as WelcomeWireProjection),
            auth: {
                canViewMediaPaths: currentUser.data.can_view_media_paths,
                user: {
                    avatar: currentUser.data.avatar_url,
                    email: profile.data.email,
                    name: profile.data.name,
                    profile_image: profile.data.profile_image_url,
                    username: profile.data.username,
                },
            },
            availableLanguages: language.data.available_languages.map((item) => ({
                code: item.code,
                name: item.name,
                nativeName: item.native_name,
            })),
            canManagePasskeys: security.data.can_manage_passkeys,
            canManageTwoFactor: security.data.can_manage_two_factor,
            feedbackPromptStatus: feedback.data.status,
            locale: language.data.locale,
            localization: {
                locale: translations.data.locale,
                translations: translations.data.translations,
            },
            mustVerifyEmail: false,
            passkeys: security.data.passkeys,
            passwordRules: security.data.password_rules,
            requiresConfirmation: security.data.requires_confirmation,
            soundPreferences: {
                ambienceVolume: sound.data.ambience_volume,
                effectsVolume: sound.data.effects_volume,
                muted: sound.data.muted,
            },
            twoFactorEnabled: security.data.two_factor_enabled,
        },
    };
}
