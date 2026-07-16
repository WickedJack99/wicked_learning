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
}
