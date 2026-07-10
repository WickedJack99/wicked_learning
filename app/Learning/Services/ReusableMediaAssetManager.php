<?php

namespace App\Learning\Services;

use App\Models\DialogueStage;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;
use App\Models\PlatformPresentationSetting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ReusableMediaAssetManager
{
    public function __construct(private readonly LearningMediaUploadService $mediaUpload) {}

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

        return [
            ...$upload,
            'referencesUpdated' => $this->replaceReferences($oldUrl, $upload['url']),
        ];
    }

    public function deleteUploadedAsset(string $url): int
    {
        $path = $this->storagePathFromUrl($url);

        if (! $path) {
            throw ValidationException::withMessages([
                'url' => 'Only uploaded storage assets can be deleted.',
            ]);
        }

        $referencesUpdated = $this->replaceReferences($url, '');
        Storage::disk('public')->delete($path);

        return $referencesUpdated;
    }

    public function replaceReferences(string $oldUrl, string $newUrl): int
    {
        if ($oldUrl === '' || $oldUrl === $newUrl) {
            return 0;
        }

        return $this->replaceToolReferences($oldUrl, $newUrl)
            + $this->replaceActivityStartReferences($oldUrl, $newUrl)
            + $this->replaceDialogueStageReferences($oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(LearningActivity::class, 'config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(LearningMap::class, 'background_config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(LearningNode::class, 'visual_config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(NpcDialogueNode::class, 'config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(DialogueStage::class, 'visual_config', $oldUrl, $newUrl)
            + $this->replaceJsonColumnReferences(PlatformPresentationSetting::class, 'value', $oldUrl, $newUrl);
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

    private function replaceDialogueStageReferences(string $oldUrl, string $newUrl): int
    {
        return $this->replaceStringColumns(DialogueStage::class, ['portrait_url'], $oldUrl, $newUrl);
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
}
