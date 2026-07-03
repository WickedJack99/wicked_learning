<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'learning_node_id',
    'slug',
    'type',
    'title',
    'introduction',
    'config',
    'sort_order',
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
}
