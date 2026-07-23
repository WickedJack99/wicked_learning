<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A learner's one-time request for feedback on a journal page. */
#[Fillable([
    'learner_journal_page_id',
    'requester_id',
    'domain_type',
    'domain_id',
    'domain_label',
    'requested_at',
    'reviewer_id',
    'feedback',
    'responded_at',
])]
class LearnerJournalFeedbackRequest extends Model
{
    protected function casts(): array
    {
        return [
            'requested_at' => 'datetime',
            'responded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LearnerJournalPage, $this> */
    public function page(): BelongsTo
    {
        return $this->belongsTo(LearnerJournalPage::class, 'learner_journal_page_id');
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
