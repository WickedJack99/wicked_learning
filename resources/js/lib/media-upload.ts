type MediaUploadOptions = {
    endpoint: string;
    errorMessage?: string;
    file: File;
    fieldName?: string;
};

type MediaUploadResponse = {
    durationSeconds?: number | null;
    url: string;
};

export async function uploadMediaFile({
    endpoint,
    errorMessage = 'The file could not be uploaded.',
    file,
    fieldName = 'file',
}: MediaUploadOptions): Promise<MediaUploadResponse> {
    const formData = new FormData();
    const csrfToken = document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content');

    formData.append(fieldName, file);

    const response = await fetch(endpoint, {
        body: formData,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
        },
        method: 'POST',
    });
    const payload = (await response.json()) as {
        durationSeconds?: number | null;
        errors?: Record<string, string[]>;
        message?: string;
        url?: string;
    };

    if (!response.ok || !payload.url) {
        throw new Error(
            payload.errors?.[fieldName]?.[0] ?? payload.message ?? errorMessage,
        );
    }

    return {
        durationSeconds: payload.durationSeconds,
        url: payload.url,
    };
}
