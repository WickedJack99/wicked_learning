<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateActivityTransition;
use App\Learning\Actions\CreateLearningActivity;
use App\Learning\Actions\DeleteActivityTransition;
use App\Learning\Actions\DeleteLearningActivity;
use App\Learning\Actions\UpdateActivitySpecialGraphLayout;
use App\Learning\Actions\UpdateLearningActivity;
use App\Learning\Actions\UpdateNodeActivityGraphLayout;
use App\Learning\Queries\LoadEditableActivityGraph;
use App\Learning\Queries\LoadEditableItems;
use App\Learning\Queries\LoadEditableSounds;
use App\Learning\Queries\LoadEditableTools;
use App\Learning\Serializers\AdminActivityGraphSerializer;
use App\Learning\Serializers\AdminMarkdownActivitySerializer;
use App\Learning\Serializers\AdminSoundSerializer;
use App\Learning\Serializers\LearningItemSerializer;
use App\Learning\Serializers\LearningToolSerializer;
use App\Learning\Services\ActivityStartRouteService;
use App\Learning\Validation\AdminActivityRules;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningItem;
use App\Models\LearningNode;
use App\Models\LearningSound;
use App\Models\LearningTool;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminActivityController extends Controller
{
    public function __construct(
        private readonly LoadEditableActivityGraph $loadEditableActivityGraph,
        private readonly LoadEditableTools $loadEditableTools,
        private readonly LoadEditableItems $loadEditableItems,
        private readonly LoadEditableSounds $loadEditableSounds,
        private readonly AdminActivityGraphSerializer $activityGraphSerializer,
        private readonly AdminMarkdownActivitySerializer $markdownActivitySerializer,
        private readonly LearningToolSerializer $toolSerializer,
        private readonly LearningItemSerializer $itemSerializer,
        private readonly AdminSoundSerializer $soundSerializer,
        private readonly AdminActivityRules $rules,
        private readonly CreateLearningActivity $createLearningActivity,
        private readonly UpdateLearningActivity $updateLearningActivity,
        private readonly UpdateActivitySpecialGraphLayout $updateActivitySpecialGraphLayout,
        private readonly UpdateNodeActivityGraphLayout $updateNodeActivityGraphLayout,
        private readonly DeleteLearningActivity $deleteLearningActivity,
        private readonly ActivityStartRouteService $startRouteService,
        private readonly CreateActivityTransition $createActivityTransition,
        private readonly DeleteActivityTransition $deleteActivityTransition,
    ) {}

    public function edit(LearningNode $node): Response
    {
        return Inertia::render('settings/worlds/edit-node-activities', [
            'activityGraph' => $this->activityGraphSerializer->serialize(
                $this->loadEditableActivityGraph->handle($node),
            ),
            'items' => $this->loadEditableItems
                ->handle()
                ->map(fn (LearningItem $item): array => $this->itemSerializer->serialize($item))
                ->all(),
            'sounds' => $this->loadEditableSounds
                ->handle()
                ->map(fn (LearningSound $sound): array => $this->soundSerializer->serialize($sound))
                ->all(),
            'tools' => $this->loadEditableTools
                ->handle()
                ->map(fn (LearningTool $tool): array => $this->toolSerializer->serialize($tool))
                ->all(),
        ]);
    }

    public function store(Request $request, LearningNode $node): RedirectResponse
    {
        $this->createLearningActivity->handle(
            $node,
            $request->validate($this->rules->store($node)),
        );

        return $this->redirectToActivities($node);
    }

    public function update(Request $request, LearningActivity $activity): RedirectResponse
    {
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

    public function updateNodeGraphLayout(Request $request, LearningNode $node): RedirectResponse
    {
        $this->updateNodeActivityGraphLayout->handle(
            $node,
            $request->validate($this->rules->specialGraphNodeLayout()),
        );

        return $this->redirectToActivities($node);
    }

    public function updateActivityGraphLayout(Request $request, LearningActivity $activity): RedirectResponse
    {
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

    public function editMarkdown(LearningActivity $activity): Response
    {
        abort_unless($activity->type === 'markdown', 404);

        return Inertia::render('settings/worlds/edit-markdown-activity', [
            'markdownActivity' => $this->markdownActivitySerializer->serialize($activity),
        ]);
    }

    public function destroy(LearningActivity $activity): RedirectResponse
    {
        return $this->redirectToActivities(
            $this->deleteLearningActivity->handle($activity),
        );
    }

    public function updateStart(Request $request, LearningNode $node): RedirectResponse
    {
        $data = $request->validate($this->rules->start());
        $this->startRouteService->addStart($node, (int) $data['activity_id']);

        return $this->redirectToActivities($node);
    }

    public function destroyStart(Request $request, LearningNode $node): RedirectResponse
    {
        $data = $request->validate($this->rules->destroyStart());
        $activityId = isset($data['activity_id']) ? (int) $data['activity_id'] : null;
        $this->startRouteService->removeStarts($node, $activityId);

        return $this->redirectToActivities($node);
    }

    public function updateStartRoute(Request $request, LearningActivityStart $start): RedirectResponse
    {
        $start->loadMissing('node');
        $this->startRouteService->updateStartRoute(
            $start,
            $request->validate($this->rules->startRoute()),
        );

        return $this->redirectToActivities($start->node);
    }

    public function destroyStartRoute(LearningActivityStart $start): RedirectResponse
    {
        return $this->redirectToActivities(
            $this->startRouteService->destroyStartRoute($start),
        );
    }

    public function storeTransition(Request $request, LearningNode $node): RedirectResponse
    {
        $this->createActivityTransition->handle(
            $node,
            $request->validate($this->rules->transition()),
        );

        return $this->redirectToActivities($node);
    }

    public function destroyTransition(ActivityTransition $transition): RedirectResponse
    {
        return $this->redirectToActivities(
            $this->deleteActivityTransition->handle($transition),
        );
    }

    private function redirectToActivities(LearningNode $node): RedirectResponse
    {
        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }
}
