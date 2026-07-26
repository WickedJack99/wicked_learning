<?php

namespace App\Learning\Services;

use App\Models\LearningMap;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProtectedMapMedia
{
    /**
     * @return array{path: string, url: string}
     */
    public function store(UploadedFile $file, LearningMap $map, array $allowedExtensions): array
    {
        $extension = strtolower($file->getClientOriginalExtension());

        if (! in_array($extension, $allowedExtensions, true)) {
            throw ValidationException::withMessages([
                'image' => 'The file type is not allowed.',
            ]);
        }

        $fileName = Str::uuid()->toString().'.'.$extension;
        $directory = "learning/protected/maps/{$map->id}";
        $path = $file->storeAs($directory, $fileName, 'local');

        abort_if($path === false, 500, 'The file could not be stored.');

        return [
            'path' => $path,
            'url' => route('protected-map-media.show', [
                'map' => $map,
                'path' => $fileName,
            ], false),
        ];
    }

    public function pathFor(LearningMap $map, string $path): string
    {
        abort_if(str_contains($path, '..') || str_starts_with($path, '/'), 404);

        return "learning/protected/maps/{$map->id}/{$path}";
    }

    public function exists(LearningMap $map, string $path): bool
    {
        return Storage::disk('local')->exists($this->pathFor($map, $path));
    }
}
