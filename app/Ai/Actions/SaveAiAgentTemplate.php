<?php

namespace App\Ai\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\AiAgentTemplate;
use App\Models\User;

class SaveAiAgentTemplate
{
    public function __construct(
        private readonly UniqueSlugGenerator $slugGenerator,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $user, ?AiAgentTemplate $template = null): AiAgentTemplate
    {
        $template ??= new AiAgentTemplate;
        $name = (string) $data['name'];
        $slug = trim((string) ($data['slug'] ?? ''));

        $template->fill([
            'ai_provider_credential_id' => $data['ai_provider_credential_id'] ?? null,
            'name' => $name,
            'slug' => $slug !== '' ? $slug : $this->slugGenerator->forAiAgentTemplate($name, $template),
            'purpose' => $data['purpose'],
            'model' => $data['model'] ?? null,
            'system_prompt' => $data['system_prompt'] ?? null,
            'task_prompt' => $data['task_prompt'] ?? null,
            'temperature' => (float) $data['temperature'],
            'max_output_tokens' => $data['max_output_tokens'] ?? null,
            'concurrency_limit' => (int) $data['concurrency_limit'],
            'monthly_token_limit' => $data['monthly_token_limit'] ?? null,
            'enabled' => (bool) ($data['enabled'] ?? false),
            'guarded_context' => (bool) ($data['guarded_context'] ?? true),
        ]);

        if (! $template->exists) {
            $template->created_by_user_id = $user->id;
        }

        $template->save();

        return $template->refresh()->load(['providerCredential', 'createdBy']);
    }
}
