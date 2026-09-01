<?php

namespace App\Learning\Actions;

use App\Learning\ActivityTypeRegistry;
use App\Models\ActivityTransition;
use App\Models\User;

class UpdateActivityTransition
{
    public function __construct(
        private readonly ActivityTypeRegistry $activityTypes,
        private readonly RecordLearningActivityVersion $recordVersion,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(ActivityTransition $transition, array $data, ?User $user = null): ActivityTransition
    {
        $transition->loadMissing('fromActivity', 'toActivity');

        $label = trim((string) ($data['label'] ?? ''));
        $triggerValue = $transition->trigger === 'outcome'
            ? trim((string) ($data['trigger_value'] ?? ''))
            : '';

        $updates = [
            'label' => $label !== ''
                ? $label
                : $transition->toActivity?->title
                    ?? $this->activityTypes->labelForOutput(
                        $transition->fromActivity,
                        (string) $transition->from_connector,
                    ),
            'trigger_value' => $triggerValue !== '' ? $triggerValue : null,
        ];

        $changed = $transition->label !== $updates['label']
            || $transition->trigger_value !== $updates['trigger_value'];

        if ($user instanceof User && $changed) {
            $this->recordVersion->handle($user, $transition->fromActivity);
        }

        $transition->update($updates);

        return $transition->refresh();
    }
}
