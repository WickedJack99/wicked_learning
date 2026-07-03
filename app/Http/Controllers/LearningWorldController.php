<?php

namespace App\Http\Controllers;

use App\Models\ActivityTransition;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerQuestionAnswer;
use App\Models\LearningActivity;
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
            ])
            ->where('slug', 'demo-cybersecurity')
            ->first();

        return Inertia::render('world', [
            'world' => $world ? $this->serializeWorld($world) : null,
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
                    ->map(fn ($node) => [
                        'id' => $node->id,
                        'slug' => $node->slug,
                        'title' => $node->title,
                        'description' => $node->description,
                        'position' => [
                            'q' => $node->position_q,
                            'r' => $node->position_r,
                        ],
                        'state' => $node->state,
                        'visualConfig' => $node->visual_config ?? [],
                        'startActivityId' => $node->start_activity_id,
                        'activities' => $node->activities->map(fn ($activity) => [
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
                                'trigger' => $transition->trigger,
                                'triggerValue' => $transition->trigger_value,
                                'label' => $transition->label,
                            ])->values(),
                        ])->values(),
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

    private function findQuestionTransition(LearningQuestion $question, LearningQuestionOption $option): ?ActivityTransition
    {
        $trigger = $option->is_correct ? 'correct' : 'incorrect';

        return $question->activity->transitions
            ->first(fn ($transition) => $transition->trigger === 'outcome' && $transition->trigger_value === $option->outcome_key)
            ?: $question->activity->transitions->first(fn ($transition) => $transition->trigger === $trigger);
    }
}
