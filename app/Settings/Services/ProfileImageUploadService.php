<?php

namespace App\Settings\Services;

use App\Learning\Services\LearningMediaUploadService;

class ProfileImageUploadService
{
    public function __construct(private readonly LearningMediaUploadService $mediaUpload) {}

    /**
     * @return array{durationSeconds: float|null, url: string}
     */
    public function upload(mixed $file): array
    {
        return $this->mediaUpload->upload($file, 'profiles/images');
    }
}
