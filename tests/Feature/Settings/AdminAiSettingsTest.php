<?php

use App\Models\AiAgentTemplate;
use App\Models\AiProviderCredential;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('admin users can open ai support settings', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->get(route('settings.ai.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/ai')
            ->has('providerOptions')
            ->has('purposeOptions')
            ->has('guardrailNotes')
        );
});

test('regular users cannot open ai support settings', function () {
    $user = User::factory()->create([
        'role' => User::ROLE_USER,
        'roles' => [User::ROLE_USER],
    ]);

    $this->actingAs($user)
        ->get(route('settings.ai.index'))
        ->assertForbidden();
});

test('admin users can create encrypted provider credentials without exposing plaintext', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.ai.credentials.store'), [
            'label' => 'OpenAI main',
            'provider' => 'openai',
            'api_key' => 'sk-learning-worlds-1234',
            'enabled' => true,
            'monthly_token_limit' => 100000,
            'monthly_cost_limit_cents' => 2500,
        ])
        ->assertRedirect(route('settings.ai.index'));

    $credential = AiProviderCredential::query()->firstOrFail();

    expect($credential->api_key)->toBe('sk-learning-worlds-1234')
        ->and($credential->api_key_last_four)->toBe('1234');

    $this->actingAs($admin)
        ->get(route('settings.ai.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('providerCredentials.0.label', 'OpenAI main')
            ->where('providerCredentials.0.hasApiKey', true)
            ->where('providerCredentials.0.apiKeyLastFour', '1234')
        );
});

test('admin users can update provider settings without replacing a blank key', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $credential = AiProviderCredential::query()->create([
        'label' => 'Primary key',
        'provider' => 'openai',
        'api_key' => 'sk-original-secret-9999',
        'api_key_last_four' => '9999',
        'enabled' => true,
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.ai.credentials.update', $credential), [
            'label' => 'Primary key renamed',
            'provider' => 'openai',
            'api_key' => '',
            'enabled' => false,
            'monthly_token_limit' => 30000,
        ])
        ->assertRedirect(route('settings.ai.index'));

    $credential->refresh();

    expect($credential->label)->toBe('Primary key renamed')
        ->and($credential->enabled)->toBeFalse()
        ->and($credential->api_key)->toBe('sk-original-secret-9999')
        ->and($credential->api_key_last_four)->toBe('9999')
        ->and($credential->monthly_token_limit)->toBe(30000);
});

test('admin users can create agent templates for a selected provider', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $credential = AiProviderCredential::query()->create([
        'label' => 'OpenAI main',
        'provider' => 'openai',
        'enabled' => true,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.ai.templates.store'), [
            'ai_provider_credential_id' => $credential->id,
            'name' => 'SDT Design Reviewer',
            'purpose' => 'sdt_design',
            'model' => 'gpt-5',
            'system_prompt' => 'Review activities through Self-Determination Theory.',
            'task_prompt' => 'Look for autonomy, competence and relatedness support.',
            'temperature' => 0.4,
            'max_output_tokens' => 1200,
            'concurrency_limit' => 2,
            'monthly_token_limit' => 50000,
            'enabled' => true,
            'guarded_context' => true,
        ])
        ->assertRedirect(route('settings.ai.index'));

    $template = AiAgentTemplate::query()->firstOrFail();

    expect($template->slug)->toBe('sdt-design-reviewer')
        ->and($template->purpose)->toBe('sdt_design')
        ->and($template->ai_provider_credential_id)->toBe($credential->id)
        ->and($template->created_by_user_id)->toBe($admin->id)
        ->and($template->enabled)->toBeTrue()
        ->and($template->guarded_context)->toBeTrue();
});
