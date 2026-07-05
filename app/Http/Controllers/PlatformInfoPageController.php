<?php

namespace App\Http\Controllers;

use App\Models\PlatformInfoPage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PlatformInfoPageController extends Controller
{
    /**
     * @var array<string, string>
     */
    private const PUBLIC_COMPONENTS = [
        'about' => 'info/about',
        'imprint' => 'info/imprint',
        'data-protection' => 'info/data-protection',
    ];

    /**
     * @var array<string, string>
     */
    private const SETTINGS_COMPONENTS = [
        'about' => 'settings/about',
        'imprint' => 'settings/imprint',
        'data-protection' => 'settings/data-protection',
    ];

    public function show(Request $request, string $page): Response
    {
        $this->ensureKnownPage($page);

        return Inertia::render(self::PUBLIC_COMPONENTS[$page], [
            'platformInfoContent' => $this->contentFor($page),
            'canEditPlatformInfo' => false,
        ]);
    }

    public function showSettings(Request $request, string $page): Response
    {
        $this->ensureKnownPage($page);

        return Inertia::render(self::SETTINGS_COMPONENTS[$page], [
            'platformInfoContent' => $this->contentFor($page),
            'canEditPlatformInfo' => $request->user()->can('manage-users'),
        ]);
    }

    public function update(Request $request, string $page): RedirectResponse
    {
        $this->ensureKnownPage($page);

        $data = $request->validate([
            'markdown' => ['required', 'string', 'max:50000'],
            'redirect_to' => ['nullable', 'string', Rule::in(['/settings/about', '/settings/imprint', '/settings/data-protection'])],
        ]);

        PlatformInfoPage::query()->updateOrCreate(
            ['key' => $page],
            [
                'markdown' => $data['markdown'],
                'updated_by_user_id' => $request->user()->id,
            ],
        );

        return redirect($data['redirect_to'] ?? route('settings.'.$page));
    }

    /**
     * @return array{key: string, markdown: string|null, updated_at: string|null, updated_by: array{id: int, name: string, email: string}|null}
     */
    private function contentFor(string $page): array
    {
        $content = PlatformInfoPage::query()
            ->with('updatedBy:id,name,email')
            ->where('key', $page)
            ->first();

        return [
            'key' => $page,
            'markdown' => $content?->markdown,
            'updated_at' => $content?->updated_at?->toISOString(),
            'updated_by' => $content?->updatedBy
                ? [
                    'id' => $content->updatedBy->id,
                    'name' => $content->updatedBy->name,
                    'email' => $content->updatedBy->email,
                ]
                : null,
        ];
    }

    private function ensureKnownPage(string $page): void
    {
        abort_unless(array_key_exists($page, self::PUBLIC_COMPONENTS), 404);
    }
}
