<?php

namespace App\Learning\Queries;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use SplFileInfo;

class LoadReusableImageAssets
{
    /**
     * @return list<array{canDelete: bool, extension: string, label: string, source: string, uploaded: bool, url: string}>
     */
    public function handle(?string $search = null): array
    {
        $needle = Str::of($search ?? '')->trim()->lower()->toString();

        return collect([
            ...$this->publicImages(),
            ...$this->storedImages(),
        ])
            ->unique('url')
            ->filter(fn (array $asset): bool => $this->matches($asset, $needle))
            ->sortBy([
                ['uploaded', 'desc'],
                ['modifiedAt', 'desc'],
                ['url', 'asc'],
            ])
            ->map(fn (array $asset): array => [
                'canDelete' => $asset['uploaded'],
                'extension' => $asset['extension'],
                'label' => $asset['label'],
                'source' => $asset['source'],
                'uploaded' => $asset['uploaded'],
                'url' => $asset['url'],
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{extension: string, label: string, modifiedAt: int, source: string, uploaded: bool, url: string}>
     */
    private function publicImages(): array
    {
        $basePath = public_path('images');

        if (! File::isDirectory($basePath)) {
            return [];
        }

        return collect(File::allFiles($basePath))
            ->filter(fn (SplFileInfo $file): bool => $this->isAllowedExtension($file->getExtension()))
            ->map(function (SplFileInfo $file) use ($basePath): array {
                $relativePath = Str::of($file->getPathname())
                    ->after($basePath.DIRECTORY_SEPARATOR)
                    ->replace('\\', '/')
                    ->toString();
                $source = Str::of($relativePath)->before('/')->headline()->toString();

                return [
                    'extension' => strtolower($file->getExtension()),
                    'label' => $this->labelFromPath($relativePath),
                    'modifiedAt' => $file->getMTime(),
                    'source' => $source === '' ? 'Built in' : $source,
                    'uploaded' => false,
                    'url' => '/images/'.$relativePath,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{extension: string, label: string, modifiedAt: int, source: string, uploaded: bool, url: string}>
     */
    private function storedImages(): array
    {
        $disk = Storage::disk('public');
        $paths = collect(['learning', 'presentation'])
            ->flatMap(fn (string $directory): array => $disk->exists($directory) ? $disk->allFiles($directory) : [])
            ->filter(fn (string $path): bool => $this->isAllowedExtension(pathinfo($path, PATHINFO_EXTENSION)));

        return $paths
            ->map(function (string $path) use ($disk): array {
                $segments = explode('/', $path);
                $source = count($segments) > 1
                    ? Str::of($segments[0].' '.$segments[1])->headline()->toString()
                    : 'Uploaded';

                return [
                    'extension' => strtolower(pathinfo($path, PATHINFO_EXTENSION)),
                    'label' => $this->labelFromPath($path),
                    'modifiedAt' => $disk->lastModified($path),
                    'source' => $source,
                    'uploaded' => true,
                    'url' => $disk->url($path),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array{label: string, source: string, url: string}  $asset
     */
    private function matches(array $asset, string $needle): bool
    {
        if ($needle === '') {
            return true;
        }

        return Str::of($asset['label'].' '.$asset['source'].' '.$asset['url'])
            ->lower()
            ->contains($needle);
    }

    private function isAllowedExtension(string $extension): bool
    {
        return in_array(strtolower($extension), ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'], true);
    }

    private function labelFromPath(string $path): string
    {
        return Str::of(pathinfo($path, PATHINFO_FILENAME))
            ->replace(['-', '_'], ' ')
            ->squish()
            ->headline()
            ->toString();
    }
}
