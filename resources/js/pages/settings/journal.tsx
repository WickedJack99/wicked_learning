import { Head, router } from '@inertiajs/react';
import {
    BookOpenCheck,
    Image,
    Plus,
    Save,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfigModeSwitch } from '@/components/config-mode-switch';
import type { ConfigThemeMode } from '@/components/config-mode-switch';
import {
    SettingsConfigurationLayout,
    SettingsConfigurationShell,
    SettingsLevelBanner,
    SettingsPanelHeader,
    SettingsSectionNavigation,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    journalThemeBackgroundUrl,
    journalThemeBackgroundAssets,
    journalThemeCssVariables,
} from '@/features/journal/theme';
import type {
    JournalBackgroundAsset,
    JournalThemeModeSettings,
    JournalThemeSettings,
} from '@/features/journal/theme';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { uploadMediaFile } from '@/lib/media-upload';
import {
    ConfigImageInput,
    NumberField,
} from '@/pages/settings/worlds/activity-config-fields';

export type JournalSettingsProps = {
    allowExpertAccessRequests: boolean;
    embedded?: boolean;
    theme: JournalThemeSettings;
};

type JournalSection = 'policy' | 'background';

const sections = [
    {
        description: 'Expert access consent and journal safeguards.',
        icon: ShieldCheck,
        key: 'policy',
        label: 'Policy',
    },
    {
        description: 'Book, parchment or other journal backdrop.',
        icon: Image,
        key: 'background',
        label: 'Background',
    },
] satisfies SettingsNavigationItem<JournalSection>[];

/** Platform journal policy and visual configuration. */
export default function JournalSettings({
    allowExpertAccessRequests,
    embedded = false,
    theme,
}: JournalSettingsProps) {
    const [section, setSection] = useState<JournalSection>('policy');
    const [configMode, setConfigMode] = useState<ConfigThemeMode>('dark');
    const [allowExpertAccess, setAllowExpertAccess] = useState(
        allowExpertAccessRequests,
    );
    const [draftTheme, setDraftTheme] = useState(theme);
    const [uploading, setUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const activeMode = draftTheme[configMode];
    const activeSectionItem =
        sections.find((item) => item.key === section) ?? sections[0];
    const journalItem: SettingsNavigationItem<'journal'> = {
        description: 'Journal policy and background image.',
        icon: BookOpenCheck,
        key: 'journal',
        label: 'Journal',
    };
    const hasChanges = useDirtyState(
        {
            allowExpertAccessRequests: allowExpertAccess,
            theme: draftTheme,
        },
        {
            allowExpertAccessRequests,
            theme,
        },
    );

    function updateThemeMode(
        updater: (
            current: JournalThemeModeSettings,
        ) => JournalThemeModeSettings,
    ) {
        setDraftTheme((current) => ({
            ...current,
            [configMode]: updater(current[configMode]),
        }));
    }

    function save() {
        if (!hasChanges) {
            return;
        }

        setIsSaving(true);
        router.patch(
            '/settings/journal',
            {
                allow_expert_access_requests: allowExpertAccess,
                theme: draftTheme,
            },
            {
                onFinish: () => setIsSaving(false),
                preserveScroll: true,
            },
        );
    }

    async function uploadJournalImage(
        file: File,
        onUploaded: (url: string) => void,
    ) {
        setUploading(true);

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/journal/background-images',
                fieldName: 'image',
                file,
            });

            onUploaded(payload.url);
        } finally {
            setUploading(false);
        }
    }

    const saveButton = (
        <Button disabled={isSaving || !hasChanges} onClick={save} type="button">
            <Save className="size-4" />
            Save changes
        </Button>
    );

    const sidebar = (
        <aside className="h-full min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0">
            <SettingsSectionNavigation
                activeSection={section}
                ariaLabel="Journal settings sections"
                items={sections}
                onChange={setSection}
            />
        </aside>
    );

    const content = (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--settings-panel-background)]">
            <SettingsLevelBanner
                action={
                    <div className="flex shrink-0 items-center gap-2">
                        {section !== 'policy' ? (
                            <ConfigModeSwitch
                                mode={configMode}
                                onChange={setConfigMode}
                                size="large"
                            />
                        ) : null}
                        {embedded ? saveButton : null}
                    </div>
                }
                className="!bg-[var(--settings-sidebar-background)]"
                contentClassName="!max-w-none"
                description="Configure learner journal behavior and visuals for the selected appearance mode."
                item={journalItem}
            />

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="grid gap-4">
                    <SettingsPanelHeader
                        item={activeSectionItem}
                        title={activeSectionItem.label}
                    />
                    {section === 'policy' ? (
                        <PolicySection
                            allowExpertAccess={allowExpertAccess}
                            onChange={setAllowExpertAccess}
                        />
                    ) : null}
                    {section === 'background' ? (
                        <BackgroundSection
                            mode={configMode}
                            onChange={updateThemeMode}
                            onUpload={uploadJournalImage}
                            theme={activeMode}
                            uploading={uploading}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );

    if (embedded) {
        return (
            <SettingsConfigurationLayout
                className="h-full gap-0"
                contentClassName="min-h-0 overflow-hidden"
                sidebar={sidebar}
            >
                {content}
            </SettingsConfigurationLayout>
        );
    }

    return (
        <>
            <Head title="Journal settings" />
            <SettingsConfigurationShell
                action={saveButton}
                eyebrow="Administration"
                sidebar={sidebar}
                title="Journal"
            >
                {content}
            </SettingsConfigurationShell>
        </>
    );
}

function PolicySection({
    allowExpertAccess,
    onChange,
}: {
    allowExpertAccess: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <section className="max-w-4xl border-b border-[var(--settings-border-color)] pb-5">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                    <ShieldCheck className="size-5" />
                </span>
                <div>
                    <h3 className="font-semibold text-slate-950 dark:text-white">
                        Optional expert access
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Learners can explicitly request informational feedback
                        on their private journal pages. This only records
                        consent and does not send entries anywhere by itself.
                    </p>
                </div>
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 border-y border-[var(--settings-border-color)] py-4 text-sm">
                <Checkbox
                    checked={allowExpertAccess}
                    className="mt-0.5"
                    onCheckedChange={(value) => onChange(value === true)}
                />
                <span>
                    <span className="block font-medium text-slate-950 dark:text-white">
                        Allow learners to request informational feedback
                    </span>
                    <span className="mt-1 block leading-6 text-slate-500 dark:text-slate-400">
                        Future feedback workflows can read this consent before
                        involving an expert or AI service.
                    </span>
                </span>
            </label>
        </section>
    );
}

function BackgroundSection({
    mode,
    onChange,
    onUpload,
    theme,
    uploading,
}: {
    mode: ConfigThemeMode;
    onChange: (
        updater: (
            current: JournalThemeModeSettings,
        ) => JournalThemeModeSettings,
    ) => void;
    onUpload: (file: File, onUploaded: (url: string) => void) => void;
    theme: JournalThemeModeSettings;
    uploading: boolean;
}) {
    return (
        <section className="grid min-w-0 items-stretch gap-4 2xl:grid-cols-[minmax(0,1fr)_28rem]">
            <div className="grid min-w-0 content-start border-b border-[var(--settings-border-color)] pb-5">
                <ConfigImageInput
                    className="!rounded-none !bg-transparent !p-0"
                    description={`Displayed behind the journal in ${mode} mode. A book page, desk, parchment or subtle texture works well.`}
                    id={`journal-${mode}-background`}
                    label={`${capitalize(mode)} mode background image`}
                    onChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            backgroundImage: value,
                        }))
                    }
                    onUpload={(file) =>
                        onUpload(file, (url) =>
                            onChange((current) => ({
                                ...current,
                                backgroundImage: url,
                            })),
                        )
                    }
                    uploading={uploading}
                    value={theme.backgroundImage}
                />
                <div className="mt-5 grid gap-4 border-t border-[var(--settings-border-color)] pt-4 sm:grid-cols-3">
                    <NumberField
                        label="Horizontal position"
                        max="100"
                        min="0"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                backgroundPositionX: value,
                            }))
                        }
                        step="1"
                        suffix="%"
                        value={String(theme.backgroundPositionX)}
                    />
                    <NumberField
                        label="Vertical position"
                        max="100"
                        min="0"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                backgroundPositionY: value,
                            }))
                        }
                        step="1"
                        suffix="%"
                        value={String(theme.backgroundPositionY)}
                    />
                    <NumberField
                        label="Zoom"
                        max="300"
                        min="25"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                backgroundZoom: value,
                            }))
                        }
                        step="1"
                        suffix="%"
                        value={String(theme.backgroundZoom)}
                    />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--settings-muted-text)]">
                    100% keeps the normal cover fit. Lower values shrink the
                    image; higher values zoom in without changing its aspect
                    ratio.
                </p>
                <BackgroundAssetsSection
                    mode={mode}
                    onChange={onChange}
                    onUpload={onUpload}
                    theme={theme}
                    uploading={uploading}
                />
            </div>
            <JournalPreview mode={mode} theme={theme} />
        </section>
    );
}

function BackgroundAssetsSection({
    mode,
    onChange,
    onUpload,
    theme,
    uploading,
}: {
    mode: ConfigThemeMode;
    onChange: (
        updater: (
            current: JournalThemeModeSettings,
        ) => JournalThemeModeSettings,
    ) => void;
    onUpload: (file: File, onUploaded: (url: string) => void) => void;
    theme: JournalThemeModeSettings;
    uploading: boolean;
}) {
    function updateAsset(
        assetId: string,
        updater: (asset: JournalBackgroundAsset) => JournalBackgroundAsset,
    ) {
        onChange((current) => ({
            ...current,
            backgroundAssets: current.backgroundAssets.map((asset) =>
                asset.id === assetId ? updater(asset) : asset,
            ),
        }));
    }

    function addAsset() {
        onChange((current) => ({
            ...current,
            backgroundAssets: [
                ...current.backgroundAssets,
                {
                    id: newJournalBackgroundAssetId(),
                    image: '',
                    positionX: 50,
                    positionY: 50,
                    zoom: 100,
                },
            ],
        }));
    }

    function removeAsset(assetId: string) {
        onChange((current) => ({
            ...current,
            backgroundAssets: current.backgroundAssets.filter(
                (asset) => asset.id !== assetId,
            ),
        }));
    }

    return (
        <section className="mt-6 border-t border-[var(--settings-border-color)] pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-slate-950 dark:text-white">
                        Decorative assets
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">
                        Place ornaments, bookmarks or other images over the base
                        background in {mode} mode.
                    </p>
                </div>
                <Button
                    disabled={theme.backgroundAssets.length >= 12}
                    onClick={addAsset}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <Plus className="size-4" />
                    Add asset
                </Button>
            </div>

            {theme.backgroundAssets.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--settings-muted-text)]">
                    No decorative assets yet.
                </p>
            ) : null}

            {theme.backgroundAssets.map((asset, index) => (
                <div
                    className="mt-5 border-t border-[var(--settings-border-color)] pt-4"
                    key={asset.id}
                >
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h4 className="font-medium text-slate-950 dark:text-white">
                            Asset {index + 1}
                        </h4>
                        <Button
                            aria-label={`Remove asset ${index + 1}`}
                            onClick={() => removeAsset(asset.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                    <ConfigImageInput
                        className="!rounded-none !bg-transparent !p-0"
                        description="Placed behind journal controls and above the base background."
                        id={`journal-${mode}-asset-${asset.id}`}
                        label={`Asset ${index + 1} image`}
                        onChange={(image) =>
                            updateAsset(asset.id, (current) => ({
                                ...current,
                                image,
                            }))
                        }
                        onUpload={(file) =>
                            onUpload(file, (image) =>
                                updateAsset(asset.id, (current) => ({
                                    ...current,
                                    image,
                                })),
                            )
                        }
                        uploading={uploading}
                        value={asset.image}
                    />
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        <NumberField
                            id={`journal-${mode}-asset-${asset.id}-x`}
                            label="Horizontal position"
                            max="100"
                            min="0"
                            onChange={(positionX) =>
                                updateAsset(asset.id, (current) => ({
                                    ...current,
                                    positionX,
                                }))
                            }
                            step="1"
                            suffix="%"
                            value={String(asset.positionX)}
                        />
                        <NumberField
                            id={`journal-${mode}-asset-${asset.id}-y`}
                            label="Vertical position"
                            max="100"
                            min="0"
                            onChange={(positionY) =>
                                updateAsset(asset.id, (current) => ({
                                    ...current,
                                    positionY,
                                }))
                            }
                            step="1"
                            suffix="%"
                            value={String(asset.positionY)}
                        />
                        <NumberField
                            id={`journal-${mode}-asset-${asset.id}-zoom`}
                            label="Zoom"
                            max="300"
                            min="25"
                            onChange={(zoom) =>
                                updateAsset(asset.id, (current) => ({
                                    ...current,
                                    zoom,
                                }))
                            }
                            step="1"
                            suffix="%"
                            value={String(asset.zoom)}
                        />
                    </div>
                    <p className="mt-3 text-sm text-[var(--settings-muted-text)]">
                        Position refers to the center of the asset. Zoom sets
                        its width and preserves its aspect ratio.
                    </p>
                </div>
            ))}
        </section>
    );
}

function JournalPreview({
    mode,
    theme,
}: {
    mode: ConfigThemeMode;
    theme: JournalThemeModeSettings;
}) {
    const cssVariables = useMemo(
        () => journalThemeCssVariables({ dark: theme, light: theme }, mode),
        [mode, theme],
    );
    const backgroundImageUrl = journalThemeBackgroundUrl(theme.backgroundImage);
    const backgroundAssets = journalThemeBackgroundAssets(theme);

    return (
        <div
            className="relative flex aspect-[3/2] w-full max-w-[28rem] flex-col self-start justify-self-center overflow-hidden rounded-xl border 2xl:justify-self-end"
            style={{
                ...cssVariables,
                backgroundColor: 'var(--journal-panel-background)',
                borderColor: 'var(--journal-panel-border)',
            }}
        >
            {backgroundImageUrl ? (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                >
                    <img
                        alt=""
                        className="size-full max-w-none object-cover"
                        draggable={false}
                        src={backgroundImageUrl}
                        style={{
                            objectPosition:
                                'var(--journal-background-position)',
                            transform: 'scale(var(--journal-background-zoom))',
                            transformOrigin:
                                'var(--journal-background-position)',
                        }}
                    />
                </div>
            ) : null}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
            >
                {backgroundAssets.map((asset) => {
                    const imageUrl = journalThemeBackgroundUrl(asset.image);

                    return imageUrl ? (
                        <img
                            alt=""
                            className="absolute max-w-none"
                            draggable={false}
                            key={asset.id}
                            src={imageUrl}
                            style={{
                                left: `${asset.positionX}%`,
                                top: `${asset.positionY}%`,
                                transform: 'translate(-50%, -50%)',
                                width: `${asset.zoom}%`,
                            }}
                        />
                    ) : null;
                })}
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0"
                style={{ background: 'var(--journal-background-overlay)' }}
            />
            <header
                className="relative z-10 flex h-[7%] shrink-0 items-center justify-between overflow-hidden border-b px-2 py-0.5"
                style={{
                    background: 'var(--journal-header-background)',
                    borderColor: 'var(--journal-panel-border)',
                }}
            >
                <div>
                    <p
                        className="text-[0.45rem] leading-none font-medium tracking-[0.16em] uppercase"
                        style={{ color: 'var(--journal-accent)' }}
                    >
                        Journal
                    </p>
                    <p
                        className="mt-0.5 text-[0.65rem] leading-none font-semibold"
                        style={{ color: 'var(--journal-heading-text)' }}
                    >
                        Reflections and notes
                    </p>
                </div>
                <span
                    className="rounded border px-1.5 py-0.5 text-[0.5rem]"
                    style={{
                        borderColor: 'var(--journal-button-border)',
                        color: 'var(--journal-button-text)',
                    }}
                >
                    Export
                </span>
            </header>
            <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[16.1%_minmax(0,1fr)]">
                <div
                    className="border-r p-2"
                    style={{
                        background: 'var(--journal-sidebar-background)',
                        borderColor: 'var(--journal-panel-border)',
                    }}
                >
                    <div
                        className="rounded border p-1.5"
                        style={{
                            background: 'var(--journal-selected-background)',
                            borderColor: 'var(--journal-selected-border)',
                            color: 'var(--journal-selected-text)',
                        }}
                    >
                        <p
                            className="truncate text-[0.6rem] font-semibold"
                            style={{ color: 'var(--journal-selected-text)' }}
                        >
                            Field notes
                        </p>
                        <p
                            className="mt-0.5 truncate text-[0.5rem]"
                            style={{ color: 'var(--journal-selected-text)' }}
                        >
                            General / Week 1
                        </p>
                    </div>
                </div>
                <div
                    className="min-w-0 p-2"
                    style={{ background: 'var(--journal-content-background)' }}
                >
                    <div className="flex h-full min-h-0 flex-col">
                        <div
                            className="flex shrink-0 items-start justify-between gap-2"
                            style={{
                                color: 'var(--journal-heading-text)',
                            }}
                        >
                            <div className="min-w-0 text-[0.6rem] font-semibold">
                                Test Reflection
                            </div>
                            <span
                                className="rounded px-1.5 py-0.5 text-[0.5rem]"
                                style={{
                                    background: 'var(--journal-accent)',
                                    color: 'var(--journal-accent-text)',
                                }}
                            >
                                Edit
                            </span>
                        </div>
                        <div
                            className="mt-2 min-h-0 flex-1 overflow-hidden rounded border p-2"
                            style={{
                                background: 'var(--journal-input-background)',
                                borderColor: 'var(--journal-button-border)',
                            }}
                        >
                            <p
                                className="text-[0.6rem] font-semibold"
                                style={{ color: 'var(--journal-heading-text)' }}
                            >
                                A clear thought
                            </p>
                            <p
                                className="mt-1 text-[0.55rem] leading-3"
                                style={{ color: 'var(--journal-body-text)' }}
                            >
                                Markdown reflections appear in this writing
                                area.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function newJournalBackgroundAssetId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `asset-${Date.now()}`;
}

function capitalize(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
