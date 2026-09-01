import { router } from '@inertiajs/react';
import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
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
import { ValidationSummary } from '@/features/settings/map-export-validation-dialog';
import type { MapExportValidationResult } from '@/features/settings/map-export-validation-dialog';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type ImportMapErrors = Record<string, string>;

type MapImportDialogProps = {
    endpoint: string;
    scope?: 'map' | 'world';
};

export function MapImportDialog({
    endpoint,
    scope = 'map',
}: MapImportDialogProps) {
    const t = usePlatformTranslation();
    const isWorldImport = scope === 'world';
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [validating, setValidating] = useState(false);
    const [errors, setErrors] = useState<ImportMapErrors>({});
    const [validation, setValidation] =
        useState<MapExportValidationResult | null>(null);
    const validationSequence = useRef(0);
    const [form, setForm] = useState<{
        file: File | null;
        slug: string;
        title: string;
    }>({ file: null, slug: '', title: '' });

    const reset = () => {
        validationSequence.current += 1;
        setForm({ file: null, slug: '', title: '' });
        setErrors({});
        setValidation(null);
        setValidating(false);
    };

    const validateFile = async (file: File | null) => {
        const sequence = ++validationSequence.current;
        setValidation(null);
        setErrors({});

        if (!file) {
            setValidating(false);

            return;
        }

        setValidating(true);
        const formData = new FormData();
        formData.append('manifest', file);
        formData.append('scope', scope);
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        try {
            const response = await fetch(
                '/settings/worlds/maps/exports/validate',
                {
                    body: formData,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as
                | MapExportValidationResult
                | { message?: string };

            if (sequence !== validationSequence.current) {
                return;
            }

            if (!response.ok) {
                throw new Error(
                    'message' in payload && payload.message
                        ? payload.message
                        : t(
                              'settings.world_builder.import.validation_failed',
                              'The file could not be checked.',
                          ),
                );
            }

            setValidation(payload as MapExportValidationResult);
        } catch (validationError) {
            if (sequence !== validationSequence.current) {
                return;
            }

            setErrors({
                manifest:
                    validationError instanceof Error
                        ? validationError.message
                        : t(
                              'settings.world_builder.import.validation_failed',
                              'The file could not be checked.',
                          ),
            });
        } finally {
            if (sequence === validationSequence.current) {
                setValidating(false);
            }
        }
    };

    const importMap = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!form.file || !validation?.valid) {
            setErrors({
                manifest: t(
                    'settings.world_builder.import.validation_required',
                    'Check a valid export file before importing.',
                ),
            });

            return;
        }

        setProcessing(true);
        setErrors({});

        router.post(
            endpoint,
            isWorldImport
                ? { manifest: form.file }
                : {
                      manifest: form.file,
                      slug: form.slug,
                      title: form.title,
                  },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <>
            <Button
                className="mt-2 w-full"
                data-wl-id={`settings.world-builder.${isWorldImport ? 'world' : 'map'}.import`}
                onClick={() => {
                    reset();
                    setOpen(true);
                }}
                type="button"
                variant="outline"
            >
                <FileUp className="size-4" />
                {isWorldImport
                    ? t(
                          'settings.world_builder.import.world_open',
                          'Import world export',
                      )
                    : t(
                          'settings.world_builder.import.open',
                          'Import map export',
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
                <DialogContent
                    className="sm:max-w-lg"
                    data-wl-id={`settings.world-builder.${isWorldImport ? 'world' : 'map'}.import.dialog`}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                isWorldImport
                                    ? 'settings.world_builder.import.world_title'
                                    : 'settings.world_builder.import.title',
                                isWorldImport
                                    ? 'Import authored world'
                                    : 'Import authored map',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                isWorldImport
                                    ? 'settings.world_builder.import.world_description'
                                    : 'settings.world_builder.import.description',
                                isWorldImport
                                    ? 'Create fresh maps from a validated world export. Portal links between included maps are remapped; learner history, versions, access restrictions and editor groups are not imported.'
                                    : 'Create a new map from a validated single-map export. Learner history, versions, review state, access restrictions and editor groups are not imported.',
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="grid gap-4" onSubmit={importMap}>
                        <div className="grid gap-2">
                            <Label htmlFor="map-import-file">
                                {t(
                                    'settings.world_builder.import.file',
                                    isWorldImport
                                        ? 'JSON world bundle'
                                        : 'JSON export file',
                                )}
                            </Label>
                            <Input
                                accept=".json,application/json,text/plain"
                                id="map-import-file"
                                onChange={(event) => {
                                    const file =
                                        event.target.files?.[0] ?? null;
                                    setForm((current) => ({
                                        ...current,
                                        file,
                                    }));
                                    void validateFile(file);
                                }}
                                required
                                type="file"
                            />
                            <InputError message={errors.manifest} />
                            {errors.manifest && form.file && !validating ? (
                                <Button
                                    data-wl-id="settings.world-builder.import.revalidate"
                                    onClick={() => void validateFile(form.file)}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    {t(
                                        'settings.world_builder.import.recheck',
                                        'Check again',
                                    )}
                                </Button>
                            ) : null}
                        </div>

                        {validating ? (
                            <p
                                aria-live="polite"
                                className="text-sm text-[var(--settings-muted-text)]"
                                role="status"
                            >
                                {t(
                                    'settings.world_builder.import.checking',
                                    'Checking the export before import...',
                                )}
                            </p>
                        ) : null}

                        {validation ? (
                            <div data-wl-id="settings.world-builder.import.validation-summary">
                                <ValidationSummary result={validation} />
                            </div>
                        ) : null}

                        {!isWorldImport ? (
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="map-import-title">
                                        {t(
                                            'settings.world_builder.import.name',
                                            'Map title',
                                        )}
                                    </Label>
                                    <Input
                                        id="map-import-title"
                                        maxLength={120}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                title: event.target.value,
                                            }))
                                        }
                                        required
                                        value={form.title}
                                    />
                                    <InputError message={errors.title} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="map-import-slug">
                                        {t(
                                            'settings.world_builder.import.slug',
                                            'Slug (optional)',
                                        )}
                                    </Label>
                                    <Input
                                        id="map-import-slug"
                                        maxLength={140}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                slug: event.target.value,
                                            }))
                                        }
                                        placeholder="A unique slug is generated from the title"
                                        value={form.slug}
                                    />
                                    <InputError message={errors.slug} />
                                </div>
                            </div>
                        ) : null}

                        <DialogFooter>
                            <Button
                                onClick={() => setOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                {t(
                                    'settings.world_builder.import.cancel',
                                    'Cancel',
                                )}
                            </Button>
                            <Button
                                disabled={
                                    processing ||
                                    validating ||
                                    !form.file ||
                                    validation?.valid !== true
                                }
                                type="submit"
                            >
                                <FileUp className="size-4" />
                                {processing
                                    ? t(
                                          'settings.world_builder.import.creating',
                                          'Importing...',
                                      )
                                    : t(
                                          isWorldImport
                                              ? 'settings.world_builder.import.world_submit'
                                              : 'settings.world_builder.import.submit',
                                          isWorldImport
                                              ? 'Import world'
                                              : 'Import map',
                                      )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
