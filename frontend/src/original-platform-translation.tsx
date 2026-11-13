import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { apiClient } from './api/client';

type ReplacementValues = Record<string, number | string>;
type Translate = (
    key: string,
    fallback?: string,
    replacements?: ReplacementValues,
) => string;

export const platformTranslationChangedEvent =
    'wicked-learning:platform-translation-changed';

const PlatformTranslationContext = createContext<Translate>((key, fallback = key) =>
    fallback,
);

/**
 * Source-adapted from `hooks/use-platform-translation.ts`. The catalog is
 * intentionally limited to fixed platform copy; activity copy has its own
 * active-run request and is never preloaded here.
 */
export function OriginalPlatformTranslationProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [translations, setTranslations] = useState<Record<string, string>>(
        {},
    );
    const [refreshVersion, setRefreshVersion] = useState(0);

    useEffect(() => {
        const refresh = () => setRefreshVersion((version) => version + 1);

        window.addEventListener(platformTranslationChangedEvent, refresh);

        return () =>
            window.removeEventListener(platformTranslationChangedEvent, refresh);
    }, []);

    useEffect(() => {
        let isCurrent = true;

        void apiClient
            .GET('/learner/platform-translations')
            .then(({ data, response }) => {
                if (!isCurrent) {
                    return;
                }

                setTranslations(response.ok && data ? data.translations : {});
            })
            .catch(() => {
                if (isCurrent) {
                    setTranslations({});
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [refreshVersion]);

    const translate = useCallback<Translate>(
        (key, fallback = key, replacements = {}) => {
            const template = translations[key] ?? fallback;

            return Object.entries(replacements).reduce(
                (translated, [name, value]) =>
                    translated.replaceAll(`:${name}`, value.toString()),
                template,
            );
        },
        [translations],
    );
    const contextValue = useMemo(() => translate, [translate]);

    return (
        <PlatformTranslationContext.Provider value={contextValue}>
            {children}
        </PlatformTranslationContext.Provider>
    );
}

export function usePlatformTranslation(): Translate {
    return useContext(PlatformTranslationContext);
}
