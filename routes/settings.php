<?php

use App\Http\Controllers\PlatformInfoPageController;
use App\Http\Controllers\Settings\AdminUserController;
use App\Http\Controllers\Settings\AppearanceController;
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
