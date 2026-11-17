import { Head } from '@inertiajs/react';
import { TopicAdministration } from '@/features/topics/topic-administration';
import type { AdminTopicArea } from '@/features/topics/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export default function AdminTopics({ areas }: { areas: AdminTopicArea[] }) {
    const t = usePlatformTranslation();

    return (
        <>
            <Head title={t('topics.admin.title', 'Topic structure')} />
            <TopicAdministration areas={areas} />
        </>
    );
}
