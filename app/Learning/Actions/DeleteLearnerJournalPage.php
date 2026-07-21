<?php

namespace App\Learning\Actions;

use App\Models\LearnerJournalPage;
use App\Models\User;

/** Deletes one learner-owned journal page and its dependent journal records. */
class DeleteLearnerJournalPage
{
    public function handle(User $user, LearnerJournalPage $page): void
    {
        abort_unless((int) $page->user_id === (int) $user->id, 404);

        $page->delete();
    }
}
