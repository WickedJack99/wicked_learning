<?php

namespace App\Learning\Validation;

use App\Models\LearningWorld;
use Illuminate\Http\UploadedFile;
use JsonException;

class LearningWorldExportValidator
{
    private const MAX_ERRORS = 30;

    private const MAX_MAPS = 12;

    private const MAX_MEDIA_REFERENCES = 2000;

    public function __construct(private readonly LearningMapExportValidator $mapValidator) {}

    /**
     * @return array{valid: bool, summary: string, errors: list<string>, warnings: list<string>, counts: array{maps: int, nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, mediaReferenceDetails: list<array{available: bool, url: string}>, world: array{slug: string|null, exists: bool}}
     */
    public function validate(UploadedFile $manifest, LearningWorld $world): array
    {
        $contents = $manifest->get();

        if ($contents === false) {
            return $this->invalid('The selected file could not be read.');
        }

        try {
            $payload = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return $this->invalid('The selected file is not valid JSON.');
        }

        if (! is_array($payload)) {
            return $this->invalid('The export must contain a JSON object.');
        }

        return $this->validatePayload($payload, $world);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{valid: bool, summary: string, errors: list<string>, warnings: list<string>, counts: array{maps: int, nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, mediaReferenceDetails: list<array{available: bool, url: string}>, world: array{slug: string|null, exists: bool}}
     */
    public function validatePayload(array $payload, LearningWorld $world): array
    {
        $errors = [];
        $warnings = [];

        if (($payload['format'] ?? null) !== 'wicked-learning-world') {
            $this->addError($errors, 'format must be "wicked-learning-world".');
        }
        if (($payload['formatVersion'] ?? null) !== 1) {
            $this->addError($errors, 'formatVersion must be 1.');
        }

        $worldPayload = is_array($payload['world'] ?? null) ? $payload['world'] : [];
        $worldSlug = $worldPayload['slug'] ?? null;
        if (! is_string($worldSlug) || $worldSlug !== $world->slug) {
            $this->addError($errors, 'world.slug must identify the current workspace.');
            $worldSlug = is_string($worldSlug) ? $worldSlug : null;
        }

        $maps = $payload['maps'] ?? null;
        if (! is_array($maps) || ! array_is_list($maps)) {
            $this->addError($errors, 'maps must be an array.');
            $maps = [];
        }
        if ($maps === []) {
            $this->addError($errors, 'maps must contain at least one map.');
        }
        if (count($maps) > self::MAX_MAPS) {
            $this->addError($errors, 'maps contains more than '.self::MAX_MAPS.' entries.');
        }

        $sourceSlugs = [];
        $counts = [
            'maps' => 0,
            'nodes' => 0,
            'activities' => 0,
            'mapAssets' => 0,
            'portalTargets' => 0,
            'mediaReferences' => 0,
        ];
        $mediaReferenceDetails = [];

        foreach (array_slice($maps, 0, self::MAX_MAPS) as $index => $map) {
            if (! is_array($map)) {
                $this->addError($errors, "maps.{$index} must be an object.");

                continue;
            }

            $mapSlug = data_get($map, 'map.slug');
            if (is_string($mapSlug)) {
                if (isset($sourceSlugs[$mapSlug])) {
                    $this->addError($errors, "Duplicate map slug '{$mapSlug}'.");
                }
                $sourceSlugs[$mapSlug] = true;
            }

            $mapResult = $this->mapValidator->validatePayload($map);
            $counts['maps']++;
            foreach (['nodes', 'activities', 'mapAssets', 'portalTargets', 'mediaReferences'] as $key) {
                $counts[$key] += $mapResult['counts'][$key];
            }
            foreach ($mapResult['mediaReferenceDetails'] as $detail) {
                $mediaReferenceDetails[$detail['url']] = $detail;
            }
            foreach ($mapResult['errors'] as $error) {
                $this->addError($errors, "maps.{$index}: {$error}");
            }
            foreach ($mapResult['warnings'] as $warning) {
                $warnings[] = "maps.{$index}: {$warning}";
            }
        }

        return [
            'valid' => $errors === [],
            'summary' => $errors === []
                ? 'The world bundle is structurally valid and ready to import.'
                : 'The world bundle needs corrections before it can be imported.',
            'errors' => $errors,
            'warnings' => array_values(array_unique($warnings)),
            'counts' => $counts,
            'mediaReferenceDetails' => array_values(array_slice($mediaReferenceDetails, 0, self::MAX_MEDIA_REFERENCES)),
            'world' => [
                'slug' => $worldSlug,
                'exists' => $worldSlug === $world->slug,
            ],
        ];
    }

    /** @param list<string> $errors */
    private function addError(array &$errors, string $message): void
    {
        if (count($errors) < self::MAX_ERRORS) {
            $errors[] = $message;
        }
    }

    /**
     * @return array{valid: false, summary: string, errors: list<string>, warnings: list<string>, counts: array{maps: int, nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, mediaReferenceDetails: list<array{available: bool, url: string}>, world: array{slug: null, exists: false}}
     */
    private function invalid(string $message): array
    {
        return [
            'valid' => false,
            'summary' => 'The world bundle could not be checked.',
            'errors' => [$message],
            'warnings' => [],
            'counts' => [
                'maps' => 0,
                'nodes' => 0,
                'activities' => 0,
                'mapAssets' => 0,
                'portalTargets' => 0,
                'mediaReferences' => 0,
            ],
            'mediaReferenceDetails' => [],
            'world' => ['slug' => null, 'exists' => false],
        ];
    }
}
