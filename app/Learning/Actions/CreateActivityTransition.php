<?php

namespace App\Learning\Actions;

use App\Learning\ActivityTypeRegistry;
use App\Learning\Services\PortalLinkService;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use Illuminate\Validation\ValidationException;

class CreateActivityTransition
{
    public function __construct(
        private readonly ActivityTypeRegistry $activityTypes,
        private readonly PortalLinkService $portalLinkService,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningNode $node, array $data): ActivityTransition
    {
        $fromActivity = $this->nodeActivityOrFail($node, (int) $data['from_activity_id']);
        $toActivityId = $this->validatedTargetActivityId($node, $data['to_activity_id'] ?? null);
        $this->ensureActivityCanContinue($fromActivity, $toActivityId);

        return ActivityTransition::query()->firstOrCreate(
            $this->transitionIdentity($fromActivity, $toActivityId, $data),
            $this->transitionDefaults($fromActivity, (string) $data['from_connector']),
        );
    }

    private function nodeActivityOrFail(LearningNode $node, int $activityId): LearningActivity
    {
        return LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->whereKey($activityId)
            ->firstOrFail();
    }

    private function validatedTargetActivityId(LearningNode $node, mixed $activityId): ?int
    {
        if ($activityId === null) {
            return null;
        }

        $this->nodeActivityOrFail($node, (int) $activityId);

        return (int) $activityId;
    }

    private function ensureActivityCanContinue(LearningActivity $fromActivity, ?int $toActivityId): void
    {
        if (
            $fromActivity->type === 'portal'
            && $this->portalLinkService->portalModeFor($fromActivity) === 'output'
            && $toActivityId !== null
        ) {
            throw ValidationException::withMessages([
                'to_activity_id' => 'Entry portal activities must end a path.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function transitionIdentity(LearningActivity $fromActivity, ?int $toActivityId, array $data): array
    {
        return [
            'from_activity_id' => $fromActivity->id,
            'to_activity_id' => $toActivityId,
            'from_connector' => (string) $data['from_connector'],
            'to_connector' => (string) $data['to_connector'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transitionDefaults(LearningActivity $fromActivity, string $fromConnector): array
    {
        return [
            'trigger' => $this->activityTypes->transitionTriggerForConnector($fromConnector),
            'label' => $this->activityTypes->labelForOutput($fromActivity, $fromConnector),
            'rules' => [],
        ];
    }
}
