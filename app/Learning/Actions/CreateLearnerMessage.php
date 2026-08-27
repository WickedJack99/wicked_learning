<?php

namespace App\Learning\Actions;

use App\Models\LearnerMessage;
use App\Models\LearningMessageTopic;
use App\Models\User;

class CreateLearnerMessage
{
    public function handle(User $user, LearningMessageTopic $topic, string $body, string $audience = 'peers'): LearnerMessage
    {
        return LearnerMessage::query()->firstOrCreate(
            [
                'learning_message_topic_id' => $topic->id,
                'user_id' => $user->id,
            ],
            ['body' => trim($body), 'audience' => $audience],
        );
    }
}
