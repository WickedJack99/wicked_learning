<?php

use App\Learning\Serializers\LearningActivitySerializer;
use App\Models\LearningActivity;
use App\Models\LearningDialogueSound;
use App\Models\LearningDialogueSoundSet;
use App\Models\LearningNode;
use App\Models\NpcDialogueNode;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('the default dialogue typing set is seeded with every letter', function () {
    $set = LearningDialogueSoundSet::query()
        ->where('slug', 'curious-double-blip')
        ->with('sounds')
        ->firstOrFail();

    expect($set->is_default)->toBeTrue()
        ->and($set->sounds)->toHaveCount(26)
        ->and($set->sounds->pluck('letter')->all())->toBe(range('a', 'z'));
});

test('authorized users can create a complete dialogue typing set', function () {
    Storage::fake('public');
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $response = $this->actingAs($admin)->post(
        route('settings.assets.dialogue-sound-sets.store'),
        [
            'files' => letterFiles(),
            'is_default' => true,
            'name' => 'Soft keys',
            'slug' => 'soft-keys',
            'tags' => ['dialogue', 'typing'],
        ],
    );

    $response->assertRedirect();

    $set = LearningDialogueSoundSet::query()
        ->where('slug', 'soft-keys')
        ->with('sounds')
        ->firstOrFail();

    expect($set->is_default)->toBeTrue()
        ->and($set->sounds)->toHaveCount(26)
        ->and(LearningDialogueSoundSet::query()
            ->where('slug', 'curious-double-blip')
            ->value('is_default'))->toBeFalse()
        ->and(LearningDialogueSound::query()
            ->where('learning_dialogue_sound_set_id', $set->id)
            ->value('url'))->toStartWith('/storage/learning/dialogue-typing/soft-keys/');
});

test('authorized users can replace one letter without changing the set', function () {
    Storage::fake('public');
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $set = LearningDialogueSoundSet::query()
        ->where('slug', 'curious-double-blip')
        ->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.assets.dialogue-sound-sets.sounds.replace', [
            'set' => $set,
            'letter' => 'c',
        ]), [
            'file' => UploadedFile::fake()->create('c.wav', 12, 'audio/wav'),
        ])
        ->assertRedirect();

    expect($set->sounds()->where('letter', 'c')->value('url'))
        ->toStartWith('/storage/learning/dialogue-typing/curious-double-blip/');
});

test('a dialogue typing set cannot be created without all letter files', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->from(route('settings.index'))
        ->post(route('settings.assets.dialogue-sound-sets.store'), [
            'files' => array_slice(letterFiles(), 0, 25),
            'name' => 'Incomplete',
            'slug' => 'incomplete',
        ])
        ->assertRedirect(route('settings.index'))
        ->assertSessionHasErrors('files');

    expect(LearningDialogueSoundSet::query()->where('slug', 'incomplete')->exists())->toBeFalse();
});

test('learner activity payload includes only the sound set used by dialogue', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $node = LearningNode::query()->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'sound-enabled-dialogue',
        'type' => 'npc_dialogue',
        'title' => 'Sound-enabled dialogue',
        'sort_order' => 99,
        'config' => [],
    ]);
    NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_monologue',
        'title' => 'Mira',
        'body' => 'A quiet sound cue.',
        'config' => [
            'typingSoundEnabled' => true,
        ],
    ]);

    $payload = app(LearningActivitySerializer::class)
        ->serialize($activity->load('npcDialogueNodes'));

    expect($payload['dialogueTypingSoundSets'])->toHaveCount(1)
        ->and($payload['dialogueTypingSoundSets'][0]['isDefault'])->toBeTrue()
        ->and($payload['dialogueTypingSoundSets'][0]['sounds'])->toHaveCount(26);
});

/**
 * @return array<int, UploadedFile>
 */
function letterFiles(): array
{
    return array_map(
        fn (string $letter): UploadedFile => UploadedFile::fake()->create("{$letter}.wav", 12, 'audio/wav'),
        range('a', 'z'),
    );
}
