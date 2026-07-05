<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\ActivityTypeRegistry;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningNode;
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
                    'startActivityId' => $node->start_activity_id,
                ],
                'activityTypes' => $this->activityTypes->definitions(),
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
            'graph_position_x' => ['nullable', 'integer'],
            'graph_position_y' => ['nullable', 'integer'],
        ]);

        $sortOrder = (int) LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->max('sort_order') + 10;
        $type = (string) $data['type'];

        LearningActivity::query()->create([
            'learning_node_id' => $node->id,
            'slug' => ($data['slug'] ?? null) ?: $this->uniqueActivitySlug($node, (string) $data['title']),
            'type' => $type,
            'title' => $data['title'],
            'introduction' => $data['introduction'] ?? null,
            'config' => $type === 'portal' ? ['portalMode' => $data['portal_mode'] ?? 'output'] : [],
            'sort_order' => $sortOrder,
            'graph_position_x' => $data['graph_position_x'] ?? null,
            'graph_position_y' => $data['graph_position_y'] ?? null,
        ]);

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

        if (array_key_exists('type', $updates) || array_key_exists('portal_mode', $data)) {
            $config = is_array($activity->config) ? $activity->config : [];
            $updates['config'] = $type === 'portal'
                ? [
                    ...$config,
                    'portalMode' => $data['portal_mode'] ?? $config['portalMode'] ?? 'output',
                ]
                : [];
        }

        $activity->forceFill($updates)->save();

        return redirect()->route('settings.worlds.nodes.activities.edit', $activity->node);
    }

    public function destroy(LearningActivity $activity): RedirectResponse
    {
        $activity->loadMissing('node');
        $node = $activity->node;

        if ($node->start_activity_id === $activity->id) {
            $node->forceFill(['start_activity_id' => null])->save();
        }

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

        $node->forceFill(['start_activity_id' => $activity->id])->save();

        return redirect()->route('settings.worlds.nodes.activities.edit', $node);
    }

    public function destroyStart(LearningNode $node): RedirectResponse
    {
        $node->forceFill(['start_activity_id' => null])->save();

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
                'to_activity_id' => 'Outbound portal activities must end a path.',
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
            'position' => [
                'x' => $activity->graph_position_x,
                'y' => $activity->graph_position_y,
            ],
            'connectors' => $this->activityTypes->connectorsFor($activity),
        ];
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
