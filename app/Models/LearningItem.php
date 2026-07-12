<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A consumable object that can be granted and spent by learning activities.
 *
 * @property array<string, mixed>|null $config
 */
#[Fillable([
    'slug',
    'title',
    'description',
    'image_dark',
    'image_light',
    'config',
])]
class LearningItem extends Model
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
        return $this->belongsToMany(User::class, 'user_learning_items')
            ->withPivot('quantity', 'acquired_at')
            ->withTimestamps();
    }
}
