<?php

use App\Learning\Queries\LoadLearnerMessages;
use App\Learning\Services\MessageActivityConfiguration;
use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMessageTopic;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

beforeEach(function (): void {
    $this->world = LearningWorld::query()->create([
        'slug' => 'message-world',
        'title' => 'Message world',
    ]);
    $this->map = LearningMap::query()->create([
        'learning_world_id' => $this->world->id,
        'slug' => 'message-map',
        'title' => 'Message map',
        'access_roles' => [User::ROLE_USER, User::ROLE_ADMIN],
    ]);
    $this->node = LearningNode::query()->create([
        'learning_map_id' => $this->map->id,
        'slug' => 'message-map-asset',
        'title' => 'Message MapAsset',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $this->mapAsset = LearningMapAsset::query()->create([
        'learning_map_id' => $this->map->id,
        'learning_node_id' => $this->node->id,
        'text' => 'Message MapAsset',
        'position_x' => 50,
        'position_y' => 50,
    ]);
});

test('message activities reuse a map asset topic and persist their ui colors', function () {
    $configuration = app(MessageActivityConfiguration::class);

    $promptConfig = $configuration->fromData($this->node, [
        'message_topic_title' => 'Helpful thoughts',
        'message_prompt_text' => 'What helped you here?',
        'message_audience' => 'support',
        'message_surface_color_dark' => '#102030',
        'message_card_color_light' => '#fefefe',
    ]);

    $topic = LearningMessageTopic::query()->sole();
    $wallConfig = $configuration->fromData($this->node, [
        'message_topic_id' => $topic->id,
        'message_allow_responses' => true,
        'message_response_prompt' => 'Name the clue that changed your interpretation.',
        'message_accent_color_light' => '#123abc',
    ]);

    expect($promptConfig['messageTopicId'])->toBe($topic->id)
        ->and($wallConfig['messageTopicId'])->toBe($topic->id)
        ->and($promptConfig['messageUi']['surfaceColorDark'])->toBe('#102030')
        ->and($promptConfig['messageAudience'])->toBe('support')
        ->and($promptConfig['messageUi']['cardColorLight'])->toBe('#fefefe')
        ->and($wallConfig['messageUi']['accentColorLight'])->toBe('#123abc')
        ->and($wallConfig['messageAllowResponses'])->toBeTrue()
        ->and($wallConfig['messageResponsePrompt'])->toBe('Name the clue that changed your interpretation.')
        ->and($this->mapAsset->messageTopics()->count())->toBe(1);
});

test('admins configure prompt and wall activities through the map asset flow', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $this->node), [
            'title' => 'Invite a helpful thought',
            'type' => 'message_prompt',
            'message_topic_title' => 'Helpful thoughts',
            'message_prompt_text' => 'What would you tell the next learner?',
            'message_audience' => 'support',
            'message_input_label' => 'Your short note',
            'message_surface_color_dark' => '#102030',
            'message_surface_color_light' => '#eafaf6',
            'message_card_color_dark' => '#182f39',
            'message_card_color_light' => '#ffffff',
            'message_card_border_color_dark' => '#34d399',
            'message_card_border_color_light' => '#047857',
            'message_text_color_dark' => '#f8fafc',
            'message_text_color_light' => '#0f172a',
            'message_accent_color_dark' => '#6ee7b7',
            'message_accent_color_light' => '#065f46',
        ])
        ->assertRedirect();

    $topic = LearningMessageTopic::query()->sole();
    $prompt = LearningActivity::query()->where('type', 'message_prompt')->sole();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $this->node), [
            'title' => 'Show helpful thoughts',
            'type' => 'message_wall',
            'message_topic_id' => $topic->id,
            'message_allow_responses' => true,
            'message_response_prompt' => 'Add a useful example or question for the next learner.',
        ])
        ->assertRedirect();

    $wall = LearningActivity::query()->where('type', 'message_wall')->sole();

    expect($prompt->config['messageTopicId'])->toBe($topic->id)
        ->and($prompt->config['messagePrompt'])->toBe('What would you tell the next learner?')
        ->and($prompt->config['messageAudience'])->toBe('support')
        ->and($prompt->config['messageUi']['surfaceColorDark'])->toBe('#102030')
        ->and($wall->config['messageTopicId'])->toBe($topic->id)
        ->and($wall->config['messageAllowResponses'])->toBeTrue()
        ->and($wall->config['messageResponsePrompt'])->toBe('Add a useful example or question for the next learner.')
        ->and($this->mapAsset->messageTopics()->count())->toBe(1);
});

test('a learner contributes once and a message wall only returns visible messages', function () {
    $learner = User::factory()->create();
    $otherLearner = User::factory()->create();
    $topic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $this->mapAsset->id,
        'slug' => 'helpful-thoughts',
        'title' => 'Helpful thoughts',
    ]);
    $prompt = LearningActivity::query()->create([
        'learning_node_id' => $this->node->id,
        'slug' => 'leave-a-message',
        'type' => 'message_prompt',
        'title' => 'Leave a message',
        'config' => ['messageTopicId' => $topic->id],
    ]);
    $wall = LearningActivity::query()->create([
        'learning_node_id' => $this->node->id,
        'slug' => 'message-wall',
        'type' => 'message_wall',
        'title' => 'Message wall',
        'config' => ['messageTopicId' => $topic->id],
    ]);
    LearnerMessage::query()->create([
        'learning_message_topic_id' => $topic->id,
        'user_id' => $otherLearner->id,
        'body' => 'This contribution is hidden.',
        'hidden_at' => now(),
    ]);

    $this->actingAs($learner)
        ->getJson(route('learning.activities.messages.index', $prompt))
        ->assertOk()
        ->assertJsonPath('hasContributed', false);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.messages.store', $prompt), [
            'body' => 'Take your time and inspect the details.',
        ])
        ->assertCreated()
        ->assertJsonPath('hasContributed', true);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.messages.store', $prompt), [
            'body' => 'This replacement must not be stored.',
        ])
        ->assertOk();

    $response = $this->actingAs($learner)
        ->getJson(route('learning.activities.messages.index', $wall))
        ->assertOk()
        ->assertJsonCount(1, 'messages')
        ->assertJsonPath('messages.0.body', 'Take your time and inspect the details.')
        ->json();

    expect($response['messages'][0])->not->toHaveKey('author')
        ->and($topic->messages()->where('user_id', $learner->id)->count())->toBe(1);
});

test('support requests stay out of peer walls and remain visible to learning support', function () {
    $learner = User::factory()->create();
    $supportPrompt = LearningActivity::query()->create([
        'learning_node_id' => $this->node->id,
        'slug' => 'ask-for-help',
        'type' => 'message_prompt',
        'title' => 'Ask for help',
        'config' => [
            'messageTopicId' => $topic = LearningMessageTopic::query()->create([
                'learning_map_asset_id' => $this->mapAsset->id,
                'slug' => 'learning-support',
                'title' => 'Learning support',
            ])->id,
            'messageAudience' => 'support',
        ],
    ]);
    $peerWall = LearningActivity::query()->create([
        'learning_node_id' => $this->node->id,
        'slug' => 'peer-wall',
        'type' => 'message_wall',
        'title' => 'Peer wall',
        'config' => ['messageTopicId' => $topic],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.messages.store', $supportPrompt), [
            'body' => 'I would like a hint about this step.',
        ])
        ->assertCreated()
        ->assertJsonPath('hasContributed', true)
        ->assertJsonCount(1, 'messages')
        ->assertJsonPath('messages.0.body', 'I would like a hint about this step.');

    $this->actingAs($learner)
        ->getJson(route('learning.activities.messages.index', $peerWall))
        ->assertOk()
        ->assertJsonCount(0, 'messages');

    $this->actingAs(User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]))
        ->get(route('settings.index', [
            'panel' => 'admin-learning-support',
            'support' => 'learner-messages',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('learningSupportSettings.learnerMessages.0.messages.0.audience', 'support')
        );
});

test('learners can respond once to an opted-in peer message and support can moderate it', function () {
    $learner = User::factory()->create();
    $otherLearner = User::factory()->create();
    $topic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $this->mapAsset->id,
        'slug' => 'peer-conversation',
        'title' => 'Peer conversation',
    ]);
    $wall = LearningActivity::query()->create([
        'learning_node_id' => $this->node->id,
        'slug' => 'peer-conversation-wall',
        'type' => 'message_wall',
        'title' => 'Peer conversation',
        'config' => [
            'messageTopicId' => $topic->id,
            'messageAllowResponses' => true,
        ],
    ]);
    $message = LearnerMessage::query()->create([
        'learning_message_topic_id' => $topic->id,
        'user_id' => $otherLearner->id,
        'body' => 'The quiet detail helped me notice the pattern.',
        'audience' => 'peers',
    ]);

    $this->actingAs($learner)
        ->getJson(route('learning.activities.messages.index', $wall))
        ->assertOk()
        ->assertJsonPath('messages.0.canRespond', true)
        ->assertJsonPath('messages.0.hasResponded', false)
        ->assertJsonCount(0, 'messages.0.responses');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.messages.responses.store', [$wall, $message]), [
            'body' => 'I noticed that too after slowing down.',
            'response_type' => 'explanation',
        ])
        ->assertCreated()
        ->assertJsonPath('messages.0.hasResponded', true)
        ->assertJsonPath('messages.0.responses.0.body', 'I noticed that too after slowing down.')
        ->assertJsonPath('messages.0.responses.0.responseType', 'explanation')
        ->assertJsonPath('response.responseType', 'explanation');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.messages.responses.store', [$wall, $message]), [
            'body' => 'A second response is not needed.',
        ])
        ->assertOk()
        ->assertJsonCount(1, 'messages.0.responses');

    $response = LearnerMessageResponse::query()->sole();
    expect($response->response_type)->toBe('explanation');
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-learning-support',
            'support' => 'learner-messages',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('learningSupportSettings.learnerMessages.0.messages.0.responses.0.body', 'I noticed that too after slowing down.')
        );

    $this->actingAs($admin)
        ->patch(route('settings.learning-support.message-responses.visibility.update', $response), [
            'hidden' => true,
        ])
        ->assertRedirect();

    expect($response->refresh()->hidden_at)->not->toBeNull();
});

test('learner message responses reject unsupported response types', function () {
    $learner = User::factory()->create();
    $otherLearner = User::factory()->create();
    $topic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $this->mapAsset->id,
        'slug' => 'typed-peer-conversation',
        'title' => 'Typed peer conversation',
    ]);
    $wall = LearningActivity::query()->create([
        'learning_node_id' => $this->node->id,
        'slug' => 'typed-peer-conversation-wall',
        'type' => 'message_wall',
        'title' => 'Typed peer conversation',
        'config' => [
            'messageTopicId' => $topic->id,
            'messageAllowResponses' => true,
        ],
    ]);
    $message = LearnerMessage::query()->create([
        'learning_message_topic_id' => $topic->id,
        'user_id' => $otherLearner->id,
        'body' => 'Try looking at the quieter detail.',
        'audience' => 'peers',
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.messages.responses.store', [$wall, $message]), [
            'body' => 'I would like to understand that detail.',
            'response_type' => 'unsupported',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('response_type');

    expect(LearnerMessageResponse::query()->count())->toBe(0);
});

test('learner message response loading stays bounded as a wall grows', function () {
    $learner = User::factory()->create();
    $messageAuthors = User::factory()->count(12)->create();
    $responseAuthors = User::factory()->count(10)->create();
    $topic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $this->mapAsset->id,
        'slug' => 'bounded-wall',
        'title' => 'Bounded wall',
    ]);

    $messages = collect(range(0, 11))->map(fn (int $number): LearnerMessage => LearnerMessage::query()->create([
        'learning_message_topic_id' => $topic->id,
        'user_id' => $messageAuthors[$number]->id,
        'body' => 'Contribution '.($number + 1),
        'audience' => 'peers',
    ]));

    $messages->each(function (LearnerMessage $message) use ($responseAuthors): void {
        foreach (range(0, 9) as $number) {
            LearnerMessageResponse::query()->create([
                'learner_message_id' => $message->id,
                'user_id' => $responseAuthors[$number]->id,
                'body' => 'Response '.($number + 1),
            ]);
        }
    });
    LearnerMessageResponse::query()->create([
        'learner_message_id' => $messages->first()->id,
        'user_id' => $learner->id,
        'body' => 'I already responded.',
        'hidden_at' => now(),
    ]);

    DB::flushQueryLog();
    DB::enableQueryLog();
    $payload = app(LoadLearnerMessages::class)->handle($topic, $learner, 'peers', true);
    $queryCount = count(DB::getQueryLog());
    $responseQuery = collect(DB::getQueryLog())
        ->first(fn (array $query): bool => str_contains($query['query'], 'response_rank'));
    DB::disableQueryLog();

    expect($queryCount)->toBe(4)
        ->and($responseQuery)->not->toBeNull()
        ->and(strtolower($responseQuery['query']))->toContain('response_rank" <= ?')
        ->and($responseQuery['bindings'])->toContain(3)
        ->and($payload['messages'])->toHaveCount(12)
        ->and(collect($payload['messages'])->every(fn (array $message): bool => count($message['responses']) === 3))->toBeTrue()
        ->and(collect($payload['messages'])->firstWhere('id', $messages->first()->id)['responses'])
        ->toMatchArray([
            ['id' => 8, 'body' => 'Response 8', 'responseType' => null],
            ['id' => 9, 'body' => 'Response 9', 'responseType' => null],
            ['id' => 10, 'body' => 'Response 10', 'responseType' => null],
        ])
        ->and(collect($payload['messages'])->firstWhere('id', $messages->first()->id)['hasResponded'])->toBeTrue();
});

test('admins can hide restore and delete learner messages', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $learner = User::factory()->create();
    $topic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $this->mapAsset->id,
        'slug' => 'helpful-thoughts',
        'title' => 'Helpful thoughts',
    ]);
    $message = LearnerMessage::query()->create([
        'learning_message_topic_id' => $topic->id,
        'user_id' => $learner->id,
        'body' => 'A message for moderation.',
    ]);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-learning-support',
            'support' => 'learner-messages',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('learningSupportSettings.learnerMessages.0.mapAsset.title', 'Message MapAsset')
            ->where('learningSupportSettings.learnerMessages.0.messages.0.author.email', $learner->email)
        );

    $this->actingAs($admin)
        ->patch(route('settings.learning-support.messages.visibility.update', $message), [
            'hidden' => true,
        ])
        ->assertRedirect();

    $message->refresh();
    expect($message->hidden_at)->not->toBeNull()
        ->and($message->hidden_by_user_id)->toBe($admin->id);

    $this->actingAs($admin)
        ->patch(route('settings.learning-support.messages.visibility.update', $message), [
            'hidden' => false,
        ])
        ->assertRedirect();

    $message->refresh();
    expect($message->hidden_at)->toBeNull()
        ->and($message->hidden_by_user_id)->toBeNull();

    $this->actingAs($admin)
        ->delete(route('settings.learning-support.messages.destroy', $message))
        ->assertRedirect();

    $this->assertDatabaseMissing('learner_messages', ['id' => $message->id]);
});
