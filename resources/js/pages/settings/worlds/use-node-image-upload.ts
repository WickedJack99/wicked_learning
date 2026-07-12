import { useCallback, useState } from 'react';

export function useNodeImageUpload() {
    const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
        null,
    );
    const [imageUploadErrors, setImageUploadErrors] = useState<
        Record<string, string>
    >({});

    const resetImageUploadErrors = useCallback(
        () => setImageUploadErrors({}),
        [],
    );

    const uploadNodeImage = useCallback(
        async (key: string, file: File, onUploaded: (url: string) => void) => {
            const formData = new FormData();
            const csrfToken = document
                .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                ?.getAttribute('content');

            formData.append('image', file);
            setUploadingImageKey(key);
            setImageUploadErrors((current) => ({ ...current, [key]: '' }));

            try {
                const response = await fetch('/settings/worlds/node-images', {
                    body: formData,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    },
                    method: 'POST',
                });
                const payload = (await response.json()) as {
                    errors?: Record<string, string[]>;
                    message?: string;
                    url?: string;
                };

                if (!response.ok || !payload.url) {
                    setImageUploadErrors((current) => ({
                        ...current,
                        [key]:
                            payload.errors?.image?.[0] ??
                            payload.message ??
                            'The image could not be uploaded.',
                    }));

                    return;
                }

                onUploaded(payload.url);
            } catch {
                setImageUploadErrors((current) => ({
                    ...current,
                    [key]: 'The image could not be uploaded.',
                }));
            } finally {
                setUploadingImageKey(null);
            }
        },
        [],
    );

    return {
        imageUploadErrors,
        resetImageUploadErrors,
        uploadNodeImage,
        uploadingImageKey,
    };
}
