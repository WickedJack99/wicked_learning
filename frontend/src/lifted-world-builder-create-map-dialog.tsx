import { Map as MapIcon } from 'lucide-react';
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

type CreateMapErrors = Record<string, string>;

/**
 * Direct lift of the create-map dialog in
 * main:resources/js/pages/settings/worlds/index.tsx. Inertia's form post and
 * redirect are replaced only by the existing Rust command and `onCreated`
 * navigation adapter.
 */
export function LiftedWorldBuilderCreateMapDialog({
    onCreated,
}: {
    onCreated: (mapId: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createErrors, setCreateErrors] = useState<CreateMapErrors>({});
    const [createForm, setCreateForm] = useState({
        description: '',
        slug: '',
        title: '',
    });

    const resetCreateForm = () => {
        setCreateErrors({});
        setCreateForm({
            description: '',
            slug: '',
            title: '',
        });
    };

    const createMap = async () => {
        setCreating(true);
        setCreateErrors({});

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps',
                {
                    body: {
                        description:
                            createForm.description.trim() === ''
                                ? null
                                : createForm.description,
                        slug:
                            createForm.slug.trim() === ''
                                ? null
                                : createForm.slug,
                        title: createForm.title,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data) {
                setCreateErrors({
                    title:
                        response.status === 400
                            ? 'Use a title, a lowercase slug, and a description within the shown limits.'
                            : 'The map could not be created. Refresh the World Builder and try again.',
                });
                return;
            }

            setOpen(false);
            onCreated(data.map_id);
        } catch {
            setCreateErrors({
                title:
                    'The map could not be created. Check your connection and try again.',
            });
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            <LiftedButton
                className="mt-4 w-full bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_86%,white)]"
                onClick={() => {
                    resetCreateForm();
                    setOpen(true);
                }}
                type="button"
            >
                <MapIcon className="size-4" />
                Create world node
            </LiftedButton>

            <LiftedDialog onOpenChange={setOpen} open={open}>
                <LiftedDialogContent className="sm:max-w-xl">
                    <LiftedDialogHeader>
                        <LiftedDialogTitle>Create world node</LiftedDialogTitle>
                        <LiftedDialogDescription>
                            Add a new map to this world graph. It can stay
                            unlinked until you create portal tiles for it.
                        </LiftedDialogDescription>
                    </LiftedDialogHeader>

                    <form
                        className="grid gap-4"
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault();
                            void createMap();
                        }}
                    >
                        <div className="grid gap-2">
                            <LiftedLabel htmlFor="map-title">Title</LiftedLabel>
                            <LiftedInput
                                id="map-title"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                placeholder="Astronomy Garden"
                                value={createForm.title}
                            />
                            <LiftedInputError message={createErrors.title} />
                        </div>

                        <div className="grid gap-2">
                            <LiftedLabel htmlFor="map-slug">Slug</LiftedLabel>
                            <LiftedInput
                                id="map-slug"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        slug: event.target.value,
                                    }))
                                }
                                placeholder="Generated from the title if empty"
                                value={createForm.slug}
                            />
                            <LiftedInputError message={createErrors.slug} />
                        </div>

                        <div className="grid gap-2">
                            <LiftedLabel htmlFor="map-description">
                                Description
                            </LiftedLabel>
                            <textarea
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_22%,transparent)] dark:border-white/10 dark:bg-slate-950 dark:text-white"
                                id="map-description"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                placeholder="What should admins know while preparing this map?"
                                value={createForm.description}
                            />
                            <LiftedInputError
                                message={createErrors.description}
                            />
                        </div>

                        <LiftedDialogFooter>
                            <LiftedButton
                                disabled={creating}
                                onClick={() => setOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </LiftedButton>
                            <LiftedButton disabled={creating} type="submit">
                                Create
                            </LiftedButton>
                        </LiftedDialogFooter>
                    </form>
                </LiftedDialogContent>
            </LiftedDialog>
        </>
    );
}
