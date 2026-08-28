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
        $toActivity = $this->validatedTargetActivity($node, $data['to_activity_id'] ?? null);
        $this->ensureActivityCanContinue($fromActivity, $toActivity?->id);

        return ActivityTransition::query()->firstOrCreate(
            $this->transitionIdentity($fromActivity, $toActivity?->id, $data),
            $this->transitionDefaults(
                $fromActivity,
                $toActivity,
                (string) $data['from_connector'],
                isset($data['label']) ? (string) $data['label'] : null,
            ),
        );
    }

    private function nodeActivityOrFail(LearningNode $node, int $activityId): LearningActivity
    {
        return LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->whereKey($activityId)
            ->firstOrFail();
    }

    private function validatedTargetActivity(LearningNode $node, mixed $activityId): ?LearningActivity
    {
        if ($activityId === null) {
            return null;
        }

        return $this->nodeActivityOrFail($node, (int) $activityId);
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
    private function transitionDefaults(
        LearningActivity $fromActivity,
        ?LearningActivity $toActivity,
        string $fromConnector,
        ?string $label = null,
    ): array {
        $customLabel = trim((string) $label);

        return [
            'trigger' => $this->activityTypes->transitionTriggerForConnector($fromConnector),
            'label' => $customLabel !== ''
                ? $customLabel
                : ($toActivity?->title ?? $this->activityTypes->labelForOutput($fromActivity, $fromConnector)),
            'rules' => [],
        ];
    }
}
