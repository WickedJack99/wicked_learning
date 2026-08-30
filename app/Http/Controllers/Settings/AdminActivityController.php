<?php

namespace App\Http\Controllers\Settings;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Ai\Actions\ReviewLearningActivity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ReviewLearningActivityRequest;
use App\Learning\Actions\CreateActivityTransition;
use App\Learning\Actions\CreateLearningActivity;
use App\Learning\Actions\DeleteActivityTransition;
use App\Learning\Actions\DeleteLearningActivity;
use App\Learning\Actions\UpdateActivitySpecialGraphLayout;
use App\Learning\Actions\UpdateActivityTransition;
use App\Learning\Actions\UpdateLearningActivity;
use App\Learning\Actions\UpdateLearningSourceRecord;
use App\Learning\Actions\UpdateNodeActivityGraphLayout;
use App\Learning\Queries\LoadSourceRecordVersions;
use App\Learning\Serializers\AdminMarkdownActivitySerializer;
use App\Learning\Serializers\EditableSourceRecordSerializer;
use App\Learning\Serializers\SourceRecordVersionSerializer;
use App\Learning\Services\ActivityStartRouteService;
use App\Learning\Services\LearningMapEditAccessService;
use App\Learning\Validation\AdminActivityRules;
use App\Models\ActivityTransition;
use App\Models\AiAgentTemplate;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningSourceRecord;
use App\Models\LearningSourceRecordVersion;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class AdminActivityController extends Controller
{
    public function __construct(
        private readonly AdminMarkdownActivitySerializer $markdownActivitySerializer,
        private readonly AdminActivityRules $rules,
        private readonly CreateLearningActivity $createLearningActivity,
        private readonly UpdateLearningActivity $updateLearningActivity,
        private readonly UpdateActivitySpecialGraphLayout $updateActivitySpecialGraphLayout,
        private readonly UpdateNodeActivityGraphLayout $updateNodeActivityGraphLayout,
        private readonly DeleteLearningActivity $deleteLearningActivity,
        private readonly ActivityStartRouteService $startRouteService,
        private readonly CreateActivityTransition $createActivityTransition,
        private readonly UpdateActivityTransition $updateActivityTransition,
        private readonly DeleteActivityTransition $deleteActivityTransition,
        private readonly LearningMapEditAccessService $mapEditAccess,
        private readonly EditableSourceRecordSerializer $sourceRecordSerializer,
        private readonly UpdateLearningSourceRecord $updateSourceRecord,
        private readonly LoadSourceRecordVersions $sourceRecordVersions,
        private readonly SourceRecordVersionSerializer $sourceRecordVersionSerializer,
    ) {}

    public function edit(Request $request, LearningNode $node): RedirectResponse
    {
        $this->authorizeNodeEdit($request, $node);
        $node->loadMissing('map');

        return redirect()->route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $node->map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]);
    }

    public function store(Request $request, LearningNode $node): RedirectResponse
    {
        $this->authorizeNodeEdit($request, $node);

        $this->createLearningActivity->handle(
            $node,
            $request->validate($this->rules->store($node)),
        );

        return $this->redirectToActivities($node);
    }

    public function storeSourceRecord(Request $request): JsonResponse
    {
        $this->authorizeGlobalActivityEdit($request);
        $data = $request->validate($this->rules->sourceRecord());

        $source = LearningSourceRecord::query()->firstOrCreate([
            'anchor' => $data['anchor'] ?? null,
            'excerpt' => $data['excerpt'] ?? null,
            'published_at' => $data['publishedAt'] ?? null,
            'publisher' => $data['publisher'] ?? null,
            'rights' => $data['rights'] ?? null,
            'title' => $data['title'],
            'url' => $data['url'],
        ], [
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'sourceRecord' => $this->sourceRecordSerializer->serialize($source),
        ], 201);
    }

    public function updateSourceRecord(Request $request, LearningSourceRecord $sourceRecord): JsonResponse
    {
        $this->authorizeGlobalActivityEdit($request);
        $data = $request->validate($this->rules->sourceRecord());
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $sourceRecord = $this->updateSourceRecord->handle($user, $sourceRecord, $data);

        return response()->json([
            'sourceRecord' => $this->sourceRecordSerializer->serialize($sourceRecord->refresh()),
        ]);
    }

    public function sourceRecordVersions(Request $request, LearningSourceRecord $sourceRecord): JsonResponse
    {
        $this->authorizeGlobalActivityEdit($request);
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);
        $versions = $this->sourceRecordVersions->paginate(
            $sourceRecord,
            page: $data['page'] ?? 1,
            perPage: $data['per_page'] ?? 8,
        );

        return response()->json([
            'items' => $versions->getCollection()
                ->map(fn (LearningSourceRecordVersion $version): array => $this->sourceRecordVersionSerializer->serialize($version))
                ->values()
                ->all(),
            'pagination' => [
                'page' => $versions->currentPage(),
                'perPage' => $versions->perPage(),
                'total' => $versions->total(),
                'lastPage' => $versions->lastPage(),
            ],
        ]);
    }

    public function destroySourceRecord(Request $request, LearningSourceRecord $sourceRecord): HttpResponse
    {
        $this->authorizeGlobalActivityEdit($request);
        $sourceRecord->delete();

        return response()->noContent();
    }

    public function update(Request $request, LearningActivity $activity): RedirectResponse
    {
        $this->authorizeActivityEdit($request, $activity);

        $data = $request->validate($this->rules->update($activity));
        $activity = $this->updateLearningActivity->handle(
            $activity,
            $data,
        );

        if (($data['return_to_markdown'] ?? false) && $activity->type === 'markdown') {
            return redirect()->route('settings.worlds.activities.markdown.edit', $activity);
        }

        return $this->redirectToActivities($activity->node);
    }

    public function review(
        ReviewLearningActivityRequest $request,
        LearningActivity $activity,
        ReviewLearningActivity $review,
    ): JsonResponse {
        $this->authorizeActivityEdit($request, $activity);
        abort_unless(
            $request->user()?->hasAccess(PermissionCatalog::AI, AccessLevel::UPDATE) ?? false,
            403,
        );

        $template = AiAgentTemplate::query()->findOrFail($request->integer('template_id'));
        abort_unless($template->enabled && $template->purpose === 'activity_review', 422);

        $reviewed = $review->handle($activity, $template, $request->user());

        return response()->json([
            'data' => [
                'activityId' => $reviewed->id,
                'aiReviewStatus' => $reviewed->ai_review_status,
                'aiReviewedAt' => $reviewed->ai_reviewed_at?->toIso8601String(),
                'aiReview' => $reviewed->ai_review,
            ],
        ]);
    }

    public function updateNodeGraphLayout(Request $request, LearningNode $node): RedirectResponse
    {
        $this->authorizeNodeEdit($request, $node);

        $this->updateNodeActivityGraphLayout->handle(
            $node,
            $request->validate($this->rules->specialGraphNodeLayout()),
        );

        return $this->redirectToActivities($node);
    }

    public function updateActivityGraphLayout(Request $request, LearningActivity $activity): RedirectResponse
    {
        $this->authorizeActivityEdit($request, $activity);

        $activity = $this->updateActivitySpecialGraphLayout->handle(
            $activity,
            $request->validate($this->rules->specialGraphNodeLayout()),
        );

        if ($activity->type === 'markdown') {
            return redirect()->route('settings.worlds.activities.markdown.edit', $activity);
        }

        if ($activity->type === 'npc_dialogue') {
            return redirect()->route('settings.worlds.activities.npc-dialogue.edit', $activity);
        }

        return $this->redirectToActivities($activity->node);
    }

    public function editMarkdown(Request $request, LearningActivity $activity): Response
    {
        abort_unless($activity->type === 'markdown', 404);
        $this->authorizeActivityEdit($request, $activity);

        return Inertia::render('settings/worlds/edit-markdown-activity', [
            'markdownActivity' => $this->markdownActivitySerializer->serialize($activity),
        ]);
    }

    public function destroy(Request $request, LearningActivity $activity): RedirectResponse
    {
        $this->authorizeActivityEdit($request, $activity);

        return $this->redirectToActivities(
            $this->deleteLearningActivity->handle($activity),
        );
    }

    public function updateStart(Request $request, LearningNode $node): RedirectResponse
    {
        $this->authorizeNodeEdit($request, $node);

        $data = $request->validate($this->rules->start());
        $this->startRouteService->addStart($node, (int) $data['activity_id']);

        return $this->redirectToActivities($node);
    }

    public function destroyStart(Request $request, LearningNode $node): RedirectResponse
    {
        $this->authorizeNodeEdit($request, $node);

        $data = $request->validate($this->rules->destroyStart());
        $activityId = isset($data['activity_id']) ? (int) $data['activity_id'] : null;
        $this->startRouteService->removeStarts($node, $activityId);

        return $this->redirectToActivities($node);
    }

    public function updateStartRoute(Request $request, LearningActivityStart $start): RedirectResponse
    {
        $start->loadMissing('node');
        $this->authorizeNodeEdit($request, $start->node);

        $this->startRouteService->updateStartRoute(
            $start,
            $request->validate($this->rules->startRoute()),
        );

        return $this->redirectToActivities($start->node);
    }

    public function destroyStartRoute(Request $request, LearningActivityStart $start): RedirectResponse
    {
        $start->loadMissing('node');
        $this->authorizeNodeEdit($request, $start->node);

        return $this->redirectToActivities(
            $this->startRouteService->destroyStartRoute($start),
        );
    }

    public function storeTransition(Request $request, LearningNode $node): RedirectResponse
    {
        $this->authorizeNodeEdit($request, $node);

        $this->createActivityTransition->handle(
            $node,
            $request->validate($this->rules->transition()),
        );

        return $this->redirectToActivities($node);
    }

    public function destroyTransition(Request $request, ActivityTransition $transition): RedirectResponse
    {
        $transition->loadMissing('fromActivity.node');
        $this->authorizeNodeEdit($request, $transition->fromActivity->node);

        return $this->redirectToActivities(
            $this->deleteActivityTransition->handle($transition),
        );
    }

    public function updateTransition(Request $request, ActivityTransition $transition): RedirectResponse
    {
        $transition->loadMissing('fromActivity.node');
        $this->authorizeNodeEdit($request, $transition->fromActivity->node);

        $this->updateActivityTransition->handle(
            $transition,
            $request->validate($this->rules->transitionUpdate()),
        );

        return $this->redirectToActivities($transition->fromActivity->node);
    }

    private function redirectToActivities(LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');

        if ($this->shouldReturnToSettingsWorkspace(request())) {
            return redirect()->route('settings.index', [
                'panel' => 'admin-world-builder',
                'map' => $node->map->id,
                'node' => $node->id,
            ]);
        }

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    private function shouldReturnToSettingsWorkspace(Request $request): bool
    {
        $referer = $request->headers->get('referer');

        return is_string($referer)
            && str_contains($referer, '/settings')
            && str_contains($referer, 'panel=admin-world-builder');
    }

    private function authorizeActivityEdit(Request $request, LearningActivity $activity): void
    {
        $activity->loadMissing('node.map');

        $this->authorizeNodeEdit($request, $activity->node);
    }

    private function authorizeNodeEdit(Request $request, LearningNode $node): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canEditActivitiesOnNode($request->user(), $node), 403);
    }

    private function authorizeGlobalActivityEdit(Request $request): void
    {
        abort_unless($request->user()?->hasAccess(PermissionCatalog::WORLD_ACTIVITIES, AccessLevel::UPDATE) ?? false, 403);
    }
}
