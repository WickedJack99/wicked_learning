<?php

use App\Http\Controllers\LearningBookmarkController;
use App\Http\Controllers\LearningItemActivityController;
use App\Http\Controllers\LearningWorldController;
use App\Http\Controllers\PlatformInfoPageController;
use App\Http\Controllers\SourceCodePageController;
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
Route::get('source', SourceCodePageController::class)->name('source');

Route::get('world', [LearningWorldController::class, 'show'])->name('world');
Route::get('learning/search', [LearningWorldController::class, 'search'])
    ->name('learning.search');
Route::get('learning/nodes/{node}/play', [LearningWorldController::class, 'play'])
    ->name('learning.nodes.play');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('bookmarks', [LearningBookmarkController::class, 'index'])->name('bookmarks');
    Route::post('learning/nodes/{node}/bookmark', [LearningBookmarkController::class, 'store'])
        ->name('learning.nodes.bookmark.store');
    Route::delete('learning/nodes/{node}/bookmark', [LearningBookmarkController::class, 'destroy'])
        ->name('learning.nodes.bookmark.destroy');
    Route::post('learning/nodes/{node}/reveal-tool', [LearningWorldController::class, 'revealNodeWithTool'])
        ->name('learning.nodes.reveal-tool');
    Route::post('learning/nodes/{node}/unlock-tool', [LearningWorldController::class, 'unlockNodeWithTool'])
        ->name('learning.nodes.unlock-tool');
    Route::post('learning/activities/{activity}/progress', [LearningWorldController::class, 'markActivity'])
        ->name('learning.activities.progress');
    Route::post('learning/questions/{question}/answer', [LearningWorldController::class, 'answerQuestion'])
        ->name('learning.questions.answer');
    Route::post('learning/npc-dialogue-nodes/{node}/answer', [LearningWorldController::class, 'answerNpcDialogue'])
        ->name('learning.npc-dialogue-nodes.answer');
    Route::post('learning/npc-dialogue-nodes/{node}/grant-tool', [LearningWorldController::class, 'grantNpcDialogueTool'])
        ->name('learning.npc-dialogue-nodes.grant-tool');
    Route::post('learning/activities/{activity}/obstacle-tool', [LearningWorldController::class, 'useObstacleTool'])
        ->name('learning.activities.obstacle-tool');
    Route::post('learning/activities/{activity}/grant-tool', [LearningWorldController::class, 'grantActivityTool'])
        ->name('learning.activities.grant-tool');
    Route::post('learning/activities/{activity}/grant-items', [LearningItemActivityController::class, 'grantItems'])
        ->name('learning.activities.grant-items');
    Route::post('learning/activities/{activity}/item-obstacle-slot', [LearningItemActivityController::class, 'placeObstacleSlot'])
        ->name('learning.activities.item-obstacle-slot');
    Route::post('learning/activities/{activity}/item-obstacle-continue', [LearningItemActivityController::class, 'continueObstacle'])
        ->name('learning.activities.item-obstacle-continue');
});

require __DIR__.'/settings.php';
