<?php

namespace App\Learning\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class ToolMediaUploadService
{
    public function __construct(private readonly LearningMediaUploadService $mediaUpload) {}

    /**
     * @return array{url: string, durationSeconds: float|null}
     */
    public function upload(mixed $file): array
    {
        if (! $file instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'file' => 'Please choose an image or animation file.',
            ]);
        }

        return $this->mediaUpload->upload($file, 'learning/tools');
    }
}
