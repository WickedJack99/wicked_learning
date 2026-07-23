<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningItem;
use App\Learning\Actions\UpdateLearningItem;
use App\Learning\Services\ItemMediaUploadService;
use App\Learning\Validation\AdminItemRules;
use App\Models\LearningItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AdminItemController extends Controller
{
    public function __construct(
        private readonly AdminItemRules $itemRules,
        private readonly CreateLearningItem $createLearningItem,
        private readonly UpdateLearningItem $updateLearningItem,
        private readonly ItemMediaUploadService $itemMediaUpload,
    ) {}

    public function index(): RedirectResponse
    {
        return $this->redirectToItems();
    }

    public function store(Request $request): RedirectResponse
    {
        $item = $this->createLearningItem->handle(
            $request->validate($this->itemRules->store()),
        );

        return $this->redirectToItems(['item' => $item->id]);
    }

    public function update(Request $request, LearningItem $item): RedirectResponse
    {
        $this->updateLearningItem->handle(
            $item,
            $request->validate($this->itemRules->update($item)),
        );

        return $this->redirectToItems(['item' => $item->id]);
    }

    public function uploadMedia(Request $request): JsonResponse
    {
        $data = $request->validate($this->itemRules->upload());

        return response()->json($this->itemMediaUpload->upload($data['file'] ?? null));
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function redirectToItems(array $extra = []): RedirectResponse
    {
        return to_route('settings.index', [
            'panel' => 'admin-assets-world-objects',
            'asset' => 'items',
            ...$extra,
        ]);
    }
}
