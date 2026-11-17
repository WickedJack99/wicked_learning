import { Head } from '@inertiajs/react';
import { LearningDesk } from '@/features/home/learning-desk';
import type { LearningDeskData } from '@/features/home/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export default function Home({ desk }: { desk: LearningDeskData }) {
    const t = usePlatformTranslation();

    return (
        <>
            <Head title={t('home.learning_desk.title', 'Learning desk')} />
            <LearningDesk desk={desk} />
        </>
    );
}
