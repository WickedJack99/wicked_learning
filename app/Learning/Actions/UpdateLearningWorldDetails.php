<?php

namespace App\Learning\Actions;

use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateLearningWorldDetails
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(User $user, LearningWorld $world, array $data): LearningWorld
    {
        return DB::transaction(function () use ($data, $user, $world): LearningWorld {
            $world->versions()->create([
                'changed_by' => $user->id,
                'description' => $world->description,
                'title' => $world->title,
            ]);

            $world->forceFill([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
            ])->save();

            return $world->refresh();
        });
    }
}
