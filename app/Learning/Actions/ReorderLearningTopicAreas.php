<?php

namespace App\Learning\Actions;

use App\Models\LearningTopicArea;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReorderLearningTopicAreas
{
    /** @param list<int> $areaIds */
    public function handle(array $areaIds): void
    {
        DB::transaction(function () use ($areaIds): void {
            $storedIds = LearningTopicArea::query()
                ->lockForUpdate()
                ->orderBy('id')
                ->pluck('id')
                ->all();
            $submittedIds = $areaIds;
            sort($storedIds);
            sort($submittedIds);

            if ($storedIds !== $submittedIds) {
                throw ValidationException::withMessages([
                    'area_ids' => 'The submitted order must contain every topic area exactly once.',
                ]);
            }

            foreach ($areaIds as $index => $areaId) {
                LearningTopicArea::query()
                    ->whereKey($areaId)
                    ->update(['sort_order' => ($index + 1) * 10]);
            }
        });
    }
}
