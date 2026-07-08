<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateNpcDialogueNode;
use App\Learning\Actions\CreateNpcDialogueTransition;
use App\Learning\Actions\DeleteNpcDialogueNode;
use App\Learning\Actions\DeleteNpcDialogueTransition;
use App\Learning\Actions\UpdateNpcDialogueNode;
use App\Learning\Queries\LoadEditableNpcDialogueGraph;
use App\Learning\Serializers\AdminNpcDialogueGraphSerializer;
use App\Learning\Validation\AdminNpcDialogueRules;
use App\Models\LearningActivity;
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
        private readonly AdminNpcDialogueGraphSerializer $dialogueGraphSerializer,
        private readonly AdminNpcDialogueRules $rules,
        private readonly CreateNpcDialogueNode $createNode,
        private readonly UpdateNpcDialogueNode $updateNode,
        private readonly DeleteNpcDialogueNode $deleteNode,
        private readonly CreateNpcDialogueTransition $createTransition,
        private readonly DeleteNpcDialogueTransition $deleteTransition,
    ) {}

    public function edit(LearningActivity $activity): Response
    {
        return Inertia::render('settings/worlds/edit-npc-dialogue', [
            'dialogueGraph' => $this->dialogueGraphSerializer->serialize(
                $this->loadDialogueGraph->handle($activity),
            ),
        ]);
    }

    public function storeNode(Request $request, LearningActivity $activity): RedirectResponse
    {
        $this->loadDialogueGraph->handle($activity);
        $this->createNode->handle($activity, $request->validate($this->rules->storeNode()));

        return $this->redirectToDialogue($activity);
    }

    public function updateNode(Request $request, NpcDialogueNode $node): RedirectResponse
    {
        $node = $this->updateNode->handle(
            $node,
            $request->validate($this->rules->updateNode()),
        );

        return $this->redirectToDialogue($node->activity);
    }

    public function destroyNode(NpcDialogueNode $node): RedirectResponse
    {
        return $this->redirectToDialogue($this->deleteNode->handle($node));
    }

    public function storeTransition(Request $request, LearningActivity $activity): RedirectResponse
    {
        $this->loadDialogueGraph->handle($activity);
        $this->createTransition->handle(
            $activity,
            $request->validate($this->rules->transition()),
        );

        return $this->redirectToDialogue($activity);
    }

    public function destroyTransition(NpcDialogueTransition $transition): RedirectResponse
    {
        return $this->redirectToDialogue($this->deleteTransition->handle($transition));
    }

    private function redirectToDialogue(LearningActivity $activity): RedirectResponse
    {
        return redirect()->route('settings.worlds.activities.npc-dialogue.edit', $activity);
    }
}
