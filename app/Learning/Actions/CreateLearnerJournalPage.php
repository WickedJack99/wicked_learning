<?php

namespace App\Learning\Actions;

use App\Models\LearnerJournalPage;
use App\Models\PlatformJournalSetting;
use App\Models\User;

/** Creates an empty private journal page in a learner-selected category. */
class CreateLearnerJournalPage
{
    /** @param array{title: string, topic: string, subtopic?: string|null, markdown?: string|null, preferred_mode?: string|null, request_expert_access?: bool} $data */
    public function handle(User $user, array $data): LearnerJournalPage
    {
        $expertAccess = (bool) ($data['request_expert_access'] ?? false)
            && PlatformJournalSetting::current()->allow_expert_access_requests;
        $subtopic = trim((string) ($data['subtopic'] ?? ''));

        return LearnerJournalPage::query()->create([
            'user_id' => $user->id,
            'title' => trim($data['title']),
            'topic' => trim($data['topic']),
            'subtopic' => $subtopic,
            'markdown' => (string) ($data['markdown'] ?? ''),
            'preferred_mode' => (string) ($data['preferred_mode'] ?? 'edit'),
            'expert_access_requested' => $expertAccess,
        ]);
    }
}
