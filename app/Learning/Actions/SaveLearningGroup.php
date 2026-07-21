<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningGroup;

class SaveLearningGroup
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?LearningGroup $group = null): LearningGroup
    {
        $group ??= new LearningGroup;
        $name = trim((string) $data['name']);
        $slug = trim((string) ($data['slug'] ?? ''));

        $group->fill([
            'name' => $name,
            'slug' => $slug !== '' ? $slug : $this->slugGenerator->forLearningGroup($name, $group),
            'description' => $data['description'] ?? null,
        ]);

        $group->save();

        return $group->refresh()->load(['members', 'messages.user', 'adminChatVotes']);
    }
}
