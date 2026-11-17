export type ContentApiMethod = 'GET' | 'POST';

export type ContentApiConsoleResponse = {
    body: unknown;
    durationMs: number;
    ok: boolean;
    status: number;
};

export async function executeContentApiRequest(
    method: ContentApiMethod,
    path: string,
    body: unknown,
): Promise<ContentApiConsoleResponse> {
    if (!path.startsWith('/api/content/v1/')) {
        throw new Error('Only documented Content API v1 paths are allowed.');
    }

    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const startedAt = performance.now();
    const response = await fetch(path, {
        body: method === 'GET' ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(method === 'GET'
                ? {}
                : {
                      'Content-Type': 'application/json',
                      'X-CSRF-TOKEN': csrfToken,
                  }),
            'X-Requested-With': 'XMLHttpRequest',
        },
        method,
    });
    const text = await response.text();

    return {
        body: parseResponseBody(text),
        durationMs: Math.round(performance.now() - startedAt),
        ok: response.ok,
        status: response.status,
    };
}

function parseResponseBody(text: string): unknown {
    if (text.trim() === '') {
        return null;
    }

    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}
