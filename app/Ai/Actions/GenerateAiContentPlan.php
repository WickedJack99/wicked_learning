<?php

namespace App\Ai\Actions;

use App\Ai\Validation\ContentPlanValidator;
use App\ContentApi\ContentApiContract;
use App\ContentApi\ContentPlanContract;
use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Models\AiAgentTemplate;
use App\Models\AiContentAuthoringRun;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;

class GenerateAiContentPlan
{
    public function __construct(
        private readonly RunAiAgentTemplate $runner,
        private readonly ContentPlanContract $planContract,
        private readonly ContentPlanValidator $validator,
        private readonly LoadCompetenceTopicDefinitions $competenceTopics,
    ) {}

    /**
     * @param  array<string, mixed>  $brief
     */
    public function handle(
        LearningMap $map,
        AiAgentTemplate $template,
        User $user,
        array $brief,
    ): AiContentAuthoringRun {
        $context = $this->mapContext($map, $brief);
        $prompt = $this->prompt($brief, $context);
        $result = $this->runner->handle(
            $template,
            $prompt,
            $this->planContract->responseFormat(),
        );
        $plan = json_decode($result['text'], true);

        if (! is_array($plan)) {
            $this->fail('The AI returned a response that was not a valid ContentPlan.');
        }

        $allowedTypes = array_values($brief['activity_types']);
        $plan = $this->validator->validate($plan, $allowedTypes);

        if (count($plan['activities']) !== (int) $brief['route_length']) {
            $this->fail('The AI returned a different number of Activities than requested. Generate a new draft.');
        }

        return AiContentAuthoringRun::query()->create([
            'learning_map_id' => $map->id,
            'ai_agent_template_id' => $template->id,
            'created_by_user_id' => $user->id,
            'contract_version' => ContentApiContract::VERSION.':'.ContentPlanContract::VERSION,
            'prompt' => $prompt,
            'context' => $context,
            'plan' => $plan,
            'warnings' => $this->validator->warnings($map, $plan),
            'provider' => $result['provider'],
            'model' => $result['model'],
            'provider_response_id' => $result['responseId'],
            'provider_request_id' => $result['requestId'],
            'input_tokens' => $result['usage']['inputTokens'],
            'output_tokens' => $result['usage']['outputTokens'],
            'total_tokens' => $result['usage']['totalTokens'],
            'status' => 'draft',
        ]);
    }

    /**
     * @param  array<string, mixed>  $brief
     * @return array<string, mixed>
     */
    private function mapContext(LearningMap $map, array $brief): array
    {
        return [
            'map' => [
                'id' => $map->id,
                'title' => $map->title,
                'description' => $map->description,
            ],
            'existingMapAssets' => $map->assets()
                ->with('node:id,title,description')
                ->get()
                ->map(fn (LearningMapAsset $asset): array => [
                    'title' => $asset->node->title,
                    'description' => $asset->node->description,
                    'positionX' => $asset->position_x,
                    'positionY' => $asset->position_y,
                ])
                ->values()
                ->all(),
            'availableCompetenceTopics' => $this->competenceTopics->names(),
            'brief' => [
                'goal' => $brief['goal'],
                'targetAudience' => $brief['target_audience'] ?? null,
                'priorKnowledge' => $brief['prior_knowledge'] ?? null,
                'routeLength' => $brief['route_length'],
                'activityTypes' => array_values($brief['activity_types']),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $brief
     * @param  array<string, mixed>  $context
     */
    private function prompt(array $brief, array $context): string
    {
        return implode("\n\n", [
            'Draft one MapAsset and a short linear learning route for Wicked Learning.',
            'This is a draft only. An administrator will review it before anything is created.',
            'Use exactly '.(int) $brief['route_length'].' Activities and only these Activity types: '.implode(', ', $brief['activity_types']).'.',
            'For every Activity, provide one to three concise competenceTopics labels drawn from the learning goal, and choose one learningIntent from apply, explain, participate, reflect, retrieve, review or transfer. Reuse an available competence topic label exactly when it fits; propose a concise new label only when none fits. These are teaching design metadata, not learner scores, and you must not output topic weights or thresholds. For markdown Activities, set body and use null for prompt, note, topic and inputLabel. For reflection Activities, set prompt, optionally note, and use null for body, topic and inputLabel. For message_prompt Activities, set prompt, topic and optionally inputLabel, and use null for body and note. For shared_task Activities, set prompt, optionally note and inputLabel, use null for body and topic, and invite a concrete learner contribution without scores or rankings. For open_practice Activities, set prompt to a concrete invitation for a learner-owned next step, and use null for body, note, topic and inputLabel.',
            'Do not invent image paths, user data, IDs, scores, rewards, rankings, or claims about learner performance.',
            'Keep the route supportive, concrete, and appropriate for the stated audience and prior knowledge.',
            'Map and authoring context:\n'.json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'ContentPlan contract:\n'.json_encode($this->planContract->document(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]);
    }

    private function fail(string $message): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => ['plan' => [$message]],
        ], 422));
    }
}
