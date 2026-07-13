<?php

namespace App\Settings\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PresentationImageUploadService
{
    public function upload(mixed $image): string
    {
        if (! $image instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'image' => 'Please choose an image file.',
            ]);
        }

        $extension = strtolower($image->getClientOriginalExtension());

        if (! in_array($extension, $this->allowedExtensions(), true)) {
            throw ValidationException::withMessages([
                'image' => 'The image must be a GIF, JPG, PNG, SVG or WEBP file.',
            ]);
        }

        $path = $image->storeAs('presentation/backgrounds', Str::uuid()->toString().'.'.$extension, 'public');

        abort_if($path === false, 500, 'The image could not be stored.');

        return Storage::url($path);
    }

    /**
     * @return list<string>
     */
    private function allowedExtensions(): array
    {
        return ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];
    }
}
