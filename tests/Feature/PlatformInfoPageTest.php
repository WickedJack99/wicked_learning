<?php

use App\Models\PlatformInfoPage;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('public info pages render editable content props', function () {
    PlatformInfoPage::query()->create([
        'key' => 'about',
        'markdown' => '# Custom About',
    ]);

    $this->get(route('about'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('info/about')
            ->where('platformInfoContent.markdown', '# Custom About')
            ->where('canEditPlatformInfo', false)
        );
});

test('admin users can update platform info markdown', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.info-pages.update', 'about'), [
            'markdown' => "# Edited About\n\nUseful project notes.",
            'redirect_to' => '/settings/about',
        ])
        ->assertRedirect('/settings/about');

    expect(PlatformInfoPage::query()->where('key', 'about')->first())
        ->markdown->toBe("# Edited About\n\nUseful project notes.")
        ->updated_by_user_id->toBe($admin->id);
});

test('normal users can view but not update platform info markdown', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('settings.about'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/about')
            ->where('canEditPlatformInfo', false)
        );

    $this->actingAs($user)
        ->patch(route('settings.info-pages.update', 'about'), [
            'markdown' => '# No',
        ])
        ->assertForbidden();
});
