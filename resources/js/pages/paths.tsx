import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Route } from 'lucide-react';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export default function Paths() {
    const t = usePlatformTranslation();

    return (
        <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#08111b] dark:text-slate-100">
            <Head title={t('paths.title', 'Paths')} />
            <LearningDeskHeader />
            <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
                <p className="text-xs font-semibold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">
                    {t('paths.eyebrow', 'Curated learning')}
                </p>
                <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
                    {t('paths.title', 'Paths')}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t(
                        'paths.description',
                        'Paths will combine topics with deliberately prepared activities and other learning material into guided sequences.',
                    )}
                </p>

                <section className="mt-12 border-y border-slate-200 py-10 dark:border-white/10">
                    <Route className="size-7 text-cyan-600 dark:text-cyan-400" />
                    <h2 className="mt-5 text-xl font-medium">
                        {t('paths.empty.title', 'No curated paths yet')}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'paths.empty.description',
                            'The navigation is ready; the path authoring model can be added next without coupling it to the topic hierarchy.',
                        )}
                    </p>
                    <Link
                        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300"
                        href="/topics"
                    >
                        {t('paths.empty.action', 'Browse topics instead')}
                        <ArrowRight className="size-4" />
                    </Link>
                </section>
            </div>
        </main>
    );
}
