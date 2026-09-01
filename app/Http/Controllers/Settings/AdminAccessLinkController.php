<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Services\LearnerInventoryService;
use App\Models\AccessLink;
use App\Models\LearningTool;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminAccessLinkController extends Controller
{
    public function __construct(
        private readonly LearnerInventoryService $inventory,
    ) {}

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'purpose' => ['required', 'string', Rule::in(array_keys($this->purposeLabels()))],
            'usage_policy' => ['sometimes', 'string', Rule::in(array_keys($this->usagePolicyLabels()))],
            'expires_at' => ['required', 'date', 'after:now'],
            'note' => ['nullable', 'string', 'max:500'],
            'tool_id' => ['nullable', 'integer', 'exists:learning_tools,id'],
            'item_grants' => ['nullable', 'array', 'max:20'],
            'item_grants.*.item_id' => ['required', 'integer', 'exists:learning_items,id'],
            'item_grants.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'roles' => $request->input('purpose') === AccessLink::PURPOSE_REGISTRATION
                ? ['nullable', 'array', 'min:1']
                : ['nullable', 'array'],
            'roles.*' => ['required', 'string', Rule::in($request->user()->assignableRoles())],
        ]);

        $purpose = (string) $data['purpose'];
        $usagePolicy = (string) ($data['usage_policy'] ?? AccessLink::USAGE_ONE_TIME);

        if ($purpose === AccessLink::PURPOSE_TEMPORARY_LOGIN
            && $usagePolicy === AccessLink::USAGE_PER_USER) {
            return back()->withErrors([
                'usage_policy' => 'Temporary learner login links cannot use the per-user policy.',
            ]);
        }

        $payload = match ($purpose) {
            AccessLink::PURPOSE_GRANT_TOOL => [
                'toolId' => (int) ($data['tool_id'] ?? 0),
            ],
            AccessLink::PURPOSE_GRANT_ITEMS => [
                'items' => collect($data['item_grants'] ?? [])
                    ->map(fn (array $item): array => [
                        'itemId' => (int) $item['item_id'],
                        'quantity' => (int) $item['quantity'],
                    ])
                    ->values()
                    ->all(),
            ],
            AccessLink::PURPOSE_REGISTRATION => [
                'roles' => User::normalizeRoles($data['roles'] ?? [User::ROLE_USER]),
            ],
            AccessLink::PURPOSE_TEMPORARY_LOGIN => [],
            default => [],
        };

        if ($purpose === AccessLink::PURPOSE_GRANT_TOOL && ($payload['toolId'] ?? 0) <= 0) {
            return back()->withErrors(['tool_id' => 'Choose a tool for this link.']);
        }

        if ($purpose === AccessLink::PURPOSE_GRANT_ITEMS && $payload['items'] === []) {
            return back()->withErrors(['item_grants' => 'Choose at least one item for this link.']);
        }

        $token = AccessLink::createFor(
            $request->user(),
            $purpose,
            $payload,
            $data['expires_at'],
            filled($data['note'] ?? null) ? trim($data['note']) : null,
            $usagePolicy,
        );

        return redirect()->route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'links',
        ])->with('created_access_link', route('access-links.show', ['token' => $token]));
    }

    public function show(Request $request, string $token): Response|RedirectResponse
    {
        $link = $this->usableLink($token);

        if ($link->purpose === AccessLink::PURPOSE_REGISTRATION) {
            return redirect()->route('register', ['registration_token' => $token]);
        }

        if ($link->purpose === AccessLink::PURPOSE_TEMPORARY_LOGIN) {
            return $this->redeemTemporaryLogin($link);
        }

        if (! $request->user()) {
            return redirect()->guest(route('access-links.show', ['token' => $token]));
        }

        return Inertia::render('access-links/redeem', [
            'link' => [
                'purpose' => $this->purposeLabels()[$link->purpose] ?? 'Access link',
                'token' => $token,
                'note' => $link->note,
            ],
        ]);
    }

    public function redeem(Request $request, string $token): RedirectResponse
    {
        $link = DB::transaction(function () use ($request, $token): AccessLink {
            $link = AccessLink::query()
                ->where('token_hash', AccessLink::hashToken($token))
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($link->canBeRedeemedBy($request->user()), 410);
            abort_unless(in_array($link->purpose, [
                AccessLink::PURPOSE_GRANT_TOOL,
                AccessLink::PURPOSE_GRANT_ITEMS,
            ], true), 422);

            if ($link->purpose === AccessLink::PURPOSE_GRANT_TOOL) {
                $tool = LearningTool::query()->find($link->payload['toolId'] ?? 0);
                abort_unless($tool instanceof LearningTool, 422);
                $request->user()->learningTools()->syncWithoutDetaching([
                    $tool->id => ['acquired_at' => now()],
                ]);
            } else {
                $this->inventory->grantItems($request->user(), $link->payload['items'] ?? []);
            }

            $link->recordRedemption($request->user());

            return $link;
        });

        return redirect()->route('home')->with('status', $this->redemptionMessage($link));
    }

    /** @return array<string, string> */
    public function purposeLabels(): array
    {
        return [
            AccessLink::PURPOSE_GRANT_TOOL => 'Grant a tool',
            AccessLink::PURPOSE_GRANT_ITEMS => 'Grant items',
            AccessLink::PURPOSE_REGISTRATION => 'Allow registration',
            AccessLink::PURPOSE_TEMPORARY_LOGIN => 'Temporary learner login',
        ];
    }

    /** @return array<string, string> */
    public function usagePolicyLabels(): array
    {
        return [
            AccessLink::USAGE_ONE_TIME => 'One time',
            AccessLink::USAGE_MULTIPLE => 'Multiple times',
            AccessLink::USAGE_PER_USER => 'One time per user',
        ];
    }

    public function updateStatus(Request $request, AccessLink $accessLink): RedirectResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'access_link_page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $accessLink->forceFill([
            'is_enabled' => (bool) $data['enabled'],
        ])->save();

        $query = [
            'panel' => 'admin-access',
            'access' => 'links',
        ];

        if (($data['access_link_page'] ?? 1) > 1) {
            $query['access_link_page'] = $data['access_link_page'];
        }

        return redirect()->route('settings.index', $query);
    }

    private function usableLink(string $token): AccessLink
    {
        $link = AccessLink::query()
            ->where('token_hash', AccessLink::hashToken($token))
            ->firstOrFail();

        abort_unless($link->canBeRedeemed(), 410);

        return $link;
    }

    private function redeemTemporaryLogin(AccessLink $link): RedirectResponse
    {
        $user = DB::transaction(function () use ($link): User {
            $lockedLink = AccessLink::query()->lockForUpdate()->findOrFail($link->id);
            abort_unless($lockedLink->canBeRedeemed(), 410);

            $user = User::query()->create([
                'name' => 'Temporary learner',
                'email' => 'temporary-'.Str::lower(Str::random(24)).'@invalid.local',
                'password' => Str::random(64),
                'email_verified_at' => now(),
                'role' => User::ROLE_USER,
                'roles' => [User::ROLE_USER, User::ROLE_TEMPORARY],
            ]);
            $user->setAssignedRoles([User::ROLE_USER, User::ROLE_TEMPORARY]);
            $user->save();

            $lockedLink->recordRedemption($user);

            return $user;
        });

        Auth::login($user);

        return redirect()->route('home');
    }

    private function redemptionMessage(AccessLink $link): string
    {
        return match ($link->purpose) {
            AccessLink::PURPOSE_GRANT_TOOL => 'The tool is now in your inventory.',
            AccessLink::PURPOSE_GRANT_ITEMS => 'The items are now in your inventory.',
            default => 'The link was redeemed.',
        };
    }
}
