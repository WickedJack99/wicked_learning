<?php

namespace App\Ai\Validation;

use App\ContentApi\ContentPlanContract;
use App\Models\LearningMap;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ContentPlanValidator
{
    /**
     * @param  array<string, mixed>  $plan
     * @param  list<string>|null  $allowedActivityTypes
     * @return array<string, mixed>
     */
    public function validate(array $plan, ?array $allowedActivityTypes = null): array
    {
        $activityTypes = $allowedActivityTypes ?: ContentPlanContract::ACTIVITY_TYPES;
        $validator = Validator::make($plan, [
            'summary' => ['required', 'string', 'max:1200'],
            'mapAsset' => ['required', 'array'],
            'mapAsset.title' => ['required', 'string', 'max:120'],
            'mapAsset.description' => ['nullable', 'string', 'max:1000'],
            'mapAsset.label' => ['nullable', 'string', 'max:80'],
            'activities' => ['required', 'array', 'min:1', 'max:3'],
            'activities.*' => ['required', 'array'],
            'activities.*.type' => ['required', 'string', Rule::in($activityTypes)],
            'activities.*.title' => ['required', 'string', 'max:120'],
            'activities.*.introduction' => ['nullable', 'string', 'max:1000'],
            'activities.*.body' => ['nullable', 'string', 'max:12000'],
            'activities.*.prompt' => ['nullable', 'string', 'max:4000'],
            'activities.*.note' => ['nullable', 'string', 'max:2000'],
            'activities.*.topic' => ['nullable', 'string', 'max:120'],
            'activities.*.inputLabel' => ['nullable', 'string', 'max:120'],
        ]);
        $validator->after(function ($validator) use ($plan): void {
            $activities = is_array($plan['activities'] ?? null) ? $plan['activities'] : [];

            foreach ($activities as $index => $activity) {
                if (! is_array($activity)) {
                    continue;
                }

                if (($activity['type'] ?? null) === 'markdown' && blank($activity['body'] ?? null)) {
                    $validator->errors()->add(
                        "activities.{$index}.body",
                        'Markdown activities need readable page content.',
                    );
                }

                if (($activity['type'] ?? null) === 'reflection' && blank($activity['prompt'] ?? null)) {
                    $validator->errors()->add(
                        "activities.{$index}.prompt",
                        'Reflection activities need a learner prompt.',
                    );
                }

                if (($activity['type'] ?? null) === 'message_prompt') {
                    if (blank($activity['prompt'] ?? null)) {
                        $validator->errors()->add(
                            "activities.{$index}.prompt",
                            'Message prompts need an invitation for learner contributions.',
                        );
                    }

                    if (blank($activity['topic'] ?? null)) {
                        $validator->errors()->add(
                            "activities.{$index}.topic",
                            'Message prompts need a shared topic.',
                        );
                    }
                }
            }
        });

        $validated = $validator->validate();

        return $validated;
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return list<string>
     */
    public function warnings(LearningMap $map, array $plan): array
    {
        $warnings = [];
        $title = trim((string) ($plan['mapAsset']['title'] ?? ''));

        if ($title !== '' && $map->nodes()->whereRaw('LOWER(title) = ?', [mb_strtolower($title)])->exists()) {
            $warnings[] = 'A MapAsset with the same title already exists on this map.';
        }

        if ($map->assets()
            ->whereBetween('position_x', [45, 55])
            ->whereBetween('position_y', [45, 55])
            ->exists()) {
            $warnings[] = 'The center of this map already contains a MapAsset. Move the new draft after applying it.';
        }

        return $warnings;
    }
}
