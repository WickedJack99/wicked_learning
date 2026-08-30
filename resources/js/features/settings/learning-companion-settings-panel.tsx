import { router } from '@inertiajs/react';
import { Bot, MessageCircle, Save, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ConfigImageInput } from '@/components/config-image-input';
import {
    SettingsNestedWorkspace,
    SettingsPanelHeader,
    SettingsSectionNavigation,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LearningCompanionDialoguesPanel } from '@/features/settings/learning-companion-dialogues-panel';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { uploadMediaFile } from '@/lib/media-upload';

export type LearningCompanionSettings = {
    avatar_color: string;
    avatar_url: string | null;
    display_name: string;
    enabled: boolean;
    welcome_message: string;
};

type LearningCompanionSection = 'dialogues' | 'identity';

const sections: SettingsNavigationItem<LearningCompanionSection>[] = [
    {
        description: 'Name, avatar and the companion orientation message.',
        icon: UserRound,
        key: 'identity',
        label: 'Identity',
    },
    {
        description: 'Reusable, assigned and safely bounded dialogue graphs.',
        icon: MessageCircle,
        key: 'dialogues',
        label: 'Dialogues',
    },
];

function readSectionFromUrl(): LearningCompanionSection {
    if (typeof window === 'undefined') {
        return 'identity';
    }

    return new URL(window.location.href).searchParams.get('companion') ===
        'dialogues'
        ? 'dialogues'
        : 'identity';
}

function writeSectionToUrl(section: LearningCompanionSection): void {
    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-learning-companion');
    url.searchParams.set('companion', section);
    window.history.pushState({ panel: 'admin-learning-companion' }, '', url);
}

export function LearningCompanionSettingsPanel({
    settings,
}: {
    settings: LearningCompanionSettings;
}) {
    const t = usePlatformTranslation();
    const [activeSection, setActiveSection] =
        useState<LearningCompanionSection>(() => readSectionFromUrl());
    const [form, setForm] = useState(settings);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => setForm(settings), [settings]);

    const updateText =
        (key: 'display_name' | 'welcome_message') =>
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setForm((current) => ({ ...current, [key]: event.target.value }));
        };

    const uploadAvatar = async (file: File) => {
        setUploading(true);
        setErrors((current) => ({ ...current, avatar_url: '' }));

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/companion/avatar',
                errorMessage: t(
                    'settings.companion.avatar_upload_error',
                    'The avatar image could not be uploaded.',
                ),
                file,
            });
            setForm((current) => ({ ...current, avatar_url: payload.url }));
        } catch (error) {
            setErrors((current) => ({
                ...current,
                avatar_url:
                    error instanceof Error
                        ? error.message
                        : t(
                              'settings.companion.avatar_upload_error',
                              'The avatar image could not be uploaded.',
                          ),
            }));
        } finally {
            setUploading(false);
        }
    };

    const save = () => {
        router.patch('/settings/companion', form, {
            onError: (validationErrors) => setErrors(validationErrors),
            onSuccess: () => setErrors({}),
            onFinish: () => setSaving(false),
            onStart: () => setSaving(true),
            preserveScroll: true,
        });
    };

    const activeSectionItem =
        sections.find((section) => section.key === activeSection) ?? sections[0];

    return (
        <SettingsNestedWorkspace
            contentClassName="h-full overflow-hidden"
            item={activeSectionItem}
            sidebar={
                <SettingsSectionNavigation
                    activeSection={activeSection}
                    ariaLabel="Learning Companion sections"
                    items={sections}
                    onChange={(section) => {
                        setActiveSection(section);
                        writeSectionToUrl(section);
                    }}
                />
            }
        >
            {activeSection === 'dialogues' ? (
                <LearningCompanionDialoguesPanel />
            ) : (
        <div className="h-full min-h-0 overflow-auto p-5 sm:p-6">
            <section className="mx-auto grid max-w-4xl gap-6">
                <SettingsPanelHeader
                    description={t(
                        'settings.companion.description',
                        'Set the small scripted guide learners can open while exploring a map or activity. It works without an AI provider.',
                    )}
                    eyebrow={t('settings.companion.eyebrow', 'Learner experience')}
                    icon={Bot}
                    title={t('settings.companion.title', 'Learning Companion')}
                />

                <form
                    className="grid gap-5 rounded-xl border p-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        save();
                    }}
                    style={{
                        background: 'var(--settings-panel-background)',
                        borderColor: 'var(--settings-border-color)',
                    }}
                >
                    <label className="flex items-start gap-3">
                        <input
                            checked={form.enabled}
                            className="mt-1 size-4 accent-[var(--settings-accent)]"
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    enabled: event.target.checked,
                                }))
                            }
                            type="checkbox"
                        />
                        <span>
                            <span className="block text-sm font-semibold">
                                {t(
                                    'settings.companion.enabled',
                                    'Show the companion to learners',
                                )}
                            </span>
                            <span className="mt-1 block text-sm text-[var(--settings-muted-text)]">
                                {t(
                                    'settings.companion.enabled_description',
                                    'Learners can open it from the lower-left corner of a world or activity. It never blocks map exploration or activity playback.',
                                )}
                            </span>
                        </span>
                    </label>

                    <div className="grid gap-2">
                        <Label htmlFor="companion-display-name">
                            {t('settings.companion.display_name', 'Display name')}
                        </Label>
                        <Input
                            id="companion-display-name"
                            maxLength={80}
                            onChange={updateText('display_name')}
                            value={form.display_name}
                        />
                    </div>

                    <ConfigImageInput
                        description={t(
                            'settings.companion.avatar_description',
                            'Upload a new image or reuse an existing visual from the media library.',
                        )}
                        error={errors.avatar_url}
                        id="companion-avatar-url"
                        label={t(
                            'settings.companion.avatar_url',
                            'Avatar image (optional)',
                        )}
                        onChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                avatar_url: value,
                            }))
                        }
                        onUpload={(file) => void uploadAvatar(file)}
                        placeholder="/storage/learning/media/companion-avatar.png"
                        uploading={uploading}
                        value={form.avatar_url ?? ''}
                    />

                    <div className="grid gap-2">
                        <Label htmlFor="companion-avatar-color">
                            {t('settings.companion.avatar_color', 'Avatar color')}
                        </Label>
                        <div className="flex items-center gap-3">
                            <input
                                aria-label={t(
                                    'settings.companion.avatar_color',
                                    'Avatar color',
                                )}
                                className="size-11 cursor-pointer rounded-md border border-[var(--settings-border-color)] bg-transparent p-1"
                                id="companion-avatar-color"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        avatar_color: event.target.value,
                                    }))
                                }
                                type="color"
                                value={form.avatar_color}
                            />
                            <span className="font-mono text-sm text-[var(--settings-muted-text)]">
                                {form.avatar_color}
                            </span>
                        </div>
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            {t(
                                'settings.companion.avatar_color_description',
                                'Used for the companion circle and its fallback icon.',
                            )}
                        </p>
                        {errors.avatar_color ? (
                            <p className="text-sm text-destructive">{errors.avatar_color}</p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="companion-welcome-message">
                            {t('settings.companion.message', 'Orientation message')}
                        </Label>
                        <textarea
                            className="min-h-32 rounded-md border bg-[var(--settings-input-background)] px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                            id="companion-welcome-message"
                            maxLength={1200}
                            onChange={updateText('welcome_message')}
                            value={form.welcome_message}
                        />
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            {t(
                                'settings.companion.message_description',
                                'Keep this invitational and choice-preserving. It is shown with deterministic context and safe navigation suggestions.',
                            )}
                        </p>
                    </div>

                    <div>
                        <Button disabled={saving} type="submit">
                            <Save className="size-4" />
                            {saving
                                ? t('settings.companion.saving', 'Saving...')
                                : t('common.save', 'Save')}
                        </Button>
                    </div>
                </form>
            </section>
        </div>
            )}
        </SettingsNestedWorkspace>
    );
}
