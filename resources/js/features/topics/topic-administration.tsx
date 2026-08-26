import { Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical } from 'lucide-react';
import { useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { CreateTopicAreaForm, TopicAreaEditor } from './topic-area-forms';
import { CreateTopicForm, TopicList } from './topic-forms';
import type { AdminTopicArea } from './types';

export function TopicAdministration({ areas }: { areas: AdminTopicArea[] }) {
    const t = usePlatformTranslation();
    const [draggingAreaId, setDraggingAreaId] = useState<number | null>(null);

    const moveArea = (areaId: number, targetIndex: number) => {
        const areaIds = areas.map((area) => area.id);
        const sourceIndex = areaIds.indexOf(areaId);

        if (
            sourceIndex < 0 ||
            targetIndex < 0 ||
            targetIndex >= areaIds.length ||
            sourceIndex === targetIndex
        ) {
            return;
        }

        areaIds.splice(sourceIndex, 1);
        areaIds.splice(targetIndex, 0, areaId);
        router.patch(
            '/admin/topic-areas/reorder',
            { area_ids: areaIds },
            { preserveScroll: true },
        );
    };

    const dropArea = (event: DragEvent<HTMLElement>, targetIndex: number) => {
        event.preventDefault();

        if (draggingAreaId !== null) {
            moveArea(draggingAreaId, targetIndex);
        }

        setDraggingAreaId(null);
    };

    return (
        <main className="h-full overflow-y-auto bg-slate-50 text-slate-950 dark:bg-[#08111b] dark:text-slate-100">
            <LearningDeskHeader />
            <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
                <Link
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
                    href="/topics"
                >
                    <ArrowLeft className="size-4" />
                    {t('topics.admin.back', 'Back to topics')}
                </Link>

                <header className="mt-7 border-b border-slate-200 pb-7 dark:border-white/10">
                    <p className="text-xs font-semibold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">
                        {t('topics.admin.eyebrow', 'Content administration')}
                    </p>
                    <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
                        {t('topics.admin.title', 'Topic structure')}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'topics.admin.description',
                            'Drag broad areas into the desired order. Topics and subtopics are displayed alphabetically inside their area.',
                        )}
                    </p>
                </header>

                <CreateTopicAreaForm
                    areas={areas}
                    key={areas.map((area) => area.id).join('-')}
                />

                <div className="mt-12 space-y-8">
                    {areas.map((area, index) => (
                        <section
                            className="border-y border-slate-200 bg-white/40 dark:border-white/10 dark:bg-white/[0.015]"
                            key={area.id}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => dropArea(event, index)}
                        >
                            <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                                <button
                                    aria-label={t(
                                        'topics.admin.drag_area',
                                        'Drag to reorder area',
                                    )}
                                    className="mt-0.5 hidden size-7 shrink-0 cursor-grab place-items-center text-slate-400 active:cursor-grabbing sm:grid"
                                    draggable
                                    onDragEnd={() => setDraggingAreaId(null)}
                                    onDragStart={() =>
                                        setDraggingAreaId(area.id)
                                    }
                                    type="button"
                                >
                                    <GripVertical className="size-5" />
                                </button>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-xl font-medium">
                                        {area.title}
                                    </h2>
                                    {area.description ? (
                                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                            {area.description}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <MoveAreaButton
                                        disabled={index === 0}
                                        label={t(
                                            'topics.admin.move_up',
                                            'Move area up',
                                        )}
                                        onClick={() =>
                                            moveArea(area.id, index - 1)
                                        }
                                    >
                                        <ArrowUp className="size-4" />
                                    </MoveAreaButton>
                                    <MoveAreaButton
                                        disabled={index === areas.length - 1}
                                        label={t(
                                            'topics.admin.move_down',
                                            'Move area down',
                                        )}
                                        onClick={() =>
                                            moveArea(area.id, index + 1)
                                        }
                                    >
                                        <ArrowDown className="size-4" />
                                    </MoveAreaButton>
                                </div>
                            </div>

                            <TopicAreaEditor area={area} />
                            <TopicList area={area} />
                            <CreateTopicForm area={area} />
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}

function MoveAreaButton({
    children,
    disabled,
    label,
    onClick,
}: {
    children: ReactNode;
    disabled: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            aria-label={label}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 dark:border-white/10 dark:text-slate-400"
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            {children}
        </button>
    );
}
