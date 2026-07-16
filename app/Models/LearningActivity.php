<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property array<string, mixed>|null $config
 */
#[Fillable([
    'learning_node_id',
    'slug',
    'type',
    'title',
    'introduction',
    'config',
    'sort_order',
    'graph_position_x',
    'graph_position_y',
])]
class LearningActivity extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'config' => 'array',
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
     * @return HasMany<DialogueStage, $this>
     */
    public function dialogueStages(): HasMany
    {
        return $this->hasMany(DialogueStage::class)->orderBy('sort_order');
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
}
