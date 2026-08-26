import { Head } from '@inertiajs/react';
import { TopicDetail } from '@/features/topics/topic-detail';
import type { TopicDetail as TopicDetailData } from '@/features/topics/types';

export default function ShowTopic({ topic }: { topic: TopicDetailData }) {
    return (
        <>
            <Head title={topic.title} />
            <TopicDetail topic={topic} />
        </>
    );
}
