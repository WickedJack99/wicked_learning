import { router } from '@inertiajs/react';
import { Copy } from 'lucide-react';
import { useState } from 'react';
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
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type DuplicateMapErrors = Record<string, string>;

export function DuplicateMapDialog({
    mapId,
    mapTitle,
}: {
    mapId: number;
    mapTitle: string;
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

    const duplicate = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post(`/settings/worlds/maps/${mapId}/duplicate`, form, {
            preserveScroll: true,
            onError: (nextErrors) => setErrors(nextErrors),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <>
            <Button
                className="mt-2 w-full"
                onClick={openDialog}
                type="button"
                variant="outline"
            >
                <Copy className="size-4" />
                {t('settings.world_builder.duplicate.open', 'Duplicate map')}
            </Button>

            <Dialog onOpenChange={setOpen} open={open}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'settings.world_builder.duplicate.title',
                                'Duplicate authored map',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'settings.world_builder.duplicate.description',
                                'Create a new map in this world with the authored activities, routes, assets, and companion assignments copied over.',
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="grid gap-4" onSubmit={duplicate}>
                        <div className="grid gap-2">
                            <Label htmlFor={`duplicate-map-title-${mapId}`}>
                                {t(
                                    'settings.world_builder.duplicate.name',
                                    'New map title',
                                )}
                            </Label>
                            <Input
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
                            <InputError message={errors.title} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor={`duplicate-map-slug-${mapId}`}>
                                {t(
                                    'settings.world_builder.duplicate.slug',
                                    'Slug (optional)',
                                )}
                            </Label>
                            <Input
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
                            <InputError message={errors.slug} />
                        </div>

                        <p className="text-xs leading-5 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.world_builder.duplicate.boundaries',
                                'Learner history, map history, review runs, and editor groups are not copied. Activities return to authoring review, while portals leaving this map keep their existing destinations.',
                            )}
                        </p>

                        <DialogFooter>
                            <Button
                                onClick={() => setOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                {t(
                                    'settings.world_builder.duplicate.cancel',
                                    'Cancel',
                                )}
                            </Button>
                            <Button disabled={processing} type="submit">
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
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
