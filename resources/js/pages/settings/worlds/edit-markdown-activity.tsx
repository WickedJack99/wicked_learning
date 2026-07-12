import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { activityFormPayload } from './activity-form-payload';
import { activityFormFromActivity } from './activity-form-state';
import type { ActivityForm, ActivitySummary } from './edit-node-activity-types';
import { MarkdownActivityFields } from './markdown-activity-fields';
import { useNodeImageUpload } from './use-node-image-upload';

type MarkdownActivityPayload = {
    activity: ActivitySummary;
    map: {
        id: number;
        slug: string;
        title: string;
    };
    node: {
        id: number;
        slug: string;
        title: string;
    };
    world: {
        id: number;
        slug: string;
        title: string;
    };
};

export default function EditMarkdownActivity({
    markdownActivity,
}: {
    markdownActivity: MarkdownActivityPayload;
}) {
    const [form, setForm] = useState<ActivityForm>(() =>
        activityFormFromActivity(markdownActivity.activity, 'markdown'),
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const { imageUploadErrors, uploadNodeImage, uploadingImageKey } =
        useNodeImageUpload();

    const save = () => {
        setSaving(true);
        setSaved(false);

        router.patch(
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
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => {
                    setErrors({});
                    setSaved(true);
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
                                asChild
                                className="mb-2"
                                size="sm"
                                variant="ghost"
                            >
                                <Link
                                    href={`/settings/worlds/nodes/${markdownActivity.node.id}/activities`}
                                >
                                    <ArrowLeft className="size-4" />
                                    Back to node
                                </Link>
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                {markdownActivity.map.title} /{' '}
                                {markdownActivity.node.title}
                            </p>
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                {markdownActivity.activity.title} pages
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            {saved ? (
                                <p className="text-sm text-cyan-700 dark:text-teal-200">
                                    Saved
                                </p>
                            ) : null}
                            <Button
                                disabled={saving}
                                onClick={save}
                                type="button"
                            >
                                <Save className="size-4" />
                                Save pages
                            </Button>
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
                            uploadingImageKey={uploadingImageKey}
                        />
                    </section>
                </div>
            </main>
        </>
    );
}
