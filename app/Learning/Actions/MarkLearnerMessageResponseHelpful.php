<?php

namespace App\Learning\Actions;

use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarkLearnerMessageResponseHelpful
{
    public function handle(
        User $user,
        LearnerMessage $message,
        LearnerMessageResponse $response,
        bool $helpful,
    ): LearnerMessageResponse {
        if ($message->user_id !== $user->id) {
            throw ValidationException::withMessages([
                'message' => 'Only the learner who asked the question can mark a response helpful.',
            ]);
        }

        if ($response->learner_message_id !== $message->id) {
            throw ValidationException::withMessages([
                'response' => 'This response does not belong to the message.',
            ]);
        }

        if ($message->hidden_at !== null || $response->hidden_at !== null) {
            throw ValidationException::withMessages([
                'response' => 'Hidden responses cannot be marked helpful.',
            ]);
        }

        return DB::transaction(function () use ($helpful, $message, $response): LearnerMessageResponse {
            $message->newQuery()->whereKey($message->id)->lockForUpdate()->firstOrFail();
            $lockedResponse = $response->newQuery()->whereKey($response->id)->lockForUpdate()->firstOrFail();

            if (! $helpful) {
                $lockedResponse->forceFill(['helpful_at' => null])->save();

                return $lockedResponse;
            }

            LearnerMessageResponse::query()
                ->where('learner_message_id', $message->id)
                ->whereKeyNot($response->id)
                ->whereNotNull('helpful_at')
                ->update(['helpful_at' => null]);

            $lockedResponse->forceFill(['helpful_at' => now()])->save();

            return $lockedResponse;
        });
    }
}
