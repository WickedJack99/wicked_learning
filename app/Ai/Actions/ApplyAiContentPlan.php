<?php

namespace App\Ai\Actions;

use App\Ai\Validation\ContentPlanValidator;
use App\Learning\Actions\CreateActivityTransition;
use App\Learning\Actions\CreateLearningActivity;
use App\Learning\Actions\CreateLearningMapAsset;
use App\Learning\Services\ActivityStartRouteService;
use App\Learning\Validation\AdminActivityRules;
use App\Learning\Validation\AdminWorldRules;
use App\Models\AiContentAuthoringRun;
use App\Models\LearningActivity;
use App\Models\LearningMapAsset;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ApplyAiContentPlan
{
    public function __construct(
        private readonly ContentPlanValidator $planValidator,
        private readonly AdminWorldRules $worldRules,
        private readonly AdminActivityRules $activityRules,
        private readonly CreateLearningMapAsset $createMapAsset,
        private readonly CreateLearningActivity $createActivity,
        private readonly CreateActivityTransition $createTransition,
        private readonly ActivityStartRouteService $startRoutes,
    ) {}

    public function handle(AiContentAuthoringRun $run, User $user): LearningMapAsset
    {
        return DB::transaction(function () use ($run, $user): LearningMapAsset {
            $run->refresh()->loadMissing('map');
            abort_unless($run->status === 'draft' && $run->applied_at === null, 409);

            $context = $run->context ?? [];
            $brief = $context['brief'] ?? [];
            $allowedTypes = $brief['activityTypes'] ?? null;
            $plan = $this->planValidator->validate(
                $run->plan ?? [],
                $allowedTypes,
            );
            $assetData = $this->assetData($plan);
            Validator::make($assetData, [
                'title' => ['required', 'string', 'max:120'],
                'description' => ['nullable', 'string', 'max:1000'],
                ...$this->worldRules->mapAsset($run->map),
            ])->validate();
            $asset = $this->createMapAsset->handle($run->map, $assetData);
            $activities = [];

            foreach ($plan['activities'] as $index => $activityPlan) {
                $activityData = $this->activityData($activityPlan, $index);
                $activities[] = $this->createActivity->handle(
                    $asset->node,
                    Validator::make(
                        $activityData,
                        $this->activityRules->store($asset->node),
                    )->validate(),
                );
            }

            $this->connectRoute($asset, $activities);
            $run->forceFill([
                'applied_by_user_id' => $user->id,
                'learning_map_asset_id' => $asset->id,
                'status' => 'applied',
                'applied_at' => now(),
            ])->save();

            return $asset->refresh()->load('node.activities');
        });
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function assetData(array $plan): array
    {
        $asset = $plan['mapAsset'];

        return [
            'title' => $asset['title'],
            'description' => $asset['description'] ?? null,
            'image_url' => null,
            'text' => $asset['label'] ?? $asset['title'],
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 14,
            'opacity' => 1,
            'locked' => false,
            'interaction_mode' => 'focusable',
            'interaction_config' => null,
            'visual_config' => null,
            'sound_config' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function activityData(array $plan, int $index): array
    {
        $base = [
            'title' => $plan['title'],
            'type' => $plan['type'],
            'introduction' => $plan['introduction'] ?? null,
            'graph_position_x' => 120 + ($index * 260),
            'graph_position_y' => 80,
        ];

        if ($plan['type'] === 'reflection') {
            return [
                ...$base,
                'reflection_prompt' => $plan['prompt'],
                'reflection_note' => $plan['note'] ?? null,
                'reflection_topic' => null,
                'reflection_subtopic' => null,
            ];
        }

        return [
            ...$base,
            'markdown_pages' => [[
                'id' => 'page-1',
                'title' => $plan['title'],
                'body' => $plan['body'],
                'position' => ['x' => 120, 'y' => 80],
            ]],
            'markdown_transitions' => [
                ['id' => 'edge-start', 'from' => 'start', 'to' => 'page-1'],
                ['id' => 'edge-end', 'from' => 'page-1', 'to' => 'end'],
            ],
            'markdown_graph_layout' => [
                'start' => ['x' => -160, 'y' => 80],
                'end' => ['x' => 520, 'y' => 80],
            ],
        ];
    }

    /** @param list<LearningActivity> $activities */
    private function connectRoute(LearningMapAsset $asset, array $activities): void
    {
        $first = $activities[0];
        $this->startRoutes->addStart($asset->node, $first->id);

        foreach ($activities as $index => $activity) {
            $next = $activities[$index + 1] ?? null;
            $this->createTransition->handle($asset->node, [
                'from_activity_id' => $activity->id,
                'to_activity_id' => $next?->id,
                'from_connector' => 'completed',
                'to_connector' => 'in',
            ]);
        }
    }
}
