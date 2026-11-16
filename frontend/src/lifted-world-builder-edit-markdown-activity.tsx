import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LiftedButton as Button } from './lifted-button';
import { LiftedInputError as InputError } from './lifted-input-error';
import { activityFormPayload } from './lifted-world-builder-activity-form-payload';
import { activityFormFromActivity } from './lifted-world-builder-activity-form-state';
import type { ActivityForm, ActivitySummary } from './lifted-world-builder-edit-node-activity-types';
import {
    MarkdownActivityFields,
    type LiftedMarkdownGraphTransport,
} from './lifted-world-builder-markdown-activity-fields';
import { useNodeImageUpload } from './lifted-use-node-image-upload';

type SourceVisitOptions = {
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
    onSuccess?: (page: unknown) => void;
    preserveScroll?: boolean;
};

export type LiftedMarkdownTransport = LiftedMarkdownGraphTransport & {
    patch: (
        url: string,
        body: unknown,
        options?: SourceVisitOptions,
    ) => void | Promise<void>;
};

function Head({ title }: { title: string }) {
    useEffect(() => {
        document.title = title;
    }, [title]);

    return null;
}

export type LiftedMarkdownActivityPayload = {
    activity: Pick<
        ActivitySummary,
        | 'config'
        | 'id'
        | 'introduction'
        | 'portalLink'
        | 'question'
        | 'slug'
        | 'title'
        | 'type'
        | 'updatedAt'
    >;
    map: {
        id: string;
        slug: string;
        title: string;
    };
    node: {
        id: string;
        slug: string;
        title: string;
    };
    world: {
        id: string;
        slug: string;
        title: string;
    };
};

export default function EditMarkdownActivity({
    markdownActivity,
    onBack,
    transport,
}: {
    markdownActivity: LiftedMarkdownActivityPayload;
    onBack: () => void;
    transport: LiftedMarkdownTransport;
}) {
    const [form, setForm] = useState<ActivityForm>(() =>
        activityFormFromActivity(markdownActivity.activity, 'markdown'),
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const { imageUploadErrors, uploadNodeImage, uploadingImageKey } =
        useNodeImageUpload(markdownActivity.map.id);

    const save = () => {
        setSaving(true);
        setSaved(false);

        transport.patch(
            `/settings/worlds/activities/${markdownActivity.activity.id}`,
            {
                ...activityFormPayload({
                    ...form,
                    type: 'markdown',
                }),
                return_to_markdown: true,
            },
            {
                preserveScroll: true,
                onError: (nextErrors: Record<string, string>) =>
                    setErrors(nextErrors),
                onSuccess: (page: unknown) => {
                    setErrors({});
                    setSaved(true);
                    const props = (page as {
                        props?: {
                            markdownActivity?: {
                                activity?: { updatedAt?: string | null };
                            };
                        };
                    }).props;
                    const updatedAt =
                        props?.markdownActivity?.activity?.updatedAt;

                    if (updatedAt) {
                        setForm((current) => ({
                            ...current,
                            updated_at: updatedAt,
                        }));
                    }
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <>
            <Head
                title={`Markdown pages for ${markdownActivity.activity.title}`}
            />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="flex h-full flex-col px-4 pt-4 pb-24">
                    <header className="mb-3 flex shrink-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                            <Button
                                className="mb-2"
                                onClick={onBack}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                <ArrowLeft className="size-4" />
                                Back to MapAsset
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                {markdownActivity.map.title} /{' '}
                                {markdownActivity.node.title}
                            </p>
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                {markdownActivity.activity.title} pages
                            </h1>
                        </div>
                    </header>

                    <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                        <MarkdownActivityFields
                            activityId={markdownActivity.activity.id}
                            errors={errors}
                            form={form}
                            imageUploadErrors={imageUploadErrors}
                            onChange={setForm}
                            onUpload={uploadNodeImage}
                            transport={transport}
                            uploadingImageKey={uploadingImageKey}
                        />
                    </section>
                    <footer className="flex shrink-0 items-center justify-between border-t border-[var(--settings-border-color)] py-4">
                        <div>
                            {errors.updated_at ? (
                                <InputError message={errors.updated_at} />
                            ) : saved ? (
                                <p className="text-sm text-[var(--settings-accent)]">
                                    Saved
                                </p>
                            ) : null}
                        </div>
                        <Button disabled={saving} onClick={save} type="button">
                            <Save className="size-4" />
                            Save pages
                        </Button>
                    </footer>
                </div>
            </main>
        </>
    );
}
