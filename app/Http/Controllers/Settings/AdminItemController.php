<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningItem;
use App\Learning\Actions\UpdateLearningItem;
use App\Learning\Queries\LoadEditableItems;
use App\Learning\Serializers\AdminItemSerializer;
use App\Learning\Services\ItemMediaUploadService;
use App\Learning\Validation\AdminItemRules;
use App\Models\LearningItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminItemController extends Controller
{
    public function __construct(
        private readonly LoadEditableItems $loadEditableItems,
        private readonly AdminItemSerializer $itemSerializer,
        private readonly AdminItemRules $itemRules,
        private readonly CreateLearningItem $createLearningItem,
        private readonly UpdateLearningItem $updateLearningItem,
        private readonly ItemMediaUploadService $itemMediaUpload,
    ) {}

    public function index(): Response
    {
        return Inertia::render('settings/assets/items', [
            'items' => $this->loadEditableItems
                ->handle()
                ->map(fn (LearningItem $item): array => $this->itemSerializer->serialize($item))
                ->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $item = $this->createLearningItem->handle(
            $request->validate($this->itemRules->store()),
        );

        return redirect()->route('settings.assets.items', ['item' => $item->id]);
    }

    public function update(Request $request, LearningItem $item): RedirectResponse
    {
        $this->updateLearningItem->handle(
            $item,
            $request->validate($this->itemRules->update($item)),
        );

        return redirect()->route('settings.assets.items', ['item' => $item->id]);
    }

    public function uploadMedia(Request $request): JsonResponse
    {
        $data = $request->validate($this->itemRules->upload());

        return response()->json($this->itemMediaUpload->upload($data['file'] ?? null));
    }
}
