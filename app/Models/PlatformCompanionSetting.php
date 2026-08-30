<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Platform-wide configuration for the non-AI learner companion. */
#[Fillable(['enabled', 'display_name', 'avatar_url', 'welcome_message', 'companion_config', 'updated_by_user_id'])]
class PlatformCompanionSetting extends Model
{
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'companion_config' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public static function current(): self
    {
        return self::query()->firstOrCreate([], [
            'enabled' => true,
            'display_name' => 'Learning companion',
            'welcome_message' => 'I can help you orient yourself. Choose a direction when you want one, or keep exploring at your own pace.',
        ]);
    }
}
