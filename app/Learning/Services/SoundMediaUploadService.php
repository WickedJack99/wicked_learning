<?php

namespace App\Learning\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SoundMediaUploadService
{
    /**
     * @return array{url: string}
     */
    public function upload(mixed $file): array
    {
        if (! $file instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'file' => 'Please choose a sound file.',
            ]);
        }

        $extension = strtolower($file->getClientOriginalExtension());

        if (! in_array($extension, ['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav', 'webm'], true)) {
            throw ValidationException::withMessages([
                'file' => 'The file must be AAC, FLAC, M4A, MP3, OGG, WAV or WEBM audio.',
            ]);
        }

        $path = $file->storeAs('learning/sounds', Str::uuid()->toString().'.'.$extension, 'public');
        abort_if($path === false, 500, 'The sound file could not be stored.');

        return ['url' => Storage::url($path)];
    }
}
