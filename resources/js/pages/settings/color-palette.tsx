import type { FormDataConvertible } from '@inertiajs/core';
import { Head, router } from '@inertiajs/react';
import { BookOpen, Map, Save, SlidersHorizontal, Sparkles } from 'lucide-react';
import { type CSSProperties, useMemo, useState } from 'react';
import {
    type AvailableColorOption,
    ColorOpacityField,
    isHexColor,
} from '@/components/color-input';
import { ConfigModeSwitch } from '@/components/config-mode-switch';
import type { ConfigThemeMode } from '@/components/config-mode-switch';
import {
    PaletteWorkbench,
    type PaletteWorkbenchTheme,
} from '@/components/palette-workbench';
import {
    SettingsConfigurationLayout,
    SettingsConfigurationShell,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { cssColorFromPicker, parseCssColor } from '@/lib/css-color';
import { cn } from '@/lib/utils';
import type {
    PublicPaletteField,
    PublicPaletteModeSettings,
    PublicPresentationSettings,
    SettingsPaletteField,
    SettingsPaletteModeSettings,
} from '@/theme/presentation';
import {
    getSettingsPalette,
    publicPaletteColor,
    settingsPaletteColor,
} from '@/theme/presentation';

type JournalTheme = {
    dark: Record<string, string | number>;
    light: Record<string, string | number>;
};

type ColorPaletteMap = {
    backgroundConfig: MapVisualConfig;
    id: number;
    slug: string;
    title: string;
};

export type ColorPaletteProps = {
    canUpdate: {
        journal: boolean;
        maps: boolean;
        presentation: boolean;
    };
    journal: {
        allowExpertAccessRequests: boolean;
        theme: JournalTheme;
    } | null;
    maps: ColorPaletteMap[];
    publicPresentation: PublicPresentationSettings | null;
};

type ColorPaletteSettingsProps = ColorPaletteProps & {
    embedded?: boolean;
};

type PaletteSection = 'presentation' | 'settings' | 'journal' | 'maps';
type MapVisualMode = Record<string, string | number | unknown[]>;
type MapVisualConfig = {
    dark?: MapVisualMode;
    light?: MapVisualMode;
};

type PaletteField = {
    field: string;
    label: string;
};

const publicFields: Array<{ field: PublicPaletteField; label: string }> = [
    { field: 'headingText', label: 'Heading text' },
    { field: 'bodyText', label: 'Body text' },
    { field: 'mutedText', label: 'Muted text' },
    { field: 'accentText', label: 'Accent' },
    { field: 'controlText', label: 'Control text' },
    { field: 'controlBorder', label: 'Control border' },
    { field: 'welcomeOverlay', label: 'Welcome background blend' },
];

const settingsFields: Array<{ field: SettingsPaletteField; label: string }> = [
    { field: 'accent', label: 'Accent' },
    { field: 'accentForeground', label: 'Accent foreground' },
    { field: 'activeBackground', label: 'Active item background' },
    {
        field: 'appearanceSwitchBackground',
        label: 'Appearance switch background',
    },
    {
        field: 'appearanceSwitchActiveBackground',
        label: 'Appearance switch active background',
    },
    {
        field: 'appearanceSwitchActiveText',
        label: 'Appearance switch active text',
    },
    {
        field: 'appearanceSwitchInactiveText',
        label: 'Appearance switch inactive text',
    },
    { field: 'sidebarBackground', label: 'Sidebar background' },
    { field: 'nestedSidebarBackground', label: 'Nested menu background' },
    { field: 'contentBackground', label: 'Content background' },
    { field: 'panelBackground', label: 'Panel background' },
    { field: 'borderColor', label: 'Border color' },
    { field: 'mutedText', label: 'Muted text' },
    { field: 'scrollbarThumb', label: 'Scrollbar thumb' },
];

const journalFields: PaletteField[] = [
    { field: 'backgroundOverlay', label: 'Background overlay' },
    { field: 'panelBackground', label: 'Panel background' },
    { field: 'panelBorder', label: 'Panel border' },
    { field: 'headerBackground', label: 'Header background' },
    { field: 'sidebarBackground', label: 'Sidebar background' },
    { field: 'contentBackground', label: 'Content background' },
    { field: 'inputBackground', label: 'Input background' },
    { field: 'headingText', label: 'Heading text' },
    { field: 'bodyText', label: 'Body text' },
    { field: 'mutedText', label: 'Muted text' },
    { field: 'accent', label: 'Accent' },
    { field: 'accentText', label: 'Accent text' },
    { field: 'buttonBackground', label: 'Button background' },
    { field: 'buttonText', label: 'Button text' },
    { field: 'buttonBorder', label: 'Button border' },
    { field: 'selectedBackground', label: 'Selected page background' },
    { field: 'selectedBorder', label: 'Selected page border' },
    { field: 'selectedText', label: 'Selected page text' },
];

const mapFieldGroups: Array<{
    fields: PaletteField[];
    id: string;
    label: string;
}> = [
    {
        id: 'general',
        label: 'General',
        fields: [
            { field: 'overlay', label: 'Map overlay' },
            { field: 'pageBackground', label: 'Map background' },
            { field: 'accentColor', label: 'Accent' },
        ],
    },
    {
        id: 'titlePanel',
        label: 'Map title panel',
        fields: [
            { field: 'panelBackground', label: 'Background' },
            { field: 'panelBorderColor', label: 'Border' },
            { field: 'panelTextColor', label: 'Text' },
            { field: 'panelMutedTextColor', label: 'Muted text' },
        ],
    },
    {
        id: 'nodePanel',
        label: 'Node side panel',
        fields: [
            { field: 'sidePanelBackground', label: 'Background' },
            { field: 'sidePanelBorderColor', label: 'Border' },
            { field: 'sidePanelHeadingColor', label: 'Heading accent' },
            { field: 'sidePanelTextColor', label: 'Text' },
            { field: 'sidePanelMutedTextColor', label: 'Muted text' },
        ],
    },
    {
        id: 'bottomNav',
        label: 'Bottom nav',
        fields: [
            { field: 'bottomNavBackground', label: 'Background' },
            { field: 'bottomNavBorderColor', label: 'Border' },
            { field: 'bottomNavIconColor', label: 'Icon' },
            { field: 'bottomNavTextColor', label: 'Text' },
            { field: 'bottomNavActiveBackground', label: 'Active background' },
            { field: 'bottomNavActiveIconColor', label: 'Active icon' },
            { field: 'bottomNavActiveTextColor', label: 'Active text' },
            { field: 'bottomNavExitIconColor', label: 'Exit icon' },
        ],
    },
    {
        id: 'rightControl',
        label: 'Right control',
        fields: [
            { field: 'sideControlBackground', label: 'Background' },
            { field: 'sideControlBorderColor', label: 'Border' },
            { field: 'sideControlIconColor', label: 'Icon' },
            { field: 'sideControlTextColor', label: 'Text' },
            {
                field: 'sideControlActiveBackground',
                label: 'Active background',
            },
            { field: 'sideControlActiveIconColor', label: 'Active icon' },
            { field: 'sideControlActiveTextColor', label: 'Active text' },
        ],
    },
];

export default function ColorPaletteSettings({
    canUpdate,
    embedded = false,
    journal,
    maps,
    publicPresentation,
}: ColorPaletteSettingsProps) {
    const [section, setSection] = useState<PaletteSection>(
        publicPresentation ? 'presentation' : journal ? 'journal' : 'maps',
    );
    const [mode, setMode] = useState<ConfigThemeMode>('dark');
    const [presentationDraft, setPresentationDraft] =
        useState(publicPresentation);
    const [journalThemeDraft, setJournalThemeDraft] = useState(
        journal?.theme ?? null,
    );
    const [mapDrafts, setMapDrafts] = useState(maps);
    const [selectedMapId, setSelectedMapId] = useState(maps[0]?.id ?? null);
    const [selectedMapGroup, setSelectedMapGroup] = useState(
        mapFieldGroups[0].id,
    );
    const [saving, setSaving] = useState(false);
    const hasChanges = useDirtyState(
        {
            journalTheme: journalThemeDraft,
            mapBackgroundConfigs: mapDrafts,
            publicPresentation: presentationDraft,
        },
        {
            journalTheme: journal?.theme ?? null,
            mapBackgroundConfigs: maps,
            publicPresentation,
        },
    );
    const availableColors = useMemo(
        () =>
            collectAvailableColors(
                presentationDraft,
                journalThemeDraft,
                mapDrafts,
            ),
        [journalThemeDraft, mapDrafts, presentationDraft],
    );
    const selectedMap =
        mapDrafts.find((map) => map.id === selectedMapId) ?? mapDrafts[0];
    const workbenchTheme = presentationDraft
        ? settingsPreviewColors(getSettingsPalette(presentationDraft, mode))
        : undefined;

    function save() {
        if (!hasChanges) {
            return;
        }

        setSaving(true);
        const payload: Record<string, FormDataConvertible> = {
            journalTheme: journalThemeDraft as FormDataConvertible,
            mapBackgroundConfigs: mapDrafts.map((map) => ({
                backgroundConfig: map.backgroundConfig,
                id: map.id,
            })) as FormDataConvertible,
            publicPresentation: presentationDraft as FormDataConvertible,
        };

        router.patch('/settings/color-palette', payload, {
            onFinish: () => setSaving(false),
            preserveScroll: true,
        });
    }

    const saveButton = (
        <Button disabled={saving || !hasChanges} onClick={save} type="button">
            <Save className="size-4" />
            {saving ? 'Saving...' : 'Save changes'}
        </Button>
    );

    const sidebar = (
        <SettingsSidebar>
            {presentationDraft ? (
                <SettingsSectionButton
                    active={section === 'presentation'}
                    description="Welcome, auth and public information text and overlay colors."
                    icon={Sparkles}
                    id="presentation"
                    label="Public text colors"
                    onSelect={setSection}
                />
            ) : null}
            {presentationDraft ? (
                <SettingsSectionButton
                    active={section === 'settings'}
                    description="Settings accent and active control contrast."
                    icon={SlidersHorizontal}
                    id="settings"
                    label="Settings UI"
                    onSelect={setSection}
                />
            ) : null}
            {journalThemeDraft ? (
                <SettingsSectionButton
                    active={section === 'journal'}
                    description="Journal shell, text, buttons and selected pages."
                    icon={BookOpen}
                    id="journal"
                    label="Journal"
                    onSelect={setSection}
                />
            ) : null}
            {mapDrafts.length > 0 ? (
                <SettingsSectionButton
                    active={section === 'maps'}
                    description="Map controls, panels and navigation colors."
                    icon={Map}
                    id="maps"
                    label="Map visuals"
                    onSelect={setSection}
                />
            ) : null}
        </SettingsSidebar>
    );

    const content = (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-white/10">
                <div>
                    <h2 className="text-xl font-semibold">
                        {sectionTitle(section)}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Edit color picker values across menus from one place.
                        The original menus remain available for detailed
                        configuration and previews.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {embedded ? saveButton : null}
                    <ConfigModeSwitch
                        mode={mode}
                        onChange={setMode}
                        size="large"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
                {section === 'presentation' && presentationDraft ? (
                    <PublicPresentationPalette
                        availableColors={availableColors}
                        canUpdate={canUpdate.presentation}
                        mode={mode}
                        onChange={setPresentationDraft}
                        presentation={presentationDraft}
                        storedPresentation={
                            publicPresentation ?? presentationDraft
                        }
                        workbenchTheme={workbenchTheme}
                    />
                ) : null}
                {section === 'settings' && presentationDraft ? (
                    <SettingsInterfacePalette
                        availableColors={availableColors}
                        canUpdate={canUpdate.presentation}
                        mode={mode}
                        onChange={setPresentationDraft}
                        presentation={presentationDraft}
                        storedPresentation={
                            publicPresentation ?? presentationDraft
                        }
                        workbenchTheme={workbenchTheme}
                    />
                ) : null}
                {section === 'journal' && journalThemeDraft ? (
                    <JournalPalette
                        availableColors={availableColors}
                        canUpdate={canUpdate.journal}
                        mode={mode}
                        onChange={setJournalThemeDraft}
                        storedTheme={journal?.theme ?? journalThemeDraft}
                        theme={journalThemeDraft}
                        workbenchTheme={workbenchTheme}
                    />
                ) : null}
                {section === 'maps' && selectedMap ? (
                    <MapPalette
                        availableColors={availableColors}
                        canUpdate={canUpdate.maps}
                        group={selectedMapGroup}
                        map={selectedMap}
                        maps={mapDrafts}
                        mode={mode}
                        onGroupChange={setSelectedMapGroup}
                        onMapChange={setSelectedMapId}
                        onMapsChange={setMapDrafts}
                        storedMaps={maps}
                        workbenchTheme={workbenchTheme}
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
            <Head title="Color palette" />
            <SettingsConfigurationShell
                action={saveButton}
                eyebrow="Administration"
                sidebar={sidebar}
                title="Color palette"
            >
                {content}
            </SettingsConfigurationShell>
        </>
    );
}

function PublicPresentationPalette({
    availableColors,
    canUpdate,
    mode,
    onChange,
    presentation,
    storedPresentation,
    workbenchTheme,
}: {
    availableColors: AvailableColorOption[];
    canUpdate: boolean;
    mode: ConfigThemeMode;
    onChange: (settings: PublicPresentationSettings) => void;
    presentation: PublicPresentationSettings;
    storedPresentation: PublicPresentationSettings;
    workbenchTheme?: PaletteWorkbenchTheme;
}) {
    const palette = presentation.publicPalette[mode];
    const storedPalette = storedPresentation.publicPalette[mode];

    return (
        <PaletteWorkbench
            disabled={!canUpdate}
            fields={publicFields}
            intro="Public colors are used by the welcome page, auth pages, source page and public information pages."
            theme={workbenchTheme}
            previewTabs={[
                {
                    content: (
                        <PublicPresentationPreview
                            mode={mode}
                            palette={palette}
                        />
                    ),
                    id: 'public',
                    label: 'Public pages',
                },
                {
                    content: (
                        <LoginPalettePreview mode={mode} palette={palette} />
                    ),
                    id: 'login',
                    label: 'Login',
                },
            ]}
            previewTitle="Public text colors"
            renderField={(field) => {
                const colorField = field.field as PublicPaletteField;
                const opacityField =
                    `${colorField}Opacity` as keyof PublicPaletteModeSettings;

                return (
                    <ColorOpacityField
                        availableColors={availableColors}
                        colorValue={palette[colorField]}
                        label={field.label}
                        onColorChange={(value) =>
                            onChange({
                                ...presentation,
                                publicPalette: {
                                    ...presentation.publicPalette,
                                    [mode]: {
                                        ...palette,
                                        [colorField]: value,
                                    },
                                },
                            })
                        }
                        onOpacityChange={(value) =>
                            onChange({
                                ...presentation,
                                publicPalette: {
                                    ...presentation.publicPalette,
                                    [mode]: {
                                        ...palette,
                                        [opacityField]: value,
                                    },
                                },
                            })
                        }
                        opacityValue={String(palette[opacityField] ?? 100)}
                        resetColorValue={storedPalette[colorField]}
                        resetOpacityValue={String(
                            storedPalette[opacityField] ?? 100,
                        )}
                    />
                );
            }}
        />
    );
}

function SettingsInterfacePalette({
    availableColors,
    canUpdate,
    mode,
    onChange,
    presentation,
    storedPresentation,
    workbenchTheme,
}: {
    availableColors: AvailableColorOption[];
    canUpdate: boolean;
    mode: ConfigThemeMode;
    onChange: (settings: PublicPresentationSettings) => void;
    presentation: PublicPresentationSettings;
    storedPresentation: PublicPresentationSettings;
    workbenchTheme?: PaletteWorkbenchTheme;
}) {
    const palette = getSettingsPalette(presentation, mode);
    const storedPalette = getSettingsPalette(storedPresentation, mode);
    const settingsPalette = {
        dark: getSettingsPalette(presentation, 'dark'),
        light: getSettingsPalette(presentation, 'light'),
    };

    return (
        <PaletteWorkbench
            disabled={!canUpdate}
            fields={settingsFields}
            intro="Settings UI colors control the accent marks, selected menu text, focus rings and active controls inside the settings workspace."
            theme={workbenchTheme}
            previewTabs={[
                {
                    content: <SettingsPalettePreview palette={palette} />,
                    id: 'settings',
                    label: 'Settings',
                },
                {
                    content: <SettingsControlsPreview palette={palette} />,
                    id: 'controls',
                    label: 'Controls',
                },
            ]}
            previewTitle="Settings workspace"
            renderField={(field) => {
                const colorField = field.field as SettingsPaletteField;
                const opacityField =
                    `${colorField}Opacity` as keyof SettingsPaletteModeSettings;

                return (
                    <ColorOpacityField
                        availableColors={availableColors}
                        colorValue={palette[colorField]}
                        label={field.label}
                        onColorChange={(value) =>
                            onChange({
                                ...presentation,
                                settingsPalette: {
                                    ...settingsPalette,
                                    [mode]: {
                                        ...palette,
                                        [colorField]: value,
                                    },
                                },
                            })
                        }
                        onOpacityChange={(value) =>
                            onChange({
                                ...presentation,
                                settingsPalette: {
                                    ...settingsPalette,
                                    [mode]: {
                                        ...palette,
                                        [opacityField]: value,
                                    },
                                },
                            })
                        }
                        opacityValue={String(palette[opacityField] ?? 100)}
                        resetColorValue={storedPalette[colorField]}
                        resetOpacityValue={String(
                            storedPalette[opacityField] ?? 100,
                        )}
                    />
                );
            }}
        />
    );
}

function JournalPalette({
    availableColors,
    canUpdate,
    mode,
    onChange,
    storedTheme,
    theme,
    workbenchTheme,
}: {
    availableColors: AvailableColorOption[];
    canUpdate: boolean;
    mode: ConfigThemeMode;
    onChange: (theme: JournalTheme) => void;
    storedTheme: JournalTheme;
    theme: JournalTheme;
    workbenchTheme?: PaletteWorkbenchTheme;
}) {
    const palette = theme[mode];
    const storedPalette = storedTheme[mode];

    return (
        <PaletteWorkbench
            disabled={!canUpdate}
            fields={journalFields}
            intro="Journal colors control the overlay, shell, page list, editor, rendered view and action buttons."
            theme={workbenchTheme}
            previewTabs={[
                {
                    content: <JournalPalettePreview palette={palette} />,
                    id: 'journal',
                    label: 'Journal',
                },
                {
                    content: <JournalRequestPreview palette={palette} />,
                    id: 'feedback',
                    label: 'Feedback',
                },
            ]}
            previewTitle="Journal"
            renderField={(field) => {
                const opacityField = `${field.field}Opacity`;

                return (
                    <ColorOpacityField
                        availableColors={availableColors}
                        colorValue={String(palette[field.field] ?? '')}
                        label={field.label}
                        onColorChange={(value) =>
                            onChange({
                                ...theme,
                                [mode]: {
                                    ...palette,
                                    [field.field]: value,
                                },
                            })
                        }
                        onOpacityChange={(value) =>
                            onChange({
                                ...theme,
                                [mode]: {
                                    ...palette,
                                    [opacityField]: value,
                                },
                            })
                        }
                        opacityValue={String(palette[opacityField] ?? 100)}
                        resetColorValue={String(
                            storedPalette[field.field] ?? '',
                        )}
                        resetOpacityValue={String(
                            storedPalette[opacityField] ?? 100,
                        )}
                    />
                );
            }}
        />
    );
}

function MapPalette({
    availableColors,
    canUpdate,
    group,
    map,
    maps,
    mode,
    onGroupChange,
    onMapChange,
    onMapsChange,
    storedMaps,
    workbenchTheme,
}: {
    availableColors: AvailableColorOption[];
    canUpdate: boolean;
    group: string;
    map: ColorPaletteMap;
    maps: ColorPaletteMap[];
    mode: ConfigThemeMode;
    onGroupChange: (group: string) => void;
    onMapChange: (id: number) => void;
    onMapsChange: (maps: ColorPaletteMap[]) => void;
    storedMaps: ColorPaletteMap[];
    workbenchTheme?: PaletteWorkbenchTheme;
}) {
    const activeGroup =
        mapFieldGroups.find((candidate) => candidate.id === group) ??
        mapFieldGroups[0];
    const modeConfig = map.backgroundConfig[mode] ?? {};
    const storedMap = storedMaps.find((candidate) => candidate.id === map.id);
    const storedModeConfig = storedMap?.backgroundConfig[mode] ?? {};

    return (
        <section className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="grid h-fit gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="grid gap-2">
                    <label className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                        Map
                    </label>
                    <select
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950"
                        onChange={(event) =>
                            onMapChange(Number(event.currentTarget.value))
                        }
                        value={map.id}
                    >
                        {maps.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                                {candidate.title}
                            </option>
                        ))}
                    </select>
                </div>
                <nav className="grid gap-2">
                    {mapFieldGroups.map((candidate) => (
                        <button
                            className={cn(
                                'rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                                candidate.id === activeGroup.id
                                    ? 'text-[var(--settings-accent-foreground)]'
                                    : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                            )}
                            key={candidate.id}
                            onClick={() => onGroupChange(candidate.id)}
                            style={
                                candidate.id === activeGroup.id
                                    ? { background: 'var(--settings-accent)' }
                                    : undefined
                            }
                            type="button"
                        >
                            {candidate.label}
                        </button>
                    ))}
                </nav>
            </aside>
            <PaletteWorkbench
                disabled={!canUpdate}
                fields={activeGroup.fields}
                intro={`${map.title}: ${activeGroup.label} colors for ${mode} mode.`}
                theme={workbenchTheme}
                previewTabs={[
                    {
                        content: (
                            <MapVisualPalettePreview
                                mapTitle={map.title}
                                modeConfig={modeConfig}
                            />
                        ),
                        id: 'map',
                        label: 'Map',
                    },
                    {
                        content: (
                            <MapControlsPalettePreview
                                modeConfig={modeConfig}
                            />
                        ),
                        id: 'controls',
                        label: 'Controls',
                    },
                ]}
                previewTitle={`${map.title} map visuals`}
                renderField={(field) => {
                    const parsed = parseCssColor(
                        String(modeConfig[field.field] ?? ''),
                    );
                    const storedRawValue = storedModeConfig[field.field];
                    const storedParsed = parseCssColor(
                        String(storedRawValue ?? ''),
                    );
                    const currentRawValue = modeConfig[field.field];
                    const canReset =
                        String(currentRawValue ?? '') !==
                        String(storedRawValue ?? '');

                    return (
                        <ColorOpacityField
                            availableColors={availableColors}
                            colorValue={parsed.hex}
                            label={field.label}
                            onColorChange={(value) =>
                                updateMapColor(
                                    maps,
                                    map.id,
                                    mode,
                                    field.field,
                                    cssColorFromPicker(value, parsed.opacity),
                                    onMapsChange,
                                )
                            }
                            onOpacityChange={(value) =>
                                updateMapColor(
                                    maps,
                                    map.id,
                                    mode,
                                    field.field,
                                    cssColorFromPicker(parsed.hex, value),
                                    onMapsChange,
                                )
                            }
                            opacityValue={parsed.opacity}
                            onReset={
                                canReset
                                    ? () =>
                                          updateMapColor(
                                              maps,
                                              map.id,
                                              mode,
                                              field.field,
                                              storedRawValue === undefined
                                                  ? undefined
                                                  : String(storedRawValue),
                                              onMapsChange,
                                          )
                                    : undefined
                            }
                            resetColorValue={storedParsed.hex}
                            resetOpacityValue={storedParsed.opacity}
                        />
                    );
                }}
            />
        </section>
    );
}

function PublicPresentationPreview({
    mode,
    palette,
}: {
    mode: ConfigThemeMode;
    palette: PublicPaletteModeSettings;
}) {
    const colors = publicPreviewColors(palette);

    return (
        <div
            className="grid gap-4 rounded-xl border p-5"
            style={{
                background:
                    mode === 'dark'
                        ? 'linear-gradient(135deg,#07111f,#0f172a)'
                        : 'linear-gradient(135deg,#e0f2fe,#f8fafc)',
                borderColor: colors.controlBorder,
            }}
        >
            <div className="relative overflow-hidden rounded-xl border p-6">
                <div
                    className="absolute inset-0"
                    style={{ background: colors.welcomeOverlay }}
                />
                <div className="relative z-10 max-w-xl">
                    <p
                        className="text-xs font-semibold tracking-[0.16em] uppercase"
                        style={{ color: colors.accentText }}
                    >
                        Public eyebrow
                    </p>
                    <h3
                        className="mt-2 text-3xl font-semibold tracking-normal"
                        style={{ color: colors.headingText }}
                    >
                        Learning Worlds
                    </h3>
                    <p
                        className="mt-3 max-w-lg text-sm leading-6"
                        style={{ color: colors.bodyText }}
                    >
                        Public pages use this palette for welcome copy,
                        information pages and source links.
                    </p>
                    <p
                        className="mt-2 text-xs"
                        style={{ color: colors.mutedText }}
                    >
                        Secondary helper text and quiet page context.
                    </p>
                    <button
                        className="mt-5 rounded-md border px-4 py-2 text-sm font-semibold"
                        style={{
                            borderColor: colors.controlBorder,
                            color: colors.controlText,
                        }}
                        type="button"
                    >
                        Read about the platform
                    </button>
                </div>
            </div>
            <div
                className="grid gap-3 rounded-xl border p-4"
                style={{
                    borderColor: colors.controlBorder,
                    color: colors.bodyText,
                }}
            >
                <h4
                    className="text-lg font-semibold"
                    style={{ color: colors.headingText }}
                >
                    About this platform
                </h4>
                <p className="text-sm leading-6">
                    Body text, links and muted legal information share these
                    tokens.
                </p>
                <a
                    className="text-sm font-semibold"
                    style={{ color: colors.accentText }}
                >
                    Source code
                </a>
            </div>
        </div>
    );
}

function LoginPalettePreview({
    mode,
    palette,
}: {
    mode: ConfigThemeMode;
    palette: PublicPaletteModeSettings;
}) {
    const colors = publicPreviewColors(palette);

    return (
        <div
            className="grid min-h-[30rem] place-items-center rounded-xl border p-6"
            style={{
                background:
                    mode === 'dark'
                        ? 'radial-gradient(circle at center,#123044,#020617 72%)'
                        : 'radial-gradient(circle at center,#bae6fd,#f8fafc 72%)',
                borderColor: colors.controlBorder,
            }}
        >
            <div
                className="w-full max-w-md rounded-xl border p-6 shadow-2xl"
                style={{
                    background:
                        mode === 'dark'
                            ? 'rgba(2, 6, 23, 0.78)'
                            : 'rgba(255, 255, 255, 0.84)',
                    borderColor: colors.controlBorder,
                }}
            >
                <h3
                    className="text-2xl font-semibold"
                    style={{ color: colors.headingText }}
                >
                    Log in to your account
                </h3>
                <p className="mt-2 text-sm" style={{ color: colors.bodyText }}>
                    Enter your email and password below.
                </p>
                <label
                    className="mt-6 block text-sm font-medium"
                    style={{ color: colors.bodyText }}
                >
                    Email address
                </label>
                <div
                    className="mt-2 h-10 rounded-md border px-3 py-2 text-sm"
                    style={{
                        borderColor: colors.controlBorder,
                        color: colors.mutedText,
                    }}
                >
                    email@example.com
                </div>
                <button
                    className="mt-5 h-10 w-full rounded-md text-sm font-semibold"
                    style={{
                        background: colors.accentText,
                        color: colors.controlText,
                    }}
                    type="button"
                >
                    Log in
                </button>
            </div>
        </div>
    );
}

function SettingsPalettePreview({
    palette,
}: {
    palette: SettingsPaletteModeSettings;
}) {
    const colors = settingsPreviewColors(palette);

    return (
        <div
            className="grid gap-4 rounded-xl border p-4"
            style={{
                background: colors.contentBackground,
                borderColor: colors.borderColor,
                color: colors.mutedText,
            }}
        >
            <div className="grid gap-4 lg:grid-cols-[12rem_12rem_minmax(0,1fr)]">
                <aside
                    className="rounded-xl border p-3"
                    style={{
                        background: colors.sidebarBackground,
                        borderColor: colors.borderColor,
                    }}
                >
                    {['Personal', 'World Builder', 'Color Palette'].map(
                        (item, index) => (
                            <div
                                className="relative mt-2 rounded-lg px-3 py-2 text-sm font-medium"
                                key={item}
                                style={
                                    index === 2
                                        ? {
                                              background:
                                                  colors.activeBackground,
                                              color: colors.accent,
                                          }
                                        : { color: colors.mutedText }
                                }
                            >
                                {index === 2 ? (
                                    <span
                                        className="absolute inset-y-2 left-0 w-1 rounded-r-full"
                                        style={{ background: colors.accent }}
                                    />
                                ) : null}
                                <span className="pl-3">{item}</span>
                            </div>
                        ),
                    )}
                </aside>
                <aside
                    className="rounded-xl border p-3"
                    style={{
                        background: colors.nestedSidebarBackground,
                        borderColor: colors.borderColor,
                    }}
                >
                    {['Profile', 'Appearance', 'Sound'].map((item, index) => (
                        <div
                            className="relative mt-2 rounded-lg px-3 py-2 text-sm font-medium"
                            key={item}
                            style={
                                index === 1
                                    ? {
                                          background: colors.activeBackground,
                                          color: colors.accent,
                                      }
                                    : { color: colors.mutedText }
                            }
                        >
                            {index === 1 ? (
                                <span
                                    className="absolute inset-y-2 left-0 w-1 rounded-r-full"
                                    style={{ background: colors.accent }}
                                />
                            ) : null}
                            <span className="pl-3">{item}</span>
                        </div>
                    ))}
                </aside>
                <section
                    className="rounded-xl border p-4"
                    style={{
                        background: colors.panelBackground,
                        borderColor: colors.borderColor,
                    }}
                >
                    <p
                        className="text-xs font-semibold tracking-[0.16em] uppercase"
                        style={{ color: colors.accent }}
                    >
                        Settings eyebrow
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                        Appearance
                    </h3>
                    <p
                        className="mt-2 text-sm"
                        style={{ color: colors.mutedText }}
                    >
                        Active menus, buttons, borders and muted text use these
                        tokens.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <button
                            className="rounded-md px-4 py-2 text-sm font-semibold"
                            style={{
                                background: colors.accent,
                                color: colors.accentForeground,
                            }}
                            type="button"
                        >
                            Save changes
                        </button>
                        <button
                            className="rounded-md border px-4 py-2 text-sm"
                            style={{
                                borderColor: colors.borderColor,
                                color: colors.mutedText,
                            }}
                            type="button"
                        >
                            Secondary
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}

function SettingsControlsPreview({
    palette,
}: {
    palette: SettingsPaletteModeSettings;
}) {
    const colors = settingsPreviewColors(palette);

    return (
        <div
            className="grid gap-4 rounded-xl border p-5"
            style={{
                background: colors.contentBackground,
                borderColor: colors.borderColor,
            }}
        >
            <div
                className="w-fit rounded-xl border p-1"
                style={{
                    background: colors.appearanceSwitchBackground,
                    borderColor: colors.borderColor,
                }}
            >
                {['System', 'Light', 'Dark'].map((item, index) => (
                    <button
                        className="rounded-lg px-4 py-2 text-sm font-medium"
                        key={item}
                        style={
                            index === 0
                                ? {
                                      background:
                                          colors.appearanceSwitchActiveBackground,
                                      color: colors.appearanceSwitchActiveText,
                                  }
                                : {
                                      color: colors.appearanceSwitchInactiveText,
                                  }
                        }
                        type="button"
                    >
                        {item}
                    </button>
                ))}
            </div>
            <div
                className="rounded-xl border p-4"
                style={{
                    background: colors.panelBackground,
                    borderColor: colors.borderColor,
                }}
            >
                <label className="text-sm font-medium text-white">
                    Site name
                </label>
                <div
                    className="mt-2 h-10 rounded-md border px-3 py-2 text-sm"
                    style={{
                        borderColor: colors.accent,
                        color: colors.mutedText,
                    }}
                >
                    Platform
                </div>
                <p className="mt-2 text-xs" style={{ color: colors.mutedText }}>
                    Focus rings and active states follow the accent token.
                </p>
            </div>
            <div
                className="rounded-xl border p-4"
                style={{
                    background: colors.panelBackground,
                    borderColor: colors.borderColor,
                }}
            >
                <p className="text-sm font-medium text-white">Scroll area</p>
                <div
                    className="mt-3 grid max-h-28 gap-2 overflow-y-auto pr-2"
                    style={
                        {
                            '--settings-scrollbar-thumb': colors.scrollbarThumb,
                            scrollbarColor: `${colors.scrollbarThumb} transparent`,
                        } as CSSProperties
                    }
                >
                    {['Navigation', 'Forms', 'Preview', 'Activity list'].map(
                        (item) => (
                            <div
                                className="rounded-md border px-3 py-2 text-sm"
                                key={item}
                                style={{
                                    background: colors.activeBackground,
                                    borderColor: colors.borderColor,
                                    color: colors.mutedText,
                                }}
                            >
                                {item}
                            </div>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}

function JournalPalettePreview({
    palette,
}: {
    palette: Record<string, number | string>;
}) {
    const colors = journalPreviewColors(palette);

    return (
        <div
            className="rounded-xl border p-4"
            style={{
                background: colors.backgroundOverlay,
                borderColor: colors.panelBorder,
                color: colors.bodyText,
            }}
        >
            <div
                className="grid gap-4 rounded-xl border p-4 lg:grid-cols-[14rem_minmax(0,1fr)]"
                style={{
                    background: colors.panelBackground,
                    borderColor: colors.panelBorder,
                }}
            >
                <aside
                    className="rounded-xl border p-3"
                    style={{
                        background: colors.sidebarBackground,
                        borderColor: colors.panelBorder,
                    }}
                >
                    {['Field Notes', 'Reflection', 'Next question'].map(
                        (item, index) => (
                            <div
                                className="mt-2 rounded-lg border px-3 py-2 text-sm"
                                key={item}
                                style={
                                    index === 0
                                        ? {
                                              background:
                                                  colors.selectedBackground,
                                              borderColor:
                                                  colors.selectedBorder,
                                              color: colors.selectedText,
                                          }
                                        : {
                                              borderColor: colors.panelBorder,
                                              color: colors.mutedText,
                                          }
                                }
                            >
                                {item}
                            </div>
                        ),
                    )}
                </aside>
                <article
                    className="rounded-xl border p-4"
                    style={{
                        background: colors.contentBackground,
                        borderColor: colors.panelBorder,
                    }}
                >
                    <h3
                        className="text-xl font-semibold"
                        style={{ color: colors.headingText }}
                    >
                        Field Notes
                    </h3>
                    <p className="mt-2 text-sm leading-6">
                        Learner writing uses body text, muted helper text and
                        the accent for actions.
                    </p>
                    <textarea
                        className="mt-4 h-24 w-full resize-none rounded-md border p-3 text-sm"
                        readOnly
                        style={{
                            background: colors.inputBackground,
                            borderColor: colors.buttonBorder,
                            color: colors.bodyText,
                        }}
                        value="Today I connected the map route with the question I wanted to answer."
                    />
                </article>
            </div>
        </div>
    );
}

function JournalRequestPreview({
    palette,
}: {
    palette: Record<string, number | string>;
}) {
    const colors = journalPreviewColors(palette);

    return (
        <div
            className="grid gap-4 rounded-xl border p-5"
            style={{
                background: colors.panelBackground,
                borderColor: colors.panelBorder,
            }}
        >
            <div>
                <p
                    className="text-xs font-semibold tracking-[0.16em] uppercase"
                    style={{ color: colors.accent }}
                >
                    Feedback request
                </p>
                <h3
                    className="mt-2 text-xl font-semibold"
                    style={{ color: colors.headingText }}
                >
                    Ask for review
                </h3>
                <p className="mt-2 text-sm" style={{ color: colors.mutedText }}>
                    Buttons and accent labels use the journal action tokens.
                </p>
            </div>
            <button
                className="w-fit rounded-md border px-4 py-2 text-sm font-semibold"
                style={{
                    background: colors.buttonBackground,
                    borderColor: colors.buttonBorder,
                    color: colors.buttonText,
                }}
                type="button"
            >
                Request feedback
            </button>
        </div>
    );
}

function MapVisualPalettePreview({
    mapTitle,
    modeConfig,
}: {
    mapTitle: string;
    modeConfig: MapVisualMode;
}) {
    const colors = mapPreviewColors(modeConfig);

    return (
        <div
            className="relative min-h-[30rem] overflow-hidden rounded-xl border p-4"
            style={{
                background:
                    colors.pageBackground ||
                    'radial-gradient(circle at center,#102033,#020617)',
                borderColor: colors.panelBorderColor,
            }}
        >
            <div
                className="absolute inset-0"
                style={{ background: colors.overlay }}
            />
            <div className="relative z-10 grid gap-4">
                <section
                    className="w-fit rounded-xl border p-4"
                    style={{
                        background: colors.panelBackground,
                        borderColor: colors.panelBorderColor,
                    }}
                >
                    <h3
                        className="text-xl font-semibold"
                        style={{ color: colors.panelTextColor }}
                    >
                        {mapTitle}
                    </h3>
                    <p
                        className="mt-1 text-sm"
                        style={{ color: colors.panelMutedTextColor }}
                    >
                        7 nodes
                    </p>
                </section>
                <div className="relative h-64 rounded-xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.18),transparent_58%)]">
                    <div
                        className="absolute top-24 left-32 size-16 rounded-full border shadow-[0_0_34px_currentColor]"
                        style={{
                            borderColor: colors.accentColor,
                            color: colors.accentColor,
                        }}
                    />
                    <div
                        className="absolute top-32 left-72 size-10 rounded-full border"
                        style={{ borderColor: colors.accentColor }}
                    />
                    <svg
                        className="absolute top-30 left-44 h-16 w-32"
                        viewBox="0 0 128 64"
                    >
                        <path
                            d="M4 34 C 34 6, 82 52, 124 20"
                            fill="none"
                            stroke={colors.accentColor}
                            strokeDasharray="4 6"
                            strokeWidth="2"
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
}

function MapControlsPalettePreview({
    modeConfig,
}: {
    modeConfig: MapVisualMode;
}) {
    const colors = mapPreviewColors(modeConfig);

    return (
        <div className="grid gap-5 rounded-xl border border-white/10 p-5">
            <section
                className="rounded-xl border p-4"
                style={{
                    background: colors.sidePanelBackground,
                    borderColor: colors.sidePanelBorderColor,
                }}
            >
                <h3
                    className="text-xl font-semibold"
                    style={{ color: colors.sidePanelHeadingColor }}
                >
                    Signal Gate
                </h3>
                <p
                    className="mt-2 text-sm leading-6"
                    style={{ color: colors.sidePanelTextColor }}
                >
                    Side panels, details and map controls use this palette.
                </p>
                <p
                    className="mt-2 text-xs"
                    style={{ color: colors.sidePanelMutedTextColor }}
                >
                    Locked until route discovered.
                </p>
            </section>
            <div
                className="flex w-fit gap-2 rounded-xl border p-2"
                style={{
                    background: colors.bottomNavBackground,
                    borderColor: colors.bottomNavBorderColor,
                    color: colors.bottomNavIconColor,
                }}
            >
                {['Map', 'Saved', 'Settings'].map((item, index) => (
                    <div
                        className="rounded-lg px-3 py-2 text-xs font-semibold"
                        key={item}
                        style={
                            index === 2
                                ? {
                                      background:
                                          colors.bottomNavActiveBackground,
                                      color: colors.bottomNavActiveTextColor,
                                  }
                                : {
                                      color: colors.bottomNavTextColor,
                                  }
                        }
                    >
                        {item}
                    </div>
                ))}
                <div
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ color: colors.bottomNavExitIconColor }}
                >
                    Exit
                </div>
            </div>
            <div
                className="flex w-fit gap-2 rounded-xl border p-2"
                style={{
                    background: colors.sideControlBackground,
                    borderColor: colors.sideControlBorderColor,
                }}
            >
                {['Group', 'Profile', 'Chat'].map((item, index) => (
                    <div
                        className="rounded-lg px-3 py-2 text-xs font-semibold"
                        key={item}
                        style={
                            index === 1
                                ? {
                                      background:
                                          colors.sideControlActiveBackground,
                                      color: colors.sideControlActiveTextColor,
                                  }
                                : {
                                      color: colors.sideControlTextColor,
                                  }
                        }
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
}

function publicPreviewColors(
    palette: PublicPaletteModeSettings,
): Record<PublicPaletteField, string> {
    return {
        accentText: publicPaletteColor(palette, 'accentText'),
        bodyText: publicPaletteColor(palette, 'bodyText'),
        controlBorder: publicPaletteColor(palette, 'controlBorder'),
        controlText: publicPaletteColor(palette, 'controlText'),
        headingText: publicPaletteColor(palette, 'headingText'),
        mutedText: publicPaletteColor(palette, 'mutedText'),
        welcomeOverlay: publicPaletteColor(palette, 'welcomeOverlay'),
    };
}

function settingsPreviewColors(
    palette: SettingsPaletteModeSettings,
): Record<SettingsPaletteField, string> {
    return {
        accent: settingsPaletteColor(palette, 'accent'),
        accentForeground: settingsPaletteColor(palette, 'accentForeground'),
        activeBackground: settingsPaletteColor(palette, 'activeBackground'),
        appearanceSwitchActiveBackground: settingsPaletteColor(
            palette,
            'appearanceSwitchActiveBackground',
        ),
        appearanceSwitchActiveText: settingsPaletteColor(
            palette,
            'appearanceSwitchActiveText',
        ),
        appearanceSwitchBackground: settingsPaletteColor(
            palette,
            'appearanceSwitchBackground',
        ),
        appearanceSwitchInactiveText: settingsPaletteColor(
            palette,
            'appearanceSwitchInactiveText',
        ),
        borderColor: settingsPaletteColor(palette, 'borderColor'),
        contentBackground: settingsPaletteColor(palette, 'contentBackground'),
        mutedText: settingsPaletteColor(palette, 'mutedText'),
        nestedSidebarBackground: settingsPaletteColor(
            palette,
            'nestedSidebarBackground',
        ),
        panelBackground: settingsPaletteColor(palette, 'panelBackground'),
        scrollbarThumb: settingsPaletteColor(palette, 'scrollbarThumb'),
        sidebarBackground: settingsPaletteColor(palette, 'sidebarBackground'),
    };
}

function journalPreviewColors(
    palette: Record<string, number | string>,
): Record<string, string> {
    const fallback: Record<string, string> = {
        accent: '#2dd4bf',
        accentText: '#5eead4',
        backgroundOverlay: 'rgba(2, 6, 23, 0.68)',
        bodyText: '#cbd5e1',
        buttonBackground: '#2dd4bf',
        buttonBorder: '#2dd4bf',
        buttonText: '#042f2e',
        contentBackground: '#0f172a',
        headerBackground: '#111827',
        headingText: '#f8fafc',
        inputBackground: '#020617',
        mutedText: '#94a3b8',
        panelBackground: '#111827',
        panelBorder: 'rgba(255, 255, 255, 0.12)',
        selectedBackground: 'rgba(45, 212, 191, 0.14)',
        selectedBorder: '#2dd4bf',
        selectedText: '#f8fafc',
        sidebarBackground: '#020617',
    };

    return Object.fromEntries(
        Object.entries(fallback).map(([field, fallbackValue]) => [
            field,
            paletteColorWithOpacity(palette, field, fallbackValue),
        ]),
    );
}

function mapPreviewColors(modeConfig: MapVisualMode): Record<string, string> {
    const fallback: Record<string, string> = {
        accentColor: '#2dd4bf',
        bottomNavActiveBackground: '#2dd4bf',
        bottomNavActiveIconColor: '#042f2e',
        bottomNavActiveTextColor: '#042f2e',
        bottomNavBackground: 'rgba(8, 17, 26, 0.78)',
        bottomNavBorderColor: 'rgba(255, 255, 255, 0.12)',
        bottomNavExitIconColor: '#ef4444',
        bottomNavIconColor: '#cbd5e1',
        bottomNavTextColor: '#cbd5e1',
        overlay: 'rgba(2, 6, 23, 0.48)',
        pageBackground: '#020617',
        panelBackground: 'rgba(8, 17, 26, 0.82)',
        panelBorderColor: 'rgba(255, 255, 255, 0.14)',
        panelMutedTextColor: '#94a3b8',
        panelTextColor: '#f8fafc',
        sideControlActiveBackground: '#2dd4bf',
        sideControlActiveIconColor: '#042f2e',
        sideControlActiveTextColor: '#042f2e',
        sideControlBackground: 'rgba(8, 17, 26, 0.78)',
        sideControlBorderColor: 'rgba(255, 255, 255, 0.12)',
        sideControlIconColor: '#cbd5e1',
        sideControlTextColor: '#cbd5e1',
        sidePanelBackground: 'rgba(8, 17, 26, 0.86)',
        sidePanelBorderColor: 'rgba(255, 255, 255, 0.12)',
        sidePanelHeadingColor: '#5eead4',
        sidePanelMutedTextColor: '#94a3b8',
        sidePanelTextColor: '#e2e8f0',
    };

    return Object.fromEntries(
        Object.entries(fallback).map(([field, fallbackValue]) => [
            field,
            String(modeConfig[field] ?? fallbackValue),
        ]),
    );
}

function paletteColorWithOpacity(
    palette: Record<string, number | string>,
    field: string,
    fallback: string,
): string {
    const color = String(palette[field] ?? fallback);
    const opacity = String(palette[`${field}Opacity`] ?? '100');

    return isHexColor(color) ? cssColorFromPicker(color, opacity) : color;
}

function updateMapColor(
    maps: ColorPaletteMap[],
    mapId: number,
    mode: ConfigThemeMode,
    field: string,
    value: string | undefined,
    onMapsChange: (maps: ColorPaletteMap[]) => void,
) {
    onMapsChange(
        maps.map((map) =>
            map.id === mapId
                ? updateMapColorField(map, mode, field, value)
                : map,
        ),
    );
}

function updateMapColorField(
    map: ColorPaletteMap,
    mode: ConfigThemeMode,
    field: string,
    value: string | undefined,
): ColorPaletteMap {
    const nextModeConfig = { ...(map.backgroundConfig[mode] ?? {}) };

    if (value === undefined) {
        delete nextModeConfig[field];
    } else {
        nextModeConfig[field] = value;
    }

    return {
        ...map,
        backgroundConfig: {
            ...map.backgroundConfig,
            [mode]: nextModeConfig,
        },
    };
}

function collectAvailableColors(
    presentation: PublicPresentationSettings | null,
    journalTheme: JournalTheme | null,
    maps: ColorPaletteMap[],
): AvailableColorOption[] {
    const colors: AvailableColorOption[] = [];

    if (presentation) {
        for (const mode of ['dark', 'light'] as const) {
            for (const field of publicFields) {
                const opacityField =
                    `${field.field}Opacity` as keyof PublicPaletteModeSettings;

                colors.push({
                    label: `Public ${mode}: ${field.label}`,
                    opacity:
                        presentation.publicPalette[mode][opacityField] ??
                        undefined,
                    value: presentation.publicPalette[mode][field.field],
                });
            }

            const settingsPalette = getSettingsPalette(presentation, mode);

            for (const field of settingsFields) {
                const opacityField =
                    `${field.field}Opacity` as keyof SettingsPaletteModeSettings;

                colors.push({
                    label: `Settings ${mode}: ${field.label}`,
                    opacity: settingsPalette[opacityField] ?? undefined,
                    value: settingsPalette[field.field],
                });
            }
        }
    }

    if (journalTheme) {
        for (const mode of ['dark', 'light'] as const) {
            for (const field of journalFields) {
                colors.push({
                    label: `Journal ${mode}: ${field.label}`,
                    opacity:
                        journalTheme[mode][`${field.field}Opacity`] ??
                        undefined,
                    value: String(journalTheme[mode][field.field] ?? ''),
                });
            }
        }
    }

    for (const map of maps) {
        for (const mode of ['dark', 'light'] as const) {
            for (const group of mapFieldGroups) {
                for (const field of group.fields) {
                    const parsed = parseCssColor(
                        String(map.backgroundConfig[mode]?.[field.field] ?? ''),
                    );

                    colors.push({
                        label: `${map.title} ${mode}: ${group.label} / ${field.label}`,
                        opacity: parsed.opacity,
                        value: parsed.hex,
                    });
                }
            }
        }
    }

    const seen = new Set<string>();

    return colors.filter((color) => {
        if (!color.value) {
            return false;
        }

        const key = `${color.value}-${color.opacity ?? ''}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
}

function sectionTitle(section: PaletteSection): string {
    if (section === 'settings') {
        return 'Settings UI colors';
    }

    if (section === 'journal') {
        return 'Journal colors';
    }

    if (section === 'maps') {
        return 'Map visual colors';
    }

    return 'Public text colors';
}
