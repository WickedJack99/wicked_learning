<?php

namespace App\Learning\Actions;

use App\Models\LearningTopicArea;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateLearningTopicArea
{
    /** @param array{title: string, description?: string|null, after_area_id?: int|null} $data */
    public function handle(array $data): LearningTopicArea
    {
        return DB::transaction(function () use ($data): LearningTopicArea {
            $areas = LearningTopicArea::query()
                ->lockForUpdate()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();

            $area = LearningTopicArea::query()->create([
                'slug' => $this->uniqueSlug($data['title']),
                'title' => trim($data['title']),
                'description' => $data['description'] ?? null,
                'sort_order' => ((int) $areas->max('sort_order')) + 10,
            ]);

            $orderedIds = $areas->pluck('id')->all();
            $afterAreaId = $data['after_area_id'] ?? null;
            $insertAt = $afterAreaId === null
                ? 0
                : array_search($afterAreaId, $orderedIds, true) + 1;

            array_splice($orderedIds, $insertAt, 0, [$area->id]);
            $this->persistOrder($orderedIds);

            return $area->refresh();
        });
    }

    /** @param list<int> $areaIds */
    private function persistOrder(array $areaIds): void
    {
        foreach ($areaIds as $index => $areaId) {
            LearningTopicArea::query()
                ->whereKey($areaId)
                ->update(['sort_order' => ($index + 1) * 10]);
        }
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'topic-area';
        $slug = $base;
        $suffix = 2;

        while (LearningTopicArea::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
