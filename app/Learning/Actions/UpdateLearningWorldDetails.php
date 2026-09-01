<?php

namespace App\Learning\Actions;

use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateLearningWorldDetails
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(
        User $user,
        LearningWorld $world,
        array $data,
        ?string $expectedUpdatedAt = null,
    ): LearningWorld {
        return DB::transaction(function () use ($data, $expectedUpdatedAt, $user, $world): LearningWorld {
            $currentWorld = LearningWorld::query()
                ->whereKey($world->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $expectedUpdatedAt !== null
                && $currentWorld->updated_at?->toIso8601String() !== Carbon::parse($expectedUpdatedAt)->toIso8601String()
            ) {
                throw ValidationException::withMessages([
                    'updated_at' => 'These world details changed while you were editing. Reload them before saving again.',
                ]);
            }

            $currentWorld->versions()->create([
                'changed_by' => $user->id,
                'description' => $currentWorld->description,
                'title' => $currentWorld->title,
            ]);

            $currentWorld->forceFill([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
            ])->save();

            return $currentWorld->refresh();
        });
    }
}
