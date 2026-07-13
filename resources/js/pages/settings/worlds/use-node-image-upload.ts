import { useCallback, useState } from 'react';
import { uploadMediaFile } from '@/lib/media-upload';

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
            setUploadingImageKey(key);
            setImageUploadErrors((current) => ({ ...current, [key]: '' }));

            try {
                const payload = await uploadMediaFile({
                    endpoint: '/settings/worlds/node-images',
                    errorMessage: 'The image could not be uploaded.',
                    fieldName: 'image',
                    file,
                });
                onUploaded(payload.url);
            } catch (error) {
                setImageUploadErrors((current) => ({
                    ...current,
                    [key]:
                        error instanceof Error
                            ? error.message
                            : 'The image could not be uploaded.',
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
