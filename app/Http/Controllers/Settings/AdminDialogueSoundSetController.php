<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Queries\LoadEditableDialogueSoundSets;
use App\Learning\Serializers\DialogueTypingSoundSetSerializer;
use App\Learning\Services\DialogueTypingSoundSetService;
use App\Models\LearningDialogueSoundSet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminDialogueSoundSetController extends Controller
{
    public function __construct(
        private readonly LoadEditableDialogueSoundSets $loadSets,
        private readonly DialogueTypingSoundSetSerializer $serializer,
        private readonly DialogueTypingSoundSetService $service,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'sets' => $this->loadSets->handle()
                ->map(fn (LearningDialogueSoundSet $set): array => $this->serializer->admin($set))
                ->values()
                ->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate($this->metadataRules());
        $files = $request->validate([
            'files' => ['required', 'array', 'size:26'],
            'files.*' => ['required', 'file', 'mimes:wav', 'max:20480'],
        ])['files'];

        $set = $this->service->create($data, $files);

        return $this->redirectToAssets($set);
    }

    public function update(Request $request, LearningDialogueSoundSet $set): RedirectResponse
    {
        $data = $request->validate($this->metadataRules($set));
        $set = $this->service->update($set, $data);

        return $this->redirectToAssets($set);
    }

    public function replace(Request $request, LearningDialogueSoundSet $set): RedirectResponse
    {
        $files = $request->validate([
            'files' => ['required', 'array', 'size:26'],
            'files.*' => ['required', 'file', 'mimes:wav', 'max:20480'],
        ])['files'];
        $this->service->replaceSounds($set, $files);

        return $this->redirectToAssets($set);
    }

    public function replaceSound(Request $request, LearningDialogueSoundSet $set, string $letter): RedirectResponse
    {
        $file = $request->validate([
            'file' => ['required', 'file', 'mimes:wav', 'max:20480'],
        ])['file'];
        $this->service->replaceSound($set, $letter, $file);

        return $this->redirectToAssets($set);
    }

    /**
     * @return array<string, mixed>
     */
    private function metadataRules(?LearningDialogueSoundSet $set = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => [
                'required',
                'string',
                'alpha_dash',
                'max:120',
                Rule::unique('learning_dialogue_sound_sets', 'slug')->ignore($set?->id),
            ],
            'tags' => ['nullable', 'array', 'max:12'],
            'tags.*' => ['string', 'max:40'],
            'is_default' => ['nullable', 'boolean'],
        ];
    }

    private function redirectToAssets(LearningDialogueSoundSet $set): RedirectResponse
    {
        return to_route('settings.index', [
            'panel' => 'admin-assets-world-objects',
            'asset' => 'dialogue-sounds',
            'dialogueSoundSet' => $set->id,
        ]);
    }
}
