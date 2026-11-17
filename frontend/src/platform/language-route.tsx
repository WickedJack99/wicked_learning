import { useEffect, useState } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import LanguageSettings from '@/pages/settings/language';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

type LanguagePageProps = Omit<WelcomePageProps, 'localization'> & {
    availableLanguages: Array<{
        code: string;
        name: string;
        nativeName: string;
    }>;
    locale: string;
    localization: {
        locale: string;
        translations: Record<string, string>;
    };
};

type LanguageLoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; appearance: 'dark' | 'light'; props: LanguagePageProps };

/**
 * The copied direct Language document is admitted only after every source prop
 * it consumes has a bounded Rust read: current user, presentation, enabled
 * locales/current preference, and the selected platform translation catalog.
 */
export function LanguageRoute() {
    const [state, setState] = useState<LanguageLoadState>({ kind: 'loading' });

    useEffect(() => {
        let isMounted = true;

        void Promise.all([
            apiClient.GET('/me'),
            apiClient.GET('/public/welcome'),
            apiClient.GET('/learner/language-preference'),
            apiClient.GET('/learner/platform-translations'),
        ])
            .then(([currentUser, welcome, language, translations]) => {
                if (!isMounted) {
                    return;
                }

                if (
                    !currentUser.response.ok ||
                    !currentUser.data ||
                    !welcome.response.ok ||
                    !welcome.data ||
                    !language.response.ok ||
                    !language.data ||
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
                        availableLanguages: language.data.available_languages.map(
                            (language) => ({
                                code: language.code,
                                name: language.name,
                                nativeName: language.native_name,
                            }),
                        ),
                        locale: language.data.locale,
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
                        title="Language settings are unavailable."
                        errors={[
                            'The language preference or Settings presentation projection is currently unavailable.',
                        ]}
                    />
                </div>
            </main>
        );
    }

    return <MountedLanguagePage {...state} />;
}

function MountedLanguagePage({
    appearance,
    props,
}: Extract<LanguageLoadState, { kind: 'ready' }>) {
    useAppearancePageSync(true, appearance);

    return (
        <SourcePageProjectionProvider
            value={{ component: 'settings/language', props }}
        >
            <LanguageSettings {...props} />
        </SourcePageProjectionProvider>
    );
}
