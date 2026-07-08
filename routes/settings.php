<?php

use App\Http\Controllers\PlatformInfoPageController;
use App\Http\Controllers\Settings\AdminActivityController;
use App\Http\Controllers\Settings\AdminNpcDialogueController;
use App\Http\Controllers\Settings\AdminUserController;
use App\Http\Controllers\Settings\AdminWorldController;
use App\Http\Controllers\Settings\AppearanceController;
use App\Http\Controllers\Settings\PresentationController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\SettingsController;
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
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

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
});

Route::middleware(['auth', 'verified', 'can:manage-users'])->group(function () {
    Route::get('settings/worlds', [AdminWorldController::class, 'index'])
        ->name('settings.worlds.index');

    Route::post('settings/worlds/maps', [AdminWorldController::class, 'storeMap'])
        ->name('settings.worlds.maps.store');

    Route::post('settings/worlds/portal-links', [AdminWorldController::class, 'storePortalLink'])
        ->name('settings.worlds.portal-links.store');

    Route::delete('settings/worlds/portal-links/{portalLink}', [AdminWorldController::class, 'destroyPortalLink'])
        ->name('settings.worlds.portal-links.destroy');

    Route::post('settings/worlds/node-images', [AdminWorldController::class, 'uploadNodeImage'])
        ->name('settings.worlds.node-images.store');

    Route::get('settings/worlds/maps/{map}/edit', [AdminWorldController::class, 'editMap'])
        ->name('settings.worlds.maps.edit');

    Route::patch('settings/worlds/maps/{map}', [AdminWorldController::class, 'updateMap'])
        ->name('settings.worlds.maps.update');

    Route::post('settings/worlds/maps/{map}/nodes', [AdminWorldController::class, 'storeNode'])
        ->name('settings.worlds.maps.nodes.store');

    Route::patch('settings/worlds/nodes/{node}', [AdminWorldController::class, 'updateNode'])
        ->name('settings.worlds.nodes.update');

    Route::post('settings/worlds/nodes/{node}/insert', [AdminWorldController::class, 'insertNode'])
        ->name('settings.worlds.nodes.insert');

    Route::patch('settings/worlds/nodes/{node}/swap', [AdminWorldController::class, 'swapNode'])
        ->name('settings.worlds.nodes.swap');

    Route::get('settings/worlds/nodes/{node}/activities', [AdminActivityController::class, 'edit'])
        ->name('settings.worlds.nodes.activities.edit');

    Route::post('settings/worlds/nodes/{node}/activities', [AdminActivityController::class, 'store'])
        ->name('settings.worlds.nodes.activities.store');

    Route::patch('settings/worlds/activities/{activity}', [AdminActivityController::class, 'update'])
        ->name('settings.worlds.activities.update');

    Route::delete('settings/worlds/activities/{activity}', [AdminActivityController::class, 'destroy'])
        ->name('settings.worlds.activities.destroy');

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

    Route::delete('settings/worlds/nodes/{node}/activities/start', [AdminActivityController::class, 'destroyStart'])
        ->name('settings.worlds.nodes.activities.start.destroy');

    Route::patch('settings/worlds/activity-starts/{start}', [AdminActivityController::class, 'updateStartRoute'])
        ->name('settings.worlds.activity-starts.update');

    Route::delete('settings/worlds/activity-starts/{start}', [AdminActivityController::class, 'destroyStartRoute'])
        ->name('settings.worlds.activity-starts.destroy');

    Route::post('settings/worlds/nodes/{node}/activity-transitions', [AdminActivityController::class, 'storeTransition'])
        ->name('settings.worlds.nodes.activity-transitions.store');

    Route::delete('settings/worlds/activity-transitions/{transition}', [AdminActivityController::class, 'destroyTransition'])
        ->name('settings.worlds.activity-transitions.destroy');

    Route::patch('settings/presentation', [PresentationController::class, 'update'])
        ->name('settings.presentation.update');

    Route::post('settings/presentation/background-images', [PresentationController::class, 'uploadBackgroundImage'])
        ->name('settings.presentation.background-images.store');

    Route::patch('settings/info-pages/{page}', [PlatformInfoPageController::class, 'update'])
        ->name('settings.info-pages.update');

    Route::patch('settings/admin/users/{user}/access', [AdminUserController::class, 'updateAccess'])
        ->name('settings.admin.users.access.update');

    Route::delete('settings/admin/users/{user}', [AdminUserController::class, 'destroy'])
        ->name('settings.admin.users.destroy');
});

Route::get('.well-known/passkey-endpoints', function () {
    return response()->json([
        'enroll' => route('security.edit'),
        'manage' => route('security.edit'),
    ]);
})->name('well-known.passkeys');
