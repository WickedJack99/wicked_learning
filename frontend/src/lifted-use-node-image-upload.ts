import { useCallback, useState } from 'react';

import { getCsrfToken } from './api/client';

export function useNodeImageUpload(mapId?: string | null) {
    const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);
    const [imageUploadErrors, setImageUploadErrors] = useState<Record<string, string>>({});
    const resetImageUploadErrors = useCallback(() => setImageUploadErrors({}), []);

    const uploadNodeImage = useCallback(async (key: string, file: File, onUploaded: (url: string) => void) => {
        if (!mapId) {
            setImageUploadErrors((current) => ({ ...current, [key]: 'The image could not be uploaded.' }));

            return;
        }

        setUploadingImageKey(key);
        setImageUploadErrors((current) => ({ ...current, [key]: '' }));

        try {
            const token = await getCsrfToken();
            const body = new FormData();
            body.append('file', file);
            const response = await fetch(`/api/v1/admin/world-builder/maps/${mapId}/visual-media`, { body, credentials: 'same-origin', headers: { 'X-CSRF-Token': token }, method: 'POST' });
            const payload = await response.json() as { url?: string };

            if (!response.ok || !payload.url) {
throw new Error('The image could not be uploaded.');
}

            onUploaded(payload.url);
        } catch (error) {
            setImageUploadErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : 'The image could not be uploaded.' }));
        } finally {
            setUploadingImageKey(null);
        }
    }, [mapId]);

    return { imageUploadErrors, resetImageUploadErrors, uploadNodeImage, uploadingImageKey };
}
