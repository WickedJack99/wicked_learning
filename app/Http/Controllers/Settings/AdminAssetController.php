<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningTool;
use App\Learning\Actions\UpdateLearningTool;
use App\Learning\Queries\LoadEditableTools;
use App\Learning\Serializers\AdminToolSerializer;
use App\Learning\Services\ToolMediaUploadService;
use App\Learning\Validation\AdminToolRules;
use App\Models\LearningTool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminAssetController extends Controller
{
    public function __construct(
        private readonly LoadEditableTools $loadEditableTools,
        private readonly AdminToolSerializer $toolSerializer,
        private readonly AdminToolRules $rules,
        private readonly CreateLearningTool $createLearningTool,
        private readonly UpdateLearningTool $updateLearningTool,
        private readonly ToolMediaUploadService $toolMediaUpload,
    ) {}

    public function index(): Response
    {
        return Inertia::render('settings/assets/index');
    }

    public function tools(): Response
    {
        return Inertia::render('settings/assets/tools', [
            'tools' => $this->loadEditableTools
                ->handle()
                ->map(fn (LearningTool $tool): array => $this->toolSerializer->serialize($tool))
                ->all(),
        ]);
    }

    public function storeTool(Request $request): RedirectResponse
    {
        $tool = $this->createLearningTool->handle(
            $request->validate($this->rules->store()),
        );

        return redirect()->route('settings.assets.tools', ['tool' => $tool->id]);
    }

    public function updateTool(Request $request, LearningTool $tool): RedirectResponse
    {
        $this->updateLearningTool->handle(
            $tool,
            $request->validate($this->rules->update($tool)),
        );

        return redirect()->route('settings.assets.tools', ['tool' => $tool->id]);
    }

    public function uploadToolMedia(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->upload());
        $upload = $this->toolMediaUpload->upload($data['file'] ?? null);

        return response()->json([
            'durationSeconds' => $upload['durationSeconds'],
            'url' => $upload['url'],
        ]);
    }
}
