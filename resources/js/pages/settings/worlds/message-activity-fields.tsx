import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAppearance } from '@/hooks/use-appearance';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { ConfigColorField } from './activity-config-fields';
import type {
    ActivityForm,
    MessageTopicOption,
} from './edit-node-activity-types';

export function MessageActivityFlowFields({
    errors,
    form,
    onChange,
    topics,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    topics: MessageTopicOption[];
}) {
    const t = usePlatformTranslation();
    const isPrompt = form.type === 'message_prompt';

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="message-topic">
                    {t('settings.activities.messages.topic', 'Message topic')}
                </Label>
                <Select
                    onValueChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            message_topic_id: value === '__new' ? '' : value,
                            message_topic_title:
                                value === '__new'
                                    ? current.message_topic_title
                                    : '',
                        }))
                    }
                    value={form.message_topic_id || '__new'}
                >
                    <SelectTrigger className="w-full" id="message-topic">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {topics.map((topic) => (
                            <SelectItem
                                key={topic.id}
                                value={topic.id.toString()}
                            >
                                {topic.title}
                            </SelectItem>
                        ))}
                        <SelectItem value="__new">
                            {t(
                                'settings.activities.messages.create_topic',
                                'Create new topic',
                            )}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <InputError message={errors.message_topic_id} />
            </div>

            {!form.message_topic_id ? (
                <div className="grid gap-2">
                    <Label htmlFor="message-topic-title">
                        {t(
                            'settings.activities.messages.new_topic_name',
                            'New topic name',
                        )}
                    </Label>
                    <Input
                        id="message-topic-title"
                        maxLength={120}
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                message_topic_title: event.target.value,
                            }))
                        }
                        placeholder={t(
                            'settings.activities.messages.topic_placeholder',
                            'Helpful thoughts',
                        )}
                        value={form.message_topic_title}
                    />
                    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.activities.messages.topic_description',
                            'Prompt and wall activities use this topic to share the same messages inside the current MapAsset.',
                        )}
                    </p>
                    <InputError message={errors.message_topic_title} />
                </div>
            ) : null}

            {!isPrompt ? (
                <div className="grid gap-2">
                    <label
                        className="flex items-start gap-3"
                        htmlFor="message-allow-responses"
                    >
                        <Checkbox
                            checked={form.message_allow_responses}
                            id="message-allow-responses"
                            onCheckedChange={(checked) =>
                                onChange((current) => ({
                                    ...current,
                                    message_allow_responses: checked === true,
                                }))
                            }
                        />
                        <span>
                            <span className="block text-sm font-medium">
                                {t(
                                    'settings.activities.messages.allow_responses',
                                    'Invite optional peer responses',
                                )}
                            </span>
                            <span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {t(
                                    'settings.activities.messages.allow_responses_description',
                                    'Learners can choose to respond once to a visible message. Responses remain moderated.',
                                )}
                            </span>
                        </span>
                    </label>
                    <InputError message={errors.message_allow_responses} />
                </div>
            ) : null}

            {isPrompt ? (
                <>
                    <div className="grid gap-2">
                        <Label htmlFor="message-audience">
                            {t(
                                'settings.activities.messages.audience',
                                'Who should receive this?',
                            )}
                        </Label>
                        <Select
                            onValueChange={(value) =>
                                onChange((current) => ({
                                    ...current,
                                    message_audience:
                                        value === 'support'
                                            ? 'support'
                                            : 'peers',
                                }))
                            }
                            value={form.message_audience || 'peers'}
                        >
                            <SelectTrigger
                                className="w-full"
                                id="message-audience"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="peers">
                                    {t(
                                        'settings.activities.messages.audience_peers',
                                        'Share with peers',
                                    )}
                                </SelectItem>
                                <SelectItem value="support">
                                    {t(
                                        'settings.activities.messages.audience_support',
                                        'Ask learning support',
                                    )}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {form.message_audience === 'support'
                                ? t(
                                      'settings.activities.messages.audience_support_description',
                                      'The learner can choose to send a short request to authorized learning support. It will not appear on a peer message wall.',
                                  )
                                : t(
                                      'settings.activities.messages.audience_peers_description',
                                      'The learner can choose to share one short message with the linked peer message wall.',
                                  )}
                        </p>
                        <InputError message={errors.message_audience} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message-prompt-text">
                            {t('settings.activities.messages.prompt', 'Prompt')}
                        </Label>
                        <textarea
                            className="min-h-28 rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-white/20 dark:bg-slate-950/60"
                            id="message-prompt-text"
                            maxLength={1000}
                            onChange={(event) =>
                                onChange((current) => ({
                                    ...current,
                                    message_prompt_text: event.target.value,
                                }))
                            }
                            value={form.message_prompt_text}
                        />
                        <InputError message={errors.message_prompt_text} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message-input-label">
                            {t(
                                'settings.activities.messages.input_label',
                                'Input label',
                            )}
                        </Label>
                        <Input
                            id="message-input-label"
                            maxLength={120}
                            onChange={(event) =>
                                onChange((current) => ({
                                    ...current,
                                    message_input_label: event.target.value,
                                }))
                            }
                            value={form.message_input_label}
                        />
                        <InputError message={errors.message_input_label} />
                    </div>
                </>
            ) : (
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.activities.messages.wall_flow_description',
                        'Closing the wall completes this activity and follows its configured output connector.',
                    )}
                </p>
            )}
        </div>
    );
}

export function MessageActivityVisualFields({
    form,
    onChange,
}: {
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    const t = usePlatformTranslation();
    const { resolvedAppearance } = useAppearance();
    const dark = resolvedAppearance === 'dark';
    const surface = dark
        ? form.message_surface_color_dark
        : form.message_surface_color_light;
    const card = dark
        ? form.message_card_color_dark
        : form.message_card_color_light;
    const border = dark
        ? form.message_card_border_color_dark
        : form.message_card_border_color_light;
    const text = dark
        ? form.message_text_color_dark
        : form.message_text_color_light;
    const accent = dark
        ? form.message_accent_color_dark
        : form.message_accent_color_light;

    return (
        <div className="grid gap-5">
            <div
                className="relative min-h-64 overflow-hidden rounded-lg border p-5"
                style={{ backgroundColor: surface, borderColor: border }}
            >
                <p
                    className="text-xs font-semibold tracking-[0.16em] uppercase"
                    style={{ color: accent }}
                >
                    {t(
                        'settings.activities.messages.live_preview',
                        'Live preview',
                    )}
                </p>
                {[
                    ['12%', '28%', '-3deg'],
                    ['55%', '16%', '2deg'],
                    ['35%', '58%', '-1deg'],
                ].map(([left, top, rotate], index) => (
                    <div
                        className="absolute w-44 rounded-lg border p-3 text-sm shadow-lg"
                        key={left}
                        style={{
                            backgroundColor: card,
                            borderColor: border,
                            color: text,
                            left,
                            top,
                            transform: `rotate(${rotate})`,
                        }}
                    >
                        {index === 0
                            ? t(
                                  'settings.activities.messages.preview_note_one',
                                  'A small clue can make the next step easier.',
                              )
                            : index === 1
                              ? t(
                                    'settings.activities.messages.preview_note_two',
                                    'Take your time and look at the details.',
                                )
                              : t(
                                    'settings.activities.messages.preview_note_three',
                                    'You are allowed to try another path.',
                                )}
                    </div>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.surface_dark',
                        'Surface - dark',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_surface_color_dark', value)
                    }
                    value={form.message_surface_color_dark}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.surface_light',
                        'Surface - light',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_surface_color_light', value)
                    }
                    value={form.message_surface_color_light}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.card_dark',
                        'Card - dark',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_card_color_dark', value)
                    }
                    value={form.message_card_color_dark}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.card_light',
                        'Card - light',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_card_color_light', value)
                    }
                    value={form.message_card_color_light}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.card_border_dark',
                        'Card border - dark',
                    )}
                    onChange={(value) =>
                        setField(
                            onChange,
                            'message_card_border_color_dark',
                            value,
                        )
                    }
                    value={form.message_card_border_color_dark}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.card_border_light',
                        'Card border - light',
                    )}
                    onChange={(value) =>
                        setField(
                            onChange,
                            'message_card_border_color_light',
                            value,
                        )
                    }
                    value={form.message_card_border_color_light}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.text_dark',
                        'Text - dark',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_text_color_dark', value)
                    }
                    value={form.message_text_color_dark}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.text_light',
                        'Text - light',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_text_color_light', value)
                    }
                    value={form.message_text_color_light}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.accent_dark',
                        'Accent - dark',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_accent_color_dark', value)
                    }
                    value={form.message_accent_color_dark}
                />
                <ConfigColorField
                    label={t(
                        'settings.activities.messages.accent_light',
                        'Accent - light',
                    )}
                    onChange={(value) =>
                        setField(onChange, 'message_accent_color_light', value)
                    }
                    value={form.message_accent_color_light}
                />
            </div>
        </div>
    );
}

function setField(
    onChange: Dispatch<SetStateAction<ActivityForm>>,
    field: keyof ActivityForm,
    value: string,
) {
    onChange((current) => ({ ...current, [field]: value }));
}
