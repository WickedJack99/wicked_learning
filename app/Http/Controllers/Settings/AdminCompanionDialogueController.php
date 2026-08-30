<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Validation\LearningCompanionDialogueGraphValidator;
use App\Models\LearningActivity;
use App\Models\LearningCompanionDialogue;
use App\Models\LearningCompanionDialogueAssignment;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminCompanionDialogueController extends Controller
{
    private const DEFAULT_PAGE_SIZE = 6;

    private const ASSIGNMENT_PAGE_SIZE = 6;

    public function __construct(
        private readonly LearningCompanionDialogueGraphValidator $graphValidator,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = $this->pageSize($request->integer('per_page', self::DEFAULT_PAGE_SIZE));
        $page = max(1, $request->integer('page', 1));
        $search = trim((string) $request->query('search', ''));

        $dialogues = LearningCompanionDialogue::query()
            ->withCount('assignments')
            ->when($search !== '', fn ($query) => $query->where('name', 'like', "%{$search}%"))
            ->orderBy('name')
            ->orderBy('id')
            ->paginate($perPage, ['id', 'name', 'updated_at'], 'page', $page);

        return response()->json([
            'items' => collect($dialogues->items())->map(fn (LearningCompanionDialogue $dialogue): array => [
                'assignmentsCount' => $dialogue->assignments_count,
                'id' => $dialogue->id,
                'name' => $dialogue->name,
                'updatedAt' => $dialogue->updated_at?->toISOString(),
            ])->values(),
            'pagination' => $this->pagination($dialogues),
        ]);
    }

    public function show(LearningCompanionDialogue $dialogue): JsonResponse
    {
        return response()->json($this->dialoguePayload($dialogue));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'dialogue_graph' => ['nullable', 'array'],
        ]);

        $dialogue = LearningCompanionDialogue::query()->create([
            'created_by_user_id' => $request->user()->id,
            'dialogue_graph' => $this->validateGraph($data['dialogue_graph'] ?? $this->defaultGraph()),
            'name' => trim($data['name']),
            'updated_by_user_id' => $request->user()->id,
        ]);

        return response()->json($this->dialoguePayload($dialogue), 201);
    }

    public function update(Request $request, LearningCompanionDialogue $dialogue): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'dialogue_graph' => ['sometimes', 'nullable', 'array'],
        ]);

        $dialogue->forceFill([
            'dialogue_graph' => array_key_exists('dialogue_graph', $data)
                ? $this->validateGraph($data['dialogue_graph'] ?? $this->defaultGraph())
                : $dialogue->dialogue_graph,
            'name' => trim($data['name']),
            'updated_by_user_id' => $request->user()->id,
        ])->save();

        return response()->json($this->dialoguePayload($dialogue->fresh('assignments')));
    }

    public function destroy(LearningCompanionDialogue $dialogue): JsonResponse
    {
        $dialogue->delete();

        return response()->json(['deleted' => true]);
    }

    public function assignments(Request $request, LearningCompanionDialogue $dialogue): JsonResponse
    {
        $perPage = $this->pageSize($request->integer('per_page', self::ASSIGNMENT_PAGE_SIZE));
        $page = max(1, $request->integer('page', 1));
        $targets = $this->targetQuery(trim((string) $request->query('search', '')))
            ->paginate($perPage, ['*'], 'page', $page);
        $targetKeys = collect($targets->items())
            ->map(fn (object $target): string => $this->assignmentKey($target->scope_type, (int) $target->scope_id))
            ->values();
        $assignedOnPage = $dialogue->assignments()
            ->whereIn('scope_type', $targetKeys->map(fn (string $key): string => explode(':', $key, 2)[0]))
            ->whereIn('scope_id', $targetKeys->map(fn (string $key): int => (int) explode(':', $key, 2)[1]))
            ->get(['scope_type', 'scope_id'])
            ->map(fn (LearningCompanionDialogueAssignment $assignment): string => $this->assignmentKey($assignment->scope_type, $assignment->scope_id))
            ->values();

        $selected = $dialogue->assignments()
            ->orderBy('id')
            ->limit(100)
            ->get(['scope_type', 'scope_id'])
            ->map(fn (LearningCompanionDialogueAssignment $assignment): string => $this->assignmentKey($assignment->scope_type, $assignment->scope_id))
            ->values();

        return response()->json([
            'items' => collect($targets->items())->map(fn (object $target): array => [
                'context' => $target->context,
                'id' => (int) $target->scope_id,
                'label' => $target->label,
                'scopeType' => $target->scope_type,
                'selected' => $assignedOnPage->contains($this->assignmentKey($target->scope_type, (int) $target->scope_id)),
            ])->values(),
            'pagination' => $this->pagination($targets),
            'selected' => $selected,
        ]);
    }

    public function syncAssignments(Request $request, LearningCompanionDialogue $dialogue): JsonResponse
    {
        $data = $request->validate([
            'assignments' => ['array', 'max:100'],
            'assignments.*.scope_id' => ['required', 'integer', 'min:1'],
            'assignments.*.scope_type' => ['required', Rule::in(LearningCompanionDialogueAssignment::SCOPE_TYPES)],
        ]);
        $assignments = collect($data['assignments'] ?? [])
            ->map(fn (array $assignment): array => [
                'scope_id' => (int) $assignment['scope_id'],
                'scope_type' => $assignment['scope_type'],
            ])
            ->unique(fn (array $assignment): string => $this->assignmentKey($assignment['scope_type'], $assignment['scope_id']))
            ->values();

        $this->ensureTargetsExist($assignments->all());

        DB::transaction(function () use ($assignments, $dialogue): void {
            $dialogue->assignments()->delete();
            $dialogue->assignments()->createMany($assignments->all());
        });

        return response()->json([
            'assignments' => $assignments->all(),
            'assignmentsCount' => $assignments->count(),
        ]);
    }

    /** @return array<string, mixed> */
    private function dialoguePayload(LearningCompanionDialogue $dialogue): array
    {
        return [
            'assignmentsCount' => $dialogue->assignments()->count(),
            'dialogueGraph' => $dialogue->dialogue_graph,
            'id' => $dialogue->id,
            'name' => $dialogue->name,
            'updatedAt' => $dialogue->updated_at?->toISOString(),
        ];
    }

    /** @return array{currentPage: int, lastPage: int, perPage: int, total: int} */
    private function pagination(object $paginator): array
    {
        return [
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
        ];
    }

    private function pageSize(int $requested): int
    {
        return min(max(1, $requested), 12);
    }

    /** @return array<string, mixed> */
    private function defaultGraph(): array
    {
        return [
            'version' => LearningCompanionDialogueGraphValidator::VERSION,
            'start' => 'welcome',
            'nodes' => [
                [
                    'id' => 'welcome',
                    'type' => 'message',
                    'message' => 'Choose a direction when you are ready.',
                    'next' => 'choice',
                ],
                [
                    'id' => 'choice',
                    'type' => 'choice',
                    'prompt' => 'What would help next?',
                    'choices' => [
                        ['key' => 'map', 'label' => 'Return to the map', 'action' => 'current-map'],
                        ['key' => 'desk', 'label' => 'Open the learning desk', 'action' => 'learning-desk'],
                    ],
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function validateGraph(array $graph): array
    {
        return $this->graphValidator->validate($graph) ?? $this->defaultGraph();
    }

    private function assignmentKey(string $scopeType, int $scopeId): string
    {
        return "{$scopeType}:{$scopeId}";
    }

    private function targetQuery(string $search): Builder
    {
        $queries = [
            $this->targetBaseQuery('learning_worlds', 'world', 'learning_worlds.title', 'learning_worlds.slug')
                ->selectRaw("'world' as scope_type, learning_worlds.id as scope_id, learning_worlds.title as label, learning_worlds.title as context"),
            $this->targetBaseQuery('learning_maps', 'map', 'learning_maps.title', 'learning_maps.slug')
                ->join('learning_worlds', 'learning_worlds.id', '=', 'learning_maps.learning_world_id')
                ->selectRaw("'map' as scope_type, learning_maps.id as scope_id, learning_maps.title as label, learning_worlds.title as context"),
            $this->targetBaseQuery('learning_nodes', 'node', 'learning_nodes.title', 'learning_nodes.slug')
                ->join('learning_maps', 'learning_maps.id', '=', 'learning_nodes.learning_map_id')
                ->join('learning_worlds', 'learning_worlds.id', '=', 'learning_maps.learning_world_id')
                ->selectRaw("'node' as scope_type, learning_nodes.id as scope_id, learning_nodes.title as label, concat(learning_worlds.title, ' / ', learning_maps.title) as context"),
            $this->targetBaseQuery('learning_activities', 'activity', 'learning_activities.title', 'learning_activities.slug')
                ->join('learning_nodes', 'learning_nodes.id', '=', 'learning_activities.learning_node_id')
                ->join('learning_maps', 'learning_maps.id', '=', 'learning_nodes.learning_map_id')
                ->join('learning_worlds', 'learning_worlds.id', '=', 'learning_maps.learning_world_id')
                ->selectRaw("'activity' as scope_type, learning_activities.id as scope_id, learning_activities.title as label, concat(learning_worlds.title, ' / ', learning_maps.title, ' / ', learning_nodes.title) as context"),
        ];

        $union = array_shift($queries);
        foreach ($queries as $query) {
            $union->unionAll($query);
        }

        return DB::query()
            ->fromSub($union, 'companion_targets')
            ->select(['scope_type', 'scope_id', 'label', 'context'])
            ->when($search !== '', fn (Builder $query) => $query->whereRaw('LOWER(label) LIKE ?', ['%'.mb_strtolower($search).'%']))
            ->orderBy('label')
            ->orderBy('scope_type')
            ->orderBy('scope_id');
    }

    private function targetBaseQuery(string $table, string $scopeType, string $labelColumn, string $slugColumn): Builder
    {
        return DB::table($table)
            ->when(request()->query('search'), function (Builder $query, mixed $search) use ($labelColumn, $slugColumn): void {
                $query->where(function (Builder $query) use ($search, $labelColumn, $slugColumn): void {
                    $needle = '%'.mb_strtolower(trim((string) $search)).'%';
                    $query->whereRaw("LOWER({$labelColumn}) LIKE ?", [$needle])
                        ->orWhereRaw("LOWER({$slugColumn}) LIKE ?", [$needle]);
                });
            });
    }

    /** @param list<array{scope_id: int, scope_type: string}> $assignments */
    private function ensureTargetsExist(array $assignments): void
    {
        $byType = collect($assignments)->groupBy('scope_type');
        $models = [
            'activity' => LearningActivity::class,
            'map' => LearningMap::class,
            'node' => LearningNode::class,
            'world' => LearningWorld::class,
        ];

        foreach ($models as $type => $model) {
            $ids = $byType->get($type, collect())->pluck('scope_id');
            if ($ids->count() === $model::query()->whereIn('id', $ids)->count()) {
                continue;
            }

            throw ValidationException::withMessages([
                'assignments' => "One or more {$type} targets no longer exist.",
            ]);
        }
    }
}
