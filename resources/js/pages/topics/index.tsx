import { Head } from '@inertiajs/react';
import { TopicDirectory } from '@/features/topics/topic-directory';
import type { TopicArea, TopicAreaOption } from '@/features/topics/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type TopicsPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

export default function Topics({
    areaOptions,
    canManageTopics,
    pagination,
    search,
    selectedArea,
}: {
    areaOptions: TopicAreaOption[];
    canManageTopics: boolean;
    pagination: TopicsPagination;
    search: string;
    selectedArea: TopicArea | null;
}) {
    const t = usePlatformTranslation();

    return (
        <>
            <Head title={t('topics.title', 'Topics')} />
            <TopicDirectory
                areaOptions={areaOptions}
                canManageTopics={canManageTopics}
                pagination={pagination}
                search={search}
                selectedArea={selectedArea}
            />
        </>
    );
}
