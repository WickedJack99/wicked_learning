<?php

use App\Learning\Services\MessageActivityConfiguration;
use App\Models\LearnerMessage;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMessageTopic;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
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
        'message_surface_color_dark' => '#102030',
        'message_card_color_light' => '#fefefe',
    ]);

    $topic = LearningMessageTopic::query()->sole();
    $wallConfig = $configuration->fromData($this->node, [
        'message_topic_id' => $topic->id,
        'message_accent_color_light' => '#123abc',
    ]);

    expect($promptConfig['messageTopicId'])->toBe($topic->id)
        ->and($wallConfig['messageTopicId'])->toBe($topic->id)
        ->and($promptConfig['messageUi']['surfaceColorDark'])->toBe('#102030')
        ->and($promptConfig['messageUi']['cardColorLight'])->toBe('#fefefe')
        ->and($wallConfig['messageUi']['accentColorLight'])->toBe('#123abc')
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
        ])
        ->assertRedirect();

    $wall = LearningActivity::query()->where('type', 'message_wall')->sole();

    expect($prompt->config['messageTopicId'])->toBe($topic->id)
        ->and($prompt->config['messagePrompt'])->toBe('What would you tell the next learner?')
        ->and($prompt->config['messageUi']['surfaceColorDark'])->toBe('#102030')
        ->and($wall->config['messageTopicId'])->toBe($topic->id)
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
