<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property array<string, mixed>|null $config
 * @property array<string, mixed>|null $ai_review
 * @property Carbon|null $ai_reviewed_at
 */
#[Fillable([
    'learning_node_id',
    'slug',
    'type',
    'title',
    'introduction',
    'config',
    'ai_review_status',
    'ai_reviewed_at',
    'ai_review',
    'sort_order',
    'graph_position_x',
    'graph_position_y',
    'companion_config',
])]
class LearningActivity extends Model
{
    public const AI_REVIEW_STATUS_NEEDS_REVIEW = 'needs_review';

    public const AI_REVIEW_STATUS_REVIEWED = 'reviewed';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'config' => 'array',
            'ai_reviewed_at' => 'datetime',
            'ai_review' => 'array',
            'companion_config' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningNode, $this>
     */
    public function node(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'learning_node_id');
    }

    /**
     * @return HasMany<NpcDialogueNode, $this>
     */
    public function npcDialogueNodes(): HasMany
    {
        return $this->hasMany(NpcDialogueNode::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * @return HasMany<NpcDialogueTransition, $this>
     */
    public function npcDialogueTransitions(): HasMany
    {
        return $this->hasMany(NpcDialogueTransition::class);
    }

    /**
     * @return HasOne<LearningQuestion, $this>
     */
    public function question(): HasOne
    {
        return $this->hasOne(LearningQuestion::class);
    }

    /**
     * @return HasMany<ActivityTransition, $this>
     */
    public function transitions(): HasMany
    {
        return $this->hasMany(ActivityTransition::class, 'from_activity_id');
    }

    /**
     * @return HasOne<LearningPortalLink, $this>
     */
    public function outgoingPortalLink(): HasOne
    {
        return $this->hasOne(LearningPortalLink::class, 'source_learning_activity_id');
    }

    /**
     * @return HasMany<LearningPortalLink, $this>
     */
    public function incomingPortalLinks(): HasMany
    {
        return $this->hasMany(LearningPortalLink::class, 'target_learning_activity_id');
    }

    /**
     * @return HasMany<LearningActivityTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(LearningActivityTranslation::class);
    }

    /**
     * @return HasMany<LearningActivityReviewRun, $this>
     */
    public function reviewRuns(): HasMany
    {
        return $this->hasMany(LearningActivityReviewRun::class)
            ->latest('id');
    }

    /**
     * @return HasMany<LearningActivityVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(LearningActivityVersion::class)
            ->latest('created_at')
            ->latest('id');
    }

    /**
     * @return HasMany<LearningSharedTaskSubmission, $this>
     */
    public function sharedTaskSubmissions(): HasMany
    {
        return $this->hasMany(LearningSharedTaskSubmission::class);
    }
}
