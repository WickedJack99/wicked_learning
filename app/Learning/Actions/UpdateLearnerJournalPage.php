<?php

namespace App\Learning\Actions;

use App\Models\LearnerJournalPage;
use App\Models\PlatformJournalSetting;
use App\Models\User;

/** Updates one learner-owned journal page without exposing another user's work. */
class UpdateLearnerJournalPage
{
    /** @param array{title: string, topic: string, subtopic?: string|null, markdown: string, preferred_mode: string, request_expert_access?: bool} $data */
    public function handle(User $user, LearnerJournalPage $page, array $data): LearnerJournalPage
    {
        if ($page->user_id !== $user->id) {
            abort(404);
        }

        $expertAccess = (bool) ($data['request_expert_access'] ?? false)
            && PlatformJournalSetting::current()->allow_expert_access_requests;

        $page->forceFill([
            'title' => trim($data['title']),
            'topic' => trim($data['topic']),
            'subtopic' => trim((string) ($data['subtopic'] ?? '')),
            'markdown' => $data['markdown'],
            'preferred_mode' => $data['preferred_mode'],
            'expert_access_requested' => $expertAccess,
        ])->save();

        return $page->refresh();
    }
}
