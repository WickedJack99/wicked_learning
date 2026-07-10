<?php

namespace App\Learning\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningMediaUploadService
{
    /**
     * @return array{durationSeconds: float|null, url: string}
     */
    public function upload(mixed $file, string $directory = 'learning/media'): array
    {
        if (! $file instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'file' => 'Please choose an image or animation file.',
            ]);
        }

        $extension = strtolower($file->getClientOriginalExtension());

        if (! in_array($extension, $this->allowedExtensions(), true)) {
            throw ValidationException::withMessages([
                'file' => 'The file must be a GIF, JPG, PNG, SVG or WEBP file.',
            ]);
        }

        $path = $file->storeAs($directory, Str::uuid()->toString().'.'.$extension, 'public');
        abort_if($path === false, 500, 'The file could not be stored.');

        return [
            'durationSeconds' => $this->durationSeconds($file, $extension),
            'url' => Storage::url($path),
        ];
    }

    /**
     * @return list<string>
     */
    private function allowedExtensions(): array
    {
        return ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];
    }

    private function durationSeconds(UploadedFile $file, string $extension): ?float
    {
        if ($extension !== 'gif') {
            return null;
        }

        $path = $file->getRealPath();
        $contents = $path ? file_get_contents($path) : false;

        if (! is_string($contents) || $contents === '') {
            return null;
        }

        preg_match_all('/\x21\xF9\x04.{1}(.{2})/s', $contents, $matches);
        $duration = 0;

        foreach ($matches[1] as $delayBytes) {
            $unpacked = unpack('vdelay', $delayBytes);
            $duration += (int) ($unpacked['delay'] ?? 0);
        }

        return $duration > 0 ? round($duration / 100, 2) : null;
    }
}
