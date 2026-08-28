<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['actor_user_id', 'target_user_id', 'action', 'changes'])]
class AccessChangeEvent extends Model
{
    public const ACTION_ACCESS_UPDATED = 'access_updated';

    public const ACTION_PASSWORD_UPDATED = 'password_updated';

    public const ACTION_TWO_FACTOR_ENABLED = 'two_factor_enabled';

    public const ACTION_TWO_FACTOR_DISABLED = 'two_factor_disabled';

    public const ACTION_PASSKEY_REGISTERED = 'passkey_registered';

    public const ACTION_PASSKEY_DELETED = 'passkey_deleted';

    protected function casts(): array
    {
        return [
            'changes' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    /** @return BelongsTo<User, $this> */
    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}
