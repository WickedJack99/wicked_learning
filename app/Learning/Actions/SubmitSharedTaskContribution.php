<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearnerActivityAccessService;
use App\Learning\Services\SharedTaskActivityConfiguration;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Records an accepted learner contribution toward shared activity progress. */
class SubmitSharedTaskContribution
{
    public function __construct(
        private readonly LearnerActivityAccessService $activityAccess,
        private readonly SharedTaskActivityConfiguration $sharedTaskConfig,
    ) {}

    public function handle(User $user, LearningActivity $activity, string $playRunId, string $body, bool $shareWithPeers = false, ?int $projectStepIndex = null): LearningSharedTaskSubmission
    {
        abort_unless($activity->type === 'shared_task', 404);

        $this->activityAccess->assertActive($user, $activity, $playRunId);

        $config = is_array($activity->config) ? $activity->config : [];
        $taskKind = $this->sharedTaskConfig->taskKind($config);
        $showContributions = (bool) ($config['showContributions'] ?? false);
        $validationMode = (string) ($config['validationMode'] ?? 'minimum_length');
        $minimumLength = max(0, (int) ($config['minimumLength'] ?? 20));
        $repeatPolicy = (string) ($config['repeatPolicy'] ?? 'once_per_user');
        $text = trim($body);
        $projectSteps = $this->sharedTaskConfig->projectSteps($config);

        abort_if($text === '', 422, 'The contribution cannot be empty.');
        abort_if(
            $validationMode === 'minimum_length' && mb_strlen($text) < $minimumLength,
            422,
            "The contribution must be at least {$minimumLength} characters.",
        );
        abort_if(
            $projectStepIndex !== null && ! array_key_exists($projectStepIndex, $projectSteps),
            422,
            'Choose a valid project step.',
        );

        return DB::transaction(function () use ($activity, $playRunId, $projectStepIndex, $repeatPolicy, $shareWithPeers, $showContributions, $taskKind, $text, $user, $validationMode): LearningSharedTaskSubmission {
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
                    'shareWithPeers' => $showContributions && $shareWithPeers,
                    'taskKind' => $taskKind,
                    'projectStepIndex' => $projectStepIndex,
                ],
            ]);
        });
    }
}
