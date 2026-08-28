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
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
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

    /**
     * @return array{count: int, groups: list<array{count: int, label: string}>}
     */
    public function referenceSummary(string $url): array
    {
        $groups = collect([
            'Tools' => $this->countStringColumns(
                LearningTool::class,
                ['image_dark', 'image_light', 'animation_dark', 'animation_light'],
                $url,
            ),
            'Activity starts' => $this->countStringColumns(
                LearningActivityStart::class,
                ['image_dark', 'image_light'],
                $url,
            ),
            'NPC dialogue' => $this->countJsonColumnReferences(NpcDialogueNode::class, 'config', $url),
            'Activities' => $this->countJsonColumnReferences(LearningActivity::class, 'config', $url),
            'Maps' => $this->countJsonColumnReferences(LearningMap::class, 'background_config', $url),
            'Map places' => $this->countJsonColumnReferences(LearningMapAsset::class, 'visual_config', $url)
                + $this->countStringColumns(LearningMapAsset::class, ['image_url'], $url),
            'Learning nodes' => $this->countJsonColumnReferences(LearningNode::class, 'visual_config', $url),
            'Presentation' => $this->countJsonColumnReferences(PlatformPresentationSetting::class, 'value', $url),
        ])
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
     * @param  class-string<Model>  $modelClass
     * @param  list<string>  $columns
     */
    private function countStringColumns(string $modelClass, array $columns, string $url): int
    {
        return collect($columns)
            ->sum(fn (string $column): int => $modelClass::query()->where($column, $url)->count());
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
     * @param  class-string<Model>  $modelClass
     */
    private function countJsonColumnReferences(string $modelClass, string $column, string $url): int
    {
        $count = 0;

        $modelClass::query()
            ->each(function ($model) use ($column, $url, &$count): void {
                if ($this->containsValue($model->{$column}, $url)) {
                    $count++;
                }
            });

        return $count;
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

    private function containsValue(mixed $value, string $needle): bool
    {
        if ($value === $needle) {
            return true;
        }

        if (! is_array($value)) {
            return false;
        }

        foreach ($value as $item) {
            if ($this->containsValue($item, $needle)) {
                return true;
            }
        }

        return false;
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
