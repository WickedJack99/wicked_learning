<?php

namespace App\Learning\Actions;

use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\User;

class RespondToLearnerSupportRequest
{
    public function handle(
        User $user,
        LearnerMessage $message,
        string $body,
    ): LearnerMessageResponse {
        return LearnerMessageResponse::query()->updateOrCreate(
            [
                'learner_message_id' => $message->id,
                'user_id' => $user->id,
            ],
            [
                'body' => trim($body),
                'response_type' => null,
            ],
        );
    }
}
