<?php

namespace App\Learning\Actions;

use App\Learning\ActivityTypeRegistry;
use App\Models\ActivityTransition;

class UpdateActivityTransition
{
    public function __construct(private readonly ActivityTypeRegistry $activityTypes) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(ActivityTransition $transition, array $data): ActivityTransition
    {
        $transition->loadMissing('fromActivity', 'toActivity');

        $label = trim((string) ($data['label'] ?? ''));
        $triggerValue = $transition->trigger === 'outcome'
            ? trim((string) ($data['trigger_value'] ?? ''))
            : '';

        $transition->update([
            'label' => $label !== ''
                ? $label
                : $transition->toActivity?->title
                    ?? $this->activityTypes->labelForOutput(
                        $transition->fromActivity,
                        (string) $transition->from_connector,
                    ),
            'trigger_value' => $triggerValue !== '' ? $triggerValue : null,
        ]);

        return $transition->refresh();
    }
}
