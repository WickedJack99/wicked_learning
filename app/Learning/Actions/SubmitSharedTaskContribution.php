<?php

namespace App\Learning\Actions;

use App\Learning\Services\ActiveLearningActivityResolver;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskSubmission;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

/** Records an accepted learner contribution toward shared activity progress. */
class SubmitSharedTaskContribution
{
    public function __construct(private readonly ActiveLearningActivityResolver $activeActivity) {}

    public function handle(User $user, LearningActivity $activity, string $playRunId, string $body): LearningSharedTaskSubmission
    {
        abort_unless($activity->type === 'shared_task', 404);

        if (! $this->activeActivity->isActive($user, $activity, $playRunId)) {
            throw (new ModelNotFoundException)->setModel(LearningActivity::class);
        }

        $config = is_array($activity->config) ? $activity->config : [];
        $validationMode = (string) ($config['validationMode'] ?? 'minimum_length');
        $minimumLength = max(0, (int) ($config['minimumLength'] ?? 20));
        $repeatPolicy = (string) ($config['repeatPolicy'] ?? 'once_per_user');
        $text = trim($body);

        abort_if($text === '', 422, 'The contribution cannot be empty.');
        abort_if(
            $validationMode === 'minimum_length' && mb_strlen($text) < $minimumLength,
            422,
            "The contribution must be at least {$minimumLength} characters.",
        );

        return DB::transaction(function () use ($activity, $playRunId, $repeatPolicy, $text, $user, $validationMode): LearningSharedTaskSubmission {
            if ($repeatPolicy === 'once_per_user') {
                $existing = LearningSharedTaskSubmission::query()
                    ->where('learning_activity_id', $activity->id)
                    ->where('user_id', $user->id)
                    ->where('status', 'accepted')
                    ->first();

                abort_if($existing !== null, 422, 'You have already contributed to this shared task.');
            }

            return LearningSharedTaskSubmission::query()->create([
                'learning_activity_id' => $activity->id,
                'user_id' => $user->id,
                'play_run_id' => $playRunId,
                'body' => $text,
                'status' => 'accepted',
                'validation_mode' => $validationMode,
                'accepted_at' => now(),
                'metadata' => [
                    'bodyLength' => mb_strlen($text),
                ],
            ]);
        });
    }
}
