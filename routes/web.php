<?php

use App\Http\Controllers\LearningBookmarkController;
use App\Http\Controllers\LearningWorldController;
use App\Http\Controllers\PlatformInfoPageController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');
Route::get('about', [PlatformInfoPageController::class, 'show'])
    ->defaults('page', 'about')
    ->name('about');
Route::get('imprint', [PlatformInfoPageController::class, 'show'])
    ->defaults('page', 'imprint')
    ->name('imprint');
Route::get('data-protection', [PlatformInfoPageController::class, 'show'])
    ->defaults('page', 'data-protection')
    ->name('data-protection');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('world', [LearningWorldController::class, 'show'])->name('world');
    Route::get('bookmarks', [LearningBookmarkController::class, 'index'])->name('bookmarks');
    Route::redirect('dashboard', '/world')->name('dashboard');
    Route::post('learning/nodes/{node}/bookmark', [LearningBookmarkController::class, 'store'])
        ->name('learning.nodes.bookmark.store');
    Route::delete('learning/nodes/{node}/bookmark', [LearningBookmarkController::class, 'destroy'])
        ->name('learning.nodes.bookmark.destroy');
    Route::get('learning/search', [LearningWorldController::class, 'search'])
        ->name('learning.search');
    Route::post('learning/activities/{activity}/progress', [LearningWorldController::class, 'markActivity'])
        ->name('learning.activities.progress');
    Route::post('learning/questions/{question}/answer', [LearningWorldController::class, 'answerQuestion'])
        ->name('learning.questions.answer');
});

require __DIR__.'/settings.php';
