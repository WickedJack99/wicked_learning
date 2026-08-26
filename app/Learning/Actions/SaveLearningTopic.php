<?php

namespace App\Learning\Actions;

use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaveLearningTopic
{
    /**
     * @param array{
     *     title: string,
     *     description?: string|null,
     *     content?: string|null,
     *     parent_id?: int|null,
     *     is_published?: bool
     * } $data
     */
    public function handle(
        LearningTopicArea $area,
        array $data,
        ?LearningTopic $topic = null,
    ): LearningTopic {
        $parentId = $data['parent_id'] ?? null;

        if ($parentId !== null) {
            $parent = LearningTopic::query()->find($parentId);

            if (
                ! $parent
                || $parent->learning_topic_area_id !== $area->id
                || ($topic && $parent->is($topic))
            ) {
                throw ValidationException::withMessages([
                    'parent_id' => 'The parent topic must belong to the same topic area.',
                ]);
            }
        }

        $topic ??= new LearningTopic([
            'learning_topic_area_id' => $area->id,
            'slug' => $this->uniqueSlug($data['title']),
        ]);
        $topic->fill([
            'parent_id' => $parentId,
            'title' => trim($data['title']),
            'description' => $data['description'] ?? null,
            'content' => $data['content'] ?? null,
            'is_published' => $data['is_published'] ?? true,
        ])->save();

        return $topic->refresh();
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'topic';
        $slug = $base;
        $suffix = 2;

        while (LearningTopic::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
