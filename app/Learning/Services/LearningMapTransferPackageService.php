<?php

namespace App\Learning\Services;

use App\Learning\Serializers\LearningMapExportSerializer;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use JsonException;
use RuntimeException;
use ZipArchive;

class LearningMapTransferPackageService
{
    private const MANIFEST_ENTRY = 'manifest.json';

    private const MEDIA_INDEX_ENTRY = 'media.json';

    private const MEDIA_PREFIX = 'media/';

    private const MAX_ENTRIES = 2000;

    private const MAX_TOTAL_UNCOMPRESSED_BYTES = 51200 * 1024;

    private const MAX_MEDIA_BYTES = 51200 * 1024;

    public function __construct(
        private readonly LearningMapExportSerializer $serializer,
        private readonly ReusableMediaAssetManager $mediaAssets,
    ) {}

    /**
     * @return array{path: string, mediaCount: int}
     */
    public function export(LearningMap $map): array
    {
        return $this->exportPayload($this->serializer->serialize($map));
    }

    /**
     * @return array{path: string, mediaCount: int}
     */
    public function exportAsset(LearningMapAsset $asset): array
    {
        return $this->exportPayload($this->serializer->serializeAsset($asset));
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{path: string, mediaCount: int}
     */
    private function exportPayload(array $payload): array
    {
        $references = $this->mediaReferences($payload);
        $mediaEntries = [];
        $totalBytes = 0;

        foreach ($references as $reference) {
            $storagePath = $this->storagePath($reference);

            if ($storagePath === null) {
                continue;
            }

            $disk = Storage::disk('public');
            if (! $this->mediaAssets->isImportableReference($reference)) {
                throw ValidationException::withMessages([
                    'media' => "The referenced media file '{$reference}' is not available for transfer.",
                ]);
            }

            $size = $disk->size($storagePath);
            $totalBytes += $size;
            if ($size > self::MAX_MEDIA_BYTES || $totalBytes > self::MAX_TOTAL_UNCOMPRESSED_BYTES) {
                throw ValidationException::withMessages([
                    'media' => 'The referenced media is too large for one transfer package.',
                ]);
            }

            $extension = strtolower(pathinfo($storagePath, PATHINFO_EXTENSION));
            $archivePath = self::MEDIA_PREFIX.hash('sha256', $reference).($extension !== '' ? '.'.$extension : '');
            $mediaEntries[] = [
                'sourceUrl' => $reference,
                'archivePath' => $archivePath,
            ];
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'wicked-map-package-');
        if ($tempPath === false) {
            throw new RuntimeException('The map transfer package could not be created.');
        }

        $archive = new ZipArchive;
        if ($archive->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            @unlink($tempPath);
            throw new RuntimeException('The map transfer package could not be opened.');
        }

        try {
            $archive->addFromString(self::MANIFEST_ENTRY, $this->encode($payload));
            $archive->addFromString(self::MEDIA_INDEX_ENTRY, $this->encode([
                'format' => 'wicked-learning-map-media',
                'formatVersion' => 1,
                'media' => $mediaEntries,
            ]));

            foreach ($mediaEntries as $mediaEntry) {
                $storagePath = $this->storagePath($mediaEntry['sourceUrl']);
                if ($storagePath === null) {
                    throw ValidationException::withMessages([
                        'media' => 'The media package contains an invalid storage reference.',
                    ]);
                }
                if (! $archive->addFile(Storage::disk('public')->path($storagePath), $mediaEntry['archivePath'])) {
                    throw new RuntimeException('The map transfer package could not include a media file.');
                }
            }

            if (! $archive->close()) {
                throw new RuntimeException('The map transfer package could not be finalized.');
            }
        } catch (\Throwable $exception) {
            $archive->close();
            @unlink($tempPath);

            throw $exception;
        }

        return ['path' => $tempPath, 'mediaCount' => count($mediaEntries)];
    }

    public function isPackage(UploadedFile $file): bool
    {
        $archive = new ZipArchive;
        $opened = $archive->open($file->getRealPath() ?: '') === true;

        if ($opened) {
            $archive->close();
        }

        return $opened;
    }

    /**
     * Validate and temporarily materialize package media so the existing
     * manifest validator can check the payload against real destination paths.
     *
     * @return array{payload: array<string, mixed>, sourceToDestination: array<string, string>, createdPaths: list<string>}
     */
    public function prepare(UploadedFile $file): array
    {
        $archive = $this->openAndValidate($file);
        $createdPaths = [];

        try {
            $payload = $this->readJsonEntry($archive, self::MANIFEST_ENTRY, 'The package manifest is not valid JSON.');
            $mediaIndex = $this->readJsonEntry($archive, self::MEDIA_INDEX_ENTRY, 'The package media index is not valid JSON.');
            $entries = $this->mediaEntries($mediaIndex);
            $references = $this->mediaReferences($payload);
            $referenceSet = array_fill_keys($references, true);
            $disk = Storage::disk('public');
            $sourceToDestination = [];
            foreach ($entries as $entry) {
                $sourceUrl = $entry['sourceUrl'];
                $archivePath = $entry['archivePath'];

                if (! isset($referenceSet[$sourceUrl]) || $this->storagePath($sourceUrl) === null) {
                    throw ValidationException::withMessages([
                        'media' => 'The package media index contains an unused or non-transferable reference.',
                    ]);
                }

                $stat = $archive->statName($archivePath);
                if (! is_array($stat) || ($stat['size'] ?? 0) > self::MAX_MEDIA_BYTES) {
                    throw ValidationException::withMessages([
                        'media' => 'A package media file is too large to import.',
                    ]);
                }

                $extension = strtolower(pathinfo((string) $this->storagePath($sourceUrl), PATHINFO_EXTENSION));
                $destinationPath = 'learning/media/'.Str::uuid().($extension !== '' ? '.'.$extension : '');
                $stream = $archive->getStream($archivePath);
                if (! is_resource($stream) || ! $disk->put($destinationPath, $stream)) {
                    $disk->delete($destinationPath);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }

                    throw ValidationException::withMessages([
                        'media' => 'A package media file could not be stored.',
                    ]);
                }
                fclose($stream);

                $sourceToDestination[$sourceUrl] = Storage::url($destinationPath);
                $createdPaths[] = $destinationPath;
            }

            foreach ($references as $reference) {
                if ($this->storagePath($reference) !== null && ! isset($sourceToDestination[$reference])) {
                    throw ValidationException::withMessages([
                        'media' => "The package does not include referenced media '{$reference}'.",
                    ]);
                }
            }

            return [
                'payload' => $this->replaceReferences($payload, $sourceToDestination),
                'sourceToDestination' => $sourceToDestination,
                'createdPaths' => $createdPaths,
            ];
        } catch (\Throwable $exception) {
            $this->deletePaths($createdPaths);

            throw $exception;
        } finally {
            $archive->close();
        }
    }

    /**
     * @param  list<string>  $paths
     */
    public function deletePaths(array $paths): void
    {
        if ($paths !== []) {
            Storage::disk('public')->delete($paths);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<string>
     */
    private function mediaReferences(array $payload): array
    {
        $references = data_get($payload, 'references.mediaUrls', []);

        if (! is_array($references)) {
            return [];
        }

        return array_values(array_unique(array_filter(
            $references,
            fn (mixed $reference): bool => is_string($reference) && trim($reference) !== '',
        )));
    }

    /**
     * @param  array<string, mixed>  $index
     * @return list<array{sourceUrl: string, archivePath: string}>
     */
    private function mediaEntries(array $index): array
    {
        if (($index['format'] ?? null) !== 'wicked-learning-map-media' || ($index['formatVersion'] ?? null) !== 1) {
            throw ValidationException::withMessages([
                'media' => 'The package media index has an unsupported format.',
            ]);
        }

        $media = $index['media'] ?? null;
        if (! is_array($media) || ! array_is_list($media) || count($media) > self::MAX_ENTRIES) {
            throw ValidationException::withMessages([
                'media' => 'The package media index is invalid.',
            ]);
        }

        $entries = [];
        $sourceUrls = [];
        $archivePaths = [];
        foreach ($media as $entry) {
            if (! is_array($entry)
                || ! is_string($entry['sourceUrl'] ?? null)
                || ! is_string($entry['archivePath'] ?? null)
                || ! str_starts_with($entry['archivePath'], self::MEDIA_PREFIX)
                || str_contains($entry['archivePath'], '..')
            ) {
                throw ValidationException::withMessages([
                    'media' => 'The package contains an invalid media entry.',
                ]);
            }

            if (isset($sourceUrls[$entry['sourceUrl']]) || isset($archivePaths[$entry['archivePath']])) {
                throw ValidationException::withMessages([
                    'media' => 'The package contains duplicate media entries.',
                ]);
            }

            $sourceUrls[$entry['sourceUrl']] = true;
            $archivePaths[$entry['archivePath']] = true;

            $entries[] = [
                'sourceUrl' => $entry['sourceUrl'],
                'archivePath' => $entry['archivePath'],
            ];
        }

        return $entries;
    }

    private function openAndValidate(UploadedFile $file): ZipArchive
    {
        $archive = new ZipArchive;
        if ($archive->open($file->getRealPath() ?: '') !== true) {
            throw ValidationException::withMessages([
                'manifest' => 'The selected file is not a valid map package.',
            ]);
        }

        if ($archive->numFiles > self::MAX_ENTRIES) {
            $archive->close();
            throw ValidationException::withMessages([
                'manifest' => 'The map package contains too many files.',
            ]);
        }

        $totalBytes = 0;
        for ($index = 0; $index < $archive->numFiles; $index++) {
            $stat = $archive->statIndex($index);
            $name = is_array($stat) ? (string) ($stat['name'] ?? '') : '';
            $totalBytes += (int) ($stat['size'] ?? 0);

            if ($name === '' || str_contains($name, '..') || str_starts_with($name, '/') || str_ends_with($name, '/')) {
                $archive->close();
                throw ValidationException::withMessages([
                    'manifest' => 'The map package contains an unsafe file path.',
                ]);
            }
        }

        if ($totalBytes > self::MAX_TOTAL_UNCOMPRESSED_BYTES
            || $archive->locateName(self::MANIFEST_ENTRY) === false
            || $archive->locateName(self::MEDIA_INDEX_ENTRY) === false
        ) {
            $archive->close();
            throw ValidationException::withMessages([
                'manifest' => 'The map package is incomplete or too large.',
            ]);
        }

        return $archive;
    }

    /**
     * @return array<string, mixed>
     */
    private function readJsonEntry(ZipArchive $archive, string $entry, string $message): array
    {
        $contents = $archive->getFromName($entry);

        try {
            $payload = is_string($contents) ? json_decode($contents, true, 512, JSON_THROW_ON_ERROR) : null;
        } catch (JsonException) {
            $payload = null;
        }

        if (! is_array($payload)) {
            throw ValidationException::withMessages(['manifest' => $message]);
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $value
     * @param  array<string, string>  $references
     * @return array<string, mixed>
     */
    private function replaceReferences(array $value, array $references): array
    {
        foreach ($value as $key => $item) {
            if (is_string($item) && isset($references[$item])) {
                $value[$key] = $references[$item];
            } elseif (is_array($item)) {
                $value[$key] = $this->replaceReferences($item, $references);
            }
        }

        return $value;
    }

    private function storagePath(string $url): ?string
    {
        $parsed = parse_url($url);
        if (! is_array($parsed) || isset($parsed['scheme']) || isset($parsed['host'])) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH);

        if (! is_string($path) || ! str_starts_with($path, '/storage/')) {
            return null;
        }

        $storagePath = ltrim(substr($path, strlen('/storage/')), '/');

        return $storagePath !== '' && ! str_contains($storagePath, '..') ? $storagePath : null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function encode(array $payload): string
    {
        return json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR).PHP_EOL;
    }
}
