<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Stores account preferences that should follow the user between devices.
 */
#[Fillable(['user_id', 'appearance', 'settings'])]
class UserPreference extends Model
{
    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    /**
     * The account that owns these preferences.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
