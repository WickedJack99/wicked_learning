<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;
use App\Models\PlatformPresentationSetting;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use LogicException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReusableMediaAssetManager
{
    public function __construct(
        private readonly LearningMediaUploadService $mediaUpload,
        private readonly ReusableMediaMetadataManager $metadataManager,
    ) {}

    /**
     * @return array{durationSeconds: float|null, url: string}
     */
    public function upload(mixed $file): array
    {
        return $this->mediaUpload->upload($file);
    }

    /**
     * @return array{durationSeconds: float|null, referencesUpdated: int, url: string}
     */
    public function replaceAndKeep(string $oldUrl, mixed $file): array
    {
        $upload = $this->upload($file);
        $this->metadataManager->transfer($oldUrl, $upload['url']);

        return [
            ...$upload,
            'referencesUpdated' => $this->replaceReferences($oldUrl, $upload['url']),
        ];
    }

    public function deleteUploadedAsset(string $url): int
    {
        return $this->deleteAsset($url);
    }

    public function download(string $url): BinaryFileResponse|StreamedResponse
    {
        $storagePath = $this->storagePathFromUrl($url);

        if ($storagePath) {
            $disk = Storage::disk('public');

            abort_unless($disk->exists($storagePath), 404);

            return $disk->download($storagePath, basename($storagePath), [
                'Content-Type' => $disk->mimeType($storagePath) ?: 'application/octet-stream',
            ]);
        }

        $assetPath = $this->publicImagePathFromUrl($url);

        if ($assetPath) {
            return response()->download($assetPath, basename($assetPath), [
                'Content-Type' => File::mimeType($assetPath) ?: 'application/octet-stream',
            ]);
        }

        throw ValidationException::withMessages([
            'url' => 'Only reusable image assets can be downloaded.',
        ]);
    }

    public function isImportableReference(string $url): bool
    {
        $parsed = parse_url($url);

        if (! is_array($parsed) || isset($parsed['scheme']) || isset($parsed['host'])) {
            return false;
        }

        $storagePath = $this->storagePathFromUrl($url);

        if ($storagePath !== null) {
            return $storagePath !== ''
                && ! str_contains($storagePath, '..')
                && Storage::disk('public')->exists($storagePath);
        }

        $path = parse_url($url, PHP_URL_PATH);

        if (! is_string($path) || ! str_starts_with($path, '/images/')) {
            return false;
        }

        $relativePath = ltrim(substr($path, strlen('/images/')), '/');

        return $relativePath !== ''
            && ! str_contains($relativePath, '..')
            && in_array(strtolower(pathinfo($relativePath, PATHINFO_EXTENSION)), [
                'gif',
                'jpeg',
                'jpg',
                'png',
                'svg',
                'webp',
            ], true);
    }

    /**
     * @return array{count: int, groups: list<array{count: int, label: string}>}
     */
    public function referenceSummary(string $url): array
    {
        return $this->referenceSummaries([$url])[$url] ?? $this->emptyReferenceSummary();
    }

    /**
     * Calculate references for several media URLs in one pass over each
     * content table. The asset library displays many images at once, so
     * looking up every URL independently creates an avoidable query storm.
     *
     * @param  list<string>  $urls
     * @return array<string, array{count: int, groups: list<array{count: int, label: string}>}>
     */
    public function referenceSummaries(array $urls): array
    {
        $urls = array_values(array_unique(array_filter(
            $urls,
            fn (mixed $url): bool => is_string($url) && $url !== '',
        )));

        if ($urls === []) {
            return [];
        }

        $counts = array_fill_keys($urls, []);
        $urlSet = array_fill_keys($urls, true);

        $this->addStringReferenceCounts(
            $counts,
            LearningTool::class,
            ['image_dark', 'image_light', 'animation_dark', 'animation_light'],
            'Tools',
            $urlSet,
        );
        $this->addStringReferenceCounts(
            $counts,
            LearningActivityStart::class,
            ['image_dark', 'image_light'],
            'Activity starts',
            $urlSet,
        );
        $this->addJsonReferenceCounts($counts, NpcDialogueNode::class, 'config', 'NPC dialogue', $urlSet);
        $this->addJsonReferenceCounts($counts, LearningActivity::class, 'config', 'Activities', $urlSet);
        $this->addJsonReferenceCounts($counts, LearningMap::class, 'background_config', 'Maps', $urlSet);
        $this->addJsonReferenceCounts($counts, LearningMapAsset::class, 'visual_config', 'Map places', $urlSet);
        $this->addStringReferenceCounts($counts, LearningMapAsset::class, ['image_url'], 'Map places', $urlSet);
        $this->addJsonReferenceCounts($counts, LearningNode::class, 'visual_config', 'Learning nodes', $urlSet);
        $this->addJsonReferenceCounts($counts, PlatformPresentationSetting::class, 'value', 'Presentation', $urlSet);

        return collect($urls)
            ->mapWithKeys(fn (string $url): array => [$url => $this->summaryFromCounts($counts[$url])])
            ->all();
    }

    public function deleteAsset(string $url): int
    {
        $path = $this->storagePathFromUrl($url);

        if ($path) {
            $referencesUpdated = $this->replaceReferences($url, '');
            Storage::disk('public')->delete($path);
            $this->metadataManager->delete($url);

            return $referencesUpdated;
        }

        $path = $this->publicImagePathFromUrl($url);

        if (! $path) {
            throw ValidationException::withMessages([
                'url' => 'Only reusable image assets can be deleted.',
            ]);
        }

        $referencesUpdated = $this->replaceReferences($url, '');
        File::delete($path);
        $this->metadataManager->delete($url);

        return $referencesUpdated;
    }

    public function replaceReferences(string $oldUrl, string $newUrl): int
    {
        if ($oldUrl === '' || $oldUrl === $newUrl) {
            return 0;
        }

        return $this->replaceToolReferences($oldUrl, $newUrl)
            + $this->replaceActivityStartReferences($oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(LearningActivity::class, 'config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(LearningMap::class, 'background_config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(LearningMapAsset::class, 'visual_config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(LearningNode::class, 'visual_config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(NpcDialogueNode::class, 'config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(PlatformPresentationSetting::class, 'value', $oldUrl, $newUrl)
            + $this->replaceStringColumns(LearningMapAsset::class, ['image_url'], $oldUrl, $newUrl);
    }

    private function replaceToolReferences(string $oldUrl, string $newUrl): int
    {
        return $this->replaceStringColumns(
            LearningTool::class,
            ['image_dark', 'image_light', 'animation_dark', 'animation_light'],
            $oldUrl,
            $newUrl,
        );
    }

    private function replaceActivityStartReferences(string $oldUrl, string $newUrl): int
    {
        return $this->replaceStringColumns(
            LearningActivityStart::class,
            ['image_dark', 'image_light'],
            $oldUrl,
            $newUrl,
        );
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @param  list<string>  $columns
     */
    private function replaceStringColumns(
        string $modelClass,
        array $columns,
        string $oldUrl,
        string $newUrl,
    ): int {
        $updates = 0;

        foreach ($columns as $column) {
            $updates += $modelClass::query()
                ->where($column, $oldUrl)
                ->update([$column => $newUrl ?: null]);
        }

        return $updates;
    }

    /**
     * @param  array<string, array<string, int>>  $counts
     * @param  class-string<Model>  $modelClass
     * @param  list<string>  $columns
     * @param  array<string, true>  $urlSet
     */
    private function addStringReferenceCounts(
        array &$counts,
        string $modelClass,
        array $columns,
        string $group,
        array $urlSet,
    ): void {
        foreach ($columns as $column) {
            $modelClass::query()
                ->whereIn($column, array_keys($urlSet))
                ->pluck($column)
                ->each(function (mixed $value) use (&$counts, $group): void {
                    if (! is_string($value) || ! isset($counts[$value])) {
                        return;
                    }

                    $counts[$value][$group] = ($counts[$value][$group] ?? 0) + 1;
                });
        }
    }

    /**
     * @param  array<string, array<string, int>>  $counts
     * @param  class-string<Model>  $modelClass
     * @param  array<string, true>  $urlSet
     */
    private function addJsonReferenceCounts(
        array &$counts,
        string $modelClass,
        string $column,
        string $group,
        array $urlSet,
    ): void {
        $query = $modelClass::query();
        $predicate = match ($column) {
            'config' => 'CAST("config" AS TEXT) LIKE ?',
            'background_config' => 'CAST("background_config" AS TEXT) LIKE ?',
            'visual_config' => 'CAST("visual_config" AS TEXT) LIKE ?',
            'value' => 'CAST("value" AS TEXT) LIKE ?',
            default => throw new LogicException('Unsupported JSON reference column.'),
        };

        $query
            ->where(function (Builder $query) use ($predicate, $urlSet): void {
                foreach (array_keys($urlSet) as $url) {
                    $query->orWhereRaw($predicate, ['%'.$url.'%']);
                }
            })
            ->get([$column])
            ->each(function (Model $model) use (&$counts, $column, $group, $urlSet): void {
                $matches = [];
                $this->collectReferencedUrls($model->getAttribute($column), $urlSet, $matches);

                foreach (array_keys($matches) as $url) {
                    $counts[$url][$group] = ($counts[$url][$group] ?? 0) + 1;
                }
            });
    }

    /**
     * @param  array<string, true>  $urlSet
     * @param  array<string, true>  $matches
     */
    private function collectReferencedUrls(mixed $value, array $urlSet, array &$matches): void
    {
        if (is_string($value)) {
            if (isset($urlSet[$value])) {
                $matches[$value] = true;
            }

            return;
        }

        if (! is_array($value)) {
            return;
        }

        foreach ($value as $item) {
            $this->collectReferencedUrls($item, $urlSet, $matches);
        }
    }

    /**
     * @param  array<string, int>  $counts
     * @return array{count: int, groups: list<array{count: int, label: string}>}
     */
    private function summaryFromCounts(array $counts): array
    {
        $groups = collect($counts)
            ->filter(fn (int $count): bool => $count > 0)
            ->map(fn (int $count, string $label): array => [
                'count' => $count,
                'label' => $label,
            ])
            ->values()
            ->all();

        return [
            'count' => collect($groups)->sum('count'),
            'groups' => $groups,
        ];
    }

    /**
     * @return array{count: int, groups: list<array{count: int, label: string}>}
     */
    private function emptyReferenceSummary(): array
    {
        return [
            'count' => 0,
            'groups' => [],
        ];
    }

    /**
     * @param  class-string<Model>  $modelClass
     */
    private function replaceJsonColumnReferences(
        string $modelClass,
        string $column,
        string $oldUrl,
        string $newUrl,
    ): int {
        $updated = 0;

        $modelClass::query()
            ->each(function ($model) use ($column, $oldUrl, $newUrl, &$updated): void {
                $value = $model->{$column};

                if (! is_array($value)) {
                    return;
                }

                [$nextValue, $changed] = $this->replaceInValue($value, $oldUrl, $newUrl);

                if (! $changed) {
                    return;
                }

                $model->forceFill([$column => $nextValue])->save();
                $updated++;
            });

        return $updated;
    }

    /**
     * @return array{0: mixed, 1: bool}
     */
    private function replaceInValue(mixed $value, string $oldUrl, string $newUrl): array
    {
        if ($value === $oldUrl) {
            return [$newUrl, true];
        }

        if (! is_array($value)) {
            return [$value, false];
        }

        $changed = false;

        foreach ($value as $key => $item) {
            [$nextItem, $itemChanged] = $this->replaceInValue($item, $oldUrl, $newUrl);
            $value[$key] = $nextItem;
            $changed = $changed || $itemChanged;
        }

        return [$value, $changed];
    }

    private function storagePathFromUrl(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH);

        if (! is_string($path) || ! str_starts_with($path, '/storage/')) {
            return null;
        }

        return ltrim(substr($path, strlen('/storage/')), '/');
    }

    private function publicImagePathFromUrl(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH);

        if (! is_string($path) || ! str_starts_with($path, '/images/')) {
            return null;
        }

        $relativePath = ltrim(substr($path, strlen('/images/')), '/');

        if ($relativePath === '' || str_contains($relativePath, '..')) {
            return null;
        }

        $extension = strtolower(pathinfo($relativePath, PATHINFO_EXTENSION));

        if (! in_array($extension, ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'], true)) {
            return null;
        }

        $basePath = realpath(public_path('images'));
        $assetPath = realpath(public_path('images/'.str_replace('/', DIRECTORY_SEPARATOR, $relativePath)));

        if (! $basePath || ! $assetPath) {
            return null;
        }

        $basePath = rtrim($basePath, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;

        return str_starts_with($assetPath, $basePath) ? $assetPath : null;
    }
}
