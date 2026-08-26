import { useForm } from '@inertiajs/react';
import { ChevronDown, Plus, Save } from 'lucide-react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import {
    TopicAdminField,
    topicAdminInputClass,
    topicAdminPrimaryButtonClass,
    topicAdminSecondaryButtonClass,
} from './topic-admin-controls';
import type { AdminTopicArea } from './types';

export function CreateTopicAreaForm({ areas }: { areas: AdminTopicArea[] }) {
    const t = usePlatformTranslation();
    const form = useForm({
        after_area_id: areas.at(-1)?.id ?? null,
        description: '',
        title: '',
    });

    return (
        <form
            className="mt-8 grid gap-4 border-b border-slate-200 pb-8 lg:grid-cols-[1fr_1.4fr_0.8fr_auto] lg:items-end dark:border-white/10"
            onSubmit={(event) => {
                event.preventDefault();
                form.post('/admin/topic-areas', {
                    preserveScroll: true,
                    onSuccess: () => form.reset('title', 'description'),
                });
            }}
        >
            <TopicAdminField label={t('topics.admin.area_title', 'New area')}>
                <input
                    className={topicAdminInputClass}
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                    placeholder={t(
                        'topics.admin.area_title_placeholder',
                        'e.g. Medicine',
                    )}
                    required
                    value={form.data.title}
                />
            </TopicAdminField>
            <TopicAdminField
                label={t('topics.admin.area_description', 'Short description')}
            >
                <input
                    className={topicAdminInputClass}
                    onChange={(event) =>
                        form.setData('description', event.target.value)
                    }
                    placeholder={t(
                        'topics.admin.area_description_placeholder',
                        'What belongs to this broad area?',
                    )}
                    value={form.data.description}
                />
            </TopicAdminField>
            <TopicAdminField
                label={t('topics.admin.insert_after', 'Insert after')}
            >
                <select
                    className={topicAdminInputClass}
                    onChange={(event) =>
                        form.setData(
                            'after_area_id',
                            event.target.value
                                ? Number(event.target.value)
                                : null,
                        )
                    }
                    value={form.data.after_area_id ?? ''}
                >
                    <option value="">
                        {t('topics.admin.at_start', 'At the beginning')}
                    </option>
                    {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                            {area.title}
                        </option>
                    ))}
                </select>
            </TopicAdminField>
            <button
                className={topicAdminPrimaryButtonClass}
                disabled={form.processing}
                type="submit"
            >
                <Plus className="size-4" />
                {t('topics.admin.add_area', 'Add area')}
            </button>
        </form>
    );
}

export function TopicAreaEditor({ area }: { area: AdminTopicArea }) {
    const t = usePlatformTranslation();
    const form = useForm({
        description: area.description ?? '',
        title: area.title,
    });

    return (
        <details className="border-t border-slate-200/70 px-4 py-3 sm:px-5 dark:border-white/8">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                {t('topics.admin.edit_area', 'Edit area details')}
                <ChevronDown className="size-4" />
            </summary>
            <form
                className="mt-4 grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.patch(`/admin/topic-areas/${area.id}`, {
                        preserveScroll: true,
                    });
                }}
            >
                <TopicAdminField
                    label={t('topics.admin.area_name', 'Area name')}
                >
                    <input
                        className={topicAdminInputClass}
                        onChange={(event) =>
                            form.setData('title', event.target.value)
                        }
                        required
                        value={form.data.title}
                    />
                </TopicAdminField>
                <TopicAdminField
                    label={t(
                        'topics.admin.area_description',
                        'Short description',
                    )}
                >
                    <input
                        className={topicAdminInputClass}
                        onChange={(event) =>
                            form.setData('description', event.target.value)
                        }
                        value={form.data.description}
                    />
                </TopicAdminField>
                <button
                    className={`${topicAdminSecondaryButtonClass} sm:col-span-2 sm:w-fit`}
                    disabled={form.processing}
                    type="submit"
                >
                    <Save className="size-4" />
                    {t('topics.admin.save_area', 'Save area')}
                </button>
            </form>
        </details>
    );
}
