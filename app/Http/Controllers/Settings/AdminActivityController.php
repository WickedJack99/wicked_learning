<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\ActivityTypeRegistry;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminActivityController extends Controller
{
    public function __construct(private readonly ActivityTypeRegistry $activityTypes) {}

    public function edit(LearningNode $node): Response
    {
        $node->loadMissing(
            'map.world',
            'activities.transitions.toActivity',
            'activities.outgoingPortalLink.targetActivity.node.map',
            'activities.outgoingPortalLink.targetNode.map',
            'activityStarts.activity',
        );

        return Inertia::render('settings/worlds/edit-node-activities', [
            'activityGraph' => [
                'world' => [
                    'id' => $node->map->world->id,
                    'slug' => $node->map->world->slug,
                    'title' => $node->map->world->title,
                ],
                'map' => [
                    'id' => $node->map->id,
                    'slug' => $node->map->slug,
                    'title' => $node->map->title,
                ],
                'node' => [
                    'id' => $node->id,
                    'slug' => $node->slug,
                    'title' => $node->title,
                    'description' => $node->description,
                    'startActivityId' => $this->eligibleStartActivityId($node),
                    'startRoutes' => $node->activityStarts
                        ->filter(fn (LearningActivityStart $start): bool => $this->canStartRoute($start->activity))
                        ->map(fn (LearningActivityStart $start): array => $this->startRouteSummary($start))
                        ->values()
                        ->all(),
                ],
                'activityTypes' => $this->activityTypes->definitions(),
                'portalCandidates' => $this->portalCandidatesFor($node),
                'activities' => $node->activities
                    ->values()
                    ->map(fn (LearningActivity $activity): array => $this->activitySummary($activity))
                    ->all(),
                'transitions' => $node->activities
                    ->flatMap(fn (LearningActivity $activity) => $activity->transitions)
                    ->values()
                    ->map(fn (ActivityTransition $transition): array => $this->transitionSummary($transition))
                    ->all(),
            ],
        ]);
    }

    public function store(Request $request, LearningNode $node): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_activities', 'slug')
                    ->where('learning_node_id', $node->id),
            ],
            'type' => ['required', 'string', Rule::in($this->activityTypes->typeKeys())],
            'introduction' => ['nullable', 'string', 'max:1000'],
            'portal_mode' => ['nullable', 'string', Rule::in(['input', 'output'])],
            'portal_background_dark' => ['nullable', 'string', 'max:2048'],
            'portal_background_light' => ['nullable', 'string', 'max:2048'],
            'portal_duration_seconds' => ['nullable', 'numeric', 'min:0.5', 'max:60'],
            'portal_foreground_dark' => ['nullable', 'string', 'max:2048'],
            'portal_foreground_light' => ['nullable', 'string', 'max:2048'],
            'portal_foreground_x' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'portal_foreground_y' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'portal_swirl_enabled' => ['nullable', 'boolean'],
            'target_portal_activity_id' => ['nullable', 'integer'],
            'graph_position_x' => ['nullable', 'integer'],
            'graph_position_y' => ['nullable', 'integer'],
        ]);

        $sortOrder = (int) LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->max('sort_order') + 10;
        $type = (string) $data['type'];

        $activity = LearningActivity::query()->create([
            'learning_node_id' => $node->id,
            'slug' => ($data['slug'] ?? null) ?: $this->uniqueActivitySlug($node, (string) $data['title']),
            'type' => $type,
            'title' => $data['title'],
            'introduction' => $data['introduction'] ?? null,
            'config' => $type === 'portal' ? $this->portalConfigFromData($data) : [],
            'sort_order' => $sortOrder,
            'graph_position_x' => $data['graph_position_x'] ?? null,
            'graph_position_y' => $data['graph_position_y'] ?? null,
        ]);

        $this->syncPortalLink($activity, $data['target_portal_activity_id'] ?? null);

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    public function update(Request $request, LearningActivity $activity): RedirectResponse
    {
        $activity->loadMissing('node');

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'slug' => [
                'sometimes',
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_activities', 'slug')
                    ->where('learning_node_id', $activity->learning_node_id)
                    ->ignore($activity->id),
            ],
            'type' => ['sometimes', 'required', 'string', Rule::in($this->activityTypes->typeKeys())],
            'introduction' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'portal_mode' => ['sometimes', 'nullable', 'string', Rule::in(['input', 'output'])],
            'portal_background_dark' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'portal_background_light' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'portal_duration_seconds' => ['sometimes', 'nullable', 'numeric', 'min:0.5', 'max:60'],
            'portal_foreground_dark' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'portal_foreground_light' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'portal_foreground_x' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'portal_foreground_y' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'portal_swirl_enabled' => ['sometimes', 'nullable', 'boolean'],
            'target_portal_activity_id' => ['sometimes', 'nullable', 'integer'],
            'graph_position_x' => ['sometimes', 'required', 'integer'],
            'graph_position_y' => ['sometimes', 'required', 'integer'],
        ]);

        $updates = [];

        if (array_key_exists('title', $data)) {
            $updates['title'] = $data['title'];
        }

        if (array_key_exists('slug', $data)) {
            $updates['slug'] = ($data['slug'] ?? null)
                ?: $this->uniqueActivitySlug($activity->node, (string) ($data['title'] ?? $activity->title), $activity);
        }

        if (array_key_exists('type', $data)) {
            $updates['type'] = $data['type'];
        }

        if (array_key_exists('introduction', $data)) {
            $updates['introduction'] = $data['introduction'] ?? null;
        }

        if (array_key_exists('graph_position_x', $data)) {
            $updates['graph_position_x'] = $data['graph_position_x'];
        }

        if (array_key_exists('graph_position_y', $data)) {
            $updates['graph_position_y'] = $data['graph_position_y'];
        }

        $type = (string) ($updates['type'] ?? $activity->type);

        if ($this->shouldUpdatePortalConfig($data, $updates)) {
            $config = is_array($activity->config) ? $activity->config : [];
            $updates['config'] = $type === 'portal' ? $this->portalConfigFromData($data, $config) : [];
        }

        $activity->forceFill($updates)->save();

        if (
            array_key_exists('type', $data)
            || array_key_exists('portal_mode', $data)
            || array_key_exists('target_portal_activity_id', $data)
            || array_key_exists('title', $data)
        ) {
            $activity->refresh();
            $this->syncPortalLink($activity, $data['target_portal_activity_id'] ?? null);
        }

        return redirect()->route('settings.worlds.nodes.activities.edit', $activity->node);
    }

    public function destroy(LearningActivity $activity): RedirectResponse
    {
        $activity->loadMissing('node');
        $node = $activity->node;

        if ($node->start_activity_id === $activity->id) {
            $node->forceFill(['start_activity_id' => null])->save();
        }

        $node->activityStarts()
            ->where('learning_activity_id', $activity->id)
            ->delete();
        $this->syncLegacyStartActivity($node);

        $activity->delete();

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    public function updateStart(Request $request, LearningNode $node): RedirectResponse
    {
        $data = $request->validate([
            'activity_id' => ['required', 'integer'],
        ]);

        $activity = LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->whereKey($data['activity_id'])
            ->firstOrFail();

        if (! $this->canStartRoute($activity)) {
            throw ValidationException::withMessages([
                'activity_id' => 'Exit portal activities cannot be used as route starts.',
            ]);
        }

        LearningActivityStart::query()->firstOrCreate(
            [
                'learning_node_id' => $node->id,
                'learning_activity_id' => $activity->id,
            ],
            [
                'label' => null,
                'sort_order' => ((int) $node->activityStarts()->max('sort_order')) + 10,
            ],
        );

        $this->syncLegacyStartActivity($node);

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    public function destroyStart(Request $request, LearningNode $node): RedirectResponse
    {
        $data = $request->validate([
            'activity_id' => ['nullable', 'integer'],
        ]);

        $starts = $node->activityStarts();

        if ($data['activity_id'] ?? null) {
            $starts->where('learning_activity_id', $data['activity_id']);
        }

        $starts->delete();
        $this->syncLegacyStartActivity($node);

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    public function updateStartRoute(Request $request, LearningActivityStart $start): RedirectResponse
    {
        $start->loadMissing('node');

        $data = $request->validate([
            'image_dark' => ['nullable', 'string', 'max:2048'],
            'image_light' => ['nullable', 'string', 'max:2048'],
            'button_color_dark' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'button_border_color_dark' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'button_color_light' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'button_border_color_light' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        $start->forceFill([
            'image_dark' => $data['image_dark'] ?? null,
            'image_light' => $data['image_light'] ?? null,
            'button_color_dark' => $data['button_color_dark'] ?? null,
            'button_border_color_dark' => $data['button_border_color_dark'] ?? null,
            'button_color_light' => $data['button_color_light'] ?? null,
            'button_border_color_light' => $data['button_border_color_light'] ?? null,
        ])->save();

        return redirect()->route('settings.worlds.nodes.activities.edit', $start->node);
    }

    public function destroyStartRoute(LearningActivityStart $start): RedirectResponse
    {
        $start->loadMissing('node');
        $node = $start->node;
        $start->delete();
        $this->syncLegacyStartActivity($node);

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    public function storeTransition(Request $request, LearningNode $node): RedirectResponse
    {
        $data = $request->validate([
            'from_activity_id' => ['required', 'integer'],
            'to_activity_id' => ['nullable', 'integer'],
            'from_connector' => ['required', 'string', 'max:80'],
            'to_connector' => ['required', 'string', 'max:80'],
        ]);

        $fromActivity = LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->whereKey($data['from_activity_id'])
            ->firstOrFail();
        $toActivityId = $data['to_activity_id'] ?? null;

        if ($toActivityId !== null) {
            LearningActivity::query()
                ->where('learning_node_id', $node->id)
                ->whereKey($toActivityId)
                ->firstOrFail();
        }

        $fromConnector = (string) $data['from_connector'];
        $toConnector = (string) $data['to_connector'];
        $fromActivityConfig = is_array($fromActivity->config) ? $fromActivity->config : [];

        if (
            $fromActivity->type === 'portal'
            && ($fromActivityConfig['portalMode'] ?? 'output') === 'output'
            && $toActivityId !== null
        ) {
            throw ValidationException::withMessages([
                'to_activity_id' => 'Entry portal activities must end a path.',
            ]);
        }

        ActivityTransition::query()->firstOrCreate(
            [
                'from_activity_id' => $fromActivity->id,
                'to_activity_id' => $toActivityId,
                'from_connector' => $fromConnector,
                'to_connector' => $toConnector,
            ],
            [
                'trigger' => $this->activityTypes->transitionTriggerForConnector($fromConnector),
                'label' => $this->activityTypes->labelForOutput($fromActivity, $fromConnector),
                'rules' => [],
            ],
        );

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    public function destroyTransition(ActivityTransition $transition): RedirectResponse
    {
        $transition->loadMissing('fromActivity.node');
        $node = $transition->fromActivity->node;
        $transition->delete();

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    /**
     * @return array<string, mixed>
     */
    private function activitySummary(LearningActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'slug' => $activity->slug,
            'type' => $activity->type,
            'title' => $activity->title,
            'introduction' => $activity->introduction,
            'config' => $activity->config ?? [],
            'portalLink' => $activity->type === 'portal' ? $this->portalLinkSummaryForActivity($activity) : null,
            'position' => [
                'x' => $activity->graph_position_x,
                'y' => $activity->graph_position_y,
            ],
            'connectors' => $this->activityTypes->connectorsFor($activity),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function portalCandidatesFor(LearningNode $node): array
    {
        $node->loadMissing('map.world.maps.nodes.activities');
        $mapIds = $node->map->world->maps->pluck('id');

        return LearningActivity::query()
            ->with('node.map')
            ->where('type', 'portal')
            ->whereIn(
                'learning_node_id',
                LearningNode::query()
                    ->select('id')
                    ->whereIn('learning_map_id', $mapIds),
            )
            ->orderBy('title')
            ->get()
            ->filter(fn (LearningActivity $activity): bool => $this->portalModeFor($activity) === 'input')
            ->values()
            ->map(fn (LearningActivity $activity): array => [
                'id' => $activity->id,
                'title' => $activity->title,
                'nodeId' => $activity->node->id,
                'nodeTitle' => $activity->node->title,
                'mapId' => $activity->node->map->id,
                'mapTitle' => $activity->node->map->title,
            ])
            ->all();
    }

    private function syncPortalLink(LearningActivity $activity, mixed $targetActivityId): void
    {
        $activity->loadMissing('node.map.world');

        if ($activity->type !== 'portal' || $this->portalModeFor($activity) !== 'output') {
            LearningPortalLink::query()
                ->where('source_learning_activity_id', $activity->id)
                ->delete();

            return;
        }

        if (! $targetActivityId) {
            LearningPortalLink::query()
                ->where('source_learning_activity_id', $activity->id)
                ->delete();

            return;
        }

        $targetActivity = $this->portalTargetActivityOrFail($activity, (int) $targetActivityId);

        LearningPortalLink::query()->updateOrCreate(
            [
                'source_learning_activity_id' => $activity->id,
            ],
            [
                'source_learning_node_id' => $activity->learning_node_id,
                'target_learning_node_id' => $targetActivity->learning_node_id,
                'target_learning_activity_id' => $targetActivity->id,
                'label' => "{$activity->title} to {$targetActivity->title}",
                'description' => "Travel from {$activity->node->title} to {$targetActivity->node->title}.",
                'config' => ['travelMode' => 'portal'],
            ],
        );
    }

    private function portalTargetActivityOrFail(LearningActivity $sourceActivity, int $targetActivityId): LearningActivity
    {
        $sourceActivity->loadMissing('node.map.world.maps');
        $mapIds = $sourceActivity->node->map->world->maps->pluck('id');

        $targetActivity = LearningActivity::query()
            ->with('node.map')
            ->whereKey($targetActivityId)
            ->where('type', 'portal')
            ->whereHas('node', fn ($query) => $query->whereIn('learning_map_id', $mapIds))
            ->firstOrFail();

        if ($this->portalModeFor($targetActivity) !== 'input') {
            throw ValidationException::withMessages([
                'target_portal_activity_id' => 'Choose an exit portal activity as the travel target.',
            ]);
        }

        return $targetActivity;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function portalLinkSummaryForActivity(LearningActivity $activity): ?array
    {
        $activity->loadMissing('outgoingPortalLink.targetActivity.node.map', 'outgoingPortalLink.targetNode.map');
        $link = $activity->outgoingPortalLink;

        if (! $link) {
            return null;
        }

        return [
            'id' => $link->id,
            'label' => $link->label,
            'description' => $link->description,
            'targetActivity' => $link->targetActivity ? [
                'id' => $link->targetActivity->id,
                'title' => $link->targetActivity->title,
                'nodeTitle' => $link->targetActivity->node->title,
                'mapTitle' => $link->targetActivity->node->map->title,
            ] : null,
            'targetNode' => [
                'id' => $link->targetNode->id,
                'title' => $link->targetNode->title,
                'mapTitle' => $link->targetNode->map->title,
            ],
        ];
    }

    private function portalModeFor(LearningActivity $activity): string
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return ($config['portalMode'] ?? 'output') === 'input' ? 'input' : 'output';
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    private function portalConfigFromData(array $data, array $existing = []): array
    {
        return [
            ...$existing,
            'portalMode' => $data['portal_mode'] ?? $existing['portalMode'] ?? 'output',
            'portalBackgroundDark' => $data['portal_background_dark'] ?? $existing['portalBackgroundDark'] ?? '',
            'portalBackgroundLight' => $data['portal_background_light'] ?? $existing['portalBackgroundLight'] ?? '',
            'portalDurationSeconds' => (float) ($data['portal_duration_seconds'] ?? $existing['portalDurationSeconds'] ?? 1.5),
            'portalForegroundDark' => $data['portal_foreground_dark'] ?? $existing['portalForegroundDark'] ?? '',
            'portalForegroundLight' => $data['portal_foreground_light'] ?? $existing['portalForegroundLight'] ?? '',
            'portalForegroundX' => (float) ($data['portal_foreground_x'] ?? $existing['portalForegroundX'] ?? 50),
            'portalForegroundY' => (float) ($data['portal_foreground_y'] ?? $existing['portalForegroundY'] ?? 50),
            'portalSwirlEnabled' => (bool) ($data['portal_swirl_enabled'] ?? $existing['portalSwirlEnabled'] ?? true),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    private function shouldUpdatePortalConfig(array $data, array $updates): bool
    {
        if (array_key_exists('type', $updates)) {
            return true;
        }

        foreach ([
            'portal_background_dark',
            'portal_background_light',
            'portal_duration_seconds',
            'portal_foreground_dark',
            'portal_foreground_light',
            'portal_foreground_x',
            'portal_foreground_y',
            'portal_mode',
            'portal_swirl_enabled',
        ] as $key) {
            if (array_key_exists($key, $data)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function startRouteSummary(LearningActivityStart $start): array
    {
        $start->loadMissing('activity');

        return [
            'id' => $start->id,
            'activityId' => $start->learning_activity_id,
            'buttonBorderColorDark' => $start->button_border_color_dark,
            'buttonBorderColorLight' => $start->button_border_color_light,
            'buttonColorDark' => $start->button_color_dark,
            'buttonColorLight' => $start->button_color_light,
            'imageDark' => $start->image_dark,
            'imageLight' => $start->image_light,
            'label' => $start->label ?: $start->activity->title,
            'sortOrder' => $start->sort_order,
        ];
    }

    private function syncLegacyStartActivity(LearningNode $node): void
    {
        $firstStart = $node->activityStarts()
            ->with('activity')
            ->get()
            ->first(fn (LearningActivityStart $start): bool => $this->canStartRoute($start->activity));

        $node->forceFill([
            'start_activity_id' => $firstStart?->learning_activity_id,
        ])->save();
    }

    private function eligibleStartActivityId(LearningNode $node): ?int
    {
        $node->loadMissing('activities');

        $activity = $node->activities
            ->first(fn (LearningActivity $activity): bool => $activity->id === $node->start_activity_id);

        return $activity && $this->canStartRoute($activity) ? $activity->id : null;
    }

    private function canStartRoute(?LearningActivity $activity): bool
    {
        if (! $activity) {
            return false;
        }

        return $activity->type !== 'portal' || $this->portalModeFor($activity) !== 'input';
    }

    /**
     * @return array<string, mixed>
     */
    private function transitionSummary(ActivityTransition $transition): array
    {
        return [
            'id' => $transition->id,
            'fromActivityId' => $transition->from_activity_id,
            'toActivityId' => $transition->to_activity_id,
            'fromConnector' => $transition->from_connector ?? $transition->trigger,
            'toConnector' => $transition->to_connector ?? 'in',
            'trigger' => $transition->trigger,
            'triggerValue' => $transition->trigger_value,
            'label' => $transition->label,
        ];
    }

    private function uniqueActivitySlug(LearningNode $node, string $title, ?LearningActivity $existingActivity = null): string
    {
        $baseSlug = Str::slug($title) ?: 'activity';
        $slug = $baseSlug;
        $suffix = 2;

        while (LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->where('slug', $slug)
            ->when($existingActivity, fn ($query) => $query->whereKeyNot($existingActivity->id))
            ->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
