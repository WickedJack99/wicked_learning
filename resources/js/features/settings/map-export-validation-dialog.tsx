import { CheckCircle2, FileJson, TriangleAlert, Upload } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type MapExportValidationResult = {
    counts: {
        activities: number;
        maps?: number;
        mapAssets: number;
        mediaReferences: number;
        nodes: number;
        portalTargets: number;
    };
    errors: string[];
    mediaReferenceDetails: Array<{
        available: boolean;
        url: string;
    }>;
    map?: { exists: boolean; slug: string | null };
    summary: string;
    valid: boolean;
    warnings: string[];
    world: { exists: boolean; slug: string | null };
};

export function MapExportValidationDialog({ endpoint }: { endpoint: string }) {
    const t = usePlatformTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<MapExportValidationResult | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [validating, setValidating] = useState(false);

    const reset = () => {
        setFile(null);
        setResult(null);
        setError(null);
    };

    const validate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!file) {
            setError(
                t(
                    'settings.world_builder.export_validation.choose_file',
                    'Choose a JSON export file first.',
                ),
            );

            return;
        }

        setValidating(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('manifest', file);
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        try {
            const response = await fetch(endpoint, {
                body: formData,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                },
                method: 'POST',
            });
            const payload = (await response.json()) as
                | MapExportValidationResult
                | { message?: string };

            if (!response.ok) {
                throw new Error(
                    'message' in payload && payload.message
                        ? payload.message
                        : t(
                              'settings.world_builder.export_validation.failed',
                              'The manifest could not be checked.',
                          ),
                );
            }

            setResult(payload as MapExportValidationResult);
        } catch (validationError) {
            setError(
                validationError instanceof Error
                    ? validationError.message
                    : t(
                          'settings.world_builder.export_validation.failed',
                          'The manifest could not be checked.',
                      ),
            );
        } finally {
            setValidating(false);
        }
    };

    return (
        <>
            <Button
                className="mt-3 w-full"
                onClick={() => {
                    reset();
                    setOpen(true);
                }}
                type="button"
                variant="outline"
            >
                <Upload className="size-4" />
                {t(
                    'settings.world_builder.export_validation.open',
                    'Validate map export',
                )}
            </Button>

            <Dialog
                onOpenChange={(nextOpen) => {
                    setOpen(nextOpen);

                    if (!nextOpen) {
                        reset();
                    }
                }}
                open={open}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'settings.world_builder.export_validation.title',
                                'Validate map export',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'settings.world_builder.export_validation.description',
                                'Check an exported map manifest without creating or changing any content.',
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="grid gap-4" onSubmit={validate}>
                        <div className="grid gap-2">
                            <Label htmlFor="map-export-manifest">
                                {t(
                                    'settings.world_builder.export_validation.file',
                                    'JSON export file',
                                )}
                            </Label>
                            <Input
                                accept=".json,application/json,text/plain"
                                id="map-export-manifest"
                                onChange={(event) => {
                                    setFile(event.target.files?.[0] ?? null);
                                    setResult(null);
                                    setError(null);
                                }}
                                type="file"
                            />
                            <p className="text-xs text-[var(--settings-muted-text)]">
                                {file?.name ??
                                    t(
                                        'settings.world_builder.export_validation.no_file',
                                        'No file selected.',
                                    )}
                            </p>
                        </div>

                        {error ? (
                            <p
                                aria-live="polite"
                                className="text-sm text-red-400"
                                role="alert"
                            >
                                {error}
                            </p>
                        ) : null}

                        {result ? <ValidationSummary result={result} /> : null}

                        <DialogFooter>
                            <Button
                                onClick={() => setOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                {t(
                                    'settings.world_builder.export_validation.close',
                                    'Close',
                                )}
                            </Button>
                            <Button disabled={validating} type="submit">
                                <FileJson className="size-4" />
                                {validating
                                    ? t(
                                          'settings.world_builder.export_validation.checking',
                                          'Checking...',
                                      )
                                    : t(
                                          'settings.world_builder.export_validation.check',
                                          'Check manifest',
                                      )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function ValidationSummary({
    result,
}: {
    result: MapExportValidationResult;
}) {
    const t = usePlatformTranslation();

    return (
        <div aria-live="polite" className="grid gap-3" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--settings-border-color)] p-3">
                {result.valid ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                ) : (
                    <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-300" />
                )}
                <p className="text-sm leading-6">{result.summary}</p>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                {typeof result.counts.maps === 'number' ? (
                    <ValidationCount
                        label={t(
                            'settings.world_builder.export_validation.maps',
                            'Maps',
                        )}
                        value={result.counts.maps}
                    />
                ) : null}
                <ValidationCount
                    label={t(
                        'settings.world_builder.export_validation.nodes',
                        'Nodes',
                    )}
                    value={result.counts.nodes}
                />
                <ValidationCount
                    label={t(
                        'settings.world_builder.export_validation.activities',
                        'Activities',
                    )}
                    value={result.counts.activities}
                />
                <ValidationCount
                    label={t(
                        'settings.world_builder.export_validation.map_assets',
                        'MapAssets',
                    )}
                    value={result.counts.mapAssets}
                />
                <ValidationCount
                    label={t(
                        'settings.world_builder.export_validation.portals',
                        'Portals',
                    )}
                    value={result.counts.portalTargets}
                />
                <ValidationCount
                    label={t(
                        'settings.world_builder.export_validation.media_references',
                        'Media refs',
                    )}
                    value={result.counts.mediaReferences}
                />
            </dl>

            {result.mediaReferenceDetails.length > 0 ? (
                <MediaReferenceDetails
                    details={result.mediaReferenceDetails}
                    total={result.counts.mediaReferences}
                />
            ) : null}

            {result.errors.length > 0 ? (
                <ValidationMessages
                    heading={t(
                        'settings.world_builder.export_validation.corrections',
                        'Corrections needed',
                    )}
                    messages={result.errors}
                />
            ) : null}
            {result.warnings.length > 0 ? (
                <ValidationMessages
                    heading={t(
                        'settings.world_builder.export_validation.notes',
                        'Notes for import',
                    )}
                    messages={result.warnings}
                />
            ) : null}
        </div>
    );
}

function MediaReferenceDetails({
    details,
    total,
}: {
    details: MapExportValidationResult['mediaReferenceDetails'];
    total: number;
}) {
    const t = usePlatformTranslation();
    const visibleDetails = details.slice(0, 6);
    const availableCount = details.filter((detail) => detail.available).length;

    return (
        <div className="grid gap-2 rounded-lg border border-[var(--settings-border-color)] p-3">
            <div>
                <h3 className="text-sm font-semibold">
                    {t(
                        'settings.world_builder.export_validation.media_details',
                        'Referenced media',
                    )}
                </h3>
                <p className="text-sm text-[var(--settings-muted-text)]">
                    {t(
                        'settings.world_builder.export_validation.media_availability',
                        ':available of :total referenced media files are available in this workspace.',
                        { available: availableCount, total },
                    )}
                </p>
            </div>
            <ul className="grid gap-1 text-sm text-[var(--settings-muted-text)]">
                {visibleDetails.map((detail) => (
                    <li
                        className="flex min-w-0 items-start gap-2"
                        key={detail.url}
                    >
                        {detail.available ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                        ) : (
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
                        )}
                        <span className="min-w-0 break-all">{detail.url}</span>
                    </li>
                ))}
            </ul>
            {details.length > visibleDetails.length ? (
                <p className="text-sm text-[var(--settings-muted-text)]">
                    {t(
                        'settings.world_builder.export_validation.more_media',
                        ':count more media references not shown.',
                        { count: details.length - visibleDetails.length },
                    )}
                </p>
            ) : null}
        </div>
    );
}

function ValidationCount({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_8%,transparent)] p-2">
            <dt className="text-[var(--settings-muted-text)]">{label}</dt>
            <dd className="mt-1 text-sm font-semibold">{value}</dd>
        </div>
    );
}

function ValidationMessages({
    heading,
    messages,
}: {
    heading: string;
    messages: string[];
}) {
    const t = usePlatformTranslation();
    const visibleMessages = messages.slice(0, 5);

    return (
        <div className="grid gap-2">
            <h3 className="text-sm font-semibold">{heading}</h3>
            <ul className="grid gap-1 text-sm text-[var(--settings-muted-text)]">
                {visibleMessages.map((message, index) => (
                    <li key={`${message}-${index}`}>• {message}</li>
                ))}
            </ul>
            {messages.length > visibleMessages.length ? (
                <p className="text-xs text-[var(--settings-muted-text)]">
                    {t(
                        'settings.world_builder.export_validation.more_messages',
                        ':count more messages not shown.',
                        { count: messages.length - visibleMessages.length },
                    )}
                </p>
            ) : null}
        </div>
    );
}
