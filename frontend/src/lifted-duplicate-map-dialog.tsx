import { Copy } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { apiClient, getCsrfToken } from './api/client';
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
import { usePlatformTranslation } from './original-platform-translation';

type DuplicateMapErrors = Record<string, string>;

/**
 * Direct lift of main:resources/js/features/settings/duplicate-map-dialog.tsx.
 * The Inertia post/error callbacks are the sole Rust transport seam.
 */
export function LiftedDuplicateMapDialog({
    mapId,
    mapTitle,
    onDuplicated,
}: {
    mapId: string;
    mapTitle: string;
    onDuplicated: (mapId: string) => void;
}) {
    const t = usePlatformTranslation();
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<DuplicateMapErrors>({});
    const [form, setForm] = useState({
        slug: '',
        title: `${mapTitle} copy`,
    });

    const openDialog = () => {
        setForm({ slug: '', title: `${mapTitle} copy` });
        setErrors({});
        setOpen(true);
    };

    const duplicate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps/{map_id}/duplicate',
                {
                    body: {
                        slug: form.slug.trim() === '' ? null : form.slug,
                        title: form.title,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: mapId },
                    },
                },
            );
            if (!response.ok || !data) {
                setErrors({
                    title: t(
                        'settings.world_builder.duplicate.error',
                        'The map could not be duplicated. Refresh the World Builder and try again.',
                    ),
                });
                return;
            }

            setOpen(false);
            onDuplicated(data.map_id);
        } catch {
            setErrors({
                title: t(
                    'settings.world_builder.duplicate.error',
                    'The map could not be duplicated. Refresh the World Builder and try again.',
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
                data-wl-id="settings.world-builder.map-duplicate.open"
                onClick={openDialog}
                type="button"
                variant="outline"
            >
                <Copy className="size-4" />
                {t('settings.world_builder.duplicate.open', 'Duplicate map')}
            </LiftedButton>

            <LiftedDialog onOpenChange={setOpen} open={open}>
                <LiftedDialogContent className="sm:max-w-lg">
                    <LiftedDialogHeader>
                        <LiftedDialogTitle>
                            {t(
                                'settings.world_builder.duplicate.title',
                                'Duplicate authored map',
                            )}
                        </LiftedDialogTitle>
                        <LiftedDialogDescription>
                            {t(
                                'settings.world_builder.duplicate.description',
                                'Create a new map in this world with the authored activities, routes, assets, and companion assignments copied over.',
                            )}
                        </LiftedDialogDescription>
                    </LiftedDialogHeader>

                    <form className="grid gap-4" onSubmit={duplicate}>
                        <div className="grid gap-2">
                            <LiftedLabel htmlFor={`duplicate-map-title-${mapId}`}>
                                {t(
                                    'settings.world_builder.duplicate.name',
                                    'New map title',
                                )}
                            </LiftedLabel>
                            <LiftedInput
                                id={`duplicate-map-title-${mapId}`}
                                maxLength={120}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                value={form.title}
                            />
                            <LiftedInputError message={errors.title} />
                        </div>

                        <div className="grid gap-2">
                            <LiftedLabel htmlFor={`duplicate-map-slug-${mapId}`}>
                                {t(
                                    'settings.world_builder.duplicate.slug',
                                    'Slug (optional)',
                                )}
                            </LiftedLabel>
                            <LiftedInput
                                id={`duplicate-map-slug-${mapId}`}
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

                        <p className="text-xs leading-5 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.world_builder.duplicate.boundaries',
                                'Learner history, map history, review runs, and editor groups are not copied. Activities return to authoring review, while portals leaving this map keep their existing destinations.',
                            )}
                        </p>

                        <LiftedDialogFooter>
                            <LiftedButton
                                onClick={() => setOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                {t(
                                    'settings.world_builder.duplicate.cancel',
                                    'Cancel',
                                )}
                            </LiftedButton>
                            <LiftedButton disabled={processing} type="submit">
                                <Copy className="size-4" />
                                {processing
                                    ? t(
                                          'settings.world_builder.duplicate.creating',
                                          'Duplicating...',
                                      )
                                    : t(
                                          'settings.world_builder.duplicate.submit',
                                          'Duplicate map',
                                      )}
                            </LiftedButton>
                        </LiftedDialogFooter>
                    </form>
                </LiftedDialogContent>
            </LiftedDialog>
        </>
    );
}
