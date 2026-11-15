import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { LiftedButton } from './lifted-button';
import {
    LiftedDialog,
    LiftedDialogContent,
    LiftedDialogDescription,
    LiftedDialogFooter,
    LiftedDialogHeader,
    LiftedDialogTitle,
} from './lifted-dialog';
import { LiftedInputError } from './lifted-input-error';
import { LiftedInput } from './lifted-input';
import { LiftedLabel } from './lifted-label';
import {
    type MapExportValidationResult,
    ValidationSummary,
} from './lifted-world-builder-map-export-validation';
import { usePlatformTranslation } from './original-platform-translation';

type ImportMapErrors = Record<string, string>;
type RustWorldImportPreflight =
    components['schemas']['AdminWorldImportPreflightResult'];
type RustMapImportPreflight =
    components['schemas']['AdminWorldMapExportPreflightResult'];
type RustImportPreflight = RustWorldImportPreflight | RustMapImportPreflight;

function adaptRustImportPreflight(
    result: RustImportPreflight,
): MapExportValidationResult {
    return {
        counts: result.counts,
        errors: result.errors,
        mediaReferenceDetails: result.mediaReferenceDetails,
        summary: result.summary,
        valid: result.valid,
        warnings: result.warnings,
        world: result.world,
    };
}

/**
 * Direct lift of main:resources/js/features/settings/map-import-dialog.tsx
 * `MapImportDialog`. Laravel validation/form transport and Inertia navigation
 * are the only replaced seams; the pinned component's map/world branches stay
 * intact rather than being recreated as separate dialog designs.
 */
export function LiftedWorldBuilderImportDialog({
    scope,
    onCreated,
}: {
    scope: 'map' | 'world';
    onCreated: (mapIds: string[]) => void;
}) {
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

        try {
            const csrfToken = await getCsrfToken();
            const response = await fetch(
                isWorldImport
                    ? '/api/v1/admin/world-builder/world-exports/preflight'
                    : '/api/v1/admin/world-builder/map-exports/preflight',
                {
                    body: formData,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as
                | RustImportPreflight
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

            setValidation(
                adaptRustImportPreflight(payload as RustImportPreflight),
            );
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

    const importMap = async (event: FormEvent<HTMLFormElement>) => {
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

        const formData = new FormData();
        formData.append('manifest', form.file);
        if (!isWorldImport) {
            formData.append('slug', form.slug);
            formData.append('title', form.title);
        }

        try {
            const csrfToken = await getCsrfToken();
            const response = await fetch(
                isWorldImport
                    ? '/api/v1/admin/world-builder/world-exports/import'
                    : '/api/v1/admin/world-builder/map-exports/import',
                {
                    body: formData,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as {
                map_id?: string;
                map_ids?: string[];
                message?: string;
            };

            const mapIds = isWorldImport
                ? payload.map_ids
                : payload.map_id
                  ? [payload.map_id]
                  : undefined;
            if (!response.ok || !mapIds?.length) {
                setErrors({
                    manifest:
                        payload.message ??
                        t(
                            'settings.world_builder.import.validation_failed',
                            'The file could not be checked.',
                        ),
                });

                return;
            }

            setOpen(false);
            onCreated(mapIds);
        } catch {
            setErrors({
                manifest: t(
                    'settings.world_builder.import.validation_failed',
                    'The file could not be checked.',
                ),
            });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <LiftedButton
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
            </LiftedButton>

            <LiftedDialog
                onOpenChange={(nextOpen) => {
                    setOpen(nextOpen);

                    if (!nextOpen) {
                        reset();
                    }
                }}
                open={open}
            >
                <LiftedDialogContent
                    className="sm:max-w-lg"
                    data-wl-id={`settings.world-builder.${isWorldImport ? 'world' : 'map'}.import.dialog`}
                >
                    <LiftedDialogHeader>
                        <LiftedDialogTitle>
                            {t(
                                isWorldImport
                                    ? 'settings.world_builder.import.world_title'
                                    : 'settings.world_builder.import.title',
                                isWorldImport
                                    ? 'Import authored world'
                                    : 'Import authored map',
                            )}
                        </LiftedDialogTitle>
                        <LiftedDialogDescription>
                            {isWorldImport
                                ? t(
                                      'settings.world_builder.import.world_description',
                                      'Create fresh maps from a validated JSON world export or portable package. Portal links between included maps are remapped; learner history, versions, access restrictions and editor groups are not imported.',
                                  )
                                : t(
                                      'settings.world_builder.import.package_description',
                                      'Create a new map from a validated JSON export or portable map package. Learner history, versions, review state, access restrictions and editor groups are not imported.',
                                  )}
                        </LiftedDialogDescription>
                    </LiftedDialogHeader>

                    <form
                        className="grid gap-4"
                        onSubmit={(event) => void importMap(event)}
                    >
                        <div className="grid gap-2">
                            <LiftedLabel htmlFor="map-import-file">
                                {isWorldImport
                                    ? t('settings.world_builder.import.world_file', 'JSON world bundle or portable package')
                                    : t('settings.world_builder.import.package_file', 'JSON export or portable map package')}
                            </LiftedLabel>
                            <LiftedInput
                                accept={
                                    isWorldImport
                                        ? '.json,.zip,application/json,application/zip,text/plain'
                                        : '.json,.zip,application/json,application/zip,text/plain'
                                }
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
                            <LiftedInputError message={errors.manifest} />
                            {errors.manifest && form.file && !validating ? (
                                <LiftedButton
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
                                </LiftedButton>
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
                                    <LiftedLabel htmlFor="map-import-title">
                                        {t(
                                            'settings.world_builder.import.name',
                                            'Map title',
                                        )}
                                    </LiftedLabel>
                                    <LiftedInput
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
                                    <LiftedInputError message={errors.title} />
                                </div>

                                <div className="grid gap-2">
                                    <LiftedLabel htmlFor="map-import-slug">
                                        {t(
                                            'settings.world_builder.import.slug',
                                            'Slug (optional)',
                                        )}
                                    </LiftedLabel>
                                    <LiftedInput
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
                                    <LiftedInputError message={errors.slug} />
                                </div>
                            </div>
                        ) : null}

                        <LiftedDialogFooter>
                            <LiftedButton
                                onClick={() => setOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                {t(
                                    'settings.world_builder.import.cancel',
                                    'Cancel',
                                )}
                            </LiftedButton>
                            <LiftedButton
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
                            </LiftedButton>
                        </LiftedDialogFooter>
                    </form>
                </LiftedDialogContent>
            </LiftedDialog>
        </>
    );
}

export function LiftedWorldBuilderWorldImportDialog({
    onCreated,
}: {
    onCreated: (mapIds: string[]) => void;
}) {
    return <LiftedWorldBuilderImportDialog onCreated={onCreated} scope="world" />;
}

export function LiftedWorldBuilderMapImportDialog({
    onCreated,
}: {
    onCreated: (mapId: string) => void;
}) {
    return (
        <LiftedWorldBuilderImportDialog
            onCreated={(mapIds) => {
                if (mapIds[0]) {
                    onCreated(mapIds[0]);
                }
            }}
            scope="map"
        />
    );
}
