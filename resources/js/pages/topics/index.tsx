import { Head } from '@inertiajs/react';
import { TopicDirectory } from '@/features/topics/topic-directory';
import type { TopicArea } from '@/features/topics/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export default function Topics({
    areas,
    canManageTopics,
}: {
    areas: TopicArea[];
    canManageTopics: boolean;
}) {
    const t = usePlatformTranslation();

    return (
        <>
            <Head title={t('topics.title', 'Topics')} />
            <TopicDirectory areas={areas} canManageTopics={canManageTopics} />
        </>
    );
}
