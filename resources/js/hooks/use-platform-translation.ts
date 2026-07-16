import { usePage } from '@inertiajs/react';

type ReplacementValues = Record<string, number | string>;

/**
 * Reads only the platform UI catalog shared by Inertia. Learning activity
 * translations intentionally use the protected active-activity endpoint.
 */
export function usePlatformTranslation() {
    const { localization } = usePage().props;

    return (
        key: string,
        fallback: string = key,
        replacements: ReplacementValues = {},
    ): string => {
        const template = localization.translations[key] ?? fallback;

        return Object.entries(replacements).reduce(
            (translated, [name, value]) =>
                translated.replaceAll(`:${name}`, value.toString()),
            template,
        );
    };
}
