<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A learner-owned capability that can be used by activity types such as obstacles.
 *
 * @property array<string, mixed>|null $config
 */
#[Fillable([
    'slug',
    'title',
    'description',
    'image_dark',
    'image_light',
    'animation_dark',
    'animation_light',
    'config',
])]
class LearningTool extends Model
{
    protected function casts(): array
    {
        return [
            'config' => 'array',
        ];
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_learning_tools')
            ->withPivot('acquired_at')
            ->withTimestamps();
    }
}
