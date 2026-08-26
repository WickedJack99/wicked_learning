import { useForm } from '@inertiajs/react';
import { Check, ChevronDown, Plus, Save } from 'lucide-react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import {
    TopicAdminField,
    topicAdminInputClass,
    topicAdminPrimaryButtonClass,
    topicAdminSecondaryButtonClass,
} from './topic-admin-controls';
import type { AdminTopic, AdminTopicArea } from './types';

type TopicFormData = {
    content: string;
    description: string;
    is_published: boolean;
    parent_id: number | null;
    title: string;
};

type SetTopicData = ReturnType<typeof useForm<TopicFormData>>['setData'];

export function TopicList({ area }: { area: AdminTopicArea }) {
    const t = usePlatformTranslation();

    if (area.topics.length === 0) {
        return (
            <p className="border-t border-slate-200/70 px-4 py-5 text-sm text-slate-500 sm:px-5 dark:border-white/8 dark:text-slate-400">
                {t('topics.admin.no_topics', 'No topics in this area yet.')}
            </p>
        );
    }

    return (
        <div className="border-t border-slate-200/70 px-4 sm:px-5 dark:border-white/8">
            {area.topics.map((topic) => (
                <TopicEditor area={area} key={topic.id} topic={topic} />
            ))}
        </div>
    );
}

export function CreateTopicForm({ area }: { area: AdminTopicArea }) {
    const t = usePlatformTranslation();
    const form = useForm<TopicFormData>({
        content: '',
        description: '',
        is_published: true,
        parent_id: null,
        title: '',
    });

    return (
        <details className="border-t border-slate-200/70 px-4 py-4 sm:px-5 dark:border-white/8">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                <Plus className="size-4" />
                {t('topics.admin.add_topic', 'Add topic or subtopic')}
            </summary>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(`/admin/topic-areas/${area.id}/topics`, {
                        preserveScroll: true,
                        onSuccess: () => form.reset(),
                    });
                }}
            >
                <TopicFields
                    area={area}
                    data={form.data}
                    setData={form.setData}
                />
                <button
                    className={`${topicAdminPrimaryButtonClass} mt-4`}
                    disabled={form.processing}
                    type="submit"
                >
                    <Plus className="size-4" />
                    {t('topics.admin.create_topic', 'Create topic')}
                </button>
            </form>
        </details>
    );
}

function TopicEditor({
    area,
    topic,
}: {
    area: AdminTopicArea;
    topic: AdminTopic;
}) {
    const t = usePlatformTranslation();
    const form = useForm<TopicFormData>({
        content: topic.content ?? '',
        description: topic.description ?? '',
        is_published: topic.isPublished,
        parent_id: topic.parentId,
        title: topic.title,
    });

    return (
        <details className="border-b border-slate-200/70 py-3 last:border-b-0 dark:border-white/8">
            <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {topic.parentId ? '↳ ' : ''}
                    {topic.title}
                </span>
                <TopicState isPublished={topic.isPublished} />
                <ChevronDown className="size-4 text-slate-400" />
            </summary>
            <TopicFields
                area={area}
                data={form.data}
                excludeTopicId={topic.id}
                setData={form.setData}
            />
            <button
                className={`${topicAdminSecondaryButtonClass} mt-4`}
                disabled={form.processing}
                onClick={() =>
                    form.patch(
                        `/admin/topic-areas/${area.id}/topics/${topic.id}`,
                        { preserveScroll: true },
                    )
                }
                type="button"
            >
                <Save className="size-4" />
                {t('topics.admin.save_topic', 'Save topic')}
            </button>
        </details>
    );
}

function TopicState({ isPublished }: { isPublished: boolean }) {
    const t = usePlatformTranslation();

    return isPublished ? (
        <span className="inline-flex items-center gap-1 text-xs text-cyan-700 dark:text-cyan-400">
            <Check className="size-3.5" />
            {t('topics.admin.published', 'Published')}
        </span>
    ) : (
        <span className="text-xs text-slate-400">
            {t('topics.admin.draft', 'Draft')}
        </span>
    );
}

function TopicFields({
    area,
    data,
    excludeTopicId,
    setData,
}: {
    area: AdminTopicArea;
    data: TopicFormData;
    excludeTopicId?: number;
    setData: SetTopicData;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TopicAdminField
                label={t('topics.admin.topic_title', 'Topic title')}
            >
                <input
                    className={topicAdminInputClass}
                    onChange={(event) => setData('title', event.target.value)}
                    required
                    value={data.title}
                />
            </TopicAdminField>
            <TopicAdminField
                label={t('topics.admin.parent_topic', 'Parent topic')}
            >
                <select
                    className={topicAdminInputClass}
                    onChange={(event) =>
                        setData(
                            'parent_id',
                            event.target.value
                                ? Number(event.target.value)
                                : null,
                        )
                    }
                    value={data.parent_id ?? ''}
                >
                    <option value="">
                        {t('topics.admin.top_level', 'Top-level topic')}
                    </option>
                    {area.topics
                        .filter(
                            (topic) =>
                                topic.id !== excludeTopicId &&
                                topic.parentId === null,
                        )
                        .map((topic) => (
                            <option key={topic.id} value={topic.id}>
                                {topic.title}
                            </option>
                        ))}
                </select>
            </TopicAdminField>
            <TopicAdminField
                className="sm:col-span-2"
                label={t('topics.admin.topic_description', 'Introduction')}
            >
                <textarea
                    className={`${topicAdminInputClass} min-h-20 resize-y py-3`}
                    onChange={(event) =>
                        setData('description', event.target.value)
                    }
                    value={data.description}
                />
            </TopicAdminField>
            <TopicAdminField
                className="sm:col-span-2"
                label={t(
                    'topics.admin.topic_content',
                    'Topic content (Markdown)',
                )}
            >
                <textarea
                    className={`${topicAdminInputClass} min-h-36 resize-y py-3 font-mono text-sm`}
                    onChange={(event) => setData('content', event.target.value)}
                    value={data.content}
                />
            </TopicAdminField>
            <label className="flex items-center gap-3 text-sm text-slate-600 sm:col-span-2 dark:text-slate-300">
                <input
                    checked={data.is_published}
                    className="size-4 rounded border-slate-400 accent-violet-600 dark:border-white/35"
                    onChange={(event) =>
                        setData('is_published', event.target.checked)
                    }
                    type="checkbox"
                />
                {t(
                    'topics.admin.publish_topic',
                    'Publish this topic for learners',
                )}
            </label>
        </div>
    );
}
