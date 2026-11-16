export function normalizeMediaUrl(url: string | null | undefined): string {
    const value = (url ?? '').trim();

    if (!value) {
        return '';
    }

    if (value.startsWith('storage/')) {
        return `/${value}`;
    }

    if (value.startsWith('/storage/') || value.startsWith('/images/')) {
        return value;
    }

    try {
        const parsed = new URL(value, window.location.origin);

        if (
            parsed.origin === window.location.origin &&
            (parsed.pathname.startsWith('/storage/') ||
                parsed.pathname.startsWith('/images/'))
        ) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
    } catch {
        return value;
    }

    return value;
}
