<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property array<int, array{nodeId: int, positionQ: int, positionR: int}> $snapshot */
#[Fillable([
    'changed_by',
    'learning_map_id',
    'snapshot',
])]
class LearningMapLayoutVersion extends Model
{
    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
        ];
    }

    /** @return BelongsTo<LearningMap, $this> */
    public function map(): BelongsTo
    {
        return $this->belongsTo(LearningMap::class, 'learning_map_id');
    }

    /** @return BelongsTo<User, $this> */
    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
