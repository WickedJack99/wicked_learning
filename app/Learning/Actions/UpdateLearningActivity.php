<?php

namespace App\Learning\Actions;

use App\Learning\Services\PortalActivityConfiguration;
use App\Learning\Services\PortalLinkService;
use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningActivity;

class UpdateLearningActivity
{
    public function __construct(
        private readonly PortalActivityConfiguration $portalConfig,
        private readonly PortalLinkService $portalLinkService,
        private readonly UniqueSlugGenerator $slugGenerator,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningActivity $activity, array $data): LearningActivity
    {
        $activity->loadMissing('node');
        $updates = $this->updatesFor($activity, $data);
        $activity->forceFill($updates)->save();
        $this->syncPortalLinkWhenNeeded($activity, $data);

        return $activity;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function updatesFor(LearningActivity $activity, array $data): array
    {
        $updates = $this->basicUpdates($activity, $data);
        $type = (string) ($updates['type'] ?? $activity->type);

        if ($this->portalConfig->shouldUpdate($data, $updates)) {
            $config = is_array($activity->config) ? $activity->config : [];
            $updates['config'] = $type === 'portal' ? $this->portalConfig->fromData($data, $config) : [];
        }

        return $updates;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function basicUpdates(LearningActivity $activity, array $data): array
    {
        $updates = [];

        foreach (['title', 'type', 'introduction', 'graph_position_x', 'graph_position_y'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }

        if (array_key_exists('slug', $data)) {
            $title = (string) ($data['title'] ?? $activity->title);
            $updates['slug'] = ($data['slug'] ?? null) ?: $this->slugGenerator->forActivity($activity->node, $title, $activity);
        }

        return $updates;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function syncPortalLinkWhenNeeded(LearningActivity $activity, array $data): void
    {
        $shouldSync = array_intersect_key($data, array_flip([
            'type',
            'portal_mode',
            'target_portal_activity_id',
            'title',
        ])) !== [];

        if (! $shouldSync) {
            return;
        }

        $activity->refresh();
        $this->portalLinkService->syncForActivity($activity, $data['target_portal_activity_id'] ?? null);
    }
}
