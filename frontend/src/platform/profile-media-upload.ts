import { getCsrfToken } from './api/client';

const profileImageUrl = /^\/api\/v1\/profile-images\/([0-9a-f-]{36})$/i;
const stagedImageIds = new Map<string, string>();

export function profileImageIdForSourceUrl(value: string): string | null {
    const url = value.trim();

    return stagedImageIds.get(url) ?? profileImageUrl.exec(url)?.[1] ?? null;
}

export async function uploadMediaFile({ endpoint, errorMessage = 'The file could not be uploaded.', file }: { endpoint: string; errorMessage?: string; file: File }): Promise<{ url: string }> {
    if (endpoint !== '/settings/profile/image') {
        throw new Error('This media upload route is not available.');
    }
    const csrfToken = await getCsrfToken();
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/v1/account/profile/image', { body: formData, credentials: 'same-origin', headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken }, method: 'POST' });
    const payload = await response.json().catch(() => null) as { profile_image_id?: string; title?: string; url?: string } | null;
    if (!response.ok || !payload?.profile_image_id || !payload.url) {
        throw new Error(payload?.title ?? errorMessage);
    }
    stagedImageIds.set(payload.url, payload.profile_image_id);
    return { url: payload.url };
}
