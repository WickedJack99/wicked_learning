<?php

namespace App\Learning\Queries;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Services\ReusableMediaAssetManager;
use App\Learning\Services\ReusableMediaMetadataManager;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use SplFileInfo;

class LoadReusableImageAssets
{
    private const DEFAULT_PAGE_SIZE = 12;

    public function __construct(
        private readonly ReusableMediaAssetManager $mediaAssetManager,
        private readonly ReusableMediaMetadataManager $metadataManager,
    ) {}

    /**
     * @return list<array{canDelete: bool, canViewPath: bool, category: string|null, extension: string, hasTransparency: bool|null, isAnimated: bool|null, label: string, referenceCount: int, referenceGroups: list<array{count: int, label: string}>, source: string, tags: list<string>, uploaded: bool, url: string}>
     */
    public function handle(
        ?string $search = null,
        ?User $user = null,
        ?string $tag = null,
    ): array {
        return $this->serializeAssets($this->matchingAssets($search, $tag), $user);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function matchingAssets(?string $search, ?string $tag): Collection
    {
        $needle = Str::of($search ?? '')->trim()->lower()->toString();
        $tagNeedle = Str::of($tag ?? '')->trim()->lower()->toString();

        $assets = collect([
            ...$this->publicImages(),
            ...$this->storedImages(),
        ])
            ->unique('url');
        $metadata = $this->metadataManager->forUrls($assets->pluck('url')->all());

        $assets = $assets
            ->map(function (array $asset) use ($metadata): array {
                $saved = $metadata->get($asset['url']);

                return [
                    ...$asset,
                    'category' => $saved?->category,
                    'hasTransparency' => $saved?->has_transparency,
                    'isAnimated' => $saved?->is_animated,
                    'label' => $saved?->display_name ?: $asset['label'],
                    'tags' => $saved?->tags ?? [],
                ];
            })
            ->filter(fn (array $asset): bool => $this->matches($asset, $needle, $tagNeedle))
            ->sortBy([
                ['uploaded', 'desc'],
                ['modifiedAt', 'desc'],
                ['url', 'asc'],
            ])
            ->values();

        return $assets;
    }

    /** @param Collection<int, array<string, mixed>> $assets */
    private function serializeAssets(Collection $assets, ?User $user): array
    {
        $canViewPath = $user?->hasAccess(PermissionCatalog::MEDIA_PATHS, AccessLevel::READ) ?? false;
        $references = $this->mediaAssetManager->referenceSummaries(
            $assets->pluck('url')->all(),
        );

        return $assets
            ->map(function (array $asset) use ($canViewPath, $references): array {
                $referenceSummary = $references[$asset['url']]
                    ?? ['count' => 0, 'groups' => []];

                return [
                    'canDelete' => true,
                    'canViewPath' => $canViewPath,
                    'category' => $asset['category'],
                    'extension' => $asset['extension'],
                    'hasTransparency' => $asset['hasTransparency'],
                    'isAnimated' => $asset['isAnimated'],
                    'label' => $asset['label'],
                    'referenceCount' => $referenceSummary['count'],
                    'referenceGroups' => $referenceSummary['groups'],
                    'source' => $asset['source'],
                    'tags' => $asset['tags'],
                    'uploaded' => $asset['uploaded'],
                    'url' => $asset['url'],
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array{assets: list<array<string, mixed>>, pagination: array{currentPage: int, lastPage: int, perPage: int, total: int}}
     */
    public function paginate(
        ?string $search = null,
        ?User $user = null,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
        ?string $tag = null,
    ): array {
        $perPage = max(1, min(self::DEFAULT_PAGE_SIZE, $perPage));
        $assets = $this->matchingAssets($search, $tag);
        $total = $assets->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min(max(1, $page), $lastPage);

        return [
            'assets' => $this->serializeAssets(
                $assets->forPage($currentPage, $perPage),
                $user,
            ),
            'pagination' => [
                'currentPage' => $currentPage,
                'lastPage' => $lastPage,
                'perPage' => $perPage,
                'total' => $total,
            ],
        ];
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
     * @param  array{category: string|null, label: string, source: string, tags: list<string>, url: string}  $asset
     */
    private function matches(array $asset, string $needle, string $tag): bool
    {
        if ($tag !== '' && ! collect($asset['tags'])
            ->contains(fn (mixed $assetTag): bool => Str::lower((string) $assetTag) === $tag)) {
            return false;
        }

        if ($needle === '') {
            return true;
        }

        return Str::of(implode(' ', [
            $asset['label'],
            $asset['source'],
            $asset['category'] ?? '',
            implode(' ', $asset['tags']),
            $asset['url'],
        ]))
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
