<?php

use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;

test('admins can author question content and preserve it in private templates', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Compare two observations',
            'type' => 'question',
            'introduction' => 'Choose the explanation that best fits the evidence.',
            'question_prompt' => 'Which clue should guide the next observation?',
            'question_feedback_correct' => 'That choice follows the strongest clue.',
            'question_feedback_incorrect' => 'Look again at the evidence spread.',
            'question_explanation' => 'A distributed pattern calls for a broader observation.',
            'question_allow_multiple' => false,
            'question_options' => [
                [
                    'label' => 'A',
                    'body' => 'Inspect the spread of observations.',
                    'is_correct' => true,
                    'outcome_key' => 'inspect-spread',
                    'feedback' => 'Good choice.',
                    'weights' => ['pattern_recognition' => 0.9],
                ],
                [
                    'label' => 'B',
                    'body' => 'Assume one local cause immediately.',
                    'is_correct' => false,
                    'outcome_key' => 'local-cause',
                    'feedback' => 'That skips an important clue.',
                    'weights' => ['pattern_recognition' => 0.2],
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'compare-two-observations')
        ->firstOrFail();
    $question = $activity->question()->with('options')->firstOrFail();

    expect($question->prompt)
        ->toBe('Which clue should guide the next observation?')
        ->and($question->options)->toHaveCount(2)
        ->and($question->options->first()->is_correct)->toBeTrue();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => $activity->title,
            'type' => 'question',
            'question_prompt' => 'Which clue should guide the revised observation?',
            'question_feedback_correct' => 'The revised clue still supports that choice.',
            'question_feedback_incorrect' => 'The revised evidence points elsewhere.',
            'question_explanation' => 'Compare the distribution before narrowing the cause.',
            'question_allow_multiple' => true,
            'question_options' => [
                [
                    'label' => 'A',
                    'body' => 'Compare the distribution first.',
                    'is_correct' => true,
                    'outcome_key' => 'compare-distribution',
                    'feedback' => 'That preserves the useful uncertainty.',
                    'weights' => ['pattern_recognition' => 1],
                ],
                [
                    'label' => 'B',
                    'body' => 'Choose a cause before checking the spread.',
                    'is_correct' => false,
                    'outcome_key' => 'choose-cause',
                    'feedback' => 'Check the spread before narrowing.',
                    'weights' => [],
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $question->refresh()->load('options');

    expect($question->prompt)
        ->toBe('Which clue should guide the revised observation?')
        ->and($question->allow_multiple)->toBeTrue()
        ->and($question->options->first()->body)->toBe('Compare the distribution first.');

    $templateId = $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.templates.store', $activity), [
            'name' => 'Observation comparison question',
        ])
        ->assertCreated()
        ->json('template.id');

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.activity-templates.show', $templateId))
        ->assertOk()
        ->assertJsonPath(
            'template.snapshot.question.prompt',
            'Which clue should guide the revised observation?',
        )
        ->assertJsonPath('template.snapshot.question.options.0.isCorrect', true);
});

test('question outcome transitions follow the matching answer key', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'branching-observation',
        'title' => 'Branching observation',
        'type' => 'question',
        'config' => [],
        'sort_order' => 910,
    ]);
    $target = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'observation-follow-up',
        'title' => 'Observation follow-up',
        'type' => 'reflection',
        'config' => [],
        'sort_order' => 920,
    ]);
    $question = $activity->question()->create([
        'prompt' => 'Which route should open?',
    ]);
    $option = $question->options()->create([
        'body' => 'Follow the distributed clue.',
        'is_correct' => true,
        'label' => 'A',
        'outcome_key' => 'follow-distributed-clue',
        'sort_order' => 10,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activity-transitions.store', $node), [
            'from_activity_id' => $activity->id,
            'to_activity_id' => $target->id,
            'from_connector' => 'outcome',
            'to_connector' => 'in',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $transition = ActivityTransition::query()
        ->where('from_activity_id', $activity->id)
        ->where('to_activity_id', $target->id)
        ->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activity-transitions.update', $transition), [
            'label' => 'Follow the distributed clue',
            'trigger_value' => 'follow-distributed-clue',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($transition->refresh()->trigger_value)->toBe('follow-distributed-clue');

    $this->actingAs($learner)
        ->postJson(route('learning.questions.answer', $question), [
            'option_id' => $option->id,
        ])
        ->assertOk()
        ->assertJsonPath('answer.nextActivityId', $target->id)
        ->assertJsonPath('answer.nextTransitionLabel', 'Follow the distributed clue');
});
