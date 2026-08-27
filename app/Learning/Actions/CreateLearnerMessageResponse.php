<?php

namespace App\Learning\Actions;

use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\User;

class CreateLearnerMessageResponse
{
    public function handle(User $user, LearnerMessage $message, string $body): LearnerMessageResponse
    {
        return LearnerMessageResponse::query()->firstOrCreate(
            [
                'learner_message_id' => $message->id,
                'user_id' => $user->id,
            ],
            ['body' => trim($body)],
        );
    }
}
