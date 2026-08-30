<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An immutable reflection captured from a playable activity or dialogue node. */
#[Fillable([
    'user_id',
    'learner_journal_page_id',
    'learning_node_id',
    'learning_activity_id',
    'npc_dialogue_node_id',
    'title',
    'question',
    'reflection',
    'response_type',
    'response_context',
    'expert_access_requested',
    'feedback_status',
    'expert_feedback',
])]
class LearnerReflection extends Model
{
    protected function casts(): array
    {
        return ['expert_access_requested' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<LearnerJournalPage, $this> */
    public function page(): BelongsTo
    {
        return $this->belongsTo(LearnerJournalPage::class, 'learner_journal_page_id');
    }

    /** @return BelongsTo<LearningNode, $this> */
    public function learningNode(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'learning_node_id');
    }

    /** @return BelongsTo<LearningActivity, $this> */
    public function learningActivity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }
}
