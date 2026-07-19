<?php

use App\Localization\Actions\ImportTranslationCatalog;
use App\Localization\Services\ActivityTranslationPayloadFactory;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityTranslation;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\PlatformLanguage;
use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Support\Str;

function translatedLearningActivity(): LearningActivity
{
    $world = LearningWorld::query()->create([
        'slug' => 'translation-world',
        'title' => 'Translation world',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'translation-map',
        'title' => 'Translation map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'translation-node',
        'title' => 'Translation node',
        'position_q' => 0,
        'position_r' => 0,
    ]);

    return LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'translated-activity',
        'type' => 'reflection',
        'title' => 'English title',
    ]);
}

test('an activity translation is returned only for the learner current active play run', function () {
    $user = User::factory()->create();
    $activity = translatedLearningActivity();
    $runId = (string) Str::uuid();

    UserPreference::query()->create([
        'user_id' => $user->id,
        'appearance' => 'dark',
        'settings' => ['locale' => 'ja'],
    ]);
    PlatformLanguage::query()->create([
        'code' => 'ja',
        'name' => 'Japanese',
        'native_name' => '日本語',
        'is_enabled' => true,
    ]);
    LearningActivityTranslation::query()->create([
        'learning_activity_id' => $activity->id,
        'locale' => 'ja',
        'content' => ['title' => '日本語の題名'],
    ]);
    LearnerRouteProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $activity->learning_node_id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
    ]);

    $this->actingAs($user)
        ->getJson(route('learning.activities.translation.show', [
            'activity' => $activity,
            'play_run_id' => $runId,
        ]))
        ->assertOk()
        ->assertJsonPath('translation.title', '日本語の題名');
});

test('an activity translation cannot be read outside the current activity run', function () {
    $user = User::factory()->create();
    $activity = translatedLearningActivity();

    $this->actingAs($user)
        ->getJson(route('learning.activities.translation.show', [
            'activity' => $activity,
            'play_run_id' => (string) Str::uuid(),
        ]))
        ->assertNotFound();
});

test('the default locale returns no alternate translation for the current activity run', function () {
    $user = User::factory()->create();
    $activity = translatedLearningActivity();
    $runId = (string) Str::uuid();

    LearnerRouteProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $activity->learning_node_id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
    ]);

    $this->actingAs($user)
        ->getJson(route('learning.activities.translation.show', [
            'activity' => $activity,
            'play_run_id' => $runId,
        ]))
        ->assertOk()
        ->assertJsonPath('translation', null);
});

test('activity translation imports keep only learner-facing configuration copy', function () {
    $user = User::factory()->create();
    $activity = translatedLearningActivity();
    $activity->update([
        'config' => [
            'allowedToolIds' => [99],
            'markdownPages' => [[
                'body' => 'English page',
                'id' => 'intro',
                'title' => 'Introduction',
            ]],
            'promptText' => 'English prompt',
        ],
    ]);
    $language = PlatformLanguage::query()->create([
        'code' => 'ja',
        'name' => 'Japanese',
        'native_name' => 'Japanese',
        'is_enabled' => true,
    ]);

    app(ImportTranslationCatalog::class)->handle($language, [
        'meta' => [
            'format' => 'learning-worlds.translation-catalog',
            'locale' => 'ja',
        ],
        'platform' => [],
        'activities' => [
            (string) $activity->id => [
                'config' => [
                    'allowedToolIds' => [1],
                    'markdownPages' => [
                        'intro' => ['body' => 'Translated page', 'title' => 'Translated introduction'],
                    ],
                    'promptText' => 'Translated prompt',
                ],
            ],
        ],
    ], $user);

    $content = LearningActivityTranslation::query()
        ->where('learning_activity_id', $activity->id)
        ->where('locale', 'ja')
        ->value('content');

    expect($content)
        ->toMatchArray([
            'config' => [
                'markdownPages' => [
                    'intro' => ['body' => 'Translated page', 'title' => 'Translated introduction'],
                ],
                'promptText' => 'Translated prompt',
            ],
        ])
        ->not->toHaveKey('allowedToolIds');

    expect(app(ActivityTranslationPayloadFactory::class)->make($activity))
        ->toHaveKey('config.markdownPages.intro.title', 'Introduction');
});
