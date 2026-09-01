<?php

use App\Learning\ActivityTypeRegistry;
use App\Learning\CurrentWorldResolver;
use App\Learning\Services\NodeUnlockReachability;
use App\Learning\Validation\AdminWorldRules;
use App\Models\ActivityTransition;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerNodeDiscovery;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningActivityTranslation;
use App\Models\LearningActivityVersion;
use App\Models\LearningCompanionDialogue;
use App\Models\LearningCompanionDialogueAssignment;
use App\Models\LearningItem;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMapLayoutVersion;
use App\Models\LearningMessageTopic;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\LearningTool;
use App\Models\LearningWorld;
use App\Models\LearningWorldVersion;
use App\Models\NpcDialogueAnswer;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use App\Models\User;
use App\Models\UserPreference;
use Database\Seeders\DemoLearningWorldSeeder;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;

test('admin users can see the world graph with portal links', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $assets = LearningMapAsset::query()->where('learning_map_id', $map->id)->get();
    $siblingAssets = LearningMapAsset::query()
        ->whereHas('map', fn ($query) => $query->where('slug', 'signal-archive'))
        ->get();
    $siblingMap = LearningMap::query()->where('slug', 'signal-archive')->firstOrFail();
    $reviewCount = LearningActivity::query()
        ->whereHas('node', fn ($query) => $query->where('learning_map_id', $map->id))
        ->where('ai_review_status', '!=', LearningActivity::AI_REVIEW_STATUS_REVIEWED)
        ->count();
    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('worldGraph.world.slug', 'demo-learning-world')
            ->has('worldGraph.maps', 2)
            ->where('worldGraph.maps.0.slug', 'first-sector')
            ->where('worldGraph.maps.0.reviewCount', $reviewCount)
            ->where('worldGraph.maps.0.nodes.0.slug', 'portal-foundation')
            ->where('worldGraph.maps.0.nodes.0.activityReviewCount', 1)
            ->missing('worldGraph.maps.0.nodes.0.pendingReviewActivities')
            ->has('worldGraph.portalCandidates', 5)
            ->has('worldGraph.portalLinks', 1)
            ->where('worldGraph.portalLinks.0.sourceNode.slug', 'portal-foundation')
            ->where('worldGraph.portalLinks.0.targetNode.slug', 'return-gate')
        );

    expect($assets)->toHaveCount(3)
        ->and($assets->whereNotNull('image_url'))->toHaveCount(3)
        ->and($assets->pluck('learning_node_id')->unique())->toHaveCount(3)
        ->and($siblingAssets)->toHaveCount(1)
        ->and($siblingAssets->first()->image_url)
        ->toBe('/images/nodes/fantasy-hex-crystal-grove.png')
        ->and($siblingMap->learning_topic_id)->toBe($map->learning_topic_id);

    $this->actingAs($admin)
        ->get(route('settings.worlds.index'))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
        ]));
});

test('admin users receive only one page of world builder review activities', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $reviewCount = LearningActivity::query()
        ->whereHas('node.map')
        ->where(function ($query): void {
            $query
                ->whereNull('ai_review_status')
                ->orWhere('ai_review_status', '!=', LearningActivity::AI_REVIEW_STATUS_REVIEWED);
        })
        ->count();
    $activityQueries = [];
    DB::listen(function (QueryExecuted $query) use (&$activityQueries): void {
        if (str_contains($query->sql, 'learning_activities')) {
            $activityQueries[] = strtolower($query->sql);
        }
    });

    $this->actingAs($admin)
        ->get(route('settings.worlds.review-queue.index', [
            'page' => 1,
            'per_page' => 4,
        ]))
        ->assertOk()
        ->assertJsonPath('pagination.total', $reviewCount)
        ->assertJsonPath('pagination.perPage', 4)
        ->assertJsonCount(min(4, $reviewCount), 'items')
        ->assertJsonStructure([
            'items' => [[
                'activity' => ['id', 'title', 'type'],
                'map' => ['id', 'title'],
                'node' => ['id', 'title'],
            ]],
            'pagination' => ['page', 'perPage', 'total', 'lastPage'],
        ]);

    if ($reviewCount > 4) {
        $this->actingAs($admin)
            ->get(route('settings.worlds.review-queue.index', [
                'page' => 2,
                'per_page' => 4,
            ]))
            ->assertOk()
            ->assertJsonPath('pagination.page', 2)
            ->assertJsonCount(min(4, $reviewCount - 4), 'items');
    }

    expect(collect($activityQueries)->some(
        fn (string $query): bool => str_contains($query, 'select')
            && str_contains($query, 'limit 4'),
    ))->toBeTrue();
});

test('admin users can open world builder map configuration and node inside settings workspace', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    CompetenceTopicDefinition::query()->create([
        'name' => 'Systems Thinking',
        'slug' => 'systems-thinking',
        'is_active' => true,
    ]);
    CompetenceTopicDefinition::query()->create([
        'name' => 'Retired Topic',
        'slug' => 'retired-topic',
        'is_active' => false,
    ]);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'configure',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('selectedWorldMap.canDeleteWorldMaps', true)
            ->where('selectedWorldMap.editableMap.map.slug', 'first-sector')
            ->has('selectedWorldMap.learningGroups')
            ->has('selectedWorldMap.items')
            ->where('selectedWorldMap.roleOptions.0.slug', User::ROLE_USER)
        );

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('selectedWorldMap.editableMap.map.slug', 'first-sector')
            ->where('selectedWorldNode.activityGraph.map.slug', 'first-sector')
            ->where('selectedWorldNode.activityGraph.node.slug', 'signal-gate')
            ->has('selectedWorldNode.activityGraph.activities', 5)
            ->where('selectedWorldNode.activityGraph.activities.0.slug', 'guided-signal-dialogue')
            ->where('selectedWorldNode.activityGraph.activities.0.type', 'npc_dialogue')
            ->has('selectedWorldNode.activityGraph.transitions', 5)
            ->has('selectedWorldNode.activityGraph.portalCandidates')
            ->has('selectedWorldNode.activityGraph.activityTypes')
            ->where('selectedWorldNode.activityGraph.canManageAiReview', true)
            ->where('selectedWorldNode.activityGraph.competenceTopicOptions', [
                'Investigation focus',
                'Pattern recognition',
                'Systems Thinking',
            ])
        );

    expect(app(ActivityTypeRegistry::class)->typeKeys())
        ->not->toContain('dialogue')
        ->toContain('npc_dialogue');
});

test('map authors can download an author-only map export manifest', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $response = $this->actingAs($admin)
        ->get(route('settings.worlds.maps.export', $map));

    $response
        ->assertOk()
        ->assertHeader(
            'Content-Disposition',
            'attachment; filename=first-sector-wicked-learning-map.json',
        )
        ->assertHeader('Content-Type', 'application/json');

    $payload = json_decode(
        $response->streamedContent(),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $signalGate = collect($payload['nodes'])
        ->firstWhere('slug', 'signal-gate');
    $signalAsset = collect($payload['mapAssets'])
        ->firstWhere('nodeSlug', 'signal-gate');

    expect($payload['format'])->toBe('wicked-learning-map')
        ->and($payload['formatVersion'])->toBe(1)
        ->and($payload['world']['slug'])->toBe('demo-learning-world')
        ->and($payload['map']['slug'])->toBe('first-sector')
        ->and($payload['map']['topicSlug'])->toBe('pattern-investigation')
        ->and($signalGate['startActivitySlug'])->toBe('guided-signal-dialogue')
        ->and($signalGate['activities'])->not->toBeEmpty()
        ->and($signalAsset['imageUrl'])->toBe('/images/nodes/fantasy-hex-forest.png')
        ->and($payload['portalTargets'])->not->toBeEmpty()
        ->and($payload['references']['mediaUrls'])
        ->toContain('/images/themes/fantasy-world-map-background.png')
        ->and($payload)->not->toHaveKey('versions')
        ->and($payload)->not->toHaveKey('learnerProgress');
});

test('map authors can transfer a map with explicitly referenced uploaded media', function () {
    Storage::fake('public');
    Storage::disk('public')->put('learning/media/portable.svg', '<svg>portable</svg>');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $mediaUrl = '/storage/learning/media/portable.svg';
    $source->forceFill([
        'background_config' => ['dark' => ['imageUrl' => $mediaUrl]],
    ])->save();

    $export = $this->actingAs($admin)
        ->get(route('settings.worlds.maps.export-package', $source));

    $export
        ->assertOk()
        ->assertHeader('Content-Type', 'application/zip')
        ->assertHeader(
            'Content-Disposition',
            'attachment; filename=first-sector-wicked-learning-map.zip',
        );

    $packagePath = tempnam(sys_get_temp_dir(), 'wicked-map-package-test-');
    expect($packagePath)->not->toBeFalse();
    file_put_contents($packagePath, file_get_contents($export->getFile()->getPathname()));
    $archive = new ZipArchive;
    expect($archive->open($packagePath))->toBeTrue();
    $manifestContents = $archive->getFromName('manifest.json');
    expect($manifestContents)->toBeString()->toContain($mediaUrl);
    $mediaIndex = json_decode(
        (string) $archive->getFromName('media.json'),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $mediaEntry = $mediaIndex['media'][0];
    expect($mediaEntry['sourceUrl'])->toBe($mediaUrl);
    expect($archive->getFromName($mediaEntry['archivePath']))->toBe('<svg>portable</svg>');
    $archive->close();

    $validation = $this->actingAs($admin)
        ->withHeaders(['Accept' => 'application/json'])
        ->post(route('settings.worlds.maps.exports.validate'), [
            'scope' => 'map',
            'manifest' => new UploadedFile($packagePath, 'map.zip', 'application/zip', null, true),
        ]);

    $validation
        ->assertOk()
        ->assertJsonPath('valid', true)
        ->assertJsonPath('mediaReferenceDetails.0.url', $mediaUrl)
        ->assertJsonPath('mediaReferenceDetails.0.available', true);

    $response = $this->actingAs($admin)
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => new UploadedFile($packagePath, 'map.zip', 'application/zip', null, true),
            'slug' => 'portable-package-map',
            'title' => 'Portable package map',
        ]);

    $response->assertRedirect();
    $imported = LearningMap::query()->where('slug', 'portable-package-map')->firstOrFail();
    $importedUrl = data_get($imported->background_config, 'dark.imageUrl');

    expect($importedUrl)->toBeString()
        ->not->toBe($mediaUrl)
        ->toStartWith('/storage/learning/media/');
    Storage::disk('public')->assertExists(substr(parse_url($importedUrl, PHP_URL_PATH), strlen('/storage/')));
    @unlink($packagePath);
});

test('map package preflight rejects unsafe archive paths before importing content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $mapCount = LearningMap::query()->count();
    $packagePath = tempnam(sys_get_temp_dir(), 'wicked-invalid-map-package-');
    expect($packagePath)->not->toBeFalse();

    $archive = new ZipArchive;
    expect($archive->open($packagePath, ZipArchive::CREATE | ZipArchive::OVERWRITE))->toBeTrue();
    $archive->addFromString('manifest.json', json_encode([
        'format' => 'wicked-learning-map',
        'formatVersion' => 1,
        'world' => ['slug' => 'demo-learning-world'],
        'map' => ['slug' => 'unsafe-package-map', 'title' => 'Unsafe package map'],
        'nodes' => [],
        'mapAssets' => [],
        'portalTargets' => [],
        'references' => ['mediaUrls' => ['/storage/learning/media/unsafe.svg']],
    ], JSON_THROW_ON_ERROR));
    $archive->addFromString('media.json', json_encode([
        'format' => 'wicked-learning-map-media',
        'formatVersion' => 1,
        'media' => [[
            'sourceUrl' => '/storage/learning/media/unsafe.svg',
            'archivePath' => 'media/../unsafe.svg',
        ]],
    ], JSON_THROW_ON_ERROR));
    $archive->close();

    $this->actingAs($admin)
        ->withHeaders(['Accept' => 'application/json'])
        ->post(route('settings.worlds.maps.exports.validate'), [
            'scope' => 'map',
            'manifest' => new UploadedFile($packagePath, 'unsafe.zip', 'application/zip', null, true),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('media');

    expect(LearningMap::query()->count())->toBe($mapCount);
    @unlink($packagePath);
});

test('map authors can download a standalone map asset bundle with its authored place', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $asset = LearningMapAsset::query()
        ->whereHas('node', fn ($query) => $query->where('slug', 'signal-gate'))
        ->firstOrFail();
    $messageTopic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $asset->id,
        'slug' => 'standalone-export-topic',
        'title' => 'Standalone export topic',
    ]);

    $response = $this->actingAs($admin)
        ->get(route('settings.worlds.assets.export', $asset));

    $response
        ->assertOk()
        ->assertHeader(
            'Content-Disposition',
            'attachment; filename=signal-gate-wicked-learning-asset.json',
        )
        ->assertHeader('Content-Type', 'application/json');

    $payload = json_decode(
        $response->streamedContent(),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );

    expect($payload['format'])->toBe('wicked-learning-map-asset')
        ->and($payload['formatVersion'])->toBe(1)
        ->and($payload['source']['world']['slug'])->toBe('demo-learning-world')
        ->and($payload['source']['map']['slug'])->toBe('first-sector')
        ->and($payload['source']['assetId'])->toBe($asset->id)
        ->and($payload['node']['slug'])->toBe('signal-gate')
        ->and($payload['node']['activities'])->not->toBeEmpty()
        ->and($payload['mapAsset']['nodeSlug'])->toBe('signal-gate')
        ->and($payload['mapAsset']['messageTopics'])->toContain([
            'sourceId' => $messageTopic->id,
            'slug' => 'standalone-export-topic',
            'title' => 'Standalone export topic',
        ])
        ->and($payload['references']['mediaUrls'])
        ->toContain('/images/nodes/fantasy-hex-forest.png')
        ->and($payload)->not->toHaveKey('learnerProgress')
        ->and($payload)->not->toHaveKey('portalTargets');
});

test('map authors can import a standalone asset bundle into an existing map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $sourceAsset = LearningMapAsset::query()
        ->whereHas('node', fn ($query) => $query->where('slug', 'signal-gate'))
        ->firstOrFail();
    $messageTopic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $sourceAsset->id,
        'slug' => 'standalone-import-topic',
        'title' => 'Standalone import topic',
    ]);
    $sourceActivity = LearningActivity::query()
        ->where('learning_node_id', $sourceAsset->learning_node_id)
        ->firstOrFail();
    $sourceActivity->forceFill([
        'config' => ['messageTopicId' => $messageTopic->id],
    ])->save();
    $destination = LearningMap::query()->where('slug', 'signal-archive')->firstOrFail();
    $sourceExport = $this->actingAs($admin)
        ->get(route('settings.worlds.assets.export', $sourceAsset))
        ->streamedContent();
    $sourcePayload = json_decode($sourceExport, true, 512, JSON_THROW_ON_ERROR);

    $response = $this->actingAs($admin)
        ->withHeaders([
            'referer' => route('settings.worlds.maps.edit', $destination),
        ])
        ->post(route('settings.worlds.maps.assets.import', $destination), [
            'manifest' => UploadedFile::fake()->createWithContent('asset.json', $sourceExport),
        ]);

    $response->assertRedirect(route('settings.worlds.maps.edit', $destination));

    $importedNode = LearningNode::query()
        ->where('learning_map_id', $destination->id)
        ->where('slug', 'pattern-gate')
        ->firstOrFail();
    $importedAsset = LearningMapAsset::query()
        ->where('learning_map_id', $destination->id)
        ->where('learning_node_id', $importedNode->id)
        ->firstOrFail();
    $importedTopic = $importedAsset->messageTopics()->firstOrFail();
    $importedActivity = $importedNode->activities()->where('slug', $sourceActivity->slug)->firstOrFail();

    expect($importedNode->id)->not->toBe($sourcePayload['node']['sourceId'])
        ->and($importedAsset->id)->not->toBe($sourcePayload['mapAsset']['sourceId'])
        ->and($importedNode->activities()->count())->toBe(count($sourcePayload['node']['activities']))
        ->and($importedAsset->messageTopics()->count())->toBe(count($sourcePayload['mapAsset']['messageTopics']))
        ->and($importedActivity->config['messageTopicId'])->toBe($importedTopic->id)
        ->and($importedTopic->id)->not->toBe($messageTopic->id);

    $this->actingAs($admin)
        ->withHeaders([
            'referer' => route('settings.worlds.maps.edit', $destination),
        ])
        ->post(route('settings.worlds.maps.assets.import', $destination), [
            'manifest' => UploadedFile::fake()->createWithContent('asset.json', $sourceExport),
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $destination));

    expect(LearningNode::query()
        ->where('learning_map_id', $destination->id)
        ->where('slug', 'pattern-gate-2')
        ->exists())->toBeTrue();
});

test('map authors can transfer a standalone asset with explicitly referenced uploaded media', function () {
    Storage::fake('public');
    Storage::disk('public')->put('learning/media/portable-asset.svg', '<svg>portable asset</svg>');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $sourceAsset = LearningMapAsset::query()
        ->whereHas('node', fn ($query) => $query->where('slug', 'signal-gate'))
        ->firstOrFail();
    $mediaUrl = '/storage/learning/media/portable-asset.svg';
    $sourceAsset->forceFill(['image_url' => $mediaUrl])->save();
    $destination = LearningMap::query()->where('slug', 'signal-archive')->firstOrFail();

    $export = $this->actingAs($admin)
        ->get(route('settings.worlds.assets.export-package', $sourceAsset));

    $export
        ->assertOk()
        ->assertHeader('Content-Type', 'application/zip')
        ->assertHeader(
            'Content-Disposition',
            'attachment; filename=signal-gate-wicked-learning-asset.zip',
        );

    $packagePath = tempnam(sys_get_temp_dir(), 'wicked-asset-package-test-');
    expect($packagePath)->not->toBeFalse();
    file_put_contents($packagePath, file_get_contents($export->getFile()->getPathname()));
    $archive = new ZipArchive;
    expect($archive->open($packagePath))->toBeTrue();
    $manifestContents = $archive->getFromName('manifest.json');
    expect($manifestContents)->toBeString()->toContain($mediaUrl);
    $mediaIndex = json_decode(
        (string) $archive->getFromName('media.json'),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $mediaEntry = $mediaIndex['media'][0];
    expect($mediaEntry['sourceUrl'])->toBe($mediaUrl);
    expect($archive->getFromName($mediaEntry['archivePath']))->toBe('<svg>portable asset</svg>');
    $archive->close();

    $response = $this->actingAs($admin)
        ->withHeaders([
            'referer' => route('settings.worlds.maps.edit', $destination),
        ])
        ->post(route('settings.worlds.maps.assets.import', $destination), [
            'manifest' => new UploadedFile($packagePath, 'asset.zip', 'application/zip', null, true),
        ]);

    $response->assertRedirect(route('settings.worlds.maps.edit', $destination));
    $importedAsset = LearningMapAsset::query()
        ->where('learning_map_id', $destination->id)
        ->where('image_url', 'like', '/storage/learning/media/%')
        ->latest('id')
        ->firstOrFail();

    expect($importedAsset->image_url)
        ->not->toBe($mediaUrl)
        ->toStartWith('/storage/learning/media/');
    Storage::disk('public')->assertExists(substr(
        parse_url($importedAsset->image_url, PHP_URL_PATH),
        strlen('/storage/'),
    ));
    @unlink($packagePath);
});

test('standalone map asset imports reject invalid bundles before creating records', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $destination = LearningMap::query()->where('slug', 'signal-archive')->firstOrFail();
    $nodeCount = LearningNode::query()->where('learning_map_id', $destination->id)->count();
    $assetCount = LearningMapAsset::query()->where('learning_map_id', $destination->id)->count();

    $this->actingAs($admin)
        ->from(route('settings.worlds.maps.edit', $destination))
        ->post(route('settings.worlds.maps.assets.import', $destination), [
            'manifest' => UploadedFile::fake()->createWithContent('invalid.json', json_encode([
                'format' => 'not-a-wicked-learning-asset',
                'formatVersion' => 1,
            ], JSON_THROW_ON_ERROR)),
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningNode::query()->where('learning_map_id', $destination->id)->count())
        ->toBe($nodeCount)
        ->and(LearningMapAsset::query()->where('learning_map_id', $destination->id)->count())
        ->toBe($assetCount);
});

test('standalone map asset package failures remove materialized media', function () {
    Storage::fake('public');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $sourceAsset = LearningMapAsset::query()
        ->whereHas('node', fn ($query) => $query->where('slug', 'signal-gate'))
        ->firstOrFail();
    $destination = LearningMap::query()->where('slug', 'signal-archive')->firstOrFail();
    $mediaUrl = '/storage/learning/media/invalid-asset.svg';
    $payload = json_decode(
        $this->actingAs($admin)
            ->get(route('settings.worlds.assets.export', $sourceAsset))
            ->streamedContent(),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $payload['formatVersion'] = 999;
    $payload['mapAsset']['imageUrl'] = $mediaUrl;
    $payload['references']['mediaUrls'] = [$mediaUrl];
    $packagePath = tempnam(sys_get_temp_dir(), 'wicked-invalid-asset-package-');
    expect($packagePath)->not->toBeFalse();

    $archive = new ZipArchive;
    expect($archive->open($packagePath, ZipArchive::CREATE | ZipArchive::OVERWRITE))->toBeTrue();
    $archive->addFromString('manifest.json', json_encode($payload, JSON_THROW_ON_ERROR));
    $archive->addFromString('media.json', json_encode([
        'format' => 'wicked-learning-map-media',
        'formatVersion' => 1,
        'media' => [[
            'sourceUrl' => $mediaUrl,
            'archivePath' => 'media/invalid-asset.svg',
        ]],
    ], JSON_THROW_ON_ERROR));
    $archive->addFromString('media/invalid-asset.svg', '<svg>invalid asset</svg>');
    $archive->close();

    $this->actingAs($admin)
        ->withHeaders([
            'referer' => route('settings.worlds.maps.edit', $destination),
        ])
        ->post(route('settings.worlds.maps.assets.import', $destination), [
            'manifest' => new UploadedFile($packagePath, 'invalid-asset.zip', 'application/zip', null, true),
        ])
        ->assertSessionHasErrors('manifest');

    expect(Storage::disk('public')->allFiles('learning/media'))->toBeEmpty();
    @unlink($packagePath);
});

test('standalone map asset imports reject bundles from another workspace', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $sourceAsset = LearningMapAsset::query()
        ->whereHas('node', fn ($query) => $query->where('slug', 'signal-gate'))
        ->firstOrFail();
    $destination = LearningMap::query()->where('slug', 'signal-archive')->firstOrFail();
    $payload = json_decode(
        $this->actingAs($admin)
            ->get(route('settings.worlds.assets.export', $sourceAsset))
            ->streamedContent(),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $payload['source']['world']['slug'] = 'another-workspace';
    $nodeCount = LearningNode::query()->where('learning_map_id', $destination->id)->count();
    $assetCount = LearningMapAsset::query()->where('learning_map_id', $destination->id)->count();

    $this->actingAs($admin)
        ->from(route('settings.worlds.maps.edit', $destination))
        ->post(route('settings.worlds.maps.assets.import', $destination), [
            'manifest' => UploadedFile::fake()->createWithContent('asset.json', json_encode($payload, JSON_THROW_ON_ERROR)),
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningNode::query()->where('learning_map_id', $destination->id)->count())
        ->toBe($nodeCount)
        ->and(LearningMapAsset::query()->where('learning_map_id', $destination->id)->count())
        ->toBe($assetCount);
});

test('map authors can download an editable world export bundle', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $portalQueries = [];
    DB::listen(function (QueryExecuted $query) use (&$portalQueries): void {
        if (str_contains($query->sql, 'learning_portal_links')) {
            $portalQueries[] = $query;
        }
    });

    $response = $this->actingAs($admin)
        ->get(route('settings.worlds.export'));

    $response
        ->assertOk()
        ->assertHeader(
            'Content-Disposition',
            'attachment; filename=demo-learning-world-wicked-learning-world.json',
        )
        ->assertHeader('Content-Type', 'application/json');

    $payload = json_decode(
        $response->streamedContent(),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );

    $firstMap = collect($payload['maps'])->firstWhere('map.slug', 'first-sector');

    expect($payload['format'])->toBe('wicked-learning-world')
        ->and($payload['formatVersion'])->toBe(1)
        ->and($payload['world']['slug'])->toBe('demo-learning-world')
        ->and(collect($payload['maps'])->pluck('map.slug')->all())
        ->toBe(['first-sector', 'signal-archive'])
        ->and($firstMap['portalTargets'])->not->toBeEmpty()
        ->and($payload['references']['mediaUrls'])->not->toBeEmpty()
        ->and($portalQueries)->toHaveCount(1);
});

test('map authors can transfer an editable world with explicitly referenced uploaded media', function () {
    Storage::fake('public');
    Storage::disk('public')->put('learning/media/portable-world.svg', '<svg>portable world</svg>');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $mediaUrl = '/storage/learning/media/portable-world.svg';
    $source->forceFill([
        'background_config' => ['dark' => ['imageUrl' => $mediaUrl]],
    ])->save();
    $originalMapCount = LearningMap::query()->count();

    $export = $this->actingAs($admin)
        ->get(route('settings.worlds.export-package'));

    $export
        ->assertOk()
        ->assertHeader('Content-Type', 'application/zip')
        ->assertHeader(
            'Content-Disposition',
            'attachment; filename=demo-learning-world-wicked-learning-world.zip',
        );

    $packagePath = tempnam(sys_get_temp_dir(), 'wicked-world-package-test-');
    expect($packagePath)->not->toBeFalse();
    file_put_contents($packagePath, file_get_contents($export->getFile()->getPathname()));
    $archive = new ZipArchive;
    expect($archive->open($packagePath))->toBeTrue();
    expect($archive->getFromName('manifest.json'))->toBeString()->toContain($mediaUrl);
    $mediaIndex = json_decode(
        (string) $archive->getFromName('media.json'),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $mediaEntry = $mediaIndex['media'][0];
    expect($mediaEntry['sourceUrl'])->toBe($mediaUrl)
        ->and($archive->getFromName($mediaEntry['archivePath']))
        ->toBe('<svg>portable world</svg>');
    $archive->close();

    $this->actingAs($admin)
        ->withHeaders(['Accept' => 'application/json'])
        ->post(route('settings.worlds.maps.exports.validate'), [
            'scope' => 'world',
            'manifest' => new UploadedFile($packagePath, 'world.zip', 'application/zip', null, true),
        ])
        ->assertOk()
        ->assertJsonPath('valid', true)
        ->assertJsonPath('mediaReferenceDetails.0.url', $mediaUrl)
        ->assertJsonPath('mediaReferenceDetails.0.available', true);

    $this->actingAs($admin)
        ->post(route('settings.worlds.import'), [
            'manifest' => new UploadedFile($packagePath, 'world.zip', 'application/zip', null, true),
        ])
        ->assertRedirect(route('settings.worlds.index'));

    $importedMaps = LearningMap::query()
        ->where('created_by_user_id', $admin->id)
        ->get();
    $importedMediaMap = $importedMaps->first(
        fn (LearningMap $map): bool => str_starts_with(
            (string) data_get($map->background_config, 'dark.imageUrl'),
            '/storage/learning/media/',
        ),
    );

    expect($importedMaps)->toHaveCount(2)
        ->and(LearningMap::query()->count())->toBe($originalMapCount + 2)
        ->and($importedMediaMap)->not->toBeNull()
        ->and(data_get($importedMediaMap?->background_config, 'dark.imageUrl'))
        ->not->toBe($mediaUrl);
    Storage::disk('public')->assertExists(substr(
        parse_url((string) data_get($importedMediaMap?->background_config, 'dark.imageUrl'), PHP_URL_PATH),
        strlen('/storage/'),
    ));
    @unlink($packagePath);
});

test('world package failures remove materialized media before creating maps', function () {
    Storage::fake('public');
    Storage::disk('public')->put('learning/media/portable-world-failure.svg', '<svg>portable world failure</svg>');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $mediaUrl = '/storage/learning/media/portable-world-failure.svg';
    $source->forceFill([
        'background_config' => ['dark' => ['imageUrl' => $mediaUrl]],
    ])->save();
    $manifest = $this->actingAs($admin)
        ->get(route('settings.worlds.export'))
        ->streamedContent();
    $payload = json_decode($manifest, true, 512, JSON_THROW_ON_ERROR);
    $payload['formatVersion'] = 999;
    $packagePath = tempnam(sys_get_temp_dir(), 'wicked-invalid-world-package-');
    expect($packagePath)->not->toBeFalse();

    $archive = new ZipArchive;
    expect($archive->open($packagePath, ZipArchive::CREATE | ZipArchive::OVERWRITE))->toBeTrue();
    $archive->addFromString('manifest.json', json_encode($payload, JSON_THROW_ON_ERROR));
    $archive->addFromString('media.json', json_encode([
        'format' => 'wicked-learning-map-media',
        'formatVersion' => 1,
        'media' => [[
            'sourceUrl' => $mediaUrl,
            'archivePath' => 'media/failure.svg',
        ]],
    ], JSON_THROW_ON_ERROR));
    $archive->addFromString('media/failure.svg', '<svg>failure</svg>');
    $archive->close();

    $mapCount = LearningMap::query()->count();

    $this->actingAs($admin)
        ->from(route('settings.worlds.index'))
        ->post(route('settings.worlds.import'), [
            'manifest' => new UploadedFile($packagePath, 'invalid-world.zip', 'application/zip', null, true),
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount)
        ->and(Storage::disk('public')->allFiles('learning/media'))
        ->toBe(['learning/media/portable-world-failure.svg']);
    @unlink($packagePath);
});

test('map authors can import an editable world export bundle with remapped portal links', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $originalMapCount = LearningMap::query()->count();
    $originalPortalCount = LearningPortalLink::query()->count();
    $manifest = $this->actingAs($admin)
        ->get(route('settings.worlds.export'))
        ->streamedContent();

    $response = $this->actingAs($admin)
        ->post(route('settings.worlds.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'world.json',
                $manifest,
            ),
        ]);

    $response->assertRedirect(route('settings.worlds.index'));

    $importedMaps = LearningMap::query()
        ->where('created_by_user_id', $admin->id)
        ->get();
    $importedMapIds = $importedMaps->pluck('id');
    $importedSourceNode = LearningNode::query()
        ->whereIn('learning_map_id', $importedMapIds)
        ->where('slug', 'portal-foundation')
        ->firstOrFail();
    $importedPortal = LearningPortalLink::query()
        ->where('source_learning_node_id', $importedSourceNode->id)
        ->firstOrFail();

    expect($importedMaps)->toHaveCount(2)
        ->and(LearningMap::query()->count())->toBe($originalMapCount + 2)
        ->and(LearningPortalLink::query()->count())->toBe($originalPortalCount + 1)
        ->and($importedMaps->pluck('access_roles')->filter()->all())->toBe([])
        ->and($importedPortal->targetNode->map->created_by_user_id)
        ->toBe($admin->id)
        ->and($importedPortal->targetNode->map->slug)
        ->toBe('quiet-library');
});

test('world import restores route records from legacy start activity fields', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $manifest = $this->actingAs($admin)
        ->get(route('settings.worlds.export'))
        ->streamedContent();
    $payload = json_decode($manifest, true, 512, JSON_THROW_ON_ERROR);

    foreach ($payload['maps'] as &$map) {
        foreach ($map['nodes'] as &$node) {
            unset($node['activityStarts']);
        }
        unset($node);
    }
    unset($map);

    $this->actingAs($admin)
        ->post(route('settings.worlds.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'legacy-world.json',
                json_encode($payload, JSON_THROW_ON_ERROR),
            ),
        ])
        ->assertRedirect(route('settings.worlds.index'));

    $importedMapIds = LearningMap::query()
        ->where('created_by_user_id', $admin->id)
        ->pluck('id');
    $importedNodes = LearningNode::query()
        ->whereIn('learning_map_id', $importedMapIds)
        ->whereNotNull('start_activity_id')
        ->get();

    expect($importedNodes)->toHaveCount(4)
        ->and(LearningActivityStart::query()
            ->whereIn('learning_node_id', $importedNodes->pluck('id'))
            ->count())->toBe(4);

    $this->actingAs($admin)
        ->get(route('paths.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('pagination.total', 7)
            ->has('paths', 6)
        );

    $this->actingAs($admin)
        ->get(route('topics.show', 'pattern-investigation'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('topic.pathsPagination.total', 7)
            ->has('topic.paths', 6)
        );
});

test('world import rejects duplicate source map slugs without creating maps', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $manifest = $this->actingAs($admin)
        ->get(route('settings.worlds.export'))
        ->streamedContent();
    $payload = json_decode($manifest, true, 512, JSON_THROW_ON_ERROR);
    $payload['maps'][1]['map']['slug'] = $payload['maps'][0]['map']['slug'];
    $mapCount = LearningMap::query()->count();

    $this->actingAs($admin)
        ->post(route('settings.worlds.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'duplicate-world.json',
                json_encode($payload, JSON_THROW_ON_ERROR),
            ),
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map authors can validate an export manifest without changing content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $mapCount = LearningMap::query()->count();
    $exportResponse = $this->actingAs($admin)
        ->get(route('settings.worlds.maps.export', $map));
    $manifest = $exportResponse->streamedContent();
    $exportPayload = json_decode($manifest, true, 512, JSON_THROW_ON_ERROR);

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.exports.validate'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'first-sector.json',
                $manifest,
            ),
        ])
        ->assertOk()
        ->assertJsonPath('valid', true)
        ->assertJsonPath('map.slug', 'first-sector')
        ->assertJsonPath('map.exists', true)
        ->assertJsonPath('counts.nodes', 4)
        ->assertJsonPath('counts.mediaReferences', count($exportPayload['references']['mediaUrls']))
        ->assertJsonPath('mediaReferenceDetails.0.available', true);

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map export validation reports malformed manifests', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.exports.validate'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'broken.json',
                json_encode(['format' => 'unknown'], JSON_THROW_ON_ERROR),
            ),
        ])
        ->assertOk()
        ->assertJsonPath('valid', false)
        ->assertJsonPath('errors.0', 'format must be "wicked-learning-map".');
});

test('map export preflight reports missing media references without changing content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $available = '/images/tools/pattern-lens-dark.svg';
    $missing = '/images/does-not-exist.png';
    $manifest = [
        'format' => 'wicked-learning-map',
        'formatVersion' => 1,
        'world' => ['slug' => 'demo-learning-world', 'title' => 'Demo learning world'],
        'map' => [
            'slug' => 'preflight-media-map',
            'title' => 'Preflight media map',
            'backgroundConfig' => [
                'dark' => ['imageUrl' => $available],
                'light' => ['imageUrl' => $missing],
            ],
        ],
        'nodes' => [],
        'mapAssets' => [],
        'portalTargets' => [],
        'references' => ['mediaUrls' => [$available, $missing]],
    ];

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.exports.validate'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'preflight-media.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
        ])
        ->assertOk()
        ->assertJsonPath('valid', false)
        ->assertJsonPath('counts.mediaReferences', 2)
        ->assertJsonPath('mediaReferenceDetails.0.url', $available)
        ->assertJsonPath('mediaReferenceDetails.0.available', true)
        ->assertJsonPath('mediaReferenceDetails.1.url', $missing)
        ->assertJsonPath('mediaReferenceDetails.1.available', false);
});

test('authors can preflight a world export without changing content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $world = LearningWorld::query()->where('slug', 'demo-learning-world')->firstOrFail();
    $mapCount = LearningMap::query()->count();
    $manifest = $this->actingAs($admin)
        ->get(route('settings.worlds.export'))
        ->streamedContent();

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.exports.validate'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'demo-world.json',
                $manifest,
            ),
            'scope' => 'world',
        ])
        ->assertOk()
        ->assertJsonPath('valid', true)
        ->assertJsonPath('world.slug', $world->slug)
        ->assertJsonPath('world.exists', true)
        ->assertJsonPath('counts.maps', $world->maps()->count())
        ->assertJsonPath('mediaReferenceDetails.0.available', true);

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map authors can import a validated export as a new authored map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $sourceNodeIds = $source->nodes()->pluck('id');
    $sourceActivityIds = LearningActivity::query()
        ->whereIn('learning_node_id', $sourceNodeIds)
        ->pluck('id');
    $sourceActivity = LearningActivity::query()
        ->whereIn('id', $sourceActivityIds)
        ->whereDoesntHave('question')
        ->firstOrFail();
    $sourceAsset = LearningMapAsset::query()
        ->where('learning_map_id', $source->id)
        ->firstOrFail();
    $messageTopic = LearningMessageTopic::query()->create([
        'learning_map_asset_id' => $sourceAsset->id,
        'slug' => 'import-topic',
        'title' => 'Import topic',
    ]);
    $sourceActivity->update([
        'config' => ['messageTopicId' => $messageTopic->id],
    ]);
    $question = LearningQuestion::query()->create([
        'learning_activity_id' => $sourceActivity->id,
        'prompt' => 'What changed?',
        'feedback_correct' => 'Good observation.',
        'feedback_incorrect' => 'Look again.',
        'explanation' => 'The useful clue changed.',
        'allow_multiple' => false,
    ]);
    LearningQuestionOption::query()->create([
        'learning_question_id' => $question->id,
        'label' => 'The clue',
        'body' => 'The clue changed.',
        'is_correct' => true,
        'outcome_key' => 'noticed',
        'feedback' => 'Exactly.',
        'weights' => ['pattern-recognition' => 1],
        'sort_order' => 0,
    ]);
    $dialogueNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $sourceActivity->id,
        'type' => 'npc_monologue',
        'title' => 'Guide',
        'body' => 'Notice the clue.',
        'config' => ['portraitUrl' => '/images/characters/mentor-calm.png'],
        'sort_order' => 0,
        'graph_position_x' => 100,
        'graph_position_y' => 100,
    ]);
    NpcDialogueNode::query()->create([
        'learning_activity_id' => $sourceActivity->id,
        'type' => 'end',
        'title' => 'End',
        'body' => 'Keep looking.',
        'config' => [],
        'sort_order' => 1,
        'graph_position_x' => 400,
        'graph_position_y' => 100,
    ]);
    $dialogueEnd = NpcDialogueNode::query()->latest('id')->firstOrFail();
    NpcDialogueTransition::query()->create([
        'learning_activity_id' => $sourceActivity->id,
        'from_dialogue_node_id' => $dialogueNode->id,
        'to_dialogue_node_id' => $dialogueEnd->id,
        'from_connector' => 'out',
        'to_connector' => 'in',
    ]);
    LearningActivityTranslation::query()->create([
        'learning_activity_id' => $sourceActivity->id,
        'locale' => 'de',
        'content' => ['title' => 'Beobachtung'],
    ]);
    $export = $this->actingAs($admin)
        ->get(route('settings.worlds.maps.export', $source));

    $response = $this->actingAs($admin)
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'first-sector.json',
                $export->streamedContent(),
            ),
            'slug' => 'first-sector-imported',
            'title' => 'First Sector Imported',
        ]);

    $imported = LearningMap::query()
        ->where('slug', 'first-sector-imported')
        ->firstOrFail();
    $importedNodeIds = $imported->nodes()->pluck('id');
    $importedActivityIds = LearningActivity::query()
        ->whereIn('learning_node_id', $importedNodeIds)
        ->pluck('id');
    $importedPortal = LearningPortalLink::query()
        ->whereIn('source_learning_node_id', $importedNodeIds)
        ->firstOrFail();
    $returnNode = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    $response->assertRedirect(route('settings.worlds.maps.edit', $imported));

    expect($imported->id)->not->toBe($source->id)
        ->and($importedNodeIds->intersect($sourceNodeIds))->toBeEmpty()
        ->and($importedActivityIds->intersect($sourceActivityIds))->toBeEmpty()
        ->and($importedNodeIds)->toHaveCount($sourceNodeIds->count())
        ->and($importedActivityIds)->toHaveCount($sourceActivityIds->count())
        ->and(LearningMapAsset::query()->where('learning_map_id', $imported->id)->count())
        ->toBe(LearningMapAsset::query()->where('learning_map_id', $source->id)->count())
        ->and(LearningMessageTopic::query()->whereHas('mapAsset', fn ($query) => $query->where('learning_map_id', $imported->id))->count())
        ->toBe(LearningMessageTopic::query()->whereHas('mapAsset', fn ($query) => $query->where('learning_map_id', $source->id))->count())
        ->and(LearningQuestion::query()->whereIn('learning_activity_id', $importedActivityIds)->count())
        ->toBe(LearningQuestion::query()->whereIn('learning_activity_id', $sourceActivityIds)->count())
        ->and(NpcDialogueNode::query()->whereIn('learning_activity_id', $importedActivityIds)->count())
        ->toBe(NpcDialogueNode::query()->whereIn('learning_activity_id', $sourceActivityIds)->count())
        ->and(LearningActivityTranslation::query()->whereIn('learning_activity_id', $importedActivityIds)->count())
        ->toBe(LearningActivityTranslation::query()->whereIn('learning_activity_id', $sourceActivityIds)->count())
        ->and(ActivityTransition::query()->whereIn('from_activity_id', $importedActivityIds)->count())
        ->toBe(ActivityTransition::query()->whereIn('from_activity_id', $sourceActivityIds)->count())
        ->and($importedPortal->target_learning_node_id)->toBe($returnNode->id)
        ->and($importedPortal->label)->toBe('First Clearing to Quiet Library')
        ->and($imported->access_roles)->toBeNull()
        ->and(LearningActivity::query()->whereIn('learning_node_id', $importedNodeIds)->pluck('ai_review_status')->unique()->all())
        ->toBe([LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW]);
});

test('map import rejects a manifest from another workspace before creating content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $mapCount = LearningMap::query()->count();

    $manifest = [
        'format' => 'wicked-learning-map',
        'formatVersion' => 1,
        'world' => ['slug' => 'another-workspace', 'title' => 'Another workspace'],
        'map' => ['slug' => 'portable-map', 'title' => 'Portable map'],
        'nodes' => [],
        'mapAssets' => [],
        'portalTargets' => [],
        'references' => ['mediaUrls' => []],
    ];

    $this->actingAs($admin)
        ->from(route('settings.index', ['panel' => 'admin-world-builder']))
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'another-workspace.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
            'title' => 'Should not be created',
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map import rejects unresolved authored references before creating content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $manifest = json_decode(
        $this->actingAs($admin)
            ->get(route('settings.worlds.maps.export', $source))
            ->streamedContent(),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $mapCount = LearningMap::query()->count();

    $manifest['portalTargets'][0]['targetNodeSlug'] = 'missing-node';

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'missing-target.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
            'title' => 'Should not be created',
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount);

    $manifest['map']['topicSlug'] = 'missing-topic';

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'missing-topic.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
            'title' => 'Should not be created',
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map import rejects missing uploaded media references before creating content', function () {
    Storage::fake('public');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $mapCount = LearningMap::query()->count();
    $manifest = [
        'format' => 'wicked-learning-map',
        'formatVersion' => 1,
        'world' => ['slug' => 'demo-learning-world', 'title' => 'Demo learning world'],
        'map' => [
            'slug' => 'missing-media-map',
            'title' => 'Missing media map',
            'backgroundConfig' => [
                'dark' => ['imageUrl' => '/storage/learning/media/missing.svg'],
            ],
        ],
        'nodes' => [],
        'mapAssets' => [],
        'portalTargets' => [],
        'references' => ['mediaUrls' => ['/storage/learning/media/missing.svg']],
    ];

    $this->actingAs($admin)
        ->from(route('settings.index', ['panel' => 'admin-world-builder']))
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'missing-media.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
            'title' => 'Should not be created',
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map import rejects external media references before creating content', function () {
    Storage::fake('public');
    Storage::disk('public')->put('learning/media/portable.svg', '<svg></svg>');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $mapCount = LearningMap::query()->count();
    $manifest = [
        'format' => 'wicked-learning-map',
        'formatVersion' => 1,
        'world' => ['slug' => 'demo-learning-world', 'title' => 'Demo learning world'],
        'map' => [
            'slug' => 'external-media-map',
            'title' => 'External media map',
            'backgroundConfig' => [
                'dark' => ['imageUrl' => 'https://example.com/storage/learning/media/portable.svg'],
            ],
        ],
        'nodes' => [],
        'mapAssets' => [],
        'portalTargets' => [],
        'references' => ['mediaUrls' => ['https://example.com/storage/learning/media/portable.svg']],
    ];

    $this->actingAs($admin)
        ->from(route('settings.index', ['panel' => 'admin-world-builder']))
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'external-media.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
            'title' => 'Should not be created',
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map import rejects missing bundled media references before creating content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $mapCount = LearningMap::query()->count();
    $manifest = [
        'format' => 'wicked-learning-map',
        'formatVersion' => 1,
        'world' => ['slug' => 'demo-learning-world', 'title' => 'Demo learning world'],
        'map' => [
            'slug' => 'missing-bundled-media-map',
            'title' => 'Missing bundled media map',
            'backgroundConfig' => [
                'dark' => ['imageUrl' => '/images/does-not-exist.png'],
            ],
        ],
        'nodes' => [],
        'mapAssets' => [],
        'portalTargets' => [],
        'references' => ['mediaUrls' => ['/images/does-not-exist.png']],
    ];

    $this->actingAs($admin)
        ->from(route('settings.index', ['panel' => 'admin-world-builder']))
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'missing-bundled-media.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
            'title' => 'Should not be created',
        ])
        ->assertSessionHasErrors('manifest');

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('map import preserves an available uploaded media reference', function () {
    Storage::fake('public');
    Storage::disk('public')->put('learning/media/portable.svg', '<svg></svg>');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $mediaUrl = '/storage/learning/media/portable.svg';
    $manifest = [
        'format' => 'wicked-learning-map',
        'formatVersion' => 1,
        'world' => ['slug' => 'demo-learning-world', 'title' => 'Demo learning world'],
        'map' => [
            'slug' => 'portable-media-map',
            'title' => 'Portable media map',
            'backgroundConfig' => [
                'dark' => ['imageUrl' => $mediaUrl],
            ],
        ],
        'nodes' => [],
        'mapAssets' => [],
        'portalTargets' => [],
        'references' => ['mediaUrls' => [$mediaUrl]],
    ];

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.import'), [
            'manifest' => UploadedFile::fake()->createWithContent(
                'portable-media.json',
                json_encode($manifest, JSON_THROW_ON_ERROR),
            ),
            'slug' => 'portable-media-map-imported',
            'title' => 'Portable media map imported',
        ])
        ->assertRedirect();

    $importedMap = LearningMap::query()
        ->where('slug', 'portable-media-map-imported')
        ->firstOrFail();

    expect($importedMap->background_config['dark']['imageUrl'])->toBe($mediaUrl);
});

test('map authors can duplicate a complete authored map without learner state', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $sourceNodeIds = $source->nodes()->pluck('id');
    $sourceActivityIds = LearningActivity::query()
        ->whereIn('learning_node_id', $sourceNodeIds)
        ->pluck('id');
    $dialogue = LearningCompanionDialogue::query()->create([
        'created_by_user_id' => $admin->id,
        'dialogue_graph' => [
            'version' => 1,
            'start' => 'welcome',
            'nodes' => [['id' => 'welcome', 'type' => 'message', 'message' => 'Hello.']],
        ],
        'name' => 'Map guide',
        'updated_by_user_id' => $admin->id,
    ]);
    LearningCompanionDialogueAssignment::query()->create([
        'learning_companion_dialogue_id' => $dialogue->id,
        'scope_id' => $source->id,
        'scope_type' => 'map',
    ]);
    $counts = [
        'activities' => $sourceActivityIds->count(),
        'assets' => LearningMapAsset::query()->where('learning_map_id', $source->id)->count(),
        'dialogueNodes' => NpcDialogueNode::query()->whereIn('learning_activity_id', $sourceActivityIds)->count(),
        'dialogueTransitions' => NpcDialogueTransition::query()->whereIn('learning_activity_id', $sourceActivityIds)->count(),
        'messageTopics' => LearningMessageTopic::query()->whereIn(
            'learning_map_asset_id',
            LearningMapAsset::query()->where('learning_map_id', $source->id)->pluck('id'),
        )->count(),
        'nodes' => $sourceNodeIds->count(),
        'questions' => LearningActivity::query()->whereIn('id', $sourceActivityIds)->whereHas('question')->count(),
        'starts' => LearningActivityStart::query()->whereIn('learning_node_id', $sourceNodeIds)->count(),
        'transitions' => ActivityTransition::query()->whereIn('from_activity_id', $sourceActivityIds)->count(),
    ];
    $sourcePortal = LearningPortalLink::query()
        ->whereIn('source_learning_node_id', $sourceNodeIds)
        ->firstOrFail();

    $response = $this->actingAs($admin)
        ->post(route('settings.worlds.maps.duplicate', $source), [
            'slug' => 'first-sector-copy',
            'title' => 'First Sector Copy',
        ]);

    $duplicate = LearningMap::query()->where('slug', 'first-sector-copy')->firstOrFail();
    $duplicateNodeIds = $duplicate->nodes()->pluck('id');
    $duplicateActivityIds = LearningActivity::query()
        ->whereIn('learning_node_id', $duplicateNodeIds)
        ->pluck('id');
    $duplicatePortal = LearningPortalLink::query()
        ->whereIn('source_learning_node_id', $duplicateNodeIds)
        ->firstOrFail();

    $response->assertRedirect(route('settings.worlds.maps.edit', $duplicate));

    expect($duplicate->id)->not->toBe($source->id)
        ->and($duplicateNodeIds->intersect($sourceNodeIds))->toBeEmpty()
        ->and($duplicateActivityIds->intersect($sourceActivityIds))->toBeEmpty()
        ->and($duplicate->nodes()->count())->toBe($counts['nodes'])
        ->and(LearningActivity::query()->whereIn('learning_node_id', $duplicateNodeIds)->count())->toBe($counts['activities'])
        ->and(LearningMapAsset::query()->where('learning_map_id', $duplicate->id)->count())->toBe($counts['assets'])
        ->and(LearningMessageTopic::query()->whereIn(
            'learning_map_asset_id',
            LearningMapAsset::query()->where('learning_map_id', $duplicate->id)->pluck('id'),
        )->count())->toBe($counts['messageTopics'])
        ->and(NpcDialogueNode::query()->whereIn('learning_activity_id', $duplicateActivityIds)->count())->toBe($counts['dialogueNodes'])
        ->and(NpcDialogueTransition::query()->whereIn('learning_activity_id', $duplicateActivityIds)->count())->toBe($counts['dialogueTransitions'])
        ->and(LearningActivity::query()->whereIn('learning_node_id', $duplicateNodeIds)->whereHas('question')->count())->toBe($counts['questions'])
        ->and(LearningActivityStart::query()->whereIn('learning_node_id', $duplicateNodeIds)->count())->toBe($counts['starts'])
        ->and(ActivityTransition::query()->whereIn('from_activity_id', $duplicateActivityIds)->count())->toBe($counts['transitions'])
        ->and(LearningActivity::query()->whereIn('id', $duplicateActivityIds)->pluck('ai_review_status')->unique()->all())
        ->toBe([LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW])
        ->and(LearningActivity::query()->whereIn('id', $duplicateActivityIds)->whereNotNull('ai_review')->count())->toBe(0)
        ->and($duplicatePortal->target_learning_node_id)->toBe($sourcePortal->target_learning_node_id)
        ->and(LearningCompanionDialogueAssignment::query()
            ->where('learning_companion_dialogue_id', $dialogue->id)
            ->where('scope_type', 'map')
            ->where('scope_id', $duplicate->id)
            ->exists())->toBeTrue()
        ->and(LearningMap::query()->whereKey($source->id)->exists())->toBeTrue();
});

test('map duplication rejects an existing world slug before creating content', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $mapCount = LearningMap::query()->count();

    $this->actingAs($admin)
        ->from(route('settings.index', ['panel' => 'admin-world-builder']))
        ->post(route('settings.worlds.maps.duplicate', $source), [
            'slug' => 'signal-archive',
            'title' => 'Should not be created',
        ])
        ->assertSessionHasErrors('slug');

    expect(LearningMap::query()->count())->toBe($mapCount);
});

test('admin users must select an item for an item unlock condition', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'slug' => $node->slug,
            'state' => 'locked',
            'title' => $node->title,
            'visual_config' => [
                ...($node->visual_config ?? []),
                'unlock' => [
                    'enabled' => true,
                    'item' => [
                        'enabled' => true,
                    ],
                ],
            ],
        ])
        ->assertSessionHasErrors('visual_config.unlock.item.itemId');
});

test('normal users can not open the world editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('settings.worlds.index'))
        ->assertForbidden();
});

test('activity edits enter the scoped AI review queue', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()
        ->where('slug', 'write-a-field-note')
        ->firstOrFail();

    $activity->forceFill([
        'ai_review_status' => LearningActivity::AI_REVIEW_STATUS_REVIEWED,
        'ai_reviewed_at' => now()->subDay(),
    ])->save();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Welcome to the field notes, revised',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $activity->node));

    $activity->refresh();

    expect($activity->ai_review_status)
        ->toBe(LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW)
        ->and($activity->ai_reviewed_at)->toBeNull();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $activity->node->map->id,
            'node' => $activity->learning_node_id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedWorldNode.activityGraph.activities.0.aiReviewStatus', 'needs_review')
            ->has('selectedWorldNode.activityGraph.activities.0.updatedAt')
            ->where('selectedWorldNode.activityGraph.activities.0.aiReviewedAt', null)
        );
});

test('dialogue content edits queue the parent activity but layout edits do not', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()
        ->where('slug', 'guided-signal-dialogue')
        ->firstOrFail();
    $node = NpcDialogueNode::query()
        ->where('learning_activity_id', $activity->id)
        ->where('type', 'npc_monologue')
        ->firstOrFail();

    $activity->forceFill([
        'ai_review_status' => LearningActivity::AI_REVIEW_STATUS_REVIEWED,
        'ai_reviewed_at' => now()->subDay(),
    ])->save();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.npc-dialogue-nodes.update', $node), [
            'title' => 'Mira opens the revised observation',
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $activity->refresh();

    expect($activity->ai_review_status)
        ->toBe(LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW)
        ->and($activity->ai_reviewed_at)->toBeNull();

    $activity->forceFill([
        'ai_review_status' => LearningActivity::AI_REVIEW_STATUS_REVIEWED,
        'ai_reviewed_at' => now(),
    ])->save();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.npc-dialogue-nodes.update', $node), [
            'graph_position_x' => 260,
            'graph_position_y' => 40,
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    expect($activity->refresh()->ai_review_status)
        ->toBe(LearningActivity::AI_REVIEW_STATUS_REVIEWED);
});

test('admin users can create a map before it has portal links', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.store'), [
            'title' => 'Reflection Harbor',
            'description' => 'A prepared map that will be connected later.',
        ])
        ->assertRedirect(route('settings.worlds.index'));

    expect(LearningMap::query()
        ->where('slug', 'reflection-harbor')
        ->where('title', 'Reflection Harbor')
        ->exists())->toBeTrue()
        ->and(LearningPortalLink::query()->count())->toBe(1);
});

test('normal users can not create world maps', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('settings.worlds.maps.store'), [
            'title' => 'Hidden Harbor',
        ])
        ->assertForbidden();
});

test('admin users can create and delete portal links', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $target = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.portal-links.store'), [
            'source_learning_node_id' => $source->id,
            'target_learning_node_id' => $target->id,
            'label' => 'Notes to Archive',
            'description' => 'A test portal route.',
        ])
        ->assertRedirect(route('settings.worlds.index'));

    $link = LearningPortalLink::query()
        ->where('source_learning_node_id', $source->id)
        ->where('target_learning_node_id', $target->id)
        ->firstOrFail();

    expect($link->label)->toBe('Notes to Archive')
        ->and($link->description)->toBe('A test portal route.')
        ->and($link->config['travelMode'])->toBe('portal');

    $this->actingAs($admin)
        ->delete(route('settings.worlds.portal-links.destroy', $link))
        ->assertRedirect(route('settings.worlds.index'));

    expect(LearningPortalLink::query()->whereKey($link->id)->exists())->toBeFalse();
});

test('duplicate portal links are rejected', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $target = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.portal-links.store'), [
            'source_learning_node_id' => $source->id,
            'target_learning_node_id' => $target->id,
        ])
        ->assertSessionHasErrors('target_learning_node_id');
});

test('admin users can open the hex map editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.worlds.maps.edit', $map))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'nodes',
        ]));
});

test('admin users can open the full map configuration screen', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.worlds.maps.configure', $map))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'configure',
        ]));
});

test('admin users can delete map tiles and related authoring state', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $sourceNode = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $targetNode = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'temporary-tile',
        'title' => 'Temporary tile',
        'description' => 'This tile can be removed.',
        'position_q' => 4,
        'position_r' => 0,
        'state' => 'available',
        'visual_config' => [],
    ]);
    $sourceActivity = LearningActivity::query()->where('learning_node_id', $sourceNode->id)->firstOrFail();
    $targetActivity = LearningActivity::query()->create([
        'learning_node_id' => $targetNode->id,
        'slug' => 'temporary-activity',
        'title' => 'Temporary activity',
        'type' => 'reflection',
        'config' => [],
        'sort_order' => 10,
    ]);
    $transition = ActivityTransition::query()->create([
        'from_activity_id' => $sourceActivity->id,
        'to_activity_id' => $targetActivity->id,
        'from_connector' => 'completed',
        'to_connector' => 'in',
        'trigger' => 'completed',
    ]);

    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $targetNode->id,
        'learning_activity_id' => $targetActivity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now(),
        'completed_at' => now(),
    ]);

    $sourceNode->forceFill([
        'visual_config' => [
            'unlock' => [
                'requiredNodeIds' => [$targetNode->id],
                'rules' => [
                    'type' => 'group',
                    'operator' => 'and',
                    'rules' => [
                        [
                            'type' => 'node_completed',
                            'nodeId' => $targetNode->id,
                        ],
                    ],
                ],
            ],
        ],
    ])->save();

    $this->actingAs($admin)
        ->delete(route('settings.worlds.nodes.destroy', $targetNode))
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    expect(LearningNode::query()->whereKey($targetNode->id)->exists())->toBeFalse()
        ->and(LearningActivity::query()->whereKey($targetActivity->id)->exists())->toBeFalse()
        ->and(ActivityTransition::query()->whereKey($transition->id)->exists())->toBeFalse()
        ->and(LearnerActivityProgress::query()->where('learning_node_id', $targetNode->id)->exists())->toBeFalse();

    $sourceNode->refresh();

    expect($sourceNode->visual_config['unlock']['requiredNodeIds'])->toBe([])
        ->and($sourceNode->visual_config['unlock']['rules']['rules'])->toBe([]);
});

test('admin users can delete world maps and related map state', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $deletedNode = LearningNode::query()
        ->where('learning_map_id', $map->id)
        ->where('slug', 'portal-foundation')
        ->firstOrFail();
    $externalNode = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    UserPreference::query()->create([
        'user_id' => $learner->id,
        'appearance' => 'dark',
        'settings' => [
            'learning' => [
                'lastMapId' => $map->id,
                'lastMapSlug' => $map->slug,
            ],
        ],
    ]);

    $externalNode->forceFill([
        'visual_config' => [
            'unlock' => [
                'requiredNodeIds' => [$deletedNode->id],
                'rules' => [
                    'type' => 'group',
                    'operator' => 'and',
                    'rules' => [
                        [
                            'type' => 'node_completed',
                            'nodeId' => $deletedNode->id,
                        ],
                    ],
                ],
            ],
        ],
    ])->save();

    $this->actingAs($admin)
        ->delete(route('settings.worlds.maps.destroy', $map))
        ->assertRedirect(route('settings.worlds.index'));

    $externalNode->refresh();
    $preference = $learner->refresh()->preference;

    expect(LearningMap::query()->whereKey($map->id)->exists())->toBeFalse()
        ->and(LearningNode::query()->where('learning_map_id', $map->id)->exists())->toBeFalse()
        ->and(LearningPortalLink::query()
            ->where('source_learning_node_id', $deletedNode->id)
            ->orWhere('target_learning_node_id', $deletedNode->id)
            ->exists())->toBeFalse()
        ->and($externalNode->visual_config['unlock']['requiredNodeIds'])->toBe([])
        ->and($externalNode->visual_config['unlock']['rules']['rules'])->toBe([])
        ->and($preference?->settings['learning']['lastMapId'] ?? null)->toBeNull()
        ->and($preference?->settings['learning']['lastMapSlug'] ?? null)->toBeNull();
});

test('admin users can manage map access permissions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedWorldMap.editableMap.map.accessRoles', [User::ROLE_USER, User::ROLE_ADMIN])
            ->where('selectedWorldMap.accessGroups.0.slug', 'public')
        );

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.access.update', $map), [
            'access_roles' => ['public', User::ROLE_ADMIN],
        ])
        ->assertRedirect(route('settings.index', [
            'map' => $map->id,
            'panel' => 'admin-world-builder',
            'worldView' => 'nodes',
        ]));

    $map->refresh();

    expect($map->access_roles)->toBe(['public', User::ROLE_ADMIN]);

    $this->app['auth']->forgetGuards();

    $this->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->has('world.maps', 1)
            ->where('world.maps.0.slug', 'first-sector')
        );

    $this->getJson(route('learning.search', ['query' => 'Quiet Library']))
        ->assertOk()
        ->assertJsonCount(0, 'results');
});

test('admin users can open the activity graph editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.worlds.nodes.activities.edit', $node))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $node->map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]));
});

test('admin users can persist activity graph special node positions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.activities.layout.update', $node), [
            'node' => 'start',
            'position' => ['x' => -360, 'y' => 140],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $node->refresh();

    expect($node->activity_graph_layout['start'])->toBe([
        'x' => -360,
        'y' => 140,
    ]);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $node->map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedWorldNode.activityGraph.node.graphLayout.start.x', -360)
            ->where('selectedWorldNode.activityGraph.node.graphLayout.start.y', 140)
        );
});

test('admin users configure portal destinations from portal activities', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $sourceNode = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $targetActivity = LearningActivity::query()->where('slug', 'arrive-through-the-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $sourceNode), [
            'title' => 'Open archive portal',
            'type' => 'portal',
            'portal_mode' => 'output',
            'portal_background_dark' => '/storage/learning/nodes/portal-dark.webp',
            'portal_background_light' => '/storage/learning/nodes/portal-light.webp',
            'portal_assets' => [
                [
                    'id' => 'destination-view',
                    'imageDark' => '/storage/learning/nodes/archive-dark.webp',
                    'imageLight' => '/storage/learning/nodes/archive-light.webp',
                    'label' => 'Destination view',
                    'layer' => 'above-background',
                    'mirrored' => true,
                    'opacity' => 82,
                    'width' => 48,
                    'x' => 56,
                    'y' => 42,
                ],
            ],
            'portal_bubble_text' => 'Before you lies an unexplored archive.',
            'portal_bubble_typing_speed' => 32,
            'portal_bubble_color_dark' => '#0f172a',
            'portal_bubble_color_light' => '#ffffff',
            'portal_bubble_border_color_dark' => '#8f64dd',
            'portal_bubble_border_color_light' => '#7c3aed',
            'portal_bubble_text_color_dark' => '#f8fafc',
            'portal_bubble_text_color_light' => '#111827',
            'portal_duration_seconds' => 2.5,
            'portal_foreground_dark' => '/storage/learning/nodes/swirl-dark.svg',
            'portal_foreground_light' => '/storage/learning/nodes/swirl-light.svg',
            'portal_foreground_width' => 36,
            'portal_foreground_x' => 42,
            'portal_foreground_y' => 58,
            'portal_show_on_arrival' => true,
            'portal_swirl_enabled' => false,
            'portal_wait_for_enter' => true,
            'target_portal_activity_id' => $targetActivity->id,
            'introduction' => 'Travel toward the archive.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $sourceNode));

    $activity = LearningActivity::query()->where('slug', 'open-archive-portal')->firstOrFail();
    $link = LearningPortalLink::query()
        ->where('source_learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($link->source_learning_node_id)->toBe($sourceNode->id)
        ->and($link->target_learning_node_id)->toBe($targetActivity->learning_node_id)
        ->and($link->target_learning_activity_id)->toBe($targetActivity->id);
    expect($activity->config['portalBackgroundDark'])->toBe('/storage/learning/nodes/portal-dark.webp')
        ->and($activity->config['portalBackgroundLight'])->toBe('/storage/learning/nodes/portal-light.webp')
        ->and($activity->config['portalAssets'][0]['id'])->toBe('destination-view')
        ->and($activity->config['portalAssets'][0]['imageDark'])->toBe('/storage/learning/nodes/archive-dark.webp')
        ->and($activity->config['portalAssets'][0]['imageLight'])->toBe('/storage/learning/nodes/archive-light.webp')
        ->and($activity->config['portalAssets'][0]['layer'])->toBe('above-background')
        ->and($activity->config['portalAssets'][0]['mirrored'])->toBeTrue()
        ->and((float) $activity->config['portalAssets'][0]['opacity'])->toBe(82.0)
        ->and((float) $activity->config['portalAssets'][0]['width'])->toBe(48.0)
        ->and((float) $activity->config['portalAssets'][0]['x'])->toBe(56.0)
        ->and((float) $activity->config['portalAssets'][0]['y'])->toBe(42.0)
        ->and($activity->config['portalBubbleText'])->toBe('Before you lies an unexplored archive.')
        ->and($activity->config['portalBubbleTypingSpeed'])->toBe(32)
        ->and($activity->config['portalBubbleColorDark'])->toBe('#0f172a')
        ->and($activity->config['portalBubbleColorLight'])->toBe('#ffffff')
        ->and($activity->config['portalBubbleBorderColorDark'])->toBe('#8f64dd')
        ->and($activity->config['portalBubbleBorderColorLight'])->toBe('#7c3aed')
        ->and($activity->config['portalBubbleTextColorDark'])->toBe('#f8fafc')
        ->and($activity->config['portalBubbleTextColorLight'])->toBe('#111827')
        ->and($activity->config['portalDurationSeconds'])->toBe(2.5)
        ->and($activity->config['portalForegroundDark'])->toBe('/storage/learning/nodes/swirl-dark.svg')
        ->and($activity->config['portalForegroundLight'])->toBe('/storage/learning/nodes/swirl-light.svg')
        ->and((float) $activity->config['portalForegroundWidth'])->toBe(36.0)
        ->and($activity->config['portalForegroundX'])->toBe(42)
        ->and($activity->config['portalForegroundY'])->toBe(58)
        ->and($activity->config['portalShowOnArrival'])->toBeTrue()
        ->and($activity->config['portalSwirlEnabled'])->toBeFalse()
        ->and($activity->config['portalWaitForEnter'])->toBeTrue();

    $targetActivity->forceFill([
        'config' => [
            ...($targetActivity->config ?? []),
            'portalBackgroundLight' => '/storage/learning/nodes/old-exit-light.webp',
            'portalForegroundLight' => '/storage/learning/nodes/old-exit-swirl.svg',
        ],
    ])->save();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $targetActivity), [
            'title' => $targetActivity->title,
            'slug' => $targetActivity->slug,
            'type' => 'portal',
            'introduction' => 'Arrive back through the gate.',
            'portal_mode' => 'input',
            'portal_background_dark' => '/storage/learning/nodes/exit-dark.webp',
            'portal_background_light' => '',
            'portal_background_mirrored' => true,
            'portal_assets' => [
                [
                    'id' => 'arrival-mist',
                    'imageDark' => '/storage/learning/nodes/mist-dark.webp',
                    'imageLight' => '',
                    'label' => 'Arrival mist',
                    'layer' => 'front',
                    'mirrored' => false,
                    'opacity' => 64,
                    'width' => 72,
                    'x' => 50,
                    'y' => 60,
                ],
            ],
            'portal_duration_seconds' => 4,
            'portal_foreground_dark' => '/storage/learning/nodes/exit-swirl.svg',
            'portal_foreground_light' => '',
            'portal_foreground_mirrored' => true,
            'portal_foreground_width' => 44,
            'portal_foreground_x' => 46,
            'portal_foreground_y' => 54,
            'portal_show_on_arrival' => false,
            'portal_swirl_enabled' => true,
            'portal_wait_for_enter' => false,
            'target_portal_activity_id' => '',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $targetActivity->node));

    $targetActivity->refresh();

    expect($targetActivity->config['portalMode'])->toBe('input')
        ->and($targetActivity->config['portalBackgroundDark'])->toBe('/storage/learning/nodes/exit-dark.webp')
        ->and($targetActivity->config['portalBackgroundLight'])->toBe('')
        ->and($targetActivity->config['portalBackgroundMirrored'])->toBeTrue()
        ->and($targetActivity->config['portalAssets'][0]['id'])->toBe('arrival-mist')
        ->and($targetActivity->config['portalAssets'][0]['layer'])->toBe('front')
        ->and((float) $targetActivity->config['portalAssets'][0]['opacity'])->toBe(64.0)
        ->and((float) $targetActivity->config['portalDurationSeconds'])->toBe(4.0)
        ->and($targetActivity->config['portalForegroundDark'])->toBe('/storage/learning/nodes/exit-swirl.svg')
        ->and($targetActivity->config['portalForegroundLight'])->toBe('')
        ->and($targetActivity->config['portalForegroundMirrored'])->toBeTrue()
        ->and((float) $targetActivity->config['portalForegroundWidth'])->toBe(44.0)
        ->and($targetActivity->config['portalForegroundX'])->toBe(46)
        ->and($targetActivity->config['portalForegroundY'])->toBe(54)
        ->and($targetActivity->config['portalShowOnArrival'])->toBeFalse()
        ->and($targetActivity->config['portalSwirlEnabled'])->toBeTrue()
        ->and($targetActivity->config['portalWaitForEnter'])->toBeFalse();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $sourceNode->map->id,
            'node' => $sourceNode->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('selectedWorldNode.activityGraph.portalCandidates')
        );
});

test('admin users can copy an activity to another editable MapAsset', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $sourceNode = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $targetNode = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $sourceNode), [
            'target_node_id' => $targetNode->id,
            'title' => 'Copied observation practice',
            'type' => 'open_practice',
            'introduction' => 'Practice the same noticing move in a new place.',
            'open_practice_next_step' => 'Write down one pattern you can test.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $targetNode));

    $activity = LearningActivity::query()
        ->where('title', 'Copied observation practice')
        ->firstOrFail();

    expect($activity->learning_node_id)->toBe($targetNode->id)
        ->and($activity->introduction)->toBe('Practice the same noticing move in a new place.');
});

test('admin users can update obstacle activity images', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()
        ->where('slug', 'clear-the-noisy-gate')
        ->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'obstacle_background_dark' => '/storage/learning/nodes/mineshaft-dark.svg',
            'obstacle_background_light' => '/storage/learning/nodes/mineshaft-light.svg',
            'obstacle_image_dark' => '/storage/learning/nodes/rock-wall-dark.svg',
            'obstacle_image_light' => '/storage/learning/nodes/rock-wall-light.svg',
            'obstacle_x' => 23,
            'obstacle_y' => 64,
            'obstacle_width' => 12,
            'obstacle_revisit_background_dark' => '/storage/learning/nodes/cleared-mineshaft-dark.svg',
            'obstacle_revisit_background_light' => '/storage/learning/nodes/cleared-mineshaft-light.svg',
            'obstacle_revisit_image_dark' => '/storage/learning/nodes/cleared-rock-dark.svg',
            'obstacle_revisit_image_light' => '/storage/learning/nodes/cleared-rock-light.svg',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $activity->node));

    $activity->refresh();

    expect($activity->config['backgroundDark'])->toBe('/storage/learning/nodes/mineshaft-dark.svg')
        ->and($activity->config['backgroundLight'])->toBe('/storage/learning/nodes/mineshaft-light.svg')
        ->and($activity->config['obstacleImageDark'])->toBe('/storage/learning/nodes/rock-wall-dark.svg')
        ->and($activity->config['obstacleImageLight'])->toBe('/storage/learning/nodes/rock-wall-light.svg')
        ->and($activity->config['obstacleX'])->toBe(23)
        ->and($activity->config['obstacleY'])->toBe(64)
        ->and($activity->config['obstacleWidth'])->toBe(12)
        ->and($activity->config['revisitBackgroundDark'])->toBe('/storage/learning/nodes/cleared-mineshaft-dark.svg')
        ->and($activity->config['revisitBackgroundLight'])->toBe('/storage/learning/nodes/cleared-mineshaft-light.svg')
        ->and($activity->config['revisitImageDark'])->toBe('/storage/learning/nodes/cleared-rock-dark.svg')
        ->and($activity->config['revisitImageLight'])->toBe('/storage/learning/nodes/cleared-rock-light.svg');
});

test('admin users can create markdown page graph activities', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Read the briefing',
            'type' => 'markdown',
            'introduction' => 'A small page route.',
            'markdown_pages' => [
                [
                    'id' => 'page-a',
                    'title' => 'Briefing',
                    'body' => "# Briefing\n\n![Diagram](/storage/learning/nodes/diagram.svg)",
                    'position' => ['x' => 160, 'y' => 90],
                    'visual' => [
                        'pageColorDark' => '#0f172a',
                        'pageColorLight' => '#ffffff',
                        'borderColorDark' => '#2dd4bf',
                        'borderColorLight' => '#0891b2',
                        'headingColorDark' => '#67e8f9',
                        'headingColorLight' => '#0e7490',
                        'textColorDark' => '#f8fafc',
                        'textColorLight' => '#0f172a',
                    ],
                ],
            ],
            'markdown_transitions' => [
                ['id' => 'start-a', 'from' => 'start', 'to' => 'page-a'],
                ['id' => 'a-end', 'from' => 'page-a', 'to' => 'end'],
            ],
            'markdown_graph_layout' => [
                'start' => ['x' => -240, 'y' => 120],
                'end' => ['x' => 620, 'y' => 130],
            ],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'read-the-briefing')
        ->firstOrFail();

    expect($activity->type)->toBe('markdown')
        ->and($activity->config['markdownPages'][0]['title'])->toBe('Briefing')
        ->and($activity->config['markdownPages'][0]['body'])->toContain('![Diagram]')
        ->and($activity->config['markdownPages'][0]['visual']['borderColorDark'])->toBe('#2dd4bf')
        ->and($activity->config['markdownPages'][0]['visual']['headingColorDark'])->toBe('#67e8f9')
        ->and($activity->config['markdownTransitions'][0]['from'])->toBe('start')
        ->and($activity->config['markdownTransitions'][1]['to'])->toBe('end')
        ->and($activity->config['markdownGraphLayout']['start'])->toBe([
            'x' => -240,
            'y' => 120,
        ]);
});

test('admin users can open and save the markdown page editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'markdown-route',
        'title' => 'Markdown route',
        'type' => 'markdown',
        'config' => [
            'markdownPages' => [
                [
                    'id' => 'page-a',
                    'title' => 'Old page',
                    'body' => 'Old text',
                    'position' => ['x' => 100, 'y' => 80],
                    'visual' => [
                        'pageColorDark' => '#0f172a',
                        'pageColorLight' => '#ffffff',
                        'borderColorDark' => '#2dd4bf',
                        'borderColorLight' => '#0891b2',
                        'headingColorDark' => '#67e8f9',
                        'headingColorLight' => '#0e7490',
                        'textColorDark' => '#f8fafc',
                        'textColorLight' => '#0f172a',
                    ],
                ],
            ],
            'markdownTransitions' => [
                ['id' => 'start-a', 'from' => 'start', 'to' => 'page-a'],
                ['id' => 'a-end', 'from' => 'page-a', 'to' => 'end'],
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->get(route('settings.worlds.activities.markdown.edit', $activity))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/worlds/edit-markdown-activity')
            ->where('markdownActivity.node.slug', 'field-notes')
            ->where('markdownActivity.activity.slug', 'markdown-route')
            ->where('markdownActivity.activity.config.markdownPages.0.title', 'Old page')
        );

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Markdown route',
            'type' => 'markdown',
            'return_to_markdown' => true,
            'markdown_pages' => [
                [
                    'id' => 'page-a',
                    'title' => 'Updated page',
                    'body' => "# Updated\n\n![Video](/storage/learning/nodes/intro.webm)",
                    'position' => ['x' => 140, 'y' => 120],
                    'visual' => [
                        'pageColorDark' => '#111827',
                        'pageColorLight' => '#f8fafc',
                        'borderColorDark' => '#22d3ee',
                        'borderColorLight' => '#0284c7',
                        'headingColorDark' => '#a5f3fc',
                        'headingColorLight' => '#0369a1',
                        'textColorDark' => '#f9fafb',
                        'textColorLight' => '#111827',
                    ],
                ],
            ],
            'markdown_transitions' => [
                ['id' => 'start-a', 'from' => 'start', 'to' => 'page-a'],
                ['id' => 'a-end', 'from' => 'page-a', 'to' => 'end'],
            ],
            'markdown_graph_layout' => [
                'start' => ['x' => -320, 'y' => 110],
                'end' => ['x' => 680, 'y' => 110],
            ],
        ])
        ->assertRedirect(route('settings.worlds.activities.markdown.edit', $activity));

    $activity->refresh();

    expect($activity->config['markdownPages'][0]['title'])->toBe('Updated page')
        ->and($activity->config['markdownPages'][0]['body'])->toContain('intro.webm')
        ->and($activity->config['markdownPages'][0]['visual']['headingColorLight'])->toBe('#0369a1')
        ->and($activity->config['markdownGraphLayout']['end'])->toBe([
            'x' => 680,
            'y' => 110,
        ]);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.graph-layout.update', $activity), [
            'node' => 'start',
            'position' => ['x' => -420, 'y' => 160],
        ])
        ->assertRedirect(route('settings.worlds.activities.markdown.edit', $activity));

    $activity->refresh();

    expect($activity->config['markdownGraphLayout']['start'])->toBe([
        'x' => -420,
        'y' => 160,
    ]);
});

test('admin users can create and connect activity graph nodes', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Choose a note path',
            'type' => 'open_practice',
            'introduction' => 'A branchable activity shell.',
            'open_practice_next_step' => 'Choose one observation to investigate next.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()->where('slug', 'choose-a-note-path')->firstOrFail();
    $nextActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'follow-the-note',
        'title' => 'Follow the note',
        'type' => 'reflection',
        'config' => [],
        'sort_order' => 210,
    ]);

    expect($activity->config['nextStep'])->toBe('Choose one observation to investigate next.');

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'open_practice_next_step' => 'Follow the clue that feels most useful.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->refresh()->config['nextStep'])->toBe('Follow the clue that feels most useful.');

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $activity->id,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect(LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_id', $activity->id)
        ->exists())->toBeTrue();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activity-transitions.store', $node), [
            'from_activity_id' => $activity->id,
            'to_activity_id' => $nextActivity->id,
            'from_connector' => 'completed',
            'to_connector' => 'in',
            'label' => 'Choose another way',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $nextTransition = $activity->transitions()
        ->where('to_activity_id', $nextActivity->id)
        ->firstOrFail();

    expect($nextTransition->label)->toBe('Choose another way');

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activity-transitions.update', $nextTransition), [
            'label' => 'Take a closer look',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($nextTransition->refresh()->label)->toBe('Take a closer look');

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activity-transitions.update', $nextTransition), [
            'label' => '',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($nextTransition->refresh()->label)->toBe('Follow the note');

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activity-transitions.store', $node), [
            'from_activity_id' => $activity->id,
            'to_activity_id' => null,
            'from_connector' => 'completed',
            'to_connector' => 'end',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $transition = $activity->transitions()
        ->whereNull('to_activity_id')
        ->firstOrFail();

    expect($transition->to_activity_id)->toBeNull()
        ->and($transition->from_connector)->toBe('completed')
        ->and($transition->to_connector)->toBe('end');

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activity-transitions.destroy', $transition))
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activity-transitions.destroy', $nextTransition))
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->transitions()->exists())->toBeFalse();
});

test('admin users can create an explicit review activity', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Revisit the field note',
            'type' => 'review',
            'reflection_prompt' => 'What do you notice now that you missed before?',
            'reflection_topic' => 'Field studies',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'revisit-the-field-note')
        ->firstOrFail();

    expect($activity->type)->toBe('review')
        ->and($activity->config['prompt'])
        ->toBe('What do you notice now that you missed before?')
        ->and($activity->config['topic'])->toBe('Field studies');
});

test('admin users can author npc dialogue activity graphs', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Meet the Archivist',
            'type' => 'npc_dialogue',
            'introduction' => 'A branching conversation with an archivist.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'meet-the-archivist')
        ->firstOrFail();
    $endNode = NpcDialogueNode::query()
        ->where('learning_activity_id', $activity->id)
        ->where('type', 'end')
        ->firstOrFail();

    expect($endNode->config['connectorSymbol'])->toBe('A')
        ->and($endNode->config['connectorColor'])->toBe('#0ea5e9');

    $this->actingAs($admin)
        ->get(route('settings.worlds.activities.npc-dialogue.edit', $activity))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/worlds/edit-npc-dialogue')
            ->where('dialogueGraph.activity.slug', 'meet-the-archivist')
            ->has('dialogueGraph.dialogueNodes', 1)
        );

    $this->actingAs($admin)
        ->post(route('settings.worlds.activities.npc-dialogue.nodes.store', $activity), [
            'body' => 'Welcome to the archive. Let us follow the useful trace.',
            'config' => [
                'backgroundDark' => '/storage/learning/dialogue/archive-dark.webp',
                'bubbleColorDark' => '#0f172a',
                'npcX' => 48,
                'typingSpeed' => 24,
            ],
            'title' => 'Archivist greeting',
            'type' => 'npc_monologue',
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $interaction = NpcDialogueNode::query()
        ->where('learning_activity_id', $activity->id)
        ->where('type', 'npc_monologue')
        ->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.activities.npc-dialogue.transitions.store', $activity), [
            'from_connector' => 'start',
            'from_dialogue_node_id' => null,
            'to_connector' => 'in',
            'to_dialogue_node_id' => $interaction->id,
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $this->actingAs($admin)
        ->post(route('settings.worlds.activities.npc-dialogue.transitions.store', $activity), [
            'from_connector' => 'out',
            'from_dialogue_node_id' => $interaction->id,
            'to_connector' => 'in',
            'to_dialogue_node_id' => $endNode->id,
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    expect(NpcDialogueTransition::query()
        ->where('learning_activity_id', $activity->id)
        ->count())->toBe(2);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.npc-dialogue-nodes.update', $endNode), [
            'config' => [
                'connectorColor' => '#ef4444',
                'connectorSymbol' => 'Z',
            ],
            'title' => 'Needs review',
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $endNode->refresh();

    expect($endNode->title)->toBe('Needs review')
        ->and($endNode->config['connectorColor'])->toBe('#ef4444')
        ->and($endNode->config['connectorSymbol'])->toBe('Z');

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.graph-layout.update', $activity), [
            'node' => 'start',
            'position' => ['x' => -300, 'y' => 140],
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $activity->refresh();

    expect($activity->config['dialogueGraphLayout']['start'])->toBe([
        'x' => -300,
        'y' => 140,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activity-transitions.store', $node), [
            'from_activity_id' => $activity->id,
            'from_connector' => 'dialogue-end-'.$endNode->id,
            'to_activity_id' => null,
            'to_connector' => 'end',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->transitions()->where('from_connector', 'dialogue-end-'.$endNode->id)->exists())->toBeTrue();
});

test('learners can answer npc dialogue questions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $learner = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'spot-the-signal',
        'type' => 'npc_dialogue',
        'title' => 'Spot the Signal',
        'introduction' => 'A small dialogue question.',
        'sort_order' => 20,
        'config' => [],
    ]);
    $questionNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_question',
        'title' => 'Mira',
        'body' => 'Which observation is useful?',
        'config' => [
            'questionOutputCount' => 2,
        ],
    ]);
    $guessAnswer = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'answer',
        'title' => 'Guess',
        'body' => 'A dramatic guess.',
        'config' => [
            'answerLabel' => 'A',
            'isCorrect' => false,
        ],
    ]);
    $patternAnswer = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'answer',
        'title' => 'Pattern',
        'body' => 'A repeated event pattern.',
        'config' => [
            'answerLabel' => 'B',
            'isCorrect' => true,
        ],
    ]);
    NpcDialogueTransition::query()->create([
        'learning_activity_id' => $activity->id,
        'from_dialogue_node_id' => $questionNode->id,
        'to_dialogue_node_id' => $guessAnswer->id,
        'from_connector' => 'answer-1',
        'to_connector' => 'in',
    ]);
    NpcDialogueTransition::query()->create([
        'learning_activity_id' => $activity->id,
        'from_dialogue_node_id' => $questionNode->id,
        'to_dialogue_node_id' => $patternAnswer->id,
        'from_connector' => 'answer-2',
        'to_connector' => 'in',
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.npc-dialogue-nodes.answer', $questionNode), [
            'answer_key' => (string) $patternAnswer->id,
        ])
        ->assertOk()
        ->assertJsonPath('answer.answerKey', (string) $patternAnswer->id)
        ->assertJsonPath('answer.answerNodeId', $patternAnswer->id)
        ->assertJsonPath('answer.isCorrect', true)
        ->assertJsonPath('answer.feedback', null);

    expect(NpcDialogueAnswer::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->where('npc_dialogue_node_id', $questionNode->id)
        ->where('answer_key', (string) $patternAnswer->id)
        ->where('is_correct', true)
        ->exists())->toBeTrue();
});

test('admin users can configure multiple independent start routes for a node', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $easyRoute = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'easy-field-route',
        'type' => 'open_practice',
        'title' => 'Easy field route',
        'sort_order' => 100,
    ]);
    $hardRoute = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'hard-field-route',
        'type' => 'open_practice',
        'title' => 'Hard field route',
        'sort_order' => 110,
    ]);
    $exitPortal = LearningActivity::query()->create([
        'config' => ['portalMode' => 'input'],
        'learning_node_id' => $node->id,
        'slug' => 'exit-field-route',
        'type' => 'portal',
        'title' => 'Exit field route',
        'sort_order' => 120,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $exitPortal->id,
        ])
        ->assertSessionHasErrors('activity_id');

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $easyRoute->id,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $hardRoute->id,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect(LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->pluck('learning_activity_id')
        ->all())->toContain($easyRoute->id, $hardRoute->id)
        ->not->toContain($exitPortal->id);

    LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $exitPortal->id,
        'label' => null,
        'sort_order' => 120,
    ]);

    $easyStart = LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_id', $easyRoute->id)
        ->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activity-starts.update', $easyStart), [
            'button_border_color_dark' => '#334155',
            'button_border_color_light' => '#e2e8f0',
            'button_color_dark' => '#0f172a',
            'button_color_light' => '#ffffff',
            'description' => 'Begin with a concrete comparison before exploring the harder route.',
            'image_dark' => '/images/routes/easy-dark.svg',
            'image_light' => '/images/routes/easy-light.svg',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $easyStart->refresh();

    expect($easyStart->button_border_color_dark)->toBe('#334155')
        ->and($easyStart->button_border_color_light)->toBe('#e2e8f0')
        ->and($easyStart->button_color_dark)->toBe('#0f172a')
        ->and($easyStart->button_color_light)->toBe('#ffffff')
        ->and($easyStart->description)->toBe('Begin with a concrete comparison before exploring the harder route.')
        ->and($easyStart->image_dark)->toBe('/images/routes/easy-dark.svg')
        ->and($easyStart->image_light)->toBe('/images/routes/easy-light.svg');

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $node->map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('selectedWorldNode.activityGraph.node.startRoutes', 3)
            ->where('selectedWorldNode.activityGraph.node.startRoutes.1.buttonColorDark', '#0f172a')
            ->where('selectedWorldNode.activityGraph.node.startRoutes.1.buttonBorderColorLight', '#e2e8f0')
            ->where('selectedWorldNode.activityGraph.node.startRoutes.1.imageDark', '/images/routes/easy-dark.svg')
        );

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activity-starts.destroy', $easyStart))
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect(LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_id', $easyRoute->id)
        ->exists())->toBeFalse()
        ->and(LearningActivityStart::query()
            ->where('learning_node_id', $node->id)
            ->where('learning_activity_id', $hardRoute->id)
            ->exists())->toBeTrue();
});

test('admin users can edit and delete activity graph nodes', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->where('learning_node_id', $node->id)->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Updated Field Note',
            'slug' => 'updated-field-note',
            'type' => 'portal',
            'portal_mode' => 'output',
            'introduction' => 'Updated generic activity fields.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity->refresh();

    expect($activity->title)->toBe('Updated Field Note')
        ->and($activity->slug)->toBe('updated-field-note')
        ->and($activity->type)->toBe('portal')
        ->and($activity->config['portalMode'])->toBe('output');

    $node->forceFill(['start_activity_id' => $activity->id])->save();

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activities.destroy', $activity))
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $node->refresh();

    expect(LearningActivity::query()->whereKey($activity->id)->exists())->toBeFalse()
        ->and($node->start_activity_id)->toBeNull();
});

test('admin users can add a tile to a map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.nodes.store', $map), [
            'title' => 'Practice Node',
            'description' => 'A new editable tile.',
            'position_q' => 2,
            'position_r' => -1,
            'state' => 'available',
            'visual_config' => [
                'label' => 'Practice',
                'tooltip' => 'Created from the admin editor.',
                'dark' => [
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                ],
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    expect(LearningNode::query()
        ->where('learning_map_id', $map->id)
        ->where('slug', 'practice-node')
        ->exists())->toBeTrue()
        ->and(LearningPortalLink::query()->count())->toBe(1);
});

test('admin users can add the first tile to an empty map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => LearningMap::query()->where('slug', 'first-sector')->firstOrFail()->learning_world_id,
        'slug' => 'empty-map',
        'title' => 'Empty Map',
        'description' => 'A prepared map without nodes.',
        'background_config' => [],
        'grid_config' => [],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.nodes.store', $map), [
            'title' => 'First Tile',
            'description' => 'The first tile on a prepared empty map.',
            'position_q' => 0,
            'position_r' => 0,
            'state' => 'available',
            'visual_config' => [
                'label' => 'First Tile',
                'tooltip' => 'Starting tile for this map.',
                'dark' => [
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                ],
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    expect(LearningNode::query()
        ->where('learning_map_id', $map->id)
        ->where('slug', 'first-tile')
        ->where('position_q', 0)
        ->where('position_r', 0)
        ->exists())->toBeTrue();
});

test('admin users can edit an existing tile', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => 'Pattern Gate Revised',
            'slug' => 'signal-gate',
            'description' => 'Updated from the admin editor.',
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'available',
            'visual_config' => [
                'label' => 'Pattern Gate',
                'hideImage' => true,
                'hideLabel' => true,
                'tooltip' => 'Edited tile.',
                'dark' => [
                    'tileColor' => '#082f49',
                    'foregroundColor' => '#bae6fd',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#38bdf8',
                    'imageUrl' => '/storage/learning/nodes/dark.svg',
                ],
                'light' => [
                    'tileColor' => '#e0f2fe',
                    'foregroundColor' => '#0369a1',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#0284c7',
                    'imageUrl' => '/storage/learning/nodes/light.svg',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    $node->refresh();

    expect($node->title)->toBe('Pattern Gate Revised')
        ->and($node->description)->toBe('Updated from the admin editor.')
        ->and($node->visual_config['hideImage'])->toBeTrue()
        ->and($node->visual_config['hideLabel'])->toBeTrue()
        ->and($node->visual_config['tooltip'])->toBe('Edited tile.')
        ->and($node->visual_config['dark']['imageUrl'])->toBe('/storage/learning/nodes/dark.svg')
        ->and($node->visual_config['light']['tileColor'])->toBe('#e0f2fe');
});

test('admin unlock diagnostics reject an impossible tile configuration', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => $node->title,
            'slug' => $node->slug,
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'locked',
            'visual_config' => [
                'unlock' => [
                    'enabled' => true,
                    'requiredNodeIds' => [$node->id],
                    'tool' => [
                        'enabled' => true,
                    ],
                ],
                'schedule' => [
                    'unlockAt' => '2026-08-28 12:00:00',
                    'lockAt' => '2026-08-28 11:00:00',
                ],
            ],
        ])
        ->assertSessionHasErrors([
            'visual_config.unlock.requiredNodeIds.0',
            'visual_config.unlock.tool.toolId',
            'visual_config.schedule.lockAt',
        ]);

    expect($node->refresh()->state)->not->toBe('locked');
});

test('admin unlock diagnostics reject enabled rules without a condition', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => $node->title,
            'slug' => $node->slug,
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'locked',
            'visual_config' => [
                'unlock' => [
                    'enabled' => true,
                ],
            ],
        ])
        ->assertSessionHasErrors('visual_config.unlock.enabled');

    expect($node->refresh()->state)->not->toBe('locked');
});

test('admin unlock diagnostics reject an unknown learner role', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => $node->title,
            'slug' => $node->slug,
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'locked',
            'visual_config' => [
                'unlock' => [
                    'enabled' => true,
                    'roleSlug' => 'missing-role',
                ],
            ],
        ])
        ->assertSessionHasErrors('visual_config.unlock.roleSlug');

    expect($node->refresh()->state)->not->toBe('locked');
});

test('admin unlock diagnostics reject malformed authored rule trees', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => $node->title,
            'slug' => $node->slug,
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'locked',
            'visual_config' => [
                'unlock' => [
                    'enabled' => true,
                    'rules' => [
                        'type' => 'group',
                        'operator' => 'and',
                        'rules' => [
                            [
                                'type' => 'node_completed',
                                'nodeId' => $node->id,
                            ],
                            [
                                'type' => 'unsupported',
                            ],
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasErrors([
            'visual_config.unlock.rules.rules.0.nodeId',
            'visual_config.unlock.rules.rules.1.type',
        ]);

    expect($node->refresh()->state)->not->toBe('locked');
});

test('admin unlock diagnostics reject a locked-node prerequisite cycle', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->firstOrFail();
    $firstNode = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $secondNode = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'cycle-check-node',
        'title' => 'Cycle check node',
        'description' => 'A locked node for unlock diagnostics.',
        'position_q' => 8,
        'position_r' => 8,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'node_completed',
                    'nodeId' => $firstNode->id,
                ],
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $firstNode), [
            'title' => $firstNode->title,
            'slug' => $firstNode->slug,
            'description' => $firstNode->description,
            'position_q' => $firstNode->position_q,
            'position_r' => $firstNode->position_r,
            'state' => 'locked',
            'visual_config' => [
                'unlock' => [
                    'enabled' => true,
                    'rules' => [
                        'type' => 'node_completed',
                        'nodeId' => $secondNode->id,
                    ],
                ],
            ],
        ])
        ->assertSessionHasErrors('visual_config.unlock.rules');

    expect($firstNode->refresh()->visual_config['unlock']['rules'] ?? null)
        ->not->toBe([
            'type' => 'node_completed',
            'nodeId' => $secondNode->id,
        ]);
});

test('admin unlock diagnostics allow a cycle when an OR branch can open independently', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->firstOrFail();
    $firstNode = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $secondNode = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'optional-cycle-node',
        'title' => 'Optional cycle node',
        'description' => 'A locked node for unlock diagnostics.',
        'position_q' => 9,
        'position_r' => 9,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'node_completed',
                    'nodeId' => $firstNode->id,
                ],
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $firstNode), [
            'title' => $firstNode->title,
            'slug' => $firstNode->slug,
            'description' => $firstNode->description,
            'position_q' => $firstNode->position_q,
            'position_r' => $firstNode->position_r,
            'state' => 'locked',
            'visual_config' => [
                'unlock' => [
                    'enabled' => true,
                    'rules' => [
                        'type' => 'group',
                        'operator' => 'or',
                        'rules' => [
                            [
                                'type' => 'node_completed',
                                'nodeId' => $secondNode->id,
                            ],
                            [
                                'type' => 'time_after',
                            ],
                        ],
                    ],
                ],
                'schedule' => [
                    'unlockAt' => '2099-01-01 12:00:00',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $firstNode->map));

    expect($firstNode->refresh()->visual_config['unlock']['rules']['operator'] ?? null)
        ->toBe('or');
});

test('admin unlock diagnostics report locked prerequisites without an authored opening path', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $map = LearningMap::query()->firstOrFail();
    $prerequisite = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'unreachable-path-check',
        'title' => 'Unreachable path check',
        'description' => 'A locked node for authoring diagnostics.',
        'position_q' => 10,
        'position_r' => 10,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'node_completed',
                    'nodeId' => $prerequisite->id,
                ],
            ],
        ],
    ]);

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))
        ->toBe([
            [
                'id' => $prerequisite->id,
                'title' => $prerequisite->title,
            ],
        ]);

    $tool = LearningTool::query()->create([
        'slug' => 'path-check-tool',
        'title' => 'Path check tool',
    ]);
    $prerequisite->forceFill([
        'visual_config' => [
            'unlock' => [
                'tool' => [
                    'enabled' => true,
                    'toolId' => $tool->id,
                ],
            ],
        ],
    ])->save();

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))->toBe([]);
});

test('admin unlock diagnostics only count answer events as an opening path', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $map = LearningMap::query()->firstOrFail();
    $prerequisite = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'answer-event-scope-check',
        'title' => 'Answer event scope check',
        'description' => 'A locked node for authoring diagnostics.',
        'position_q' => 15,
        'position_r' => 15,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'node_completed',
                    'nodeId' => $prerequisite->id,
                ],
            ],
        ],
    ]);
    $activity = LearningActivity::query()
        ->where('learning_node_id', $map->nodes()->where('state', 'available')->value('id'))
        ->firstOrFail();
    NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_monologue',
        'title' => 'Not an answer',
        'body' => 'This event cannot be chosen by a learner.',
        'config' => [
            'events' => [
                'unlockNodeIds' => [$prerequisite->id],
            ],
        ],
    ]);

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))
        ->toBe([
            [
                'id' => $prerequisite->id,
                'title' => $prerequisite->title,
            ],
        ]);

    NpcDialogueNode::query()->latest('id')->firstOrFail()->update(['type' => 'answer']);

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))->toBe([]);
});

test('admin unlock diagnostics report an unparseable schedule opening path', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $map = LearningMap::query()->firstOrFail();
    $prerequisite = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $prerequisite->forceFill([
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'time_after',
                ],
            ],
            'schedule' => [
                'unlockAt' => 'not-a-date',
            ],
        ],
    ])->save();
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'invalid-schedule-path-check',
        'title' => 'Invalid schedule path check',
        'description' => 'A locked node for authoring diagnostics.',
        'position_q' => 16,
        'position_r' => 16,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'node_completed',
                    'nodeId' => $prerequisite->id,
                ],
            ],
        ],
    ]);

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))
        ->toBe([
            [
                'id' => $prerequisite->id,
                'title' => $prerequisite->title,
            ],
        ]);
});

test('admin unlock validation rejects unparseable schedule timestamps', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $node = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();

    expect(fn () => app(AdminWorldRules::class)->validateNodeUnlock([
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'time_after',
                ],
            ],
            'schedule' => [
                'unlockAt' => 'not-a-date',
            ],
        ],
    ], $node))->toThrow(ValidationException::class);
});

test('admin unlock diagnostics ignore an unreachable prerequisite in an optional OR branch', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $map = LearningMap::query()->firstOrFail();
    $unreachablePrerequisite = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $reachablePrerequisite = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'optional-path-check',
        'title' => 'Optional path check',
        'description' => 'A locked node with an optional diagnostic branch.',
        'position_q' => 11,
        'position_r' => 11,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'group',
                    'operator' => 'or',
                    'rules' => [
                        [
                            'type' => 'node_completed',
                            'nodeId' => $unreachablePrerequisite->id,
                        ],
                        [
                            'type' => 'node_completed',
                            'nodeId' => $reachablePrerequisite->id,
                        ],
                    ],
                ],
            ],
        ],
    ]);

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))->toBe([]);
});

test('admin unlock diagnostics report a hidden prerequisite without a reveal path', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $map = LearningMap::query()->firstOrFail();
    $hiddenPrerequisite = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'hidden-path-check',
        'title' => 'Hidden path check',
        'description' => 'A hidden prerequisite for authoring diagnostics.',
        'position_q' => 12,
        'position_r' => 12,
        'state' => 'hidden',
        'visual_config' => [],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'hidden-prerequisite-check',
        'title' => 'Hidden prerequisite check',
        'description' => 'A locked node that depends on a hidden place.',
        'position_q' => 13,
        'position_r' => 13,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'node_completed',
                    'nodeId' => $hiddenPrerequisite->id,
                ],
            ],
        ],
    ]);

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))
        ->toBe([
            [
                'id' => $hiddenPrerequisite->id,
                'title' => $hiddenPrerequisite->title,
            ],
        ]);

    $tool = LearningTool::query()->create([
        'slug' => 'hidden-path-tool',
        'title' => 'Hidden path tool',
    ]);
    $hiddenPrerequisite->forceFill([
        'visual_config' => [
            'reveal' => [
                'enabled' => true,
                'toolId' => $tool->id,
            ],
        ],
    ])->save();

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))->toBe([]);
});

test('admin unlock diagnostics report a hidden prerequisite with a missing reveal tool', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $map = LearningMap::query()->firstOrFail();
    $hiddenPrerequisite = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'missing-reveal-tool-path',
        'title' => 'Missing reveal tool path',
        'description' => 'A hidden prerequisite with a stale reveal tool reference.',
        'position_q' => 14,
        'position_r' => 14,
        'state' => 'hidden',
        'visual_config' => [
            'reveal' => [
                'enabled' => true,
                'toolId' => 999999,
            ],
        ],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'stale-reveal-prerequisite-check',
        'title' => 'Stale reveal prerequisite check',
        'description' => 'A locked node that depends on a hidden place with a stale reveal path.',
        'position_q' => 15,
        'position_r' => 15,
        'state' => 'locked',
        'visual_config' => [
            'unlock' => [
                'enabled' => true,
                'rules' => [
                    'type' => 'node_completed',
                    'nodeId' => $hiddenPrerequisite->id,
                ],
            ],
        ],
    ]);

    expect(app(NodeUnlockReachability::class)->unreachablePrerequisites($node))
        ->toBe([
            [
                'id' => $hiddenPrerequisite->id,
                'title' => $hiddenPrerequisite->title,
            ],
        ]);
});

test('admin users can save a valid authored item unlock tree', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $item = LearningItem::query()->create([
        'slug' => 'archive-lens',
        'title' => 'Archive lens',
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => $node->title,
            'slug' => $node->slug,
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'locked',
            'visual_config' => [
                'unlock' => [
                    'enabled' => true,
                    'item' => [
                        'enabled' => true,
                        'itemId' => $item->id,
                    ],
                    'rules' => [
                        'type' => 'group',
                        'operator' => 'and',
                        'rules' => [[
                            'type' => 'item_owned',
                            'itemId' => $item->id,
                        ]],
                    ],
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    expect($node->refresh()->state)->toBe('locked')
        ->and($node->visual_config['unlock']['rules']['rules'][0]['type'])->toBe('item_owned');
});

test('admin users can configure a tile to be revealed by a tool', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $tool = LearningTool::query()->create([
        'slug' => 'survey-scanner',
        'title' => 'Survey scanner',
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => $node->title,
            'slug' => $node->slug,
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'hidden',
            'visual_config' => [
                'label' => 'Pattern Gate',
                'reveal' => [
                    'enabled' => true,
                    'toolId' => $tool->id,
                ],
                'dark' => [
                    'tileColor' => '#082f49',
                    'foregroundColor' => '#bae6fd',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#38bdf8',
                ],
                'light' => [
                    'tileColor' => '#e0f2fe',
                    'foregroundColor' => '#0369a1',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#0284c7',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    $node->refresh();

    expect($node->state)->toBe('hidden')
        ->and($node->visual_config['reveal']['enabled'])->toBeTrue()
        ->and((int) $node->visual_config['reveal']['toolId'])->toBe($tool->id);
});

test('admin users can set the tool granted by a tool grant activity with empty optional visuals', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $tool = LearningTool::query()->create([
        'slug' => 'context-lens',
        'title' => 'Context lens',
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Receive context lens',
            'type' => 'tool_grant',
            'tool_grant_background_dark' => '',
            'tool_grant_background_light' => '',
            'tool_grant_background_mirrored' => false,
            'tool_grant_bubble_border_color_dark' => '#2dd4bf',
            'tool_grant_bubble_border_color_light' => '#0891b2',
            'tool_grant_bubble_color_dark' => '#0f172a',
            'tool_grant_bubble_color_light' => '#ffffff',
            'tool_grant_bubble_opacity_dark' => '92',
            'tool_grant_bubble_opacity_light' => '94',
            'tool_grant_fade_duration_seconds' => '0.4',
            'tool_grant_slide_direction' => 'left',
            'tool_grant_slide_duration_seconds' => '0.6',
            'tool_grant_text' => '',
            'tool_grant_tool_id' => $tool->id,
            'tool_grant_tool_mirrored' => false,
            'tool_grant_tool_x' => '50',
            'tool_grant_tool_y' => '50',
            'tool_grant_typing_speed' => '24',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('learning_node_id', $node->id)
        ->where('type', 'tool_grant')
        ->where('title', 'Receive context lens')
        ->firstOrFail();

    expect($activity->config['toolId'])->toBe($tool->id)
        ->and($activity->config['backgroundDark'])->toBe('')
        ->and($activity->config['text'])->toBe('');
});

test('admin users can reset node tool unlocks for all learners', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();

    $discovery = LearnerNodeDiscovery::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'discovered_at' => now(),
        'metadata' => [
            'source' => 'test',
            'unlock' => [
                'source' => 'world-map-lock-tool',
                'toolId' => 42,
                'unlockedAt' => now()->toIso8601String(),
            ],
            'manualUnlock' => [
                'grantedAt' => now()->toIso8601String(),
                'grantedByUserId' => $admin->id,
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.unlocks.reset', $node))
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    $discovery->refresh();

    expect($discovery->metadata)->toBe([
        'source' => 'test',
        'manualUnlock' => [
            'grantedAt' => $discovery->metadata['manualUnlock']['grantedAt'],
            'grantedByUserId' => $admin->id,
        ],
    ]);
});

test('admin users can open and close a locked node for one learner', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $node->forceFill(['state' => 'locked'])->save();
    $supportUrl = route('settings.index', [
        'panel' => 'admin-learning-support',
        'support' => 'support-signals',
        'signals' => 'individual',
    ]);

    $this->actingAs($admin)
        ->from($supportUrl)
        ->post(route('settings.worlds.nodes.manual-unlock', $node), [
            'enabled' => true,
            'user_id' => $learner->id,
        ])
        ->assertRedirect($supportUrl);

    $discovery = LearnerNodeDiscovery::query()
        ->where('user_id', $learner->id)
        ->where('learning_node_id', $node->id)
        ->firstOrFail();

    expect($discovery->metadata['manualUnlock']['grantedByUserId'])->toBe($admin->id)
        ->and($discovery->metadata['manualUnlock']['grantedAt'])->not->toBeEmpty();

    $this->actingAs($admin)
        ->from($supportUrl)
        ->post(route('settings.worlds.nodes.manual-unlock', $node), [
            'enabled' => false,
            'user_id' => $learner->id,
        ])
        ->assertRedirect($supportUrl);

    expect($discovery->refresh()->metadata)->toBeNull();
});

test('admin users can edit map details', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'title' => 'First Clearing',
            'description' => 'A quiet learning landscape for active practice.',
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    $map->refresh();

    expect($map->title)->toBe('First Clearing')
        ->and($map->description)->toBe('A quiet learning landscape for active practice.')
        ->and($map->versions()->count())->toBe(1);

    $workspaceUrl = route('settings.index', [
        'panel' => 'admin-world-builder',
        'map' => $map->id,
        'worldView' => 'configure',
    ]);

    $this->actingAs($admin)
        ->from($workspaceUrl)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'title' => 'First Clearing',
            'description' => 'Still inside the settings workspace.',
        ])
        ->assertRedirect($workspaceUrl);
});

test('authors can browse and restore map detail versions without losing the current version', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'description' => 'The first map description.',
            'title' => 'First Clearing revised',
        ])
        ->assertRedirect();

    $version = $map->versions()->firstOrFail();

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.maps.versions.index', $map).'?page=1&per_page=6')
        ->assertOk()
        ->assertJsonPath('items.0.title', $map->getOriginal('title'))
        ->assertJsonPath('items.0.description', $map->getOriginal('description'))
        ->assertJsonPath('pagination.page', 1)
        ->assertJsonPath('pagination.perPage', 6)
        ->assertJsonPath('pagination.total', 1);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.versions.restore', [
            'map' => $map,
            'version' => $version,
        ]))
        ->assertOk()
        ->assertJsonPath('map.title', $version->title)
        ->assertJsonPath('map.description', $version->description);

    expect($map->refresh()->title)->toBe('First Clearing')
        ->and($map->description)->toBe($version->description)
        ->and($map->versions()->count())->toBe(2);
});

test('authors can edit and restore world details without losing the current version', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $world = LearningWorld::query()
        ->where('slug', CurrentWorldResolver::DEFAULT_WORLD_SLUG)
        ->firstOrFail();
    $originalTitle = $world->title;
    $originalDescription = $world->description;

    $this->actingAs($admin)
        ->patch(route('settings.worlds.details.update'), [
            'title' => 'A more welcoming world',
            'description' => 'A revised authoring description.',
            'updated_at' => $world->updated_at?->toIso8601String(),
        ])
        ->assertRedirect(route('settings.worlds.index'));

    $world->refresh();
    $version = $world->versions()->firstOrFail();

    expect($world->title)->toBe('A more welcoming world')
        ->and($world->description)->toBe('A revised authoring description.')
        ->and($version->title)->toBe($originalTitle)
        ->and($version->description)->toBe($originalDescription);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.versions.index').'?page=1&per_page=6')
        ->assertOk()
        ->assertJsonPath('items.0.title', $originalTitle)
        ->assertJsonPath('pagination.page', 1)
        ->assertJsonPath('pagination.perPage', 6)
        ->assertJsonPath('pagination.total', 1);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.versions.restore', ['version' => $version]))
        ->assertOk()
        ->assertJsonPath('world.title', $originalTitle)
        ->assertJsonPath('world.description', $originalDescription);

    expect($world->refresh()->title)->toBe($originalTitle)
        ->and($world->description)->toBe($originalDescription)
        ->and($world->versions()->count())->toBe(2);
});

test('world detail edits reject a stale author form without overwriting newer details', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $world = LearningWorld::query()
        ->where('slug', CurrentWorldResolver::DEFAULT_WORLD_SLUG)
        ->firstOrFail();
    $staleUpdatedAt = $world->updated_at?->toIso8601String();

    Carbon::setTestNow(now()->addMinute());
    $this->actingAs($admin)
        ->patch(route('settings.worlds.details.update'), [
            'title' => 'First author update',
            'description' => 'The newer details must win.',
            'updated_at' => $staleUpdatedAt,
        ])
        ->assertRedirect(route('settings.worlds.index'));
    Carbon::setTestNow();

    $this->actingAs($admin)
        ->from(route('settings.worlds.index'))
        ->patch(route('settings.worlds.details.update'), [
            'title' => 'Stale author update',
            'description' => 'This must not overwrite the newer details.',
            'updated_at' => $staleUpdatedAt,
        ])
        ->assertSessionHasErrors('updated_at');

    expect($world->refresh()->title)->toBe('First author update')
        ->and($world->description)->toBe('The newer details must win.')
        ->and($world->versions()->count())->toBe(1);
});

test('world detail history cannot restore a version from another world', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $otherWorld = LearningWorld::query()->create([
        'slug' => 'other-world-for-history',
        'title' => 'Other world',
    ]);
    $version = LearningWorldVersion::query()->create([
        'learning_world_id' => $otherWorld->id,
        'title' => 'Unrelated title',
        'description' => 'Unrelated description',
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.versions.restore', ['version' => $version]))
        ->assertNotFound();
});

test('authors can browse and restore activity configuration versions without losing the current version', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()->where('slug', 'write-a-field-note')->firstOrFail();
    $originalTitle = $activity->title;
    $originalIntroduction = $activity->introduction;
    $originalPrompt = $activity->config['prompt'];

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Updated field note',
            'introduction' => 'A changed authoring prompt.',
            'reflection_prompt' => 'A changed reflection prompt.',
        ])
        ->assertRedirect();

    $version = $activity->versions()->firstOrFail();

    expect($version->snapshot['title'])->toBe($originalTitle)
        ->and($version->snapshot['introduction'])->toBe($originalIntroduction)
        ->and($version->snapshot['config']['prompt'])->toBe($originalPrompt);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.activities.versions.index', $activity).'?page=1&per_page=4')
        ->assertOk()
        ->assertJsonPath('items.0.title', $originalTitle)
        ->assertJsonPath('items.0.type', $activity->type)
        ->assertJsonPath('pagination.page', 1)
        ->assertJsonPath('pagination.perPage', 4)
        ->assertJsonPath('pagination.total', 1);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.activities.versions.show', [
            'activity' => $activity,
            'version' => $version,
        ]))
        ->assertOk()
        ->assertJsonPath('version.snapshot.title', $originalTitle)
        ->assertJsonPath('version.snapshot.config.prompt', $originalPrompt);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.versions.restore', [
            'activity' => $activity,
            'version' => $version,
        ]))
        ->assertOk()
        ->assertJsonPath('activity.title', $originalTitle)
        ->assertJsonPath('activity.introduction', $originalIntroduction)
        ->assertJsonPath('activity.config.prompt', $originalPrompt);

    expect($activity->refresh()->title)->toBe($originalTitle)
        ->and($activity->introduction)->toBe($originalIntroduction)
        ->and($activity->config['prompt'])->toBe($originalPrompt)
        ->and($activity->ai_review_status)->toBe(LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW)
        ->and($activity->versions()->count())->toBe(2);
});

test('activity history captures and restores outgoing route connections', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'history-route-source',
        'title' => 'History route source',
        'type' => 'open_practice',
        'config' => [],
        'sort_order' => 900,
    ]);
    $target = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'history-route-target',
        'title' => 'History route target',
        'type' => 'reflection',
        'config' => [],
        'sort_order' => 901,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activity-transitions.store', $node), [
            'from_activity_id' => $activity->id,
            'to_activity_id' => $target->id,
            'from_connector' => 'completed',
            'to_connector' => 'in',
            'label' => 'Follow the first clue',
        ])
        ->assertRedirect();

    $transition = $activity->transitions()->firstOrFail();
    $this->actingAs($admin)
        ->patch(route('settings.worlds.activity-transitions.update', $transition), [
            'label' => 'Follow the revised clue',
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activity-transitions.destroy', $transition))
        ->assertRedirect();

    $versions = $activity->versions()->reorder('id')->get();

    expect($versions)->toHaveCount(3)
        ->and($versions[0]->snapshot['transitions'])->toBe([])
        ->and($versions[1]->snapshot['transitions'][0]['label'])
        ->toBe('Follow the first clue')
        ->and($versions[2]->snapshot['transitions'][0]['label'])
        ->toBe('Follow the revised clue');

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.versions.restore', [
            'activity' => $activity,
            'version' => $versions[1],
        ]))
        ->assertOk()
        ->assertJsonPath('activity.config', []);

    expect($activity->refresh()->transitions)->toHaveCount(1)
        ->and($activity->transitions->first()->label)->toBe('Follow the first clue')
        ->and($activity->transitions->first()->to_activity_id)->toBe($target->id);
});

test('legacy activity versions without route snapshots preserve current connections', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()->where('slug', 'write-a-field-note')->firstOrFail();
    $node = $activity->node;
    $target = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'legacy-route-target',
        'title' => 'Legacy route target',
        'type' => 'reflection',
        'config' => [],
        'sort_order' => 902,
    ]);

    $transition = $activity->transitions()->create([
        'to_activity_id' => $target->id,
        'from_connector' => 'completed',
        'to_connector' => 'in',
        'trigger' => 'completed',
        'label' => 'Keep this route',
        'rules' => [],
    ]);
    $version = $activity->versions()->create([
        'changed_by' => $admin->id,
        'snapshot' => [
            'companionConfig' => [],
            'config' => $activity->config,
            'graphPositionX' => $activity->graph_position_x,
            'graphPositionY' => $activity->graph_position_y,
            'introduction' => $activity->introduction,
            'slug' => $activity->slug,
            'title' => $activity->title,
            'type' => $activity->type,
            'question' => [],
        ],
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.versions.restore', [
            'activity' => $activity,
            'version' => $version,
        ]))
        ->assertOk();

    expect($activity->refresh()->transitions)->toHaveCount(1)
        ->and($activity->transitions->first()->id)->toBe($transition->id);
});

test('activity history never restores a route target from another node', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()->where('slug', 'write-a-field-note')->firstOrFail();
    $otherNode = LearningNode::query()->where('id', '!=', $activity->learning_node_id)->firstOrFail();
    $unrelatedTarget = LearningActivity::query()->create([
        'learning_node_id' => $otherNode->id,
        'slug' => 'unrelated-route-target',
        'title' => 'Unrelated route target',
        'type' => 'reflection',
        'config' => [],
        'sort_order' => 903,
    ]);
    $version = $activity->versions()->create([
        'changed_by' => $admin->id,
        'snapshot' => [
            'title' => $activity->title,
            'slug' => $activity->slug,
            'type' => $activity->type,
            'introduction' => $activity->introduction,
            'config' => $activity->config,
            'companionConfig' => [],
            'graphPositionX' => $activity->graph_position_x,
            'graphPositionY' => $activity->graph_position_y,
            'question' => [],
            'transitions' => [[
                'fromConnector' => 'completed',
                'toConnector' => 'in',
                'toActivityId' => $unrelatedTarget->id,
                'toActivitySlug' => $unrelatedTarget->slug,
                'trigger' => 'completed',
                'label' => 'Must not cross nodes',
                'rules' => [],
            ]],
        ],
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.versions.restore', [
            'activity' => $activity,
            'version' => $version,
        ]))
        ->assertOk();

    expect($activity->refresh()->transitions)->toBeEmpty()
        ->and(ActivityTransition::query()
            ->where('from_activity_id', $activity->id)
            ->where('to_activity_id', $unrelatedTarget->id)
            ->exists())->toBeFalse();
});

test('activity versions cannot be restored across activities', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activities = LearningActivity::query()->take(2)->get();
    $activity = $activities->firstOrFail();
    $otherActivity = $activities->last();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Versioned activity',
        ])
        ->assertRedirect();

    $version = LearningActivityVersion::query()
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.versions.restore', [
            'activity' => $otherActivity,
            'version' => $version,
        ]))
        ->assertNotFound();

    expect($otherActivity->refresh()->title)->not->toBe('Versioned activity')
        ->and($otherActivity->versions()->count())->toBe(0);
});

test('map detail versions cannot be restored across maps', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $maps = LearningMap::query()->take(2)->get();
    $map = $maps->firstOrFail();
    $otherMap = $maps->last();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'title' => 'Versioned map',
        ])
        ->assertRedirect();

    $version = $map->versions()->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.versions.restore', [
            'map' => $otherMap,
            'version' => $version,
        ]))
        ->assertNotFound();

    expect($otherMap->refresh()->title)->not->toBe('Versioned map')
        ->and($otherMap->versions()->count())->toBe(0);
});

test('authors can browse and restore MapAsset versions without losing current configuration', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $asset = LearningMapAsset::query()->whereNotNull('learning_node_id')->firstOrFail();
    $originalText = $asset->text;
    $originalImage = $asset->image_url;
    $originalY = $asset->position_y;

    $this->actingAs($admin)
        ->patch(route('settings.worlds.assets.update', $asset), [
            'image_url' => '/storage/learning/nodes/revised.svg',
            'position_x' => $asset->position_x,
            'position_y' => 61,
            'position_z' => $asset->position_z,
            'width' => $asset->width,
            'opacity' => $asset->opacity,
            'text' => 'Revised asset label',
            'interaction_mode' => 'focusable',
            'visual_config' => ['imageFit' => 'cover'],
        ])
        ->assertRedirect();

    $version = $asset->versions()->firstOrFail();

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.assets.versions.index', $asset).'?page=1&per_page=4')
        ->assertOk()
        ->assertJsonPath('items.0.text', $originalText)
        ->assertJsonPath('items.0.imageUrl', $originalImage)
        ->assertJsonPath('pagination.page', 1)
        ->assertJsonPath('pagination.perPage', 4)
        ->assertJsonPath('pagination.total', 1);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.assets.versions.restore', [
            'asset' => $asset,
            'version' => $version,
        ]))
        ->assertOk()
        ->assertJsonPath('asset.text', $originalText)
        ->assertJsonPath('asset.imageUrl', $originalImage);

    expect($asset->refresh()->text)->toBe($originalText)
        ->and($asset->image_url)->toBe($originalImage)
        ->and($asset->position_y)->toBe($originalY)
        ->and($asset->versions()->count())->toBe(2);
});

test('MapAsset versions cannot be restored across assets', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $assets = LearningMapAsset::query()->whereNotNull('learning_node_id')->take(2)->get();
    $asset = $assets->firstOrFail();
    $otherAsset = $assets->last();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.assets.update', $asset), [
            'position_x' => $asset->position_x,
            'position_y' => $asset->position_y,
            'position_z' => $asset->position_z,
            'width' => $asset->width,
            'opacity' => $asset->opacity,
            'text' => 'Versioned asset',
        ])
        ->assertRedirect();

    $version = $asset->versions()->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.assets.versions.restore', [
            'asset' => $otherAsset,
            'version' => $version,
        ]))
        ->assertNotFound();

    expect($otherAsset->refresh()->text)->not->toBe('Versioned asset')
        ->and($otherAsset->versions()->count())->toBe(0);
});

test('admin users can edit map visual theme variants', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.update', $map), [
            'background_config' => [
                'dark' => [
                    'imageUrl' => '/storage/learning/maps/dark.webp',
                    'overlay' => 'rgba(1, 8, 14, 0.72)',
                    'pageBackground' => '#020617',
                    'panelBackground' => 'rgba(8, 17, 26, 0.78)',
                    'panelBorderColor' => 'rgba(226, 232, 240, 0.12)',
                    'panelTextColor' => '#f8fafc',
                    'panelMutedTextColor' => 'rgba(226, 232, 240, 0.82)',
                    'accentColor' => '#5eead4',
                    'sidePanelBackground' => '#111820',
                    'sidePanelBorderColor' => 'rgba(255, 255, 255, 0.1)',
                    'sidePanelTextColor' => '#f8fafc',
                    'sidePanelMutedTextColor' => 'rgba(226, 232, 240, 0.72)',
                    'sideControlBackground' => 'rgba(8, 17, 26, 0.78)',
                    'sideControlBorderColor' => 'rgba(226, 232, 240, 0.12)',
                    'sideControlIconColor' => '#cbd5e1',
                    'sideControlTextColor' => '#e2e8f0',
                    'sideControlActiveBackground' => '#5eead4',
                    'sideControlActiveIconColor' => '#020617',
                    'sideControlActiveTextColor' => '#020617',
                    'assets' => [
                        [
                            'id' => 'moon',
                            'imageUrl' => '/images/map-assets/moon.png',
                            'x' => 72,
                            'y' => 18,
                            'width' => 16,
                            'opacity' => 82,
                        ],
                    ],
                ],
                'light' => [
                    'imageUrl' => '/storage/learning/maps/light.webp',
                    'overlay' => 'rgba(240, 253, 250, 0.74)',
                    'pageBackground' => '#ecfeff',
                    'panelTextColor' => '#0f172a',
                    'accentColor' => '#0e7490',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    $map->refresh();

    expect($map->background_config)->not->toHaveKey('imageUrl')
        ->and($map->background_config['dark']['imageUrl'])->toBe('/storage/learning/maps/dark.webp')
        ->and($map->background_config['dark']['panelBorderColor'])->toBe('rgba(226, 232, 240, 0.12)')
        ->and($map->background_config['dark']['sideControlBackground'])->toBe('rgba(8, 17, 26, 0.78)')
        ->and($map->background_config['dark']['sideControlIconColor'])->toBe('#cbd5e1')
        ->and($map->background_config['dark']['sideControlActiveIconColor'])->toBe('#020617')
        ->and($map->background_config['dark']['assets'][0]['imageUrl'])->toBe('/images/map-assets/moon.png')
        ->and($map->background_config['light']['pageBackground'])->toBe('#ecfeff');
});

test('admin users can upload a node image', function () {
    Storage::fake('public');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $response = $this->actingAs($admin)
        ->postJson(route('settings.worlds.node-images.store'), [
            'image' => UploadedFile::fake()->create('tile.svg', 4, 'image/svg+xml'),
        ])
        ->assertOk()
        ->assertJsonStructure(['url']);

    $url = $response->json('url');

    expect($url)->toStartWith('/storage/learning/nodes/');
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $url));
});

test('node image upload validation returns a json error', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.node-images.store'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['image']);
});

test('admin users can download reusable uploaded images as attachments', function () {
    Storage::fake('public');
    Storage::disk('public')->put('learning/media/example.png', 'fake image contents');
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->get(route('settings.assets.media.download', [
            'url' => '/storage/learning/media/example.png',
        ]))
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename=example.png')
        ->assertHeader('Content-Type', 'image/png');
});

test('admin users can download bundled images as attachments', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->get(route('settings.assets.media.download', [
            'url' => '/images/nodes/fantasy-hex-forest.png',
        ]))
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename=fantasy-hex-forest.png')
        ->assertHeader('Content-Type', 'image/png');
});

test('map node images are served through map access', function () {
    Storage::fake('local');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->firstOrFail();

    $response = $this->actingAs($admin)
        ->postJson(route('settings.worlds.node-images.store'), [
            'image' => UploadedFile::fake()->create('private-tile.svg', 4, 'image/svg+xml'),
            'map_id' => $map->id,
        ])
        ->assertOk()
        ->assertJsonStructure(['url']);

    $url = $response->json('url');
    $fileName = basename((string) parse_url($url, PHP_URL_PATH));

    expect($url)->toStartWith("/protected-media/maps/{$map->id}/");
    Storage::disk('local')->assertExists("learning/protected/maps/{$map->id}/{$fileName}");

    auth()->logout();

    $this->get($url)->assertForbidden();

    $map->forceFill([
        'access_roles' => ['public', User::ROLE_ADMIN],
    ])->save();

    $this->get($url)->assertOk();
});

test('admin users can swap neighboring tiles', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $portal = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $signalGate = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $portalStart = [$portal->position_q, $portal->position_r];
    $signalGateStart = [$signalGate->position_q, $signalGate->position_r];

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.swap', $portal), [
            'direction_q' => $signalGate->position_q - $portal->position_q,
            'direction_r' => $signalGate->position_r - $portal->position_r,
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $portal->map));

    $portal->refresh();
    $signalGate->refresh();

    expect([$portal->position_q, $portal->position_r])->toBe($signalGateStart)
        ->and([$signalGate->position_q, $signalGate->position_r])->toBe($portalStart);
});

test('authors can browse and restore map layout versions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $portal = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $signalGate = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $map = $portal->map()->firstOrFail();
    $portalStart = [$portal->position_q, $portal->position_r];
    $signalGateStart = [$signalGate->position_q, $signalGate->position_r];

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.swap', $portal), [
            'direction_q' => $signalGate->position_q - $portal->position_q,
            'direction_r' => $signalGate->position_r - $portal->position_r,
        ])
        ->assertRedirect();

    $version = $map->layoutVersions()->firstOrFail();

    expect($version)->toBeInstanceOf(LearningMapLayoutVersion::class)
        ->and($map->layoutVersions()->count())->toBe(1);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.maps.layout-versions.index', $map).'?page=1&per_page=6')
        ->assertOk()
        ->assertJsonPath('items.0.nodeCount', $map->nodes()->count())
        ->assertJsonPath('items.0.restorable', true)
        ->assertJsonPath('pagination.page', 1)
        ->assertJsonPath('pagination.perPage', 6)
        ->assertJsonPath('pagination.total', 1);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.maps.layout-versions.preview', [
            'map' => $map,
            'version' => $version,
        ]).'?page=1&per_page=24')
        ->assertOk()
        ->assertJsonFragment([
            'nodeId' => $portal->id,
            'positionQ' => $portalStart[0],
            'positionR' => $portalStart[1],
            'currentPositionQ' => $signalGateStart[0],
            'currentPositionR' => $signalGateStart[1],
            'title' => $portal->title,
        ])
        ->assertJsonPath('pagination.total', $map->nodes()->count());

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.maps.layout-versions.preview', [
            'map' => $map,
            'version' => $version,
        ]).'?page=1&per_page=1')
        ->assertOk()
        ->assertJsonCount(1, 'items')
        ->assertJsonPath('pagination.perPage', 1)
        ->assertJsonPath('pagination.total', $map->nodes()->count());

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.layout-versions.restore', [
            'map' => $map,
            'version' => $version,
        ]))
        ->assertOk()
        ->assertJsonPath('map.id', $map->id);

    $portal->refresh();
    $signalGate->refresh();

    expect([$portal->position_q, $portal->position_r])->toBe($portalStart)
        ->and([$signalGate->position_q, $signalGate->position_r])->toBe($signalGateStart)
        ->and($map->layoutVersions()->count())->toBe(2);
});

test('map layout history marks entries unavailable after the map structure changes', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $map = $node->map()->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'description' => $node->description,
            'position_q' => 20,
            'position_r' => 20,
            'slug' => $node->slug,
            'state' => $node->state,
            'title' => $node->title,
            'visual_config' => [
                'label' => $node->title,
            ],
        ])
        ->assertRedirect();

    $map->nodes()->create([
        'position_q' => 100,
        'position_r' => 100,
        'slug' => 'new-structure-node',
        'state' => 'available',
        'title' => 'New structure node',
    ]);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.maps.layout-versions.index', $map))
        ->assertOk()
        ->assertJsonPath('items.0.restorable', false);
});

test('node placement updates create a restorable layout version', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $map = $node->map()->firstOrFail();
    $originalPosition = [$node->position_q, $node->position_r];

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'description' => $node->description,
            'position_q' => 20,
            'position_r' => 20,
            'slug' => $node->slug,
            'state' => $node->state,
            'title' => $node->title,
            'visual_config' => [
                'label' => $node->title,
            ],
        ])
        ->assertRedirect();

    $version = $map->layoutVersions()->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.maps.layout-versions.restore', [
            'map' => $map,
            'version' => $version,
        ]))
        ->assertOk();

    $node->refresh();

    expect([$node->position_q, $node->position_r])->toBe($originalPosition)
        ->and($map->layoutVersions()->count())->toBe(2);
});

test('admin users can insert a tile between neighboring tiles', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $portal = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $signalGate = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $signalGateStart = [$signalGate->position_q, $signalGate->position_r];
    $direction = [
        $signalGate->position_q - $portal->position_q,
        $signalGate->position_r - $portal->position_r,
    ];

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.insert', $portal), [
            'title' => 'Inserted Node',
            'description' => 'A tile inserted between two existing tiles.',
            'state' => 'available',
            'direction_q' => $direction[0],
            'direction_r' => $direction[1],
            'visual_config' => [
                'label' => 'Inserted',
                'tooltip' => 'Inserted from the edge control.',
                'dark' => [
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                ],
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $portal->map));

    $insertedNode = LearningNode::query()->where('slug', 'inserted-node')->firstOrFail();
    $signalGate->refresh();

    expect([$insertedNode->position_q, $insertedNode->position_r])->toBe($signalGateStart)
        ->and([$signalGate->position_q, $signalGate->position_r])->toBe([
            $signalGateStart[0] + $direction[0],
            $signalGateStart[1] + $direction[1],
        ]);
});

test('shared task authoring previews both enabled learner workflow states', function () {
    $preview = file_get_contents(
        resource_path('js/pages/settings/worlds/shared-task-activity-fields.tsx'),
    );

    expect($preview)
        ->toContain("'contribution' | 'peer_review'")
        ->toContain('aria-pressed={visiblePreviewMode ===')
        ->toContain('SharedTaskPeerReviewPreview')
        ->toContain("'activities.shared_task.preview_peer_review_privacy'")
        ->toContain('does not create a rating or ranking')
        ->toContain('type="button"');
});

test('world builder review queue keeps paginated cards inside the panel without nested scrolling', function () {
    $panel = file_get_contents(
        resource_path('js/features/settings/world-builder-settings-panel.tsx'),
    );

    expect($panel)
        ->toContain('const pageSize = 4;')
        ->toContain('sm:grid-cols-2')
        ->toContain('overflow-hidden py-4 pr-1')
        ->not->toContain('[scrollbar-width:thin] overflow-y-auto');
});

test('map layout history preview shows a bounded spatial surface and accessible position list', function () {
    $dialog = file_get_contents(
        resource_path('js/features/settings/map-layout-history-dialog.tsx'),
    );

    expect($dialog)
        ->toContain('<LayoutPreviewSurface')
        ->toContain('data-layout-preview-surface="true"')
        ->toContain('currentPositionQ')
        ->toContain('position_will_move')
        ->toContain('aria-hidden="true"')
        ->toContain('role="list"')
        ->toContain('per_page=4')
        ->toContain('overflow-hidden');
});

test('map configuration collapses nested navigation before the content is squeezed', function () {
    $shell = file_get_contents(
        resource_path('js/components/settings-configuration-shell.tsx'),
    );
    $configureMap = file_get_contents(
        resource_path('js/pages/settings/worlds/configure-map.tsx'),
    );

    expect($shell)
        ->toContain('collapseSidebarBelowWide')
        ->toContain('2xl:grid-cols-[16rem_minmax(0,1fr)]')
        ->toContain("compact && 'max-[1535px]:hidden'");

    expect($configureMap)
        ->toContain('collapseSidebarBelowWide')
        ->toContain('grid-cols-1 gap-6')
        ->toContain('2xl:grid-cols-[minmax(0,1fr)_24rem]')
        ->toContain('compact');
});

test('activity evidence authoring previews the learner orientation', function () {
    $editor = file_get_contents(
        resource_path('js/pages/settings/worlds/activity-form-fields.tsx'),
    );

    expect($editor)
        ->toContain('<EvidenceContextPreview form={form} />')
        ->toContain("'settings.world_builder.activity.evidence.preview_label'")
        ->toContain("'learning.activity.evidence_context.objective'")
        ->toContain("'learning.activity.evidence_context.concepts'")
        ->toContain('Add an evidence objective or concept above')
        ->not->toContain('overflow-y-auto');
});
