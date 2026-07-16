<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Stores an administrator-managed platform UI catalog for one locale.
 * Learning activity translations intentionally live in a separate table.
 */
#[Fillable([
    'code',
    'name',
    'native_name',
    'translations',
    'is_enabled',
    'created_by',
    'updated_by',
])]
class PlatformLanguage extends Model
{
    protected function casts(): array
    {
        return [
            'translations' => 'array',
            'is_enabled' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
