<?php

namespace App\Http\Controllers;

use App\Models\ActivityTransition;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerQuestionAnswer;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\LearningWorld;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class LearningWorldController extends Controller
{
    /**
     * Show the first explorable learning world.
     */
    public function show(Request $request): Response
    {
        $world = LearningWorld::query()
            ->with([
                'maps.nodes.activities.dialogueStages',
                'maps.nodes.activities.question.options',
                'maps.nodes.activities.transitions',
                'maps.nodes.activityStarts.activity',
                'maps.nodes.outgoingPortalLinks.targetNode.map',
            ])
            ->where('slug', 'demo-cybersecurity')
            ->first();

        return Inertia::render('world', [
            'bookmarkedNodeIds' => $this->bookmarkedNodeIds($request),
            'world' => $world ? $this->serializeWorld($world) : null,
            'progress' => $this->serializeProgress($request),
        ]);
    }

    /**
     * Play one node's activity graph away from the map surface.
     */
    public function play(Request $request, LearningNode $node): Response
    {
        $node->loadMissing([
            'map.world',
            'activities.dialogueStages',
            'activities.question.options',
            'activities.transitions',
            'activityStarts.activity',
            'outgoingPortalLinks.targetNode.map',
        ]);

        abort_if($node->state === 'hidden' || $node->state === 'locked', 404);

        return Inertia::render('learning/node-play', [
            'node' => $this->serializeNode($node),
            'progress' => $this->serializeProgress($request),
        ]);
    }

    /**
     * Store that the learner reached or completed an activity.
     */
    public function markActivity(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:reached,completed'],
        ]);

        $progress = LearnerActivityProgress::query()->firstOrNew([
            'user_id' => $request->user()->id,
            'learning_activity_id' => $activity->id,
        ]);

        $now = Carbon::now();
        $progress->learning_node_id = $activity->learning_node_id;
        $progress->status = $data['status'] === 'completed' ? 'completed' : ($progress->status ?: 'reached');
        $progress->reached_at ??= $now;

        if (! $progress->exists) {
            $progress->attempt_count = 1;
        }

        if ($data['status'] === 'completed') {
            $progress->completed_at ??= $now;
        }

        $progress->save();

        return response()->json([
            'progress' => [
                'activityId' => $activity->id,
                'status' => $progress->status,
                'completedAt' => $progress->completed_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Store one multiple-choice answer and return informational feedback.
     */
    public function answerQuestion(Request $request, LearningQuestion $question): JsonResponse
    {
        $data = $request->validate([
            'option_id' => ['required', 'integer'],
        ]);

        $question->loadMissing('activity.node', 'activity.transitions', 'options');

        $option = LearningQuestionOption::query()
            ->where('learning_question_id', $question->id)
            ->findOrFail($data['option_id']);

        $feedback = $option->feedback
            ?: ($option->is_correct ? $question->feedback_correct : $question->feedback_incorrect);

        LearnerQuestionAnswer::query()->create([
            'user_id' => $request->user()->id,
            'learning_question_id' => $question->id,
            'learning_question_option_id' => $option->id,
            'is_correct' => $option->is_correct,
            'selected_option_ids' => [$option->id],
            'feedback' => $feedback,
        ]);

        LearnerActivityProgress::query()->updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'learning_activity_id' => $question->activity->id,
            ],
            [
                'learning_node_id' => $question->activity->learning_node_id,
                'status' => 'completed',
                'reached_at' => Carbon::now(),
                'completed_at' => Carbon::now(),
            ],
        );

        $transition = $this->findQuestionTransition($question, $option);

        return response()->json([
            'answer' => [
                'questionId' => $question->id,
                'optionId' => $option->id,
                'isCorrect' => $option->is_correct,
                'feedback' => $feedback,
                'explanation' => $question->explanation,
                'nextActivityId' => $transition?->to_activity_id,
            ],
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'query' => ['required', 'string', 'min:1', 'max:80'],
        ]);
        $query = trim((string) $data['query']);

        $maps = LearningMap::query()
            ->whereHas('world', fn ($worldQuery) => $worldQuery->where('slug', 'demo-cybersecurity'))
            ->where(function ($mapQuery) use ($query): void {
                $mapQuery
                    ->where('title', 'like', "%{$query}%")
                    ->orWhere('description', 'like', "%{$query}%")
                    ->orWhere('slug', 'like', "%{$query}%");
            })
            ->limit(8)
            ->get()
            ->map(fn (LearningMap $map): array => [
                'id' => "map:{$map->id}",
                'kind' => 'map',
                'mapId' => $map->id,
                'mapSlug' => $map->slug,
                'subtitle' => 'World map',
                'title' => $map->title,
            ]);

        $nodes = LearningNode::query()
            ->with('map')
            ->where('state', '!=', 'hidden')
            ->whereHas('map.world', fn ($worldQuery) => $worldQuery->where('slug', 'demo-cybersecurity'))
            ->where(function ($nodeQuery) use ($query): void {
                $nodeQuery
                    ->where('title', 'like', "%{$query}%")
                    ->orWhere('description', 'like', "%{$query}%")
                    ->orWhere('slug', 'like', "%{$query}%")
                    ->orWhereHas('map', fn ($mapQuery) => $mapQuery->where('title', 'like', "%{$query}%"));
            })
            ->limit(32)
            ->get()
            ->filter(fn (LearningNode $node): bool => ($node->visual_config['hideEmptySpace'] ?? false) !== true)
            ->take(24)
            ->map(fn (LearningNode $node): array => [
                'id' => "node:{$node->id}",
                'kind' => 'node',
                'mapId' => $node->map->id,
                'mapSlug' => $node->map->slug,
                'nodeId' => $node->id,
                'nodeSlug' => $node->slug,
                'subtitle' => $node->map->title.($node->state === 'locked' ? ' - locked' : ''),
                'title' => $node->title,
            ]);

        return response()->json([
            'results' => $maps->concat($nodes)->values(),
        ]);
    }

    /**
     * Convert Eloquent models into frontend-friendly arrays.
     *
     * @return array<string, mixed>
     */
    private function serializeWorld(LearningWorld $world): array
    {
        return [
            'id' => $world->id,
            'slug' => $world->slug,
            'title' => $world->title,
            'description' => $world->description,
            'themeConfig' => $world->theme_config ?? [],
            'maps' => $world->maps->map(fn ($map) => [
                'id' => $map->id,
                'slug' => $map->slug,
                'title' => $map->title,
                'description' => $map->description,
                'backgroundConfig' => $map->background_config ?? [],
                'gridConfig' => $map->grid_config ?? [],
                'nodes' => $map->nodes
                    ->sortBy([['position_q', 'asc'], ['position_r', 'asc']])
                    ->values()
                    ->map(fn (LearningNode $node) => $this->serializeNode($node))
                    ->values(),
            ])->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeNode(LearningNode $node): array
    {
        $node->loadMissing([
            'map',
            'activities.dialogueStages',
            'activities.question.options',
            'activities.transitions',
            'outgoingPortalLinks.targetNode.map',
        ]);

        return [
            'id' => $node->id,
            'mapId' => $node->map->id,
            'mapSlug' => $node->map->slug,
            'mapTitle' => $node->map->title,
            'slug' => $node->slug,
            'title' => $node->title,
            'description' => $node->description,
            'position' => [
                'q' => $node->position_q,
                'r' => $node->position_r,
            ],
            'state' => $node->state,
            'visualConfig' => $node->visual_config ?? [],
            'outgoingPortalLinks' => $node->outgoingPortalLinks->map(fn ($link) => [
                'id' => $link->id,
                'label' => $link->label,
                'description' => $link->description,
                'sourceActivityId' => $link->source_learning_activity_id,
                'targetActivityId' => $link->target_learning_activity_id,
                'targetMapId' => $link->targetNode->map->id,
                'targetMapSlug' => $link->targetNode->map->slug,
                'targetMapTitle' => $link->targetNode->map->title,
                'targetNodeId' => $link->targetNode->id,
                'targetNodeSlug' => $link->targetNode->slug,
                'targetNodeTitle' => $link->targetNode->title,
            ])->values(),
            'startActivityId' => $this->eligibleStartActivityId($node),
            'startRoutes' => $node->activityStarts
                ->filter(fn (LearningActivityStart $start): bool => $this->canStartRoute($start->activity))
                ->map(fn (LearningActivityStart $start) => [
                    'id' => $start->id,
                    'activityId' => $start->learning_activity_id,
                    'buttonBorderColorDark' => $start->button_border_color_dark,
                    'buttonBorderColorLight' => $start->button_border_color_light,
                    'buttonColorDark' => $start->button_color_dark,
                    'buttonColorLight' => $start->button_color_light,
                    'imageDark' => $start->image_dark,
                    'imageLight' => $start->image_light,
                    'label' => $start->label ?: $start->activity->title,
                    'sortOrder' => $start->sort_order,
                ])->values(),
            'activities' => $node->activities->map(fn (LearningActivity $activity) => [
                'id' => $activity->id,
                'slug' => $activity->slug,
                'type' => $activity->type,
                'title' => $activity->title,
                'introduction' => $activity->introduction,
                'config' => $activity->config ?? [],
                'dialogueStages' => $activity->dialogueStages->map(fn ($stage) => [
                    'id' => $stage->id,
                    'key' => $stage->stage_key,
                    'speakerName' => $stage->speaker_name,
                    'speakerRole' => $stage->speaker_role,
                    'body' => $stage->body,
                    'portraitUrl' => $stage->portrait_url,
                    'imageAlt' => $stage->image_alt,
                    'mood' => $stage->mood,
                    'visualConfig' => $stage->visual_config ?? [],
                ])->values(),
                'question' => $activity->question ? [
                    'id' => $activity->question->id,
                    'prompt' => $activity->question->prompt,
                    'allowMultiple' => $activity->question->allow_multiple,
                    'options' => $activity->question->options->map(fn ($option) => [
                        'id' => $option->id,
                        'label' => $option->label,
                        'body' => $option->body,
                        'outcomeKey' => $option->outcome_key,
                        'weights' => $option->weights ?? [],
                    ])->values(),
                ] : null,
                'transitions' => $activity->transitions->map(fn ($transition) => [
                    'id' => $transition->id,
                    'toActivityId' => $transition->to_activity_id,
                    'fromConnector' => $transition->from_connector ?? $transition->trigger,
                    'toConnector' => $transition->to_connector ?? 'in',
                    'trigger' => $transition->trigger,
                    'triggerValue' => $transition->trigger_value,
                    'label' => $transition->label,
                ])->values(),
            ])->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeProgress(Request $request): array
    {
        $user = $request->user();

        $activities = LearnerActivityProgress::query()
            ->where('user_id', $user->id)
            ->get()
            ->mapWithKeys(fn ($progress) => [
                $progress->learning_activity_id => [
                    'status' => $progress->status,
                    'completedAt' => $progress->completed_at?->toIso8601String(),
                ],
            ]);

        $answers = LearnerQuestionAnswer::query()
            ->where('user_id', $user->id)
            ->latest()
            ->get()
            ->unique('learning_question_id')
            ->mapWithKeys(fn ($answer) => [
                $answer->learning_question_id => [
                    'optionId' => $answer->learning_question_option_id,
                    'isCorrect' => $answer->is_correct,
                    'feedback' => $answer->feedback,
                ],
            ]);

        return [
            'activities' => $activities,
            'answers' => $answers,
        ];
    }

    /**
     * @return array<int, int>
     */
    private function bookmarkedNodeIds(Request $request): array
    {
        return LearningNodeBookmark::query()
            ->where('user_id', $request->user()->id)
            ->pluck('learning_node_id')
            ->map(fn (int $nodeId): int => $nodeId)
            ->all();
    }

    private function findQuestionTransition(LearningQuestion $question, LearningQuestionOption $option): ?ActivityTransition
    {
        $trigger = $option->is_correct ? 'correct' : 'incorrect';

        return $question->activity->transitions
            ->first(fn ($transition) => $transition->trigger === 'outcome' && $transition->trigger_value === $option->outcome_key)
            ?: $question->activity->transitions->first(fn ($transition) => $transition->trigger === $trigger);
    }

    private function eligibleStartActivityId(LearningNode $node): ?int
    {
        $node->loadMissing('activities');

        $activity = $node->activities
            ->first(fn (LearningActivity $activity): bool => $activity->id === $node->start_activity_id);

        return $activity && $this->canStartRoute($activity) ? $activity->id : null;
    }

    private function canStartRoute(?LearningActivity $activity): bool
    {
        if (! $activity) {
            return false;
        }

        $config = is_array($activity->config) ? $activity->config : [];

        return $activity->type !== 'portal' || ($config['portalMode'] ?? 'output') !== 'input';
    }
}
