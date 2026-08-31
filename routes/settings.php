<?php

use App\Http\Controllers\PlatformInfoPageController;
use App\Http\Controllers\Settings\AdminAccessController;
use App\Http\Controllers\Settings\AdminActivityController;
use App\Http\Controllers\Settings\AdminAiContentAuthoringController;
use App\Http\Controllers\Settings\AdminAiController;
use App\Http\Controllers\Settings\AdminAssetController;
use App\Http\Controllers\Settings\AdminCompanionController;
use App\Http\Controllers\Settings\AdminCompanionDialogueController;
use App\Http\Controllers\Settings\AdminDialogueSoundSetController;
use App\Http\Controllers\Settings\AdminItemController;
use App\Http\Controllers\Settings\AdminLanguageController;
use App\Http\Controllers\Settings\AdminLearningGroupController;
use App\Http\Controllers\Settings\AdminNpcDialogueController;
use App\Http\Controllers\Settings\AdminPanelController;
use App\Http\Controllers\Settings\AdminUserController;
use App\Http\Controllers\Settings\AdminWorldController;
use App\Http\Controllers\Settings\AppearanceController;
use App\Http\Controllers\Settings\ColorPaletteController;
use App\Http\Controllers\Settings\JournalSettingsController;
use App\Http\Controllers\Settings\LanguageController;
use App\Http\Controllers\Settings\LearnerMessageModerationController;
use App\Http\Controllers\Settings\PresentationController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\SettingsController;
use App\Http\Controllers\Settings\SoundPreferenceController;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::get('settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::get('settings/about', [PlatformInfoPageController::class, 'showSettings'])
        ->defaults('page', 'about')
        ->name('settings.about');
    Route::get('settings/imprint', [PlatformInfoPageController::class, 'showSettings'])
        ->defaults('page', 'imprint')
        ->name('settings.imprint');
    Route::get('settings/data-protection', [PlatformInfoPageController::class, 'showSettings'])
        ->defaults('page', 'data-protection')
        ->name('settings.data-protection');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('settings/profile/image', [ProfileController::class, 'uploadImage'])
        ->name('profile.image.store');
    Route::get('settings/language', [LanguageController::class, 'edit'])
        ->name('settings.language.edit');
    Route::patch('settings/language', [LanguageController::class, 'update'])
        ->name('settings.language.update');
    Route::patch('settings/sound-preferences', [SoundPreferenceController::class, 'update'])
        ->name('settings.sound-preferences.update');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/color-palette', [ColorPaletteController::class, 'edit'])
        ->name('settings.color-palette.edit');

    Route::patch('settings/color-palette', [ColorPaletteController::class, 'update'])
        ->name('settings.color-palette.update');

    Route::get('settings/security', [SecurityController::class, 'edit'])
        ->middleware(RequirePassword::class)
        ->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::get('settings/appearance', [AppearanceController::class, 'edit'])->name('appearance.edit');
    Route::patch('settings/appearance', [AppearanceController::class, 'update'])->name('appearance.update');

    Route::post('settings/registration-tokens', [AdminUserController::class, 'storeRegistrationToken'])
        ->name('settings.registration-tokens.store');

    Route::get('settings/admin-panel', [AdminPanelController::class, 'index'])
        ->name('settings.admin-panel.index');
});

Route::middleware(['auth', 'verified', 'can:learner_messages.ru'])->group(function () {
    Route::get('settings/learning-support/message-topics/{topic}/messages', [LearnerMessageModerationController::class, 'messages'])
        ->name('settings.learning-support.message-topics.messages.index');
    Route::get('settings/learning-support/messages/{message}/responses', [LearnerMessageModerationController::class, 'responses'])
        ->name('settings.learning-support.messages.responses.index');
    Route::patch('settings/learning-support/messages/{message}/visibility', [LearnerMessageModerationController::class, 'updateVisibility'])
        ->name('settings.learning-support.messages.visibility.update');
    Route::patch('settings/learning-support/message-responses/{response}/visibility', [LearnerMessageModerationController::class, 'updateResponseVisibility'])
        ->name('settings.learning-support.message-responses.visibility.update');
});

Route::middleware(['auth', 'verified', 'can:learner_messages.rud'])->group(function () {
    Route::delete('settings/learning-support/messages/{message}', [LearnerMessageModerationController::class, 'destroy'])
        ->name('settings.learning-support.messages.destroy');
    Route::delete('settings/learning-support/message-responses/{response}', [LearnerMessageModerationController::class, 'destroyResponse'])
        ->name('settings.learning-support.message-responses.destroy');
});

Route::middleware(['auth', 'verified', 'can:world_maps.ru'])->group(function () {
    Route::get('settings/worlds', [AdminWorldController::class, 'index'])
        ->name('settings.worlds.index');

    Route::post('settings/worlds/maps', [AdminWorldController::class, 'storeMap'])
        ->name('settings.worlds.maps.store');

    Route::post('settings/worlds/maps/{map}/duplicate', [AdminWorldController::class, 'duplicateMap'])
        ->name('settings.worlds.maps.duplicate');

    Route::post('settings/worlds/maps/{map}/assets', [AdminWorldController::class, 'storeMapAsset'])
        ->name('settings.worlds.maps.assets.store');

    Route::patch('settings/worlds/assets/{asset}', [AdminWorldController::class, 'updateMapAsset'])
        ->name('settings.worlds.assets.update');

    Route::get('settings/worlds/assets/{asset}/versions', [AdminWorldController::class, 'mapAssetVersions'])
        ->name('settings.worlds.assets.versions.index');

    Route::post('settings/worlds/assets/{asset}/versions/{version}/restore', [AdminWorldController::class, 'restoreMapAssetVersion'])
        ->name('settings.worlds.assets.versions.restore');

    Route::delete('settings/worlds/assets/{asset}', [AdminWorldController::class, 'destroyMapAsset'])
        ->name('settings.worlds.assets.destroy');

    Route::post('settings/worlds/portal-links', [AdminWorldController::class, 'storePortalLink'])
        ->name('settings.worlds.portal-links.store');

    Route::delete('settings/worlds/portal-links/{portalLink}', [AdminWorldController::class, 'destroyPortalLink'])
        ->name('settings.worlds.portal-links.destroy');

    Route::get('settings/worlds/maps/{map}/edit', [AdminWorldController::class, 'editMap'])
        ->name('settings.worlds.maps.edit');

    Route::get('settings/worlds/maps/{map}/configure', [AdminWorldController::class, 'configureMap'])
        ->name('settings.worlds.maps.configure');

    Route::get('settings/worlds/maps/{map}/export', [AdminWorldController::class, 'exportMap'])
        ->name('settings.worlds.maps.export');

    Route::post('settings/worlds/maps/exports/validate', [AdminWorldController::class, 'validateMapExport'])
        ->name('settings.worlds.maps.exports.validate');

    Route::patch('settings/worlds/maps/{map}', [AdminWorldController::class, 'updateMap'])
        ->name('settings.worlds.maps.update');

    Route::patch('settings/worlds/maps/{map}/details', [AdminWorldController::class, 'updateMapDetails'])
        ->name('settings.worlds.maps.details.update');

    Route::get('settings/worlds/maps/{map}/versions', [AdminWorldController::class, 'mapVersions'])
        ->name('settings.worlds.maps.versions.index');

    Route::post('settings/worlds/maps/{map}/versions/{version}/restore', [AdminWorldController::class, 'restoreMapVersion'])
        ->name('settings.worlds.maps.versions.restore');
});

Route::middleware(['auth', 'verified', 'can:world_nodes.ru'])->group(function () {
    Route::post('settings/worlds/node-images', [AdminWorldController::class, 'uploadNodeImage'])
        ->name('settings.worlds.node-images.store');

    Route::post('settings/worlds/maps/{map}/nodes', [AdminWorldController::class, 'storeNode'])
        ->name('settings.worlds.maps.nodes.store');

    Route::patch('settings/worlds/nodes/{node}', [AdminWorldController::class, 'updateNode'])
        ->name('settings.worlds.nodes.update');

    Route::post('settings/worlds/nodes/{node}/insert', [AdminWorldController::class, 'insertNode'])
        ->name('settings.worlds.nodes.insert');

    Route::patch('settings/worlds/nodes/{node}/swap', [AdminWorldController::class, 'swapNode'])
        ->name('settings.worlds.nodes.swap');

    Route::post('settings/worlds/nodes/{node}/reset-unlocks', [AdminWorldController::class, 'resetNodeUnlocks'])
        ->name('settings.worlds.nodes.unlocks.reset');

    Route::post('settings/worlds/nodes/{node}/manual-unlock', [AdminWorldController::class, 'setLearnerNodeManualUnlock'])
        ->name('settings.worlds.nodes.manual-unlock');
});

Route::middleware(['auth', 'verified', 'can:world_activities.ru'])->group(function () {
    Route::post('settings/worlds/source-records', [AdminActivityController::class, 'storeSourceRecord'])
        ->name('settings.worlds.source-records.store');
    Route::get('settings/worlds/source-records', [AdminActivityController::class, 'sourceRecords'])
        ->name('settings.worlds.source-records.index');

    Route::patch('settings/worlds/source-records/{sourceRecord}', [AdminActivityController::class, 'updateSourceRecord'])
        ->name('settings.worlds.source-records.update');

    Route::get('settings/worlds/source-records/{sourceRecord}/versions', [AdminActivityController::class, 'sourceRecordVersions'])
        ->name('settings.worlds.source-records.versions');

    Route::post('settings/worlds/source-records/{sourceRecord}/versions/{version}/restore', [AdminActivityController::class, 'restoreSourceRecordVersion'])
        ->name('settings.worlds.source-records.versions.restore');

    Route::delete('settings/worlds/source-records/{sourceRecord}', [AdminActivityController::class, 'destroySourceRecord'])
        ->name('settings.worlds.source-records.destroy');

    Route::get('settings/worlds/nodes/{node}/activities', [AdminActivityController::class, 'edit'])
        ->name('settings.worlds.nodes.activities.edit');

    Route::post('settings/worlds/nodes/{node}/activities', [AdminActivityController::class, 'store'])
        ->name('settings.worlds.nodes.activities.store');

    Route::patch('settings/worlds/activities/{activity}', [AdminActivityController::class, 'update'])
        ->name('settings.worlds.activities.update');

    Route::get('settings/worlds/activities/{activity}/versions', [AdminActivityController::class, 'activityVersions'])
        ->name('settings.worlds.activities.versions.index');

    Route::get('settings/worlds/activities/{activity}/versions/{version}', [AdminActivityController::class, 'activityVersion'])
        ->name('settings.worlds.activities.versions.show');

    Route::post('settings/worlds/activities/{activity}/versions/{version}/restore', [AdminActivityController::class, 'restoreActivityVersion'])
        ->name('settings.worlds.activities.versions.restore');

    Route::post('settings/worlds/activities/{activity}/ai-review', [AdminActivityController::class, 'review'])
        ->name('settings.worlds.activities.ai-review');

    Route::patch('settings/worlds/activities/{activity}/graph-layout', [AdminActivityController::class, 'updateActivityGraphLayout'])
        ->name('settings.worlds.activities.graph-layout.update');

    Route::delete('settings/worlds/activities/{activity}', [AdminActivityController::class, 'destroy'])
        ->name('settings.worlds.activities.destroy');

    Route::get('settings/worlds/activities/{activity}/markdown', [AdminActivityController::class, 'editMarkdown'])
        ->name('settings.worlds.activities.markdown.edit');

    Route::get('settings/worlds/activities/{activity}/npc-dialogue', [AdminNpcDialogueController::class, 'edit'])
        ->name('settings.worlds.activities.npc-dialogue.edit');

    Route::post('settings/worlds/activities/{activity}/npc-dialogue/nodes', [AdminNpcDialogueController::class, 'storeNode'])
        ->name('settings.worlds.activities.npc-dialogue.nodes.store');

    Route::patch('settings/worlds/npc-dialogue-nodes/{node}', [AdminNpcDialogueController::class, 'updateNode'])
        ->name('settings.worlds.npc-dialogue-nodes.update');

    Route::delete('settings/worlds/npc-dialogue-nodes/{node}', [AdminNpcDialogueController::class, 'destroyNode'])
        ->name('settings.worlds.npc-dialogue-nodes.destroy');

    Route::post('settings/worlds/activities/{activity}/npc-dialogue/transitions', [AdminNpcDialogueController::class, 'storeTransition'])
        ->name('settings.worlds.activities.npc-dialogue.transitions.store');

    Route::delete('settings/worlds/npc-dialogue-transitions/{transition}', [AdminNpcDialogueController::class, 'destroyTransition'])
        ->name('settings.worlds.npc-dialogue-transitions.destroy');

    Route::post('settings/worlds/nodes/{node}/activities/start', [AdminActivityController::class, 'updateStart'])
        ->name('settings.worlds.nodes.activities.start.update');

    Route::patch('settings/worlds/nodes/{node}/activities/layout', [AdminActivityController::class, 'updateNodeGraphLayout'])
        ->name('settings.worlds.nodes.activities.layout.update');

    Route::delete('settings/worlds/nodes/{node}/activities/start', [AdminActivityController::class, 'destroyStart'])
        ->name('settings.worlds.nodes.activities.start.destroy');

    Route::patch('settings/worlds/activity-starts/{start}', [AdminActivityController::class, 'updateStartRoute'])
        ->name('settings.worlds.activity-starts.update');

    Route::delete('settings/worlds/activity-starts/{start}', [AdminActivityController::class, 'destroyStartRoute'])
        ->name('settings.worlds.activity-starts.destroy');

    Route::post('settings/worlds/nodes/{node}/activity-transitions', [AdminActivityController::class, 'storeTransition'])
        ->name('settings.worlds.nodes.activity-transitions.store');

    Route::patch('settings/worlds/activity-transitions/{transition}', [AdminActivityController::class, 'updateTransition'])
        ->name('settings.worlds.activity-transitions.update');

    Route::delete('settings/worlds/activity-transitions/{transition}', [AdminActivityController::class, 'destroyTransition'])
        ->name('settings.worlds.activity-transitions.destroy');
});

Route::middleware(['auth', 'verified', 'can:world_map_access.ru'])->group(function () {
    Route::patch('settings/worlds/maps/{map}/access', [AdminWorldController::class, 'updateMapAccess'])
        ->name('settings.worlds.maps.access.update');

    Route::patch('settings/worlds/maps/{map}/editing-groups', [AdminWorldController::class, 'updateMapEditingGroups'])
        ->name('settings.worlds.maps.editing-groups.update');
});

Route::middleware(['auth', 'verified', 'can:world_maps.rud'])->group(function () {
    Route::delete('settings/worlds/maps/{map}', [AdminWorldController::class, 'destroyMap'])
        ->name('settings.worlds.maps.destroy');
});

Route::middleware(['auth', 'verified', 'can:world_nodes.rud'])->group(function () {
    Route::delete('settings/worlds/nodes/{node}', [AdminWorldController::class, 'destroyNode'])
        ->name('settings.worlds.nodes.destroy');
});

Route::middleware(['auth', 'verified', 'can:assets.ru'])->group(function () {
    Route::get('settings/assets', [AdminAssetController::class, 'index'])
        ->name('settings.assets.index');

    Route::get('settings/assets/tools', [AdminAssetController::class, 'tools'])
        ->name('settings.assets.tools');

    Route::get('settings/assets/items', [AdminItemController::class, 'index'])
        ->name('settings.assets.items');

    Route::get('settings/assets/media', [AdminAssetController::class, 'media'])
        ->name('settings.assets.media');

    Route::get('settings/assets/reusable-images', [AdminAssetController::class, 'reusableImages'])
        ->name('settings.assets.reusable-images');

    Route::get('settings/assets/media/download', [AdminAssetController::class, 'downloadMedia'])
        ->name('settings.assets.media.download');

    Route::post('settings/assets/tools', [AdminAssetController::class, 'storeTool'])
        ->name('settings.assets.tools.store');

    Route::post('settings/assets/items', [AdminItemController::class, 'store'])
        ->name('settings.assets.items.store');

    Route::patch('settings/assets/tools/{tool}', [AdminAssetController::class, 'updateTool'])
        ->name('settings.assets.tools.update');

    Route::patch('settings/assets/items/{item}', [AdminItemController::class, 'update'])
        ->name('settings.assets.items.update');

    Route::post('settings/assets/tool-media', [AdminAssetController::class, 'uploadToolMedia'])
        ->name('settings.assets.tool-media.store');

    Route::post('settings/assets/item-media', [AdminItemController::class, 'uploadMedia'])
        ->name('settings.assets.item-media.store');

    Route::post('settings/assets/media', [AdminAssetController::class, 'storeMedia'])
        ->name('settings.assets.media.store');

    Route::post('settings/assets/media/replace', [AdminAssetController::class, 'replaceMedia'])
        ->name('settings.assets.media.replace');

    Route::delete('settings/assets/media', [AdminAssetController::class, 'destroyMedia'])
        ->name('settings.assets.media.destroy');

    Route::patch('settings/assets/media/metadata', [AdminAssetController::class, 'updateMediaMetadata'])
        ->name('settings.assets.media.metadata.update');
});

Route::middleware(['auth', 'verified', 'can:sounds.ro'])->group(function () {
    Route::get('settings/assets/sounds', [AdminAssetController::class, 'sounds'])
        ->name('settings.assets.sounds');

    Route::get('settings/assets/reusable-sounds', [AdminAssetController::class, 'reusableSounds'])
        ->name('settings.assets.reusable-sounds');

    Route::get('settings/assets/dialogue-sound-sets', [AdminDialogueSoundSetController::class, 'index'])
        ->name('settings.assets.dialogue-sound-sets');
});

Route::middleware(['auth', 'verified', 'can:sounds.ru'])->group(function () {
    Route::post('settings/assets/sounds', [AdminAssetController::class, 'storeSound'])
        ->name('settings.assets.sounds.store');

    Route::patch('settings/assets/sounds/{sound}', [AdminAssetController::class, 'updateSound'])
        ->name('settings.assets.sounds.update');

    Route::post('settings/assets/sound-media', [AdminAssetController::class, 'uploadSoundMedia'])
        ->name('settings.assets.sound-media.store');

    Route::post('settings/assets/dialogue-sound-sets', [AdminDialogueSoundSetController::class, 'store'])
        ->name('settings.assets.dialogue-sound-sets.store');

    Route::patch('settings/assets/dialogue-sound-sets/{set}', [AdminDialogueSoundSetController::class, 'update'])
        ->name('settings.assets.dialogue-sound-sets.update');

    Route::post('settings/assets/dialogue-sound-sets/{set}/replace', [AdminDialogueSoundSetController::class, 'replace'])
        ->name('settings.assets.dialogue-sound-sets.replace');

    Route::post('settings/assets/dialogue-sound-sets/{set}/sounds/{letter}', [AdminDialogueSoundSetController::class, 'replaceSound'])
        ->name('settings.assets.dialogue-sound-sets.sounds.replace');
});

Route::middleware(['auth', 'verified', 'can:sounds.rud'])->group(function () {
    Route::delete('settings/assets/sounds/{sound}', [AdminAssetController::class, 'destroySound'])
        ->name('settings.assets.sounds.destroy');
});

Route::middleware(['auth', 'verified', 'can:presentation.ru'])->group(function () {
    Route::get('settings/presentation', [PresentationController::class, 'edit'])
        ->name('settings.presentation.edit');

    Route::patch('settings/presentation', [PresentationController::class, 'update'])
        ->name('settings.presentation.update');

    Route::post('settings/presentation/background-images', [PresentationController::class, 'uploadBackgroundImage'])
        ->name('settings.presentation.background-images.store');

    Route::patch('settings/info-pages/{page}', [PlatformInfoPageController::class, 'update'])
        ->name('settings.info-pages.update');
});

Route::middleware(['auth', 'verified', 'can:journal_feedback.ru'])->group(function () {
    Route::post('settings/admin-panel/feedback-requests/{feedbackRequest}', [AdminPanelController::class, 'respond'])
        ->name('settings.admin-panel.feedback-requests.respond');
});

Route::middleware(['auth', 'verified', 'can:competence_topics.ru'])->group(function () {
    Route::patch('settings/admin-panel/competence-topics', [AdminPanelController::class, 'updateCompetenceTopics'])
        ->name('settings.admin-panel.competence-topics.update');
});

Route::middleware(['auth', 'verified', 'can:learning_concepts.ru'])->group(function () {
    Route::patch('settings/admin-panel/learning-concepts', [AdminPanelController::class, 'updateLearningConcepts'])
        ->name('settings.admin-panel.learning-concepts.update');
});

Route::middleware(['auth', 'verified', 'can:organization_moderation.ru'])->group(function () {
    Route::patch('settings/admin-panel/organizations', [AdminPanelController::class, 'updateOrganizationSettings'])
        ->name('settings.admin-panel.organizations.update');
    Route::patch('settings/admin-panel/organization-icon-reports/{report}', [AdminPanelController::class, 'resolveOrganizationIconReport'])
        ->name('settings.admin-panel.organization-icon-reports.resolve');
});

Route::middleware(['auth', 'verified', 'can:journal_settings.ru'])->group(function () {
    Route::get('settings/journal', [JournalSettingsController::class, 'edit'])
        ->name('settings.journal.edit');
    Route::patch('settings/journal', [JournalSettingsController::class, 'update'])
        ->name('settings.journal.update');
    Route::post('settings/journal/background-images', [JournalSettingsController::class, 'uploadBackgroundImage'])
        ->name('settings.journal.background-images.store');
});

Route::middleware(['auth', 'verified', 'can:languages.ru'])->group(function () {
    Route::get('settings/languages', [AdminLanguageController::class, 'index'])
        ->name('settings.languages.index');
    Route::post('settings/languages', [AdminLanguageController::class, 'store'])
        ->name('settings.languages.store');
    Route::patch('settings/languages/{language}', [AdminLanguageController::class, 'update'])
        ->name('settings.languages.update');
    Route::get('settings/languages/export/english', [AdminLanguageController::class, 'export'])
        ->name('settings.languages.export.english');
    Route::get('settings/languages/{language}/export', [AdminLanguageController::class, 'export'])
        ->name('settings.languages.export');
    Route::post('settings/languages/{language}/import', [AdminLanguageController::class, 'import'])
        ->name('settings.languages.import');
});

Route::middleware(['auth', 'verified', 'can:ai.ro'])->group(function () {
    Route::get('settings/ai', [AdminAiController::class, 'index'])
        ->name('settings.ai.index');
});

Route::middleware(['auth', 'verified', 'can:ai.ru'])->group(function () {
    Route::post('settings/ai/credentials', [AdminAiController::class, 'storeCredential'])
        ->name('settings.ai.credentials.store');

    Route::patch('settings/ai/credentials/{credential}', [AdminAiController::class, 'updateCredential'])
        ->name('settings.ai.credentials.update');

    Route::post('settings/ai/templates', [AdminAiController::class, 'storeTemplate'])
        ->name('settings.ai.templates.store');

    Route::patch('settings/ai/templates/{template}', [AdminAiController::class, 'updateTemplate'])
        ->name('settings.ai.templates.update');

    Route::post('settings/ai/templates/{template}/test', [AdminAiController::class, 'testTemplate'])
        ->name('settings.ai.templates.test');
});

Route::middleware([
    'auth',
    'verified',
    'can:ai.ru',
    'can:world_maps.ru',
    'can:world_activities.ru',
])->group(function () {
    Route::post('settings/worlds/maps/{map}/ai-content-plans', [AdminAiContentAuthoringController::class, 'generate'])
        ->name('settings.worlds.maps.ai-content-plans.generate');
    Route::patch('settings/ai-content-plans/{run}', [AdminAiContentAuthoringController::class, 'update'])
        ->name('settings.ai-content-plans.update');
    Route::post('settings/ai-content-plans/{run}/apply', [AdminAiContentAuthoringController::class, 'apply'])
        ->name('settings.ai-content-plans.apply');
});

Route::middleware(['auth', 'verified', 'can:ai.rud'])->group(function () {
    Route::delete('settings/ai/credentials/{credential}', [AdminAiController::class, 'destroyCredential'])
        ->name('settings.ai.credentials.destroy');

    Route::delete('settings/ai/templates/{template}', [AdminAiController::class, 'destroyTemplate'])
        ->name('settings.ai.templates.destroy');
});

Route::middleware(['auth', 'verified', 'can:companion.ru'])->group(function () {
    Route::post('settings/companion/avatar', [AdminCompanionController::class, 'uploadAvatar'])
        ->name('settings.companion.avatar.store');

    Route::patch('settings/companion', [AdminCompanionController::class, 'update'])
        ->name('settings.companion.update');

    Route::get('settings/companion/dialogues', [AdminCompanionDialogueController::class, 'index'])
        ->name('settings.companion.dialogues.index');
    Route::post('settings/companion/dialogues', [AdminCompanionDialogueController::class, 'store'])
        ->name('settings.companion.dialogues.store');
    Route::get('settings/companion/dialogues/{dialogue}/assignments', [AdminCompanionDialogueController::class, 'assignments'])
        ->name('settings.companion.dialogues.assignments.index');
    Route::put('settings/companion/dialogues/{dialogue}/assignments', [AdminCompanionDialogueController::class, 'syncAssignments'])
        ->name('settings.companion.dialogues.assignments.update');
    Route::get('settings/companion/dialogues/{dialogue}', [AdminCompanionDialogueController::class, 'show'])
        ->name('settings.companion.dialogues.show');
    Route::patch('settings/companion/dialogues/{dialogue}', [AdminCompanionDialogueController::class, 'update'])
        ->name('settings.companion.dialogues.update');
    Route::delete('settings/companion/dialogues/{dialogue}', [AdminCompanionDialogueController::class, 'destroy'])
        ->name('settings.companion.dialogues.destroy');
});

Route::middleware(['auth', 'verified', 'can:groups.ru'])->group(function () {
    Route::get('settings/groups', [AdminLearningGroupController::class, 'index'])
        ->name('settings.groups.index');
    Route::post('settings/groups', [AdminLearningGroupController::class, 'store'])
        ->name('settings.groups.store');
    Route::patch('settings/groups/{group}', [AdminLearningGroupController::class, 'update'])
        ->name('settings.groups.update');
});

Route::middleware(['auth', 'verified', 'can:group_members.ru'])->group(function () {
    Route::patch('settings/groups/{group}/members', [AdminLearningGroupController::class, 'updateMembers'])
        ->name('settings.groups.members.update');
});

Route::middleware(['auth', 'verified', 'can:users.ru'])->group(function () {
    Route::patch('settings/admin/users/{user}/access', [AdminUserController::class, 'updateAccess'])
        ->name('settings.admin.users.access.update');
});

Route::middleware(['auth', 'verified', 'can:users.rud'])->group(function () {
    Route::delete('settings/admin/users/{user}', [AdminUserController::class, 'destroy'])
        ->name('settings.admin.users.destroy');
});

Route::middleware(['auth', 'verified', 'can:roles.ru'])->group(function () {
    Route::post('settings/admin/roles', [AdminAccessController::class, 'storeRole'])
        ->name('settings.admin.roles.store');

    Route::patch('settings/admin/roles/{role}', [AdminAccessController::class, 'updateRole'])
        ->name('settings.admin.roles.update');
});

Route::middleware(['auth', 'verified', 'can:roles.rud'])->group(function () {
    Route::delete('settings/admin/roles/{role}', [AdminAccessController::class, 'destroyRole'])
        ->name('settings.admin.roles.destroy');
});

Route::get('.well-known/passkey-endpoints', function () {
    return response()->json([
        'enroll' => route('security.edit'),
        'manage' => route('security.edit'),
    ]);
})->name('well-known.passkeys');
