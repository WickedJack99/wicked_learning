import type { FormDataConvertible } from '@inertiajs/core';
import { Head, router } from '@inertiajs/react';
import { BookOpen, Map, Palette, Save, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    type AvailableColorOption,
    ColorOpacityField,
} from '@/components/color-input';
import { ConfigModeSwitch } from '@/components/config-mode-switch';
import type { ConfigThemeMode } from '@/components/config-mode-switch';
import {
    SettingsConfigurationShell,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { cssColorFromPicker, parseCssColor } from '@/lib/css-color';
import { cn } from '@/lib/utils';
import type {
    PublicPaletteField,
    PublicPaletteModeSettings,
    PublicPresentationSettings,
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

type ColorPaletteProps = {
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

type PaletteSection = 'presentation' | 'journal' | 'maps';
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
    journal,
    maps,
    publicPresentation,
}: ColorPaletteProps) {
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

    function save() {
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

    return (
        <>
            <Head title="Color palette" />
            <SettingsConfigurationShell
                action={
                    <Button disabled={saving} onClick={save} type="button">
                        <Save className="size-4" />
                        {saving ? 'Saving...' : 'Save changes'}
                    </Button>
                }
                eyebrow="Administration"
                sidebar={
                    <SettingsSidebar>
                        {presentationDraft ? (
                            <SettingsSectionButton
                                active={section === 'presentation'}
                                description="Welcome, auth and public information colors."
                                icon={Sparkles}
                                id="presentation"
                                label="Public presentation"
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
                }
                title="Color palette"
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-white/10">
                        <div>
                            <h2 className="text-xl font-semibold">
                                {sectionTitle(section)}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                Edit color picker values across menus from one
                                place. The original menus remain available for
                                detailed configuration and previews.
                            </p>
                        </div>
                        <ConfigModeSwitch
                            mode={mode}
                            onChange={setMode}
                            size="large"
                        />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
                        {section === 'presentation' && presentationDraft ? (
                            <PublicPresentationPalette
                                availableColors={availableColors}
                                canUpdate={canUpdate.presentation}
                                mode={mode}
                                onChange={setPresentationDraft}
                                presentation={presentationDraft}
                            />
                        ) : null}
                        {section === 'journal' && journalThemeDraft ? (
                            <JournalPalette
                                availableColors={availableColors}
                                canUpdate={canUpdate.journal}
                                mode={mode}
                                onChange={setJournalThemeDraft}
                                theme={journalThemeDraft}
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
                            />
                        ) : null}
                    </div>
                </div>
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
}: {
    availableColors: AvailableColorOption[];
    canUpdate: boolean;
    mode: ConfigThemeMode;
    onChange: (settings: PublicPresentationSettings) => void;
    presentation: PublicPresentationSettings;
}) {
    const palette = presentation.publicPalette[mode];

    return (
        <PaletteGrid
            disabled={!canUpdate}
            fields={publicFields}
            intro="Public colors are used by the welcome page, auth pages, source page and public information pages."
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
    theme,
}: {
    availableColors: AvailableColorOption[];
    canUpdate: boolean;
    mode: ConfigThemeMode;
    onChange: (theme: JournalTheme) => void;
    theme: JournalTheme;
}) {
    const palette = theme[mode];

    return (
        <PaletteGrid
            disabled={!canUpdate}
            fields={journalFields}
            intro="Journal colors control the overlay, shell, page list, editor, rendered view and action buttons."
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
}) {
    const activeGroup =
        mapFieldGroups.find((candidate) => candidate.id === group) ??
        mapFieldGroups[0];
    const modeConfig = map.backgroundConfig[mode] ?? {};

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
            <PaletteGrid
                disabled={!canUpdate}
                fields={activeGroup.fields}
                intro={`${map.title}: ${activeGroup.label} colors for ${mode} mode.`}
                renderField={(field) => {
                    const parsed = parseCssColor(
                        String(modeConfig[field.field] ?? ''),
                    );

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
                        />
                    );
                }}
            />
        </section>
    );
}

function PaletteGrid({
    disabled,
    fields,
    intro,
    renderField,
}: {
    disabled: boolean;
    fields: PaletteField[];
    intro: string;
    renderField: (field: PaletteField) => React.ReactNode;
}) {
    return (
        <section className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {intro}
                {!disabled ? null : (
                    <span className="mt-1 block text-amber-600 dark:text-amber-200">
                        You can inspect these colors, but your role cannot save
                        this section.
                    </span>
                )}
            </div>
            <div
                className={cn(
                    'grid gap-4 lg:grid-cols-2 2xl:grid-cols-3',
                    disabled && 'pointer-events-none opacity-70',
                )}
            >
                {fields.map((field) => (
                    <div
                        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/60"
                        key={field.field}
                    >
                        {renderField(field)}
                    </div>
                ))}
            </div>
        </section>
    );
}

function updateMapColor(
    maps: ColorPaletteMap[],
    mapId: number,
    mode: ConfigThemeMode,
    field: string,
    value: string,
    onMapsChange: (maps: ColorPaletteMap[]) => void,
) {
    onMapsChange(
        maps.map((map) =>
            map.id === mapId
                ? {
                      ...map,
                      backgroundConfig: {
                          ...map.backgroundConfig,
                          [mode]: {
                              ...(map.backgroundConfig[mode] ?? {}),
                              [field]: value,
                          },
                      },
                  }
                : map,
        ),
    );
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
    if (section === 'journal') {
        return 'Journal colors';
    }

    if (section === 'maps') {
        return 'Map visual colors';
    }

    return 'Public presentation colors';
}
