<?php

namespace App\Learning\Services;

use App\Models\ReusableMediaMetadata;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ReusableMediaMetadataManager
{
    /**
     * @param  list<string>  $urls
     * @return Collection<string, ReusableMediaMetadata>
     */
    public function forUrls(array $urls): Collection
    {
        return ReusableMediaMetadata::query()
            ->whereIn('url', $urls)
            ->get()
            ->keyBy('url');
    }

    /**
     * @param  array{display_name?: string|null, category?: string|null, tags?: list<string>, has_transparency?: bool|null, is_animated?: bool|null}  $data
     */
    public function save(string $url, array $data): void
    {
        $displayName = Str::of($data['display_name'] ?? '')->squish()->toString();
        $category = Str::of($data['category'] ?? '')->squish()->toString();
        $tags = collect($data['tags'] ?? [])
            ->map(fn (string $tag): string => Str::of($tag)->trim()->lower()->toString())
            ->filter()
            ->unique()
            ->values()
            ->all();
        $attributes = [
            'display_name' => $displayName === '' ? null : $displayName,
            'category' => $category === '' ? null : $category,
            'tags' => $tags === [] ? null : $tags,
            'has_transparency' => $data['has_transparency'] ?? null,
            'is_animated' => $data['is_animated'] ?? null,
        ];

        if (collect($attributes)->every(fn (mixed $value): bool => $value === null)) {
            ReusableMediaMetadata::query()->where('url', $url)->delete();

            return;
        }

        ReusableMediaMetadata::query()->updateOrCreate(
            ['url' => $url],
            $attributes,
        );
    }

    public function transfer(string $oldUrl, string $newUrl): void
    {
        ReusableMediaMetadata::query()
            ->where('url', $oldUrl)
            ->update(['url' => $newUrl]);
    }

    public function delete(string $url): void
    {
        ReusableMediaMetadata::query()->where('url', $url)->delete();
    }
}
