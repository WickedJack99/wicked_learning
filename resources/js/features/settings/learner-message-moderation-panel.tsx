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
        audience: 'peers' | 'support' | string;
        author: { email: string; id: number; name: string };
        body: string;
        createdAt: string | null;
        hiddenAt: string | null;
        hiddenBy: { id: number; name: string } | null;
        id: number;
        responses: Array<{
            author: { email: string; id: number; name: string };
            body: string;
            createdAt: string | null;
            hiddenAt: string | null;
            hiddenBy: { id: number; name: string } | null;
            id: number;
            isHelpful: boolean;
            responseType: 'explanation' | 'example' | 'question' | null;
        }>;
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
                                        {message.audience === 'support' ? (
                                            <span className="rounded-full border border-amber-400/40 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-300/30 dark:text-amber-200">
                                                {t(
                                                    'settings.learner_messages.support_request',
                                                    'Support request',
                                                )}
                                            </span>
                                        ) : null}
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
                                    {message.responses.length > 0 ? (
                                        <div className="mt-4 grid gap-3 border-l-2 border-[var(--settings-border-color)] pl-4">
                                            {message.responses.map(
                                                (response) => (
                                                    <div
                                                        className="grid gap-2"
                                                        key={response.id}
                                                    >
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-semibold">
                                                                    {
                                                                        response
                                                                            .author
                                                                            .name
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {
                                                                        response
                                                                            .author
                                                                            .email
                                                                    }
                                                                    {response.createdAt
                                                                        ? ` · ${new Date(response.createdAt).toLocaleString()}`
                                                                        : ''}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    onClick={() =>
                                                                        router.patch(
                                                                            `/settings/learning-support/message-responses/${response.id}/visibility`,
                                                                            {
                                                                                hidden:
                                                                                    response.hiddenAt ===
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
                                                                    {response.hiddenAt
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
                                                                                    'settings.learner_messages.delete_response_confirm',
                                                                                    'Permanently delete this learner response?',
                                                                                ),
                                                                            )
                                                                        ) {
                                                                            router.delete(
                                                                                `/settings/learning-support/message-responses/${response.id}`,
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
                                                            className={`text-sm leading-6 ${response.hiddenAt ? 'text-slate-400 line-through opacity-70' : ''}`}
                                                        >
                                                            {response.responseType ? (
                                                                <span className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                                                                    {t(
                                                                        `settings.learner_messages.response_kind_${response.responseType}`,
                                                                        response.responseType ===
                                                                            'explanation'
                                                                            ? 'Explained an idea'
                                                                            : response.responseType ===
                                                                                'example'
                                                                              ? 'Shared an example'
                                                                              : 'Asked a question',
                                                                    )}
                                                                </span>
                                                            ) : null}
                                                            {response.body}
                                                        </p>
                                                        {response.isHelpful ? (
                                                            <span className="mt-2 inline-flex rounded-full border border-teal-500/30 px-2 py-1 text-xs font-medium text-teal-700 dark:border-teal-300/30 dark:text-teal-200">
                                                                {t(
                                                                    'settings.learner_messages.helpful_signal',
                                                                    'Marked helpful by learner',
                                                                )}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ),
                                            )}
                                        </div>
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
