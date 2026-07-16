<?php

namespace App\Models;

use App\Learning\Services\JournalThemeConfiguration;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Platform-wide safeguards and presentation settings for learner journals. */
#[Fillable(['allow_expert_access_requests', 'theme', 'updated_by_user_id'])]
class PlatformJournalSetting extends Model
{
    protected function casts(): array
    {
        return [
            'allow_expert_access_requests' => 'boolean',
            'theme' => 'array',
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
            'allow_expert_access_requests' => false,
            'theme' => app(JournalThemeConfiguration::class)->defaults(),
        ]);
    }
}
