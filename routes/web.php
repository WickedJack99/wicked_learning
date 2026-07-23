<?php

use App\Http\Controllers\LearnerCompetenceController;
use App\Http\Controllers\LearnerJournalController;
use App\Http\Controllers\LearningActivityTranslationController;
use App\Http\Controllers\LearningBookmarkController;
use App\Http\Controllers\LearningGroupController;
use App\Http\Controllers\LearningItemActivityController;
use App\Http\Controllers\LearningRouteProgressController;
use App\Http\Controllers\LearningSharedTaskSubmissionController;
use App\Http\Controllers\LearningWorldController;
use App\Http\Controllers\OrganizationController;
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
Route::get('info/{page}', [PlatformInfoPageController::class, 'showConfigured'])
    ->name('info.show');
Route::get('source', SourceCodePageController::class)->name('source');

Route::get('world', [LearningWorldController::class, 'show'])->name('world');
Route::get('learning/search', [LearningWorldController::class, 'search'])
    ->name('learning.search');
Route::get('learning/nodes/{node}/play', [LearningWorldController::class, 'play'])
    ->name('learning.nodes.play');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('bookmarks', [LearningBookmarkController::class, 'index'])->name('bookmarks');
    Route::get('competence', [LearnerCompetenceController::class, 'index'])
        ->name('competence.index');
    Route::get('organizations', [OrganizationController::class, 'index'])
        ->name('organizations.index');
    Route::post('organizations', [OrganizationController::class, 'store'])
        ->name('organizations.store');
    Route::get('organizations/{organization:slug}', [OrganizationController::class, 'show'])
        ->name('organizations.show');
    Route::patch('organizations/{organization:slug}', [OrganizationController::class, 'update'])
        ->name('organizations.update');
    Route::delete('organizations/{organization:slug}', [OrganizationController::class, 'destroy'])
        ->name('organizations.destroy');
    Route::post('organizations/{organization:slug}/icon', [OrganizationController::class, 'uploadIcon'])
        ->name('organizations.icon.store');
    Route::post('organizations/{organization:slug}/icon-reports', [OrganizationController::class, 'reportIcon'])
        ->name('organizations.icon-reports.store');
    Route::post('organizations/{organization:slug}/join-requests', [OrganizationController::class, 'requestMembership'])
        ->name('organizations.join-requests.store');
    Route::patch('organization-join-requests/{joinRequest}', [OrganizationController::class, 'respondToJoinRequest'])
        ->name('organizations.join-requests.update');
    Route::delete('organizations/{organization:slug}/membership', [OrganizationController::class, 'leave'])
        ->name('organizations.membership.destroy');
    Route::patch('organization-memberships/{membership}/leader', [OrganizationController::class, 'promoteMember'])
        ->name('organizations.memberships.promote');
    Route::post('organizations/{organization:slug}/messages', [OrganizationController::class, 'storeMessage'])
        ->name('organizations.messages.store');
    Route::delete('organization-messages/{message}', [OrganizationController::class, 'destroyMessage'])
        ->name('organizations.messages.destroy');
    Route::patch('organization-messages/{message}/hide', [OrganizationController::class, 'hideMessage'])
        ->name('organizations.messages.hide');
    Route::get('learning/groups', [LearningGroupController::class, 'index'])
        ->name('learning.groups.index');
    Route::post('learning/groups/{group}/messages', [LearningGroupController::class, 'storeMessage'])
        ->name('learning.groups.messages.store');
    Route::post('learning/groups/{group}/admin-chat-vote', [LearningGroupController::class, 'voteForAdminChatAccess'])
        ->name('learning.groups.admin-chat-vote');
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
    Route::get('learning/journal', [LearnerJournalController::class, 'index'])
        ->name('learning.journal.index');
    Route::get('learning/journal/export', [LearnerJournalController::class, 'export'])
        ->name('learning.journal.export');
    Route::post('learning/journal/pages', [LearnerJournalController::class, 'storePage'])
        ->name('learning.journal.pages.store');
    Route::patch('learning/journal/pages/{page}', [LearnerJournalController::class, 'update'])
        ->name('learning.journal.pages.update');
    Route::delete('learning/journal/pages/{page}', [LearnerJournalController::class, 'destroy'])
        ->name('learning.journal.pages.destroy');
    Route::post('learning/journal/pages/{page}/feedback-request', [LearnerJournalController::class, 'requestFeedback'])
        ->name('learning.journal.pages.feedback-request');
    Route::post('learning/activities/{activity}/reflection', [LearnerJournalController::class, 'storeActivityReflection'])
        ->name('learning.activities.reflection.store');
    Route::post('learning/activities/{activity}/shared-task-submissions', [LearningSharedTaskSubmissionController::class, 'store'])
        ->name('learning.activities.shared-task-submissions.store');
    Route::post('learning/npc-dialogue-nodes/{node}/reflection', [LearnerJournalController::class, 'storeDialogueReflection'])
        ->name('learning.npc-dialogue-nodes.reflection.store');
    Route::get('learning/activities/{activity}/translation', [LearningActivityTranslationController::class, 'show'])
        ->name('learning.activities.translation.show');
    Route::post('learning/questions/{question}/answer', [LearningWorldController::class, 'answerQuestion'])
        ->name('learning.questions.answer');
    Route::post('learning/npc-dialogue-nodes/{node}/answer', [LearningWorldController::class, 'answerNpcDialogue'])
        ->name('learning.npc-dialogue-nodes.answer');
    Route::post('learning/npc-dialogue-nodes/{node}/grant-tool', [LearningWorldController::class, 'grantNpcDialogueTool'])
        ->name('learning.npc-dialogue-nodes.grant-tool');
    Route::post('learning/activities/{activity}/npc-dialogue-state', [LearningWorldController::class, 'updateNpcDialogueState'])
        ->name('learning.activities.npc-dialogue-state');
    Route::post('learning/activities/{activity}/obstacle-tool', [LearningWorldController::class, 'useObstacleTool'])
        ->name('learning.activities.obstacle-tool');
    Route::post('learning/activities/{activity}/grant-tool', [LearningWorldController::class, 'grantActivityTool'])
        ->name('learning.activities.grant-tool');
    Route::post('learning/activities/{activity}/grant-items', [LearningItemActivityController::class, 'grantItems'])
        ->name('learning.activities.grant-items');
    Route::post('learning/activity-starts/{start}/restart', [LearningRouteProgressController::class, 'restart'])
        ->name('learning.activity-starts.restart');
    Route::post('learning/activity-starts/{start}/reset', [LearningRouteProgressController::class, 'reset'])
        ->name('learning.activity-starts.reset');
    Route::post('learning/activities/{activity}/item-obstacle-slot', [LearningItemActivityController::class, 'placeObstacleSlot'])
        ->name('learning.activities.item-obstacle-slot');
    Route::post('learning/activities/{activity}/item-obstacle-continue', [LearningItemActivityController::class, 'continueObstacle'])
        ->name('learning.activities.item-obstacle-continue');
});

require __DIR__.'/settings.php';
