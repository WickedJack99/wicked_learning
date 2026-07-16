export async function postJson<T>(
    url: string,
    payload: Record<string, unknown>,
): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export async function getJson<T>(
    url: string,
    signal?: AbortSignal,
): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'GET',
        signal,
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export async function deleteJson<T>(url: string): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}

/** Sends a JSON partial update with the same CSRF protection as other learning actions. */
export async function patchJson<T>(
    url: string,
    payload: Record<string, unknown>,
): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'PATCH',
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}
