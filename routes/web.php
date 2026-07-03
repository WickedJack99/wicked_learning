<?php

use App\Http\Controllers\LearningWorldController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('world', [LearningWorldController::class, 'show'])->name('world');
    Route::redirect('dashboard', '/world')->name('dashboard');
    Route::post('learning/activities/{activity}/progress', [LearningWorldController::class, 'markActivity'])
        ->name('learning.activities.progress');
    Route::post('learning/questions/{question}/answer', [LearningWorldController::class, 'answerQuestion'])
        ->name('learning.questions.answer');
});

require __DIR__.'/settings.php';
