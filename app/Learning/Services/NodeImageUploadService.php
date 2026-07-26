<?php

namespace App\Learning\Services;

use App\Models\LearningMap;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class NodeImageUploadService
{
    public function __construct(
        private readonly ProtectedMapMedia $protectedMedia,
    ) {}

    public function upload(mixed $image, ?LearningMap $map = null): string
    {
        if (! $image instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'image' => 'Please choose an image or video file.',
            ]);
        }

        $extension = strtolower($image->getClientOriginalExtension());

        if (! in_array($extension, $this->allowedExtensions(), true)) {
            throw ValidationException::withMessages([
                'image' => 'The file must be a GIF, JPG, PNG, SVG, WEBP, MP4, OGG or WEBM file.',
            ]);
        }

        if ($map) {
            return $this->protectedMedia->store($image, $map, $this->allowedExtensions())['url'];
        }

        $path = $image->storeAs('learning/nodes', Str::uuid()->toString().'.'.$extension, 'public');
        abort_if($path === false, 500, 'The image could not be stored.');

        return Storage::url($path);
    }

    /**
     * @return array<int, string>
     */
    private function allowedExtensions(): array
    {
        return ['gif', 'jpeg', 'jpg', 'm4v', 'mov', 'mp4', 'ogg', 'ogv', 'png', 'svg', 'webm', 'webp'];
    }
}
