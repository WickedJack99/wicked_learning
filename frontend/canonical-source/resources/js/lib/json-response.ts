type JsonErrorPayload = {
    errors?: Record<string, string[]>;
    message?: string;
};

function responseErrorMessage(status: number, fallback: string): string {
    if (status === 401 || status === 419) {
        return 'Your session expired. Refresh the page and try again.';
    }

    if (status === 403) {
        return 'You do not have permission to use this asset action.';
    }

    if (status === 404) {
        return 'The asset action is unavailable. Refresh the page and try again.';
    }

    return fallback;
}

export async function readJsonResponse<T extends JsonErrorPayload>(
    response: Response,
    fallbackMessage: string,
): Promise<T> {
    const body = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    let payload: T | null = null;

    if (body && contentType.includes('json')) {
        try {
            payload = JSON.parse(body) as T;
        } catch {
            payload = null;
        }
    }

    if (!response.ok) {
        const validationMessage = payload?.errors
            ? Object.values(payload.errors).flat()[0]
            : undefined;

        throw new Error(
            payload?.message ??
                validationMessage ??
                responseErrorMessage(response.status, fallbackMessage),
        );
    }

    if (!payload) {
        throw new Error(fallbackMessage);
    }

    return payload;
}
