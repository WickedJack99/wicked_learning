<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateNpcDialogueNode;
use App\Learning\Actions\CreateNpcDialogueTransition;
use App\Learning\Actions\DeleteNpcDialogueNode;
use App\Learning\Actions\DeleteNpcDialogueTransition;
use App\Learning\Actions\UpdateNpcDialogueNode;
use App\Learning\Queries\LoadEditableNpcDialogueGraph;
use App\Learning\Queries\LoadEditableTools;
use App\Learning\Serializers\AdminNpcDialogueGraphSerializer;
use App\Learning\Serializers\LearningToolSerializer;
use App\Learning\Services\LearningMapEditAccessService;
use App\Learning\Validation\AdminNpcDialogueRules;
use App\Models\LearningActivity;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminNpcDialogueController extends Controller
{
    public function __construct(
        private readonly LoadEditableNpcDialogueGraph $loadDialogueGraph,
        private readonly LoadEditableTools $loadEditableTools,
        private readonly AdminNpcDialogueGraphSerializer $dialogueGraphSerializer,
        private readonly LearningToolSerializer $toolSerializer,
        private readonly AdminNpcDialogueRules $rules,
        private readonly CreateNpcDialogueNode $createNode,
        private readonly UpdateNpcDialogueNode $updateNode,
        private readonly DeleteNpcDialogueNode $deleteNode,
        private readonly CreateNpcDialogueTransition $createTransition,
        private readonly DeleteNpcDialogueTransition $deleteTransition,
        private readonly LearningMapEditAccessService $mapEditAccess,
    ) {}

    public function edit(Request $request, LearningActivity $activity): Response
    {
        $this->authorizeActivityEdit($request, $activity);

        return Inertia::render('settings/worlds/edit-npc-dialogue', [
            'dialogueGraph' => $this->dialogueGraphSerializer->serialize(
                $this->loadDialogueGraph->handle($activity),
            ),
            'tools' => $this->loadEditableTools
                ->handle()
                ->map(fn (LearningTool $tool): array => $this->toolSerializer->serialize($tool))
                ->all(),
        ]);
    }

    public function storeNode(Request $request, LearningActivity $activity): RedirectResponse
    {
        $this->authorizeActivityEdit($request, $activity);
        $this->loadDialogueGraph->handle($activity);
        $this->createNode->handle($activity, $request->validate($this->rules->storeNode()));

        return $this->redirectToDialogue($activity);
    }

    public function updateNode(Request $request, NpcDialogueNode $node): RedirectResponse
    {
        $node->loadMissing('activity.node.map');
        $this->authorizeActivityEdit($request, $node->activity);

        $node = $this->updateNode->handle(
            $node,
            $request->validate($this->rules->updateNode()),
        );

        return $this->redirectToDialogue($node->activity);
    }

    public function destroyNode(Request $request, NpcDialogueNode $node): RedirectResponse
    {
        $node->loadMissing('activity.node.map');
        $this->authorizeActivityEdit($request, $node->activity);

        return $this->redirectToDialogue($this->deleteNode->handle($node));
    }

    public function storeTransition(Request $request, LearningActivity $activity): RedirectResponse
    {
        $this->authorizeActivityEdit($request, $activity);
        $this->loadDialogueGraph->handle($activity);
        $this->createTransition->handle(
            $activity,
            $request->validate($this->rules->transition()),
        );

        return $this->redirectToDialogue($activity);
    }

    public function destroyTransition(Request $request, NpcDialogueTransition $transition): RedirectResponse
    {
        $transition->loadMissing('fromNode.activity.node.map');
        $this->authorizeActivityEdit($request, $transition->fromNode->activity);

        return $this->redirectToDialogue($this->deleteTransition->handle($transition));
    }

    private function redirectToDialogue(LearningActivity $activity): RedirectResponse
    {
        return redirect()->route('settings.worlds.activities.npc-dialogue.edit', $activity);
    }

    private function authorizeActivityEdit(Request $request, LearningActivity $activity): void
    {
        $activity->loadMissing('node.map');

        abort_unless($request->user() && $this->mapEditAccess->canEditActivitiesOnNode($request->user(), $activity->node), 403);
    }
}
