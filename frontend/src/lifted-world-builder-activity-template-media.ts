export type TemplateMediaReplacements = Record<string, string>;

const imageMediaPattern = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

export function isImageMediaReference(value: string): boolean {
    return imageMediaPattern.test(value);
}

/**
 * Replace exact media references while preserving the shape of the activity
 * configuration. Template snapshots contain nested arrays and records, so a
 * shallow replacement would leave some type-specific media behind.
 */
export function replaceTemplateMediaReferences(
    value: unknown,
    replacements: TemplateMediaReplacements,
): unknown {
    if (typeof value === 'string') {
        return replacements[value] ?? value;
    }

    if (Array.isArray(value)) {
        return value.map((item) =>
            replaceTemplateMediaReferences(item, replacements),
        );
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                replaceTemplateMediaReferences(item, replacements),
            ]),
        );
    }

    return value;
}
