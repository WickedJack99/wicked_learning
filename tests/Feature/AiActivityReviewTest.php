<?php

use App\Models\ActivityTransition;
use App\Models\AiAgentTemplate;
use App\Models\AiProviderCredential;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

test('an administrator can request a scoped activity review', function () {
    $admin = activityReviewAdmin();
    [$activity, $template] = activityReviewContext($admin);
    Http::fake([
        'https://api.openai.com/v1/responses' => Http::response([
            'id' => 'resp_activity_review',
            'output_text' => json_encode(activityReviewPayload()),
            'usage' => [
                'input_tokens' => 380,
                'output_tokens' => 240,
                'total_tokens' => 620,
            ],
        ]),
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.ai-review', $activity), [
            'template_id' => $template->id,
        ])
        ->assertOk()
        ->assertJsonPath('data.activityId', $activity->id)
        ->assertJsonPath('data.aiReviewStatus', 'reviewed')
        ->assertJsonPath('data.aiReview.review.summary', 'The activity has a clear reflective purpose.');

    Http::assertSent(function (Request $request): bool {
        $input = (string) $request['input'];

        return $request->url() === 'https://api.openai.com/v1/responses'
            && $request['text']['format']['name'] === 'wicked_learning_activity_review'
            && str_contains($input, 'Activity review context')
            && str_contains($input, 'Observe the changing system')
            && str_contains($input, 'Next reflection')
            && str_contains($input, 'availableCompetenceTopics')
            && str_contains($input, 'Systems Thinking')
            && ! str_contains($input, 'Unrelated private draft');
    });

    expect($activity->refresh()->ai_review_status)->toBe('reviewed')
        ->and($activity->ai_reviewed_at)->not->toBeNull()
        ->and($activity->ai_review['review']['sdt']['autonomy']['signal'])->toBe('supported')
        ->and($activity->ai_review['review']['learningDesign']['purpose']['signal'])->toBe('aligned')
        ->and($activity->ai_review['review']['learningDesign']['suggestedCompetenceTopics'])->toBe(['Systems Thinking']);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Next reflection, revised',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $activity->node));

    expect($activity->refresh()->ai_review_status)->toBe('needs_review')
        ->and($activity->ai_reviewed_at)->toBeNull()
        ->and($activity->ai_review)->toBeNull();
});

test('activity review rejects templates from another AI purpose', function () {
    $admin = activityReviewAdmin();
    [$activity] = activityReviewContext($admin);
    $template = AiAgentTemplate::query()->where('purpose', 'content_authoring')->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.ai-review', $activity), [
            'template_id' => $template->id,
        ])
        ->assertUnprocessable();

    expect($activity->refresh()->ai_review_status)->toBe('needs_review');
});

function activityReviewAdmin(): User
{
    return User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
}

/** @return array{LearningActivity, AiAgentTemplate} */
function activityReviewContext(User $admin): array
{
    CompetenceTopicDefinition::query()->create([
        'name' => 'Systems Thinking',
        'slug' => 'systems-thinking',
        'description' => 'Notice relationships, change and consequences across a system.',
        'is_active' => true,
    ]);

    $world = LearningWorld::query()->create([
        'slug' => 'activity-review-world',
        'title' => 'Activity Review World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'created_by_user_id' => $admin->id,
        'slug' => 'activity-review-map',
        'title' => 'Activity Review Map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'activity-review-node',
        'title' => 'Review Node',
        'description' => 'A node used to test scoped review context.',
        'position_q' => 0,
        'position_r' => 0,
    ]);
    $previous = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'previous-observation',
        'type' => 'markdown',
        'title' => 'Observe the changing system',
        'config' => [],
        'sort_order' => 10,
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'next-reflection',
        'type' => 'reflection',
        'title' => 'Next reflection',
        'introduction' => 'Connect the observation to your own reasoning.',
        'config' => [
            'prompt' => 'What changed in your understanding?',
            'note' => 'You may leave this open if it is still forming.',
            'competenceTopics' => [
                ['topic' => 'Systems Thinking', 'slug' => 'systems-thinking', 'weight' => 1],
            ],
        ],
        'sort_order' => 20,
    ]);
    $farActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'unrelated-private-draft',
        'type' => 'markdown',
        'title' => 'Unrelated private draft',
        'config' => [],
        'sort_order' => 30,
    ]);
    ActivityTransition::query()->create([
        'from_activity_id' => $previous->id,
        'to_activity_id' => $activity->id,
        'trigger' => 'completed',
    ]);
    $credential = AiProviderCredential::query()->create([
        'label' => 'Activity review provider',
        'provider' => 'openai',
        'api_key' => 'test-provider-key',
        'api_key_last_four' => 'r-key',
        'enabled' => true,
    ]);
    $template = AiAgentTemplate::query()->create([
        'ai_provider_credential_id' => $credential->id,
        'created_by_user_id' => $admin->id,
        'name' => 'Activity reviewer',
        'slug' => 'activity-reviewer',
        'purpose' => 'activity_review',
        'model' => 'gpt-5.6-terra',
        'system_prompt' => 'Review activities carefully.',
        'enabled' => true,
        'guarded_context' => true,
    ]);
    AiAgentTemplate::query()->create([
        'ai_provider_credential_id' => $credential->id,
        'created_by_user_id' => $admin->id,
        'name' => 'Content author',
        'slug' => 'activity-review-content-author',
        'purpose' => 'content_authoring',
        'model' => 'gpt-5.6-terra',
        'enabled' => true,
        'guarded_context' => true,
    ]);

    return [$activity, $template];
}

/** @return array<string, mixed> */
function activityReviewPayload(): array
{
    return [
        'summary' => 'The activity has a clear reflective purpose.',
        'strengths' => [
            'The prompt leaves room for learner-owned reflection.',
        ],
        'suggestions' => [
            'Consider adding an optional example for learners who feel stuck.',
        ],
        'sdt' => [
            'autonomy' => ['signal' => 'supported', 'note' => 'The learner can decide what to explore.'],
            'competence' => ['signal' => 'unclear', 'note' => 'The prompt could make the next step more visible.'],
            'relatedness' => ['signal' => 'supported', 'note' => 'The tone is invitational and non-judgmental.'],
        ],
        'learningDesign' => [
            'purpose' => ['signal' => 'aligned', 'note' => 'The prompt gives the learner space to revisit their understanding.'],
            'topics' => ['signal' => 'unclear', 'note' => 'The activity needs a more visible connection to the declared systems-thinking topic.'],
            'suggestedLearningIntent' => null,
            'suggestedCompetenceTopics' => ['Systems Thinking'],
        ],
    ];
}
