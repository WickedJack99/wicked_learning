import { router } from '@inertiajs/react';
import { Eye, EyeOff, MessageSquareText, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    SettingsConfigurationLayout,
    SettingsContentPane,
    SettingsPanelHeader,
    SettingsSectionNavigation,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type LearnerMessageModerationTopic = {
    id: number;
    mapAsset: {
        id: number;
        mapTitle: string;
        title: string;
    };
    messages: Array<{
        author: { email: string; id: number; name: string };
        body: string;
        createdAt: string | null;
        hiddenAt: string | null;
        hiddenBy: { id: number; name: string } | null;
        id: number;
    }>;
    title: string;
};

export function LearnerMessageModerationPanel({
    topics,
}: {
    topics: LearnerMessageModerationTopic[];
}) {
    const t = usePlatformTranslation();
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
        topics[0]?.id.toString() ?? null,
    );
    const selectedTopic =
        topics.find((topic) => topic.id.toString() === selectedTopicId) ??
        topics[0];
    const items = useMemo(
        () =>
            topics.map(
                (topic): SettingsNavigationItem<string> => ({
                    description: `${topic.mapAsset.mapTitle} · ${t(
                        topic.messages.length === 1
                            ? 'settings.learner_messages.count_one'
                            : 'settings.learner_messages.count_many',
                        topic.messages.length === 1
                            ? ':count message'
                            : ':count messages',
                        { count: topic.messages.length },
                    )}`,
                    icon: MessageSquareText,
                    key: topic.id.toString(),
                    label: `${topic.mapAsset.title} — ${topic.title}`,
                }),
            ),
        [t, topics],
    );

    if (!selectedTopic) {
        return (
            <section className="grid h-full place-items-center p-6 text-center">
                <div className="max-w-lg">
                    <MessageSquareText className="mx-auto size-8 text-slate-400" />
                    <h2 className="mt-4 text-lg font-semibold">
                        {t(
                            'settings.learner_messages.empty_title',
                            'No learner messages yet',
                        )}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.learner_messages.empty_description',
                            'Messages appear here after learners contribute through a Message prompt activity.',
                        )}
                    </p>
                </div>
            </section>
        );
    }

    const headerItem: SettingsNavigationItem<'learner-messages'> = {
        description: t(
            'settings.learner_messages.description',
            'Review short learner contributions grouped by MapAsset and topic.',
        ),
        icon: MessageSquareText,
        key: 'learner-messages',
        label: t('settings.learner_messages.eyebrow', 'Learner messages'),
    };

    return (
        <SettingsConfigurationLayout
            className="h-full gap-0"
            contentClassName="min-h-0 overflow-hidden"
            sidebar={
                <SettingsSidebar>
                    <SettingsSectionNavigation
                        activeSection={selectedTopic.id.toString()}
                        ariaLabel={t(
                            'settings.learner_messages.topic_navigation',
                            'Message topics',
                        )}
                        items={items}
                        onChange={setSelectedTopicId}
                    />
                </SettingsSidebar>
            }
        >
            <SettingsContentPane>
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="shrink-0">
                        <SettingsPanelHeader
                            description={`${selectedTopic.mapAsset.mapTitle} · ${selectedTopic.title}`}
                            item={headerItem}
                            title={selectedTopic.mapAsset.title}
                        />
                    </div>

                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-3">
                            {selectedTopic.messages.map((message) => (
                                <article
                                    className="border-b border-[var(--settings-border-color)] px-1 py-4 first:pt-0"
                                    key={message.id}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold">
                                                {message.author.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {message.author.email}
                                                {message.createdAt
                                                    ? ` · ${new Date(message.createdAt).toLocaleString()}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() =>
                                                    router.patch(
                                                        `/settings/learning-support/messages/${message.id}/visibility`,
                                                        {
                                                            hidden:
                                                                message.hiddenAt ===
                                                                null,
                                                        },
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                                size="sm"
                                                type="button"
                                                variant="outline"
                                            >
                                                {message.hiddenAt ? (
                                                    <Eye className="size-4" />
                                                ) : (
                                                    <EyeOff className="size-4" />
                                                )}
                                                {message.hiddenAt
                                                    ? t(
                                                          'settings.learner_messages.show',
                                                          'Show',
                                                      )
                                                    : t(
                                                          'settings.learner_messages.hide',
                                                          'Hide',
                                                      )}
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            t(
                                                                'settings.learner_messages.delete_confirm',
                                                                'Permanently delete this learner message?',
                                                            ),
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/settings/learning-support/messages/${message.id}`,
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        );
                                                    }
                                                }}
                                                size="sm"
                                                type="button"
                                                variant="destructive"
                                            >
                                                <Trash2 className="size-4" />
                                                {t(
                                                    'settings.learner_messages.delete',
                                                    'Delete',
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    <p
                                        className={`mt-3 max-w-3xl text-sm leading-6 ${message.hiddenAt ? 'text-slate-400 line-through opacity-70' : ''}`}
                                    >
                                        {message.body}
                                    </p>
                                    {message.hiddenAt ? (
                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                                            {t(
                                                'settings.learner_messages.hidden_note',
                                                'Hidden from learners',
                                            )}
                                            {message.hiddenBy
                                                ? ` · ${message.hiddenBy.name}`
                                                : ''}
                                        </p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </SettingsContentPane>
        </SettingsConfigurationLayout>
    );
}
