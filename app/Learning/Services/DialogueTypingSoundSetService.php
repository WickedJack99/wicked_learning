<?php

namespace App\Learning\Services;

use App\Models\LearningDialogueSoundSet;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DialogueTypingSoundSetService
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, mixed>  $files
     */
    public function create(array $data, array $files): LearningDialogueSoundSet
    {
        return DB::transaction(function () use ($data, $files): LearningDialogueSoundSet {
            $set = LearningDialogueSoundSet::query()->create([
                'name' => $data['name'],
                'slug' => $data['slug'],
                'tags' => $this->tags($data['tags'] ?? []),
                'is_default' => (bool) ($data['is_default'] ?? false),
            ]);

            $this->replaceSounds($set, $files);
            $this->ensureDefaultSet($set);

            return $set->load('sounds');
        });
    }

    /**
     * @param  array<int, mixed>  $files
     */
    public function replaceSounds(LearningDialogueSoundSet $set, array $files): LearningDialogueSoundSet
    {
        $letters = $this->validatedLetters($files);
        $stored = [];

        try {
            foreach ($letters as $letter => $file) {
                $stored[$letter] = $this->store($set, $letter, $file);
            }

            foreach ($stored as $letter => $url) {
                $set->sounds()->updateOrCreate(
                    ['letter' => $letter],
                    ['url' => $url, 'volume' => 70],
                );
            }
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete(array_values($stored));

            throw $exception;
        }

        return $set->load('sounds');
    }

    public function replaceSound(LearningDialogueSoundSet $set, string $letter, UploadedFile $file): LearningDialogueSoundSet
    {
        $letter = strtolower($letter);
        $this->assertLetter($letter);

        $url = $this->store($set, $letter, $file);
        $set->sounds()->updateOrCreate(
            ['letter' => $letter],
            ['url' => $url, 'volume' => 70],
        );

        return $set->load('sounds');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(LearningDialogueSoundSet $set, array $data): LearningDialogueSoundSet
    {
        return DB::transaction(function () use ($set, $data): LearningDialogueSoundSet {
            $set->update([
                'name' => $data['name'],
                'slug' => $data['slug'],
                'tags' => $this->tags($data['tags'] ?? []),
                'is_default' => (bool) ($data['is_default'] ?? false),
            ]);
            $this->ensureDefaultSet($set);

            return $set->load('sounds');
        });
    }

    /**
     * @param  array<int, mixed>  $files
     * @return array<string, UploadedFile>
     */
    private function validatedLetters(array $files): array
    {
        $letters = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                throw ValidationException::withMessages([
                    'files' => 'Choose one WAV file for every letter from A to Z.',
                ]);
            }

            $letter = strtolower(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));

            if (! preg_match('/^[a-z]$/', $letter)) {
                throw ValidationException::withMessages([
                    'files' => 'Each WAV filename must be one letter from a.wav to z.wav.',
                ]);
            }

            if (isset($letters[$letter])) {
                throw ValidationException::withMessages([
                    'files' => "The letter {$letter} was uploaded more than once.",
                ]);
            }

            $letters[$letter] = $file;
        }

        if (count($letters) !== 26 || count(array_diff(range('a', 'z'), array_keys($letters))) > 0) {
            throw ValidationException::withMessages([
                'files' => 'Choose exactly one WAV file for every letter from A to Z.',
            ]);
        }

        ksort($letters);

        return $letters;
    }

    private function store(LearningDialogueSoundSet $set, string $letter, UploadedFile $file): string
    {
        $path = $file->storeAs(
            "learning/dialogue-typing/{$set->slug}",
            "{$letter}-".Str::uuid()->toString().'.wav',
            'public',
        );

        abort_if($path === false, 500, 'The dialogue typing sound could not be stored.');

        return Storage::url($path);
    }

    private function assertLetter(string $letter): void
    {
        abort_unless(preg_match('/^[a-z]$/', $letter) === 1, 404);
    }

    /**
     * @return list<string>
     */
    private function tags(mixed $tags): array
    {
        if (is_string($tags)) {
            $tags = explode(',', $tags);
        }

        if (! is_array($tags)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            static fn (mixed $tag): string => trim((string) $tag),
            $tags,
        ))));
    }

    private function ensureDefaultSet(LearningDialogueSoundSet $set): void
    {
        if ($set->is_default) {
            LearningDialogueSoundSet::query()
                ->whereKeyNot($set->id)
                ->update(['is_default' => false]);

            return;
        }

        if (! LearningDialogueSoundSet::query()->where('is_default', true)->exists()) {
            $set->update(['is_default' => true]);
        }
    }
}
