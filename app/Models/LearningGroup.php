<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property DateTimeInterface|null $admin_chat_visible_until
 */
#[Fillable([
    'created_by_user_id',
    'name',
    'slug',
    'description',
    'study_topic',
    'admin_chat_visible_enabled',
    'admin_chat_visible_until',
])]
class LearningGroup extends Model
{
    protected function casts(): array
    {
        return [
            'admin_chat_visible_enabled' => 'boolean',
            'admin_chat_visible_until' => 'datetime',
        ];
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'learning_group_user')
            ->withPivot('joined_at', 'role')
            ->withTimestamps();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * @return HasMany<LearningGroupMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(LearningGroupMessage::class);
    }

    /**
     * @return HasMany<LearningGroupAdminChatVote, $this>
     */
    public function adminChatVotes(): HasMany
    {
        return $this->hasMany(LearningGroupAdminChatVote::class);
    }

    /**
     * @return BelongsToMany<LearningMap, $this>
     */
    public function editableMaps(): BelongsToMany
    {
        return $this->belongsToMany(LearningMap::class, 'learning_group_map_editors')
            ->withTimestamps();
    }

    public function adminCanViewMessage(LearningGroupMessage $message): bool
    {
        if ($this->admin_chat_visible_enabled) {
            return true;
        }

        return $this->admin_chat_visible_until instanceof DateTimeInterface
            && $message->created_at instanceof DateTimeInterface
            && $message->created_at <= $this->admin_chat_visible_until;
    }
}
