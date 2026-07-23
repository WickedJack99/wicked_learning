import { Head, router } from '@inertiajs/react';
import type { BookOpenCheck } from 'lucide-react';
import {
    Highlighter,
    Image,
    LayoutPanelTop,
    Palette,
    Save,
    ShieldCheck,
    SquareMousePointer,
    Type,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ColorOpacityField } from '@/components/color-input';
import { ConfigModeSwitch } from '@/components/config-mode-switch';
import type { ConfigThemeMode } from '@/components/config-mode-switch';
import {
    SettingsConfigurationLayout,
    SettingsConfigurationShell,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    journalThemeColors,
    journalThemeCssVariables,
} from '@/features/journal/theme';
import type {
    JournalThemeModeSettings,
    JournalThemeSettings,
} from '@/features/journal/theme';
import { uploadMediaFile } from '@/lib/media-upload';
import { cn } from '@/lib/utils';
import { ConfigImageInput } from '@/pages/settings/worlds/activity-config-fields';

export type JournalSettingsProps = {
    allowExpertAccessRequests: boolean;
    embedded?: boolean;
    theme: JournalThemeSettings;
};

type JournalSection =
    | 'policy'
    | 'background'
    | 'shell'
    | 'typography'
    | 'buttons'
    | 'selection';

type ThemeField = Exclude<keyof JournalThemeModeSettings, 'backgroundImage'>;

const sections: {
    description: string;
    icon: typeof BookOpenCheck;
    id: JournalSection;
    label: string;
}[] = [
    {
        description: 'Expert access consent and journal safeguards.',
        icon: ShieldCheck,
        id: 'policy',
        label: 'Policy',
    },
    {
        description: 'Book, parchment or other journal backdrop.',
        icon: Image,
        id: 'background',
        label: 'Background',
    },
    {
        description: 'Journal panel, header, sidebar and writing area.',
        icon: LayoutPanelTop,
        id: 'shell',
        label: 'Journal shell',
    },
    {
        description: 'Headings, body copy and muted helper text.',
        icon: Type,
        id: 'typography',
        label: 'Typography',
    },
    {
        description: 'Action buttons, active mode and highlighted controls.',
        icon: SquareMousePointer,
        id: 'buttons',
        label: 'Buttons',
    },
    {
        description: 'Selected journal page colors in the page list.',
        icon: Highlighter,
        id: 'selection',
        label: 'Page highlight',
    },
];

const fieldsBySection: Record<
    Exclude<JournalSection, 'policy' | 'background'>,
    { field: ThemeField; label: string }[]
> = {
    shell: [
        { field: 'panelBackground', label: 'Panel background' },
        { field: 'panelBorder', label: 'Panel border' },
        { field: 'headerBackground', label: 'Header background' },
        { field: 'sidebarBackground', label: 'Sidebar background' },
        { field: 'contentBackground', label: 'Content background' },
        { field: 'inputBackground', label: 'Input background' },
    ],
    typography: [
        { field: 'headingText', label: 'Heading text' },
        { field: 'bodyText', label: 'Body text' },
        { field: 'mutedText', label: 'Muted text' },
    ],
    buttons: [
        { field: 'accent', label: 'Accent / active background' },
        { field: 'accentText', label: 'Accent text' },
        { field: 'buttonBackground', label: 'Button background' },
        { field: 'buttonText', label: 'Button text' },
        { field: 'buttonBorder', label: 'Button border' },
    ],
    selection: [
        { field: 'selectedBackground', label: 'Selected page background' },
        { field: 'selectedBorder', label: 'Selected page border' },
        { field: 'selectedText', label: 'Selected page text' },
    ],
};

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

    async function uploadBackground(file: File) {
        setUploading(true);

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/journal/background-images',
                fieldName: 'image',
                file,
            });

            updateThemeMode((current) => ({
                ...current,
                backgroundImage: payload.url,
            }));
        } finally {
            setUploading(false);
        }
    }

    const saveButton = (
        <Button disabled={isSaving} onClick={save} type="button">
            <Save className="size-4" />
            Save changes
        </Button>
    );

    const sidebar = (
        <SettingsSidebar>
            {sections.map((item) => (
                <SettingsSectionButton
                    active={section === item.id}
                    description={item.description}
                    icon={item.icon}
                    id={item.id}
                    key={item.id}
                    label={item.label}
                    onSelect={setSection}
                />
            ))}
        </SettingsSidebar>
    );

    const content = (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-white/10">
                <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                        {sections.find((item) => item.id === section)?.label ??
                            'Journal'}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Configure learner journal behavior and visuals for the
                        selected appearance mode.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {embedded ? saveButton : null}
                    {section !== 'policy' ? (
                        <ConfigModeSwitch
                            mode={configMode}
                            onChange={setConfigMode}
                            size="large"
                        />
                    ) : null}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
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
                        onUpload={uploadBackground}
                        theme={activeMode}
                        uploading={uploading}
                    />
                ) : null}
                {section !== 'policy' && section !== 'background' ? (
                    <ColorSection
                        fields={fieldsBySection[section]}
                        mode={configMode}
                        onChange={updateThemeMode}
                        theme={activeMode}
                    />
                ) : null}
            </div>
        </div>
    );

    if (embedded) {
        return (
            <SettingsConfigurationLayout className="h-full" sidebar={sidebar}>
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
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                        <ShieldCheck className="size-5" />
                    </span>
                    <div>
                        <h3 className="font-semibold text-slate-950 dark:text-white">
                            Optional expert access
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Learners can explicitly request informational
                            feedback on their private journal pages. This only
                            records consent and does not send entries anywhere
                            by itself.
                        </p>
                    </div>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-slate-950/40">
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
                            Future feedback workflows can read this consent
                            before involving an expert or AI service.
                        </span>
                    </span>
                </label>
            </div>
            <PolicyPreview allowExpertAccess={allowExpertAccess} />
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
    onUpload: (file: File) => void;
    theme: JournalThemeModeSettings;
    uploading: boolean;
}) {
    return (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
            <div className="grid gap-4">
                <ConfigImageInput
                    description={`Displayed behind the journal in ${mode} mode. A book page, desk, parchment or subtle texture works well.`}
                    id={`journal-${mode}-background`}
                    label={`${capitalize(mode)} mode background image`}
                    onChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            backgroundImage: value,
                        }))
                    }
                    onUpload={onUpload}
                    uploading={uploading}
                    value={theme.backgroundImage}
                />
                <ColorOpacityField
                    colorValue={theme.backgroundOverlay}
                    label="Background overlay"
                    onColorChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            backgroundOverlay: value,
                        }))
                    }
                    onOpacityChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            backgroundOverlayOpacity: value,
                        }))
                    }
                    opacityValue={String(theme.backgroundOverlayOpacity)}
                />
            </div>
            <JournalPreview mode={mode} theme={theme} />
        </section>
    );
}

function ColorSection({
    fields,
    mode,
    onChange,
    theme,
}: {
    fields: { field: ThemeField; label: string }[];
    mode: ConfigThemeMode;
    onChange: (
        updater: (
            current: JournalThemeModeSettings,
        ) => JournalThemeModeSettings,
    ) => void;
    theme: JournalThemeModeSettings;
}) {
    const [selectedField, setSelectedField] = useState(fields[0].field);
    const activeField =
        fields.find((field) => field.field === selectedField) ?? fields[0];
    const opacityField = `${activeField.field}Opacity` as ThemeField;

    return (
        <section className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="grid h-fit gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                {fields.map((field) => (
                    <button
                        className={cn(
                            'rounded-lg px-3 py-3 text-left text-sm font-medium transition',
                            selectedField === field.field
                                ? 'text-white dark:text-slate-950'
                                : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                        )}
                        key={field.field}
                        onClick={() => setSelectedField(field.field)}
                        style={
                            selectedField === field.field
                                ? {
                                      background: 'var(--settings-accent)',
                                      color: 'var(--settings-accent-foreground)',
                                  }
                                : undefined
                        }
                        type="button"
                    >
                        {field.label}
                    </button>
                ))}
            </aside>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-5 flex items-center gap-3">
                        <Palette className="size-5 text-[var(--settings-accent)]" />
                        <div>
                            <h3 className="font-semibold text-slate-950 dark:text-white">
                                {activeField.label}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Editing {mode} mode journal colors.
                            </p>
                        </div>
                    </div>
                    <ColorOpacityField
                        colorValue={String(theme[activeField.field] ?? '')}
                        label={activeField.label}
                        onColorChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                [activeField.field]: value,
                            }))
                        }
                        onOpacityChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                [opacityField]: value,
                            }))
                        }
                        opacityValue={String(theme[opacityField] ?? 100)}
                    />
                </div>
                <JournalPreview
                    focus={activeField.field}
                    mode={mode}
                    theme={theme}
                />
            </div>
        </section>
    );
}

function JournalPreview({
    focus,
    mode,
    theme,
}: {
    focus?: ThemeField;
    mode: ConfigThemeMode;
    theme: JournalThemeModeSettings;
}) {
    const cssVariables = useMemo(
        () => journalThemeCssVariables({ dark: theme, light: theme }, mode),
        [mode, theme],
    );
    const colors = journalThemeColors(theme);

    return (
        <div
            className="overflow-hidden rounded-xl border p-4"
            style={{
                ...cssVariables,
                backgroundImage: 'var(--journal-background-image)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderColor: 'var(--journal-panel-border)',
            }}
        >
            <div
                className="rounded-lg p-4"
                style={{ background: 'var(--journal-background-overlay)' }}
            >
                <p
                    className="text-xs font-medium tracking-[0.16em] uppercase"
                    style={{ color: 'var(--journal-accent)' }}
                >
                    Preview
                </p>
                <div
                    className="mt-3 overflow-hidden rounded-lg border"
                    style={{
                        background: 'var(--journal-panel-background)',
                        borderColor: outlineColor(focus, 'panelBorder', colors),
                    }}
                >
                    <div
                        className="border-b p-3"
                        style={{
                            background: 'var(--journal-header-background)',
                            borderColor: 'var(--journal-panel-border)',
                        }}
                    >
                        <p
                            className="font-semibold"
                            style={{ color: 'var(--journal-heading-text)' }}
                        >
                            Reflections and notes
                        </p>
                        <p
                            className="text-xs"
                            style={{ color: 'var(--journal-muted-text)' }}
                        >
                            Journal header area
                        </p>
                    </div>
                    <div className="grid grid-cols-[9rem_minmax(0,1fr)]">
                        <div
                            className="border-r p-2"
                            style={{
                                background: 'var(--journal-sidebar-background)',
                                borderColor: 'var(--journal-panel-border)',
                            }}
                        >
                            <div
                                className="rounded-md border p-2"
                                style={{
                                    background:
                                        'var(--journal-selected-background)',
                                    borderColor:
                                        'var(--journal-selected-border)',
                                    color: 'var(--journal-selected-text)',
                                }}
                            >
                                <p className="truncate text-xs font-semibold">
                                    Field notes
                                </p>
                                <p className="mt-1 truncate text-[0.68rem] opacity-80">
                                    General / Week 1
                                </p>
                            </div>
                        </div>
                        <div
                            className="p-3"
                            style={{
                                background: 'var(--journal-content-background)',
                            }}
                        >
                            <div
                                className="rounded-md border p-3"
                                style={{
                                    background:
                                        'var(--journal-input-background)',
                                    borderColor: 'var(--journal-button-border)',
                                }}
                            >
                                <p
                                    className="text-sm font-semibold"
                                    style={{
                                        color: 'var(--journal-heading-text)',
                                    }}
                                >
                                    A clear thought
                                </p>
                                <p
                                    className="mt-2 text-xs leading-5"
                                    style={{
                                        color: 'var(--journal-body-text)',
                                    }}
                                >
                                    Markdown reflections use the journal text
                                    palette and can contain headings, notes and
                                    media.
                                </p>
                                <button
                                    className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold"
                                    style={{
                                        background:
                                            'var(--journal-button-background)',
                                        borderColor:
                                            'var(--journal-button-border)',
                                        color: 'var(--journal-button-text)',
                                    }}
                                    type="button"
                                >
                                    Save changes
                                </button>
                                <button
                                    className="mt-3 ml-2 rounded-md px-3 py-1.5 text-xs font-semibold"
                                    style={{
                                        background: 'var(--journal-accent)',
                                        color: 'var(--journal-accent-text)',
                                    }}
                                    type="button"
                                >
                                    Edit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PolicyPreview({ allowExpertAccess }: { allowExpertAccess: boolean }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                Preview
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <p className="font-semibold text-slate-950 dark:text-white">
                    Journal page
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {allowExpertAccess
                        ? 'Learners can opt into future informational feedback per page.'
                        : 'Expert access requests stay hidden while this policy is disabled.'}
                </p>
            </div>
        </div>
    );
}

function outlineColor(
    focus: ThemeField | undefined,
    field: ThemeField,
    colors: ReturnType<typeof journalThemeColors>,
) {
    return focus === field ? colors.accent : colors.panelBorder;
}

function capitalize(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
