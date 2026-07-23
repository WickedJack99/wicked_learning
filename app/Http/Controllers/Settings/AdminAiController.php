<?php

namespace App\Http\Controllers\Settings;

use App\Ai\Actions\DeleteAiAgentTemplate;
use App\Ai\Actions\DeleteAiProviderCredential;
use App\Ai\Actions\SaveAiAgentTemplate;
use App\Ai\Actions\SaveAiProviderCredential;
use App\Ai\Actions\TestAiAgentTemplate;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\SaveAiAgentTemplateRequest;
use App\Http\Requests\Settings\SaveAiProviderCredentialRequest;
use App\Http\Requests\Settings\TestAiAgentTemplateRequest;
use App\Models\AiAgentTemplate;
use App\Models\AiProviderCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class AdminAiController extends Controller
{
    public function index(): RedirectResponse
    {
        return $this->redirectToSettings();
    }

    public function storeCredential(
        SaveAiProviderCredentialRequest $request,
        SaveAiProviderCredential $save,
    ): RedirectResponse {
        $save->handle($request->validated());

        return $this->redirectToSettings('providers');
    }

    public function updateCredential(
        SaveAiProviderCredentialRequest $request,
        AiProviderCredential $credential,
        SaveAiProviderCredential $save,
    ): RedirectResponse {
        $save->handle($request->validated(), $credential);

        return $this->redirectToSettings('providers');
    }

    public function destroyCredential(
        AiProviderCredential $credential,
        DeleteAiProviderCredential $delete,
    ): RedirectResponse {
        $delete->handle($credential);

        return $this->redirectToSettings('providers');
    }

    public function storeTemplate(
        SaveAiAgentTemplateRequest $request,
        SaveAiAgentTemplate $save,
    ): RedirectResponse {
        $save->handle($request->validated(), $request->user());

        return $this->redirectToSettings('templates');
    }

    public function updateTemplate(
        SaveAiAgentTemplateRequest $request,
        AiAgentTemplate $template,
        SaveAiAgentTemplate $save,
    ): RedirectResponse {
        $save->handle($request->validated(), $request->user(), $template);

        return $this->redirectToSettings('templates');
    }

    public function testTemplate(
        TestAiAgentTemplateRequest $request,
        AiAgentTemplate $template,
        TestAiAgentTemplate $test,
    ): JsonResponse {
        return response()->json($test->handle(
            $template,
            (string) $request->validated('prompt'),
        ));
    }

    public function destroyTemplate(
        AiAgentTemplate $template,
        DeleteAiAgentTemplate $delete,
    ): RedirectResponse {
        $delete->handle($template);

        return $this->redirectToSettings('templates');
    }

    private function redirectToSettings(string $section = 'providers'): RedirectResponse
    {
        return to_route('settings.index', [
            'ai' => $section,
            'panel' => 'admin-ai-integrations',
        ]);
    }
}
