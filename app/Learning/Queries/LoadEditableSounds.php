<?php

namespace App\Learning\Queries;

use App\Models\LearningSound;
use Illuminate\Database\Eloquent\Collection;

class LoadEditableSounds
{
    /**
     * @return Collection<int, LearningSound>
     */
    public function handle(?string $search = null): Collection
    {
        $query = LearningSound::query()->orderBy('name');

        if (is_string($search) && trim($search) !== '') {
            $needle = trim($search);
            $query->where(function ($query) use ($needle): void {
                $query->where('name', 'like', "%{$needle}%")
                    ->orWhere('slug', 'like', "%{$needle}%")
                    ->orWhere('icon', 'like', "%{$needle}%")
                    ->orWhere('url', 'like', "%{$needle}%");
            });
        }

        return $query->get();
    }
}
