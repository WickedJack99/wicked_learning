<?php

use App\Models\ActivityTransition;
use App\Models\AiAgentTemplate;
use App\Models\AiContentAuthoringRun;
use App\Models\AiProviderCredential;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

test('an administrator can generate review and atomically apply a content plan', function () {
    $admin = aiAuthoringUser();
    [$map, $template] = aiAuthoringContext($admin);
    Http::fake([
        'https://api.openai.com/v1/responses' => Http::response([
            'id' => 'resp_content_plan',
            'output_text' => json_encode(aiContentPlan()),
            'usage' => [
                'input_tokens' => 450,
                'output_tokens' => 220,
                'total_tokens' => 670,
            ],
        ]),
    ]);

    $generateResponse = $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.ai-content-plans.generate', $map), [
            'template_id' => $template->id,
            'goal' => 'Help learners distinguish stored and transferred energy.',
            'target_audience' => 'First-year engineering students',
            'prior_knowledge' => 'Basic mechanical systems',
            'route_length' => 2,
            'activity_types' => ['markdown', 'reflection'],
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.plan.mapAsset.title', 'Energy converter')
        ->assertJsonCount(2, 'data.plan.activities');
    $run = AiContentAuthoringRun::query()->findOrFail($generateResponse->json('data.id'));

    Http::assertSent(function (Request $request): bool {
        return $request->url() === 'https://api.openai.com/v1/responses'
            && $request['text']['format']['type'] === 'json_schema'
            && $request['text']['format']['strict'] === true
            && str_contains((string) $request['input'], 'ContentPlan contract');
    });
    expect($run->context['availableCompetenceTopics'])->toContain('Energy systems');

    $this->actingAs($admin)
        ->postJson(route('settings.ai-content-plans.apply', $run))
        ->assertCreated()
        ->assertJsonPath('data.status', 'applied')
        ->assertJsonPath('data.mapAsset.title', 'Energy converter')
        ->assertJsonPath('data.mapAsset.activityCount', 2);

    $asset = LearningMapAsset::query()->with('node.activities')->sole();
    expect($asset->position_x)->toEqual(50)
        ->and($asset->position_y)->toEqual(50)
        ->and($asset->node->activities)->toHaveCount(2)
        ->and($asset->node->activityStarts)->toHaveCount(1)
        ->and($asset->node->start_activity_id)->toBe($asset->node->activities->first()->id)
        ->and(ActivityTransition::query()->count())->toBe(2)
        ->and(AiContentAuthoringRun::query()->sole()->status)->toBe('applied');

    expect($asset->node->activities->first()->config['competenceTopics'])->toBe([
        ['topic' => 'Energy systems', 'slug' => 'energy-systems', 'weight' => 1],
    ])
        ->and($asset->node->activities->first()->config['learningIntent'])->toBe('explain');

    $this->actingAs($admin)
        ->postJson(route('settings.ai-content-plans.apply', $run))
        ->assertConflict();

    expect(LearningMapAsset::query()->count())->toBe(1)
        ->and(LearningActivity::query()->count())->toBe(2);
});

test('content plans reject unsupported or semantically incomplete activities', function () {
    $admin = aiAuthoringUser();
    [$map, $template] = aiAuthoringContext($admin);
    $plan = aiContentPlan();
    $plan['activities'][0]['body'] = null;
    Http::fake([
        'https://api.openai.com/v1/responses' => Http::response([
            'id' => 'resp_invalid_plan',
            'output_text' => json_encode($plan),
        ]),
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.ai-content-plans.generate', $map), [
            'template_id' => $template->id,
            'goal' => 'Explain energy conversion.',
            'route_length' => 2,
            'activity_types' => ['markdown', 'reflection'],
        ])
        ->assertUnprocessable()
        ->assertJsonFragment([
            'Markdown activities need readable page content.',
        ]);

    expect(AiContentAuthoringRun::query()->count())->toBe(0)
        ->and(LearningMapAsset::query()->count())->toBe(0);
});

test('an administrator can include a learner message prompt in a content plan', function () {
    $admin = aiAuthoringUser();
    [$map, $template] = aiAuthoringContext($admin);
    Http::fake([
        'https://api.openai.com/v1/responses' => Http::response([
            'id' => 'resp_message_prompt',
            'output_text' => json_encode(messageContentPlan()),
            'usage' => [
                'input_tokens' => 300,
                'output_tokens' => 140,
                'total_tokens' => 440,
            ],
        ]),
    ]);

    $generateResponse = $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.ai-content-plans.generate', $map), [
            'template_id' => $template->id,
            'goal' => 'Help learners share observations about energy conversion.',
            'route_length' => 1,
            'activity_types' => ['message_prompt'],
        ])
        ->assertCreated()
        ->assertJsonPath('data.plan.activities.0.type', 'message_prompt');
    $run = AiContentAuthoringRun::query()->findOrFail($generateResponse->json('data.id'));

    $this->actingAs($admin)
        ->postJson(route('settings.ai-content-plans.apply', $run))
        ->assertCreated()
        ->assertJsonPath('data.mapAsset.activityCount', 1);

    $activity = LearningActivity::query()->sole();
    $asset = LearningMapAsset::query()->sole();
    $topic = $asset->messageTopics()->sole();

    expect($activity->type)->toBe('message_prompt')
        ->and($activity->config['messagePrompt'])->toBe('What did you notice in the energy path?')
        ->and($activity->config['messageInputLabel'])->toBe('Share an observation')
        ->and($activity->config['competenceTopics'][0]['topic'])->toBe('Energy conversion')
        ->and($activity->config['learningIntent'])->toBe('explain')
        ->and($topic->title)->toBe('Energy observations');
});

test('an administrator can include a shared task in a content plan', function () {
    $admin = aiAuthoringUser();
    [$map, $template] = aiAuthoringContext($admin);
    Http::fake([
        'https://api.openai.com/v1/responses' => Http::response([
            'id' => 'resp_shared_task',
            'output_text' => json_encode(sharedTaskContentPlan()),
        ]),
    ]);

    $generateResponse = $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.ai-content-plans.generate', $map), [
            'template_id' => $template->id,
            'goal' => 'Help learners build a shared vocabulary for energy conversion.',
            'route_length' => 1,
            'activity_types' => ['shared_task'],
        ])
        ->assertCreated()
        ->assertJsonPath('data.plan.activities.0.type', 'shared_task');
    $run = AiContentAuthoringRun::query()->findOrFail($generateResponse->json('data.id'));

    $this->actingAs($admin)
        ->postJson(route('settings.ai-content-plans.apply', $run))
        ->assertCreated()
        ->assertJsonPath('data.mapAsset.activityCount', 1);

    $activity = LearningActivity::query()->sole();

    expect($activity->type)->toBe('shared_task')
        ->and($activity->config['prompt'])->toBe('What useful observation could another learner build on?')
        ->and($activity->config['instructions'])->toBe('Write one concrete observation and explain why it matters.')
        ->and($activity->config['inputLabel'])->toBe('Add an observation')
        ->and($activity->config['minimumLength'])->toBe(20)
        ->and($activity->config['validationMode'])->toBe('minimum_length')
        ->and($activity->config['competenceTopics'][0]['topic'])->toBe('Energy systems')
        ->and($activity->config['learningIntent'])->toBe('explain');
});

test('only the administrator who generated a draft can apply it', function () {
    $creator = aiAuthoringUser();
    $otherAdmin = aiAuthoringUser();
    [$map, $template] = aiAuthoringContext($creator);
    $run = AiContentAuthoringRun::query()->create([
        'learning_map_id' => $map->id,
        'ai_agent_template_id' => $template->id,
        'created_by_user_id' => $creator->id,
        'contract_version' => '1.1:1.0',
        'prompt' => 'Test prompt',
        'context' => ['brief' => ['activityTypes' => ['markdown', 'reflection']]],
        'plan' => aiContentPlan(),
        'warnings' => [],
        'provider' => 'openai',
        'model' => 'gpt-5.6-terra',
        'status' => 'draft',
    ]);

    $this->actingAs($otherAdmin)
        ->postJson(route('settings.ai-content-plans.apply', $run))
        ->assertForbidden();

    expect(LearningMapAsset::query()->count())->toBe(0);
});

function aiAuthoringUser(): User
{
    return User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
}

/** @return array{LearningMap, AiAgentTemplate} */
function aiAuthoringContext(User $admin): array
{
    $world = LearningWorld::query()->create([
        'slug' => 'authoring-world',
        'title' => 'Authoring World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'created_by_user_id' => $admin->id,
        'slug' => 'energy-map',
        'title' => 'Energy systems',
        'description' => 'A map about connected energy systems.',
    ]);
    $credential = AiProviderCredential::query()->create([
        'label' => 'OpenAI authoring',
        'provider' => 'openai',
        'api_key' => 'test-provider-key',
        'api_key_last_four' => 'r-key',
        'enabled' => true,
    ]);
    $template = AiAgentTemplate::query()->create([
        'ai_provider_credential_id' => $credential->id,
        'created_by_user_id' => $admin->id,
        'name' => 'Content author',
        'slug' => 'content-author',
        'purpose' => 'content_authoring',
        'model' => 'gpt-5.6-terra',
        'system_prompt' => 'Write concise learning content.',
        'reasoning_effort' => 'medium',
        'enabled' => true,
        'guarded_context' => true,
    ]);
    CompetenceTopicDefinition::query()->create([
        'name' => 'Energy systems',
        'slug' => 'energy-systems',
        'description' => 'Energy relationships in connected systems.',
        'is_active' => true,
    ]);

    return [$map, $template];
}

/** @return array<string, mixed> */
function aiContentPlan(): array
{
    return [
        'summary' => 'A short explanation followed by a learner-owned reflection.',
        'mapAsset' => [
            'title' => 'Energy converter',
            'description' => 'A component that changes energy from one form to another.',
            'label' => 'Energy converter',
        ],
        'activities' => [
            [
                'type' => 'markdown',
                'title' => 'Follow the energy',
                'introduction' => 'Trace the system from input to output.',
                'body' => '## Energy path\n\nObserve where energy enters and how its form changes.',
                'prompt' => null,
                'note' => null,
                'topic' => null,
                'inputLabel' => null,
                'competenceTopics' => ['Energy systems'],
                'learningIntent' => 'explain',
            ],
            [
                'type' => 'reflection',
                'title' => 'Explain the conversion',
                'introduction' => 'Connect the visible system to the underlying principle.',
                'body' => null,
                'prompt' => 'Which energy forms can you identify before and after the conversion?',
                'note' => 'Name both the input and output.',
                'topic' => null,
                'inputLabel' => null,
                'competenceTopics' => ['Energy systems'],
                'learningIntent' => 'explain',
            ],
        ],
    ];
}

/** @return array<string, mixed> */
function messageContentPlan(): array
{
    return [
        'summary' => 'A shared observation prompt that invites learners to notice the system together.',
        'mapAsset' => [
            'title' => 'Energy observations',
            'description' => 'A place to compare observations about energy conversion.',
            'label' => 'Share an observation',
        ],
        'activities' => [[
            'type' => 'message_prompt',
            'title' => 'Share an observation',
            'introduction' => 'Add one detail that another learner could build on.',
            'body' => null,
            'prompt' => 'What did you notice in the energy path?',
            'note' => null,
            'topic' => 'Energy observations',
            'inputLabel' => 'Share an observation',
            'competenceTopics' => ['Energy conversion'],
            'learningIntent' => 'explain',
        ]],
    ];
}

/** @return array<string, mixed> */
function sharedTaskContentPlan(): array
{
    return [
        'summary' => 'A shared contribution prompt that lets learners build on one another\'s observations.',
        'mapAsset' => [
            'title' => 'Shared energy notes',
            'description' => 'A place for learners to connect observations about energy conversion.',
            'label' => 'Build the shared explanation',
        ],
        'activities' => [[
            'type' => 'shared_task',
            'title' => 'Add an observation',
            'introduction' => 'Contribute one detail that helps the group notice the system more clearly.',
            'body' => null,
            'prompt' => 'What useful observation could another learner build on?',
            'note' => 'Write one concrete observation and explain why it matters.',
            'topic' => null,
            'inputLabel' => 'Add an observation',
            'competenceTopics' => ['Energy systems'],
            'learningIntent' => 'explain',
        ]],
    ];
}
