<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningSound;
use App\Learning\Actions\CreateLearningTool;
use App\Learning\Actions\UpdateLearningSound;
use App\Learning\Actions\UpdateLearningTool;
use App\Learning\Queries\LoadEditableSounds;
use App\Learning\Queries\LoadEditableTools;
use App\Learning\Queries\LoadReusableImageAssets;
use App\Learning\Serializers\AdminSoundSerializer;
use App\Learning\Serializers\AdminToolSerializer;
use App\Learning\Services\ReusableMediaAssetManager;
use App\Learning\Services\SoundMediaUploadService;
use App\Learning\Services\ToolMediaUploadService;
use App\Learning\Validation\AdminSoundRules;
use App\Learning\Validation\AdminToolRules;
use App\Models\LearningSound;
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
        private readonly LoadEditableSounds $loadEditableSounds,
        private readonly AdminToolSerializer $toolSerializer,
        private readonly AdminSoundSerializer $soundSerializer,
        private readonly AdminToolRules $rules,
        private readonly AdminSoundRules $soundRules,
        private readonly CreateLearningTool $createLearningTool,
        private readonly UpdateLearningTool $updateLearningTool,
        private readonly CreateLearningSound $createLearningSound,
        private readonly UpdateLearningSound $updateLearningSound,
        private readonly ToolMediaUploadService $toolMediaUpload,
        private readonly SoundMediaUploadService $soundMediaUpload,
        private readonly LoadReusableImageAssets $loadReusableImageAssets,
        private readonly ReusableMediaAssetManager $mediaAssetManager,
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

    public function media(): Response
    {
        return Inertia::render('settings/assets/media', [
            'assets' => $this->loadReusableImageAssets->handle(),
        ]);
    }

    public function sounds(): Response
    {
        return Inertia::render('settings/assets/sounds', [
            'sounds' => $this->soundPayload(),
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

    public function storeSound(Request $request): RedirectResponse
    {
        $sound = $this->createLearningSound->handle(
            $request->validate($this->soundRules->store()),
        );

        return redirect()->route('settings.assets.sounds', ['sound' => $sound->id]);
    }

    public function updateSound(Request $request, LearningSound $sound): RedirectResponse
    {
        $this->updateLearningSound->handle(
            $sound,
            $request->validate($this->soundRules->update($sound)),
        );

        return redirect()->route('settings.assets.sounds', ['sound' => $sound->id]);
    }

    public function destroySound(LearningSound $sound): RedirectResponse
    {
        $sound->delete();

        return redirect()->route('settings.assets.sounds');
    }

    public function uploadSoundMedia(Request $request): JsonResponse
    {
        $data = $request->validate($this->soundRules->upload());

        return response()->json($this->soundMediaUpload->upload($data['file'] ?? null));
    }

    public function storeMedia(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);

        $this->mediaAssetManager->upload($data['file'] ?? null);

        return redirect()->route('settings.assets.media');
    }

    public function replaceMedia(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:5120'],
            'url' => ['required', 'string', 'max:2048'],
        ]);

        $this->mediaAssetManager->replaceAndKeep(
            $data['url'],
            $data['file'] ?? null,
        );

        return redirect()->route('settings.assets.media');
    }

    public function destroyMedia(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'url' => ['required', 'string', 'max:2048'],
        ]);

        $this->mediaAssetManager->deleteAsset($data['url']);

        return redirect()->route('settings.assets.media');
    }

    public function reusableImages(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        return response()->json([
            'assets' => $this->loadReusableImageAssets->handle($data['q'] ?? null),
        ]);
    }

    public function reusableSounds(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        return response()->json([
            'sounds' => $this->soundPayload($data['q'] ?? null),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function soundPayload(?string $search = null): array
    {
        return $this->loadEditableSounds
            ->handle($search)
            ->map(fn (LearningSound $sound): array => $this->soundSerializer->serialize($sound))
            ->all();
    }
}
