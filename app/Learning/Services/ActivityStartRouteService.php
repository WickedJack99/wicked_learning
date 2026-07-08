<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use Illuminate\Validation\ValidationException;

class ActivityStartRouteService
{
    public function __construct(private readonly ActivityRouteEligibility $routeEligibility) {}

    public function addStart(LearningNode $node, int $activityId): void
    {
        $activity = LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->whereKey($activityId)
            ->firstOrFail();

        if (! $this->routeEligibility->canStart($activity)) {
            throw ValidationException::withMessages([
                'activity_id' => 'Exit portal activities cannot be used as route starts.',
            ]);
        }

        LearningActivityStart::query()->firstOrCreate(
            ['learning_node_id' => $node->id, 'learning_activity_id' => $activity->id],
            ['label' => null, 'sort_order' => ((int) $node->activityStarts()->max('sort_order')) + 10],
        );

        $this->syncLegacyStartActivity($node);
    }

    public function removeStarts(LearningNode $node, ?int $activityId): void
    {
        $starts = $node->activityStarts();

        if ($activityId) {
            $starts->where('learning_activity_id', $activityId);
        }

        $starts->delete();
        $this->syncLegacyStartActivity($node);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateStartRoute(LearningActivityStart $start, array $data): void
    {
        $start->forceFill([
            'image_dark' => $data['image_dark'] ?? null,
            'image_light' => $data['image_light'] ?? null,
            'button_color_dark' => $data['button_color_dark'] ?? null,
            'button_border_color_dark' => $data['button_border_color_dark'] ?? null,
            'button_color_light' => $data['button_color_light'] ?? null,
            'button_border_color_light' => $data['button_border_color_light'] ?? null,
        ])->save();
    }

    public function destroyStartRoute(LearningActivityStart $start): LearningNode
    {
        $start->loadMissing('node');
        $node = $start->node;
        $start->delete();
        $this->syncLegacyStartActivity($node);

        return $node;
    }

    public function syncLegacyStartActivity(LearningNode $node): void
    {
        $firstStart = $node->activityStarts()
            ->with('activity')
            ->get()
            ->first(fn (LearningActivityStart $start): bool => $this->routeEligibility->canStart($start->activity));

        $node->forceFill(['start_activity_id' => $firstStart?->learning_activity_id])->save();
    }
}
