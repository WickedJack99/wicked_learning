<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningGroup;
use App\Models\User;

class SaveLearningGroup
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?LearningGroup $group = null, ?User $creator = null): LearningGroup
    {
        $group ??= new LearningGroup;
        $name = trim((string) $data['name']);
        $slug = trim((string) ($data['slug'] ?? ''));

        $group->fill([
            'created_by_user_id' => $group->exists ? $group->created_by_user_id : $creator?->id,
            'name' => $name,
            'slug' => $slug !== '' ? $slug : $this->slugGenerator->forLearningGroup($name, $group),
            'description' => $data['description'] ?? null,
            'study_topic' => $data['study_topic'] ?? null,
        ]);

        $group->save();

        return $group->refresh()->load(['members', 'messages.user', 'adminChatVotes']);
    }
}
