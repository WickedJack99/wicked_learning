import { Head, router } from '@inertiajs/react';
import {
    Image,
    LayoutPanelTop,
    Map as MapIcon,
    Navigation,
    Palette,
    PanelRight,
    Plus,
    Save,
    ShieldCheck,
    SlidersHorizontal,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ColorOpacityField, isHexColor } from '@/components/color-input';
import { ConfigModeSwitch } from '@/components/config-mode-switch';
import InputError from '@/components/input-error';
import {
    SettingsConfigurationLayout,
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsPanelHeader,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadMediaFile } from '@/lib/media-upload';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import { ConfigImageInput } from '@/pages/settings/worlds/activity-config-fields';
import type { MapVisualAsset } from '@/types/learning';

type EditableWorld = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
};

type EditableMap = {
    accessRoles: string[];
    backgroundConfig: MapVisualConfig;
    description: string | null;
    editingGroupIds: number[];
    id: number;
    nodeCount: number;
    slug: string;
    title: string;
};

type EditableMapPayload = {
    map: EditableMap;
    world: EditableWorld;
};

type AccessGroup = {
    description: string | null;
    label: string;
    slug: string;
};

type LearningGroupOption = {
    description: string | null;
    id: number;
    name: string;
    slug: string;
};

type ThemeMode = 'dark' | 'light';
type MainSection = 'details' | 'visuals' | 'access' | 'delete';
type VisualSection =
    | 'general'
    | 'titlePanel'
    | 'sidePanel'
    | 'bottomNav'
    | 'rightControl'
    | 'backgroundImage'
    | 'assets';

type MapVisualThemeFields = {
    accentColor: string;
    assets: MapVisualAssetForm[];
    bottomNavActiveBackground: string;
    bottomNavActiveIconColor: string;
    bottomNavActiveTextColor: string;
    bottomNavBackground: string;
    bottomNavBorderColor: string;
    bottomNavExitIconColor: string;
    bottomNavIconColor: string;
    bottomNavTextColor: string;
    imageUrl: string;
    overlay: string;
    pageBackground: string;
    panelBackground: string;
    panelBorderColor: string;
    panelMutedTextColor: string;
    panelTextColor: string;
    sideControlActiveBackground: string;
    sideControlActiveIconColor: string;
    sideControlActiveTextColor: string;
    sideControlBackground: string;
    sideControlBorderColor: string;
    sideControlIconColor: string;
    sideControlTextColor: string;
    sidePanelBackground: string;
    sidePanelBorderColor: string;
    sidePanelHeadingColor: string;
    sidePanelMutedTextColor: string;
    sidePanelTextColor: string;
};

type MapVisualAssetForm = {
    id: string;
    imageUrl: string;
    opacity: string;
    width: string;
    x: string;
    y: string;
};

type MapVisualConfig = {
    dark?: Partial<MapVisualThemeFields>;
    light?: Partial<MapVisualThemeFields>;
};

type MapVisualForm = {
    dark: MapVisualThemeFields;
    light: MapVisualThemeFields;
};

type DetailsForm = {
    description: string;
    title: string;
};

const mainSections: {
    danger?: boolean;
    icon: typeof MapIcon;
    id: MainSection;
    label: string;
}[] = [
    { icon: LayoutPanelTop, id: 'details', label: 'Map details' },
    { icon: Palette, id: 'visuals', label: 'Map visuals' },
    { icon: ShieldCheck, id: 'access', label: 'Access' },
    { danger: true, icon: Trash2, id: 'delete', label: 'Delete world' },
];

const visualSections: {
    description: string;
    icon: typeof MapIcon;
    id: VisualSection;
    label: string;
}[] = [
    {
        description: 'Overlay, page background and accent color.',
        icon: MapIcon,
        id: 'general',
        label: 'General',
    },
    {
        description: 'The current-map title panel in the top-left corner.',
        icon: LayoutPanelTop,
        id: 'titlePanel',
        label: 'Map title panel',
    },
    {
        description: 'The focused node description panel.',
        icon: PanelRight,
        id: 'sidePanel',
        label: 'Node description side panel',
    },
    {
        description: 'The floating primary navigation at the bottom.',
        icon: Navigation,
        id: 'bottomNav',
        label: 'Bottom nav',
    },
    {
        description: 'Inventory, tools and future player controls.',
        icon: SlidersHorizontal,
        id: 'rightControl',
        label: 'Right control',
    },
    {
        description: 'The main map background image for this mode.',
        icon: Image,
        id: 'backgroundImage',
        label: 'Background image',
    },
    {
        description: 'Decorative map layers placed over the background.',
        icon: Plus,
        id: 'assets',
        label: 'Assets',
    },
];

const visualFieldGroups: Record<
    Exclude<VisualSection, 'backgroundImage' | 'assets'>,
    { key: keyof MapVisualThemeFields; label: string }[]
> = {
    general: [
        { key: 'overlay', label: 'Map overlay' },
        { key: 'pageBackground', label: 'Map background' },
        { key: 'accentColor', label: 'Accent' },
    ],
    titlePanel: [
        { key: 'panelBackground', label: 'Background' },
        { key: 'panelBorderColor', label: 'Border' },
        { key: 'panelTextColor', label: 'Text' },
        { key: 'panelMutedTextColor', label: 'Muted text' },
    ],
    sidePanel: [
        { key: 'sidePanelBackground', label: 'Background' },
        { key: 'sidePanelBorderColor', label: 'Border' },
        { key: 'sidePanelHeadingColor', label: 'Heading accent' },
        { key: 'sidePanelTextColor', label: 'Text' },
        { key: 'sidePanelMutedTextColor', label: 'Muted text' },
    ],
    bottomNav: [
        { key: 'bottomNavBackground', label: 'Background' },
        { key: 'bottomNavBorderColor', label: 'Border' },
        { key: 'bottomNavIconColor', label: 'Icon' },
        { key: 'bottomNavTextColor', label: 'Text' },
        { key: 'bottomNavActiveBackground', label: 'Active background' },
        { key: 'bottomNavActiveIconColor', label: 'Active icon' },
        { key: 'bottomNavActiveTextColor', label: 'Active text' },
        { key: 'bottomNavExitIconColor', label: 'Exit icon' },
    ],
    rightControl: [
        { key: 'sideControlBackground', label: 'Background' },
        { key: 'sideControlBorderColor', label: 'Border' },
        { key: 'sideControlIconColor', label: 'Icon' },
        { key: 'sideControlTextColor', label: 'Text' },
        { key: 'sideControlActiveBackground', label: 'Active background' },
        { key: 'sideControlActiveIconColor', label: 'Active icon' },
        { key: 'sideControlActiveTextColor', label: 'Active text' },
    ],
};

export default function ConfigureMap({
    accessGroups,
    embedded = false,
    canDeleteWorldMaps,
    editableMap,
    learningGroups,
}: {
    accessGroups: AccessGroup[];
    embedded?: boolean;
    canDeleteWorldMaps: boolean;
    editableMap: EditableMapPayload;
    learningGroups: LearningGroupOption[];
}) {
    const { map, world } = editableMap;
    const [mainSection, setMainSection] = useState<MainSection>('details');
    const [visualSection, setVisualSection] =
        useState<VisualSection>('general');
    const [mode, setMode] = useState<ThemeMode>('dark');
    const [detailsForm, setDetailsForm] = useState<DetailsForm>({
        description: map.description ?? '',
        title: map.title,
    });
    const [visualForm, setVisualForm] = useState<MapVisualForm>(() =>
        mapVisualFormFromConfig(map.backgroundConfig),
    );
    const [accessRoles, setAccessRoles] = useState<string[]>(
        map.accessRoles.length > 0 ? map.accessRoles : ['user', 'admin'],
    );
    const [editingGroupIds, setEditingGroupIds] = useState<number[]>(
        map.editingGroupIds,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
        null,
    );
    const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
    const resolvedTheme = useMemo(
        () => resolveThemePreview(visualForm, mode),
        [mode, visualForm],
    );

    const saveCurrentSection = () => {
        if (mainSection === 'details') {
            saveDetails(map.id, detailsForm, setErrors, setProcessing);

            return;
        }

        if (mainSection === 'access') {
            saveAccess(map.id, accessRoles, setErrors, setProcessing);
            saveEditingGroups(
                map.id,
                editingGroupIds,
                setErrors,
                setProcessing,
            );

            return;
        }

        if (mainSection === 'delete') {
            return;
        }

        saveVisuals(map.id, visualForm, setErrors, setProcessing);
    };

    const deleteMap = () => {
        setDeleting(true);

        router.delete(`/settings/worlds/maps/${map.id}`, {
            onFinish: () => setDeleting(false),
        });
    };

    const uploadImage = async (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => {
        setUploadingImageKey(key);
        setImageErrors((current) => ({ ...current, [key]: '' }));

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/worlds/node-images',
                errorMessage: 'The image could not be uploaded.',
                fieldName: 'image',
                file,
            });
            onUploaded(payload.url);
        } catch (error) {
            setImageErrors((current) => ({
                ...current,
                [key]:
                    error instanceof Error
                        ? error.message
                        : 'The image could not be uploaded.',
            }));
        } finally {
            setUploadingImageKey(null);
        }
    };

    const action =
        mainSection !== 'delete' ? (
            <Button
                disabled={processing}
                onClick={saveCurrentSection}
                type="button"
            >
                <Save className="size-4" />
                {processing ? 'Saving...' : 'Save changes'}
            </Button>
        ) : null;
    const sidebar = (
        <SettingsSidebar>
            {mainSections.map((section) => (
                <SettingsSectionButton
                    active={mainSection === section.id}
                    danger={section.danger}
                    icon={section.icon}
                    id={section.id}
                    key={section.id}
                    label={section.label}
                    onSelect={setMainSection}
                />
            ))}
        </SettingsSidebar>
    );
    const body = (
        <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-[#0b1117]/80">
            {mainSection === 'details' ? (
                <MapDetailsSection
                    errors={errors}
                    form={detailsForm}
                    onChange={setDetailsForm}
                    previewTheme={resolvedTheme}
                />
            ) : null}
            {mainSection === 'visuals' ? (
                <MapVisualsSection
                    errors={errors}
                    imageErrors={imageErrors}
                    mode={mode}
                    onImageUpload={uploadImage}
                    onModeChange={setMode}
                    onVisualSectionChange={setVisualSection}
                    setForm={setVisualForm}
                    theme={resolvedTheme}
                    uploadingImageKey={uploadingImageKey}
                    visualSection={visualSection}
                    visualForm={visualForm}
                />
            ) : null}
            {mainSection === 'access' ? (
                <AccessSection
                    accessGroups={accessGroups}
                    editingGroupIds={editingGroupIds}
                    errors={errors}
                    learningGroups={learningGroups}
                    roles={accessRoles}
                    setEditingGroupIds={setEditingGroupIds}
                    setRoles={setAccessRoles}
                />
            ) : null}
            {mainSection === 'delete' ? (
                <DeleteWorldSection
                    canDelete={canDeleteWorldMaps}
                    deleting={deleting}
                    map={map}
                    onDelete={() => setDeleteOpen(true)}
                />
            ) : null}
        </div>
    );

    return (
        <>
            {!embedded ? <Head title={`Configure ${map.title}`} /> : null}
            {embedded ? (
                <SettingsConfigurationLayout
                    className="h-full p-4"
                    sidebar={sidebar}
                >
                    <SettingsContentPane>
                        <div className="grid h-full min-h-[34rem] grid-rows-[auto_minmax(0,1fr)] gap-4">
                            <SettingsPanelHeader
                                action={action}
                                description={
                                    map.description ??
                                    'Configure map details, visuals and access.'
                                }
                                eyebrow={world.title}
                                title={`Configure ${map.title}`}
                            />
                            {body}
                        </div>
                    </SettingsContentPane>
                </SettingsConfigurationLayout>
            ) : (
                <SettingsConfigurationShell
                    action={action}
                    backHref={`/settings?panel=admin-world-builder&map=${map.id}&worldView=nodes`}
                    backLabel="Back to map editor"
                    eyebrow={world.title}
                    sidebar={sidebar}
                    title={`Configure ${map.title}`}
                >
                    {body}
                </SettingsConfigurationShell>
            )}
            <Dialog
                onOpenChange={(open) => {
                    if (!open && !deleting) {
                        setDeleteOpen(false);
                    }
                }}
                open={deleteOpen}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Delete world map?</DialogTitle>
                        <DialogDescription>
                            This removes the map, its tiles, activities, portal
                            links and learner progress for those tiles. This
                            cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-100">
                        <span className="font-semibold">{map.title}</span>
                        <span className="mt-1 block text-red-800 dark:text-red-200/80">
                            {map.nodeCount} tile
                            {map.nodeCount === 1 ? '' : 's'} will be deleted
                            with this map.
                        </span>
                    </div>
                    <DialogFooter>
                        <Button
                            disabled={deleting}
                            onClick={() => setDeleteOpen(false)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={deleting}
                            onClick={deleteMap}
                            type="button"
                            variant="destructive"
                        >
                            <Trash2 className="size-4" />
                            Delete world map
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function MapDetailsSection({
    errors,
    form,
    onChange,
    previewTheme,
}: {
    errors: Record<string, string>;
    form: DetailsForm;
    onChange: (form: DetailsForm) => void;
    previewTheme: MapVisualThemeFields;
}) {
    return (
        <div className="grid h-full min-h-0 gap-6 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid content-start gap-5">
                <div>
                    <h2 className="text-xl font-semibold">Map details</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        These fields are shown in the top-left map title panel.
                    </p>
                </div>
                <TextField
                    error={errors.title}
                    label="Title"
                    onChange={(title) => onChange({ ...form, title })}
                    value={form.title}
                />
                <div className="grid gap-2">
                    <Label htmlFor="map-description">Description</Label>
                    <textarea
                        className="min-h-40 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-xs transition focus-visible:border-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] focus-visible:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
                        id="map-description"
                        onChange={(event) =>
                            onChange({
                                ...form,
                                description: event.currentTarget.value,
                            })
                        }
                        value={form.description}
                    />
                    <InputError message={errors.description} />
                </div>
            </div>
            <MapTitlePanelPreview
                description={form.description}
                theme={previewTheme}
                title={form.title}
            />
        </div>
    );
}

function MapVisualsSection({
    errors,
    imageErrors,
    mode,
    onImageUpload,
    onModeChange,
    onVisualSectionChange,
    setForm,
    theme,
    uploadingImageKey,
    visualForm,
    visualSection,
}: {
    errors: Record<string, string>;
    imageErrors: Record<string, string>;
    mode: ThemeMode;
    onImageUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    onModeChange: (mode: ThemeMode) => void;
    onVisualSectionChange: (section: VisualSection) => void;
    setForm: React.Dispatch<React.SetStateAction<MapVisualForm>>;
    theme: MapVisualThemeFields;
    uploadingImageKey: string | null;
    visualForm: MapVisualForm;
    visualSection: VisualSection;
}) {
    const values = visualForm[mode];

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
                <div>
                    <h2 className="text-xl font-semibold">Map visuals</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Switch between light and dark configuration, then select
                        the map element you want to tune.
                    </p>
                </div>
                <ConfigModeSwitch
                    mode={mode}
                    onChange={onModeChange}
                    size="large"
                />
            </div>

            <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <nav className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white/72 p-2 dark:border-white/10 dark:bg-white/5">
                    {visualSections.map((section) => {
                        const Icon = section.icon;

                        return (
                            <button
                                className={cn(
                                    'mb-2 grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl px-3 py-3 text-left transition last:mb-0',
                                    visualSection === section.id
                                        ? 'text-[var(--settings-accent-foreground)] shadow-md shadow-black/15'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                                )}
                                key={section.id}
                                onClick={() =>
                                    onVisualSectionChange(section.id)
                                }
                                style={
                                    visualSection === section.id
                                        ? {
                                              background:
                                                  'var(--settings-accent)',
                                              color: 'var(--settings-accent-foreground)',
                                          }
                                        : undefined
                                }
                                type="button"
                            >
                                <Icon className="mt-0.5 size-4" />
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">
                                        {section.label}
                                    </span>
                                    <span className="mt-1 block text-xs leading-5 opacity-80">
                                        {section.description}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/80">
                    <VisualEditorPanel
                        errors={errors}
                        imageErrors={imageErrors}
                        mode={mode}
                        onImageUpload={onImageUpload}
                        section={visualSection}
                        setForm={setForm}
                        theme={theme}
                        uploadingImageKey={uploadingImageKey}
                        values={values}
                    />
                </div>
            </div>
        </div>
    );
}

function VisualEditorPanel({
    errors,
    imageErrors,
    mode,
    onImageUpload,
    section,
    setForm,
    theme,
    uploadingImageKey,
    values,
}: {
    errors: Record<string, string>;
    imageErrors: Record<string, string>;
    mode: ThemeMode;
    onImageUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    section: VisualSection;
    setForm: React.Dispatch<React.SetStateAction<MapVisualForm>>;
    theme: MapVisualThemeFields;
    uploadingImageKey: string | null;
    values: MapVisualThemeFields;
}) {
    if (section === 'backgroundImage') {
        return (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <ConfigImageInput
                    description="Background image displayed behind the map overlay."
                    error={
                        imageErrors[`${mode}-background`] ||
                        errors[`background_config.${mode}.imageUrl`]
                    }
                    id={`${mode}-map-background-image`}
                    label={`${labelPrefix(mode)} background image`}
                    onChange={(value) =>
                        setVisualField(setForm, mode, 'imageUrl', value)
                    }
                    onUpload={(file) =>
                        onImageUpload(`${mode}-background`, file, (url) =>
                            setVisualField(setForm, mode, 'imageUrl', url),
                        )
                    }
                    uploading={uploadingImageKey === `${mode}-background`}
                    value={values.imageUrl}
                />
                <MapScenePreview theme={theme} />
            </div>
        );
    }

    if (section === 'assets') {
        return (
            <MapAssetsEditor
                errors={errors}
                imageErrors={imageErrors}
                mode={mode}
                onImageUpload={onImageUpload}
                setForm={setForm}
                theme={theme}
                uploadingImageKey={uploadingImageKey}
                values={values}
            />
        );
    }

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid content-start gap-4">
                <h3 className="text-lg font-semibold">
                    {visualSections.find(
                        (candidate) => candidate.id === section,
                    )?.label ?? 'Visual settings'}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                    {visualFieldGroups[section].map((field) => (
                        <CssColorOpacityField
                            error={
                                errors[`background_config.${mode}.${field.key}`]
                            }
                            key={field.key}
                            label={field.label}
                            onChange={(value) =>
                                setVisualField(setForm, mode, field.key, value)
                            }
                            value={String(values[field.key] ?? '')}
                        />
                    ))}
                </div>
            </div>
            <SectionPreview section={section} theme={theme} />
        </div>
    );
}

function MapAssetsEditor({
    errors,
    imageErrors,
    mode,
    onImageUpload,
    setForm,
    theme,
    uploadingImageKey,
    values,
}: {
    errors: Record<string, string>;
    imageErrors: Record<string, string>;
    mode: ThemeMode;
    onImageUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    setForm: React.Dispatch<React.SetStateAction<MapVisualForm>>;
    theme: MapVisualThemeFields;
    uploadingImageKey: string | null;
    values: MapVisualThemeFields;
}) {
    return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_30rem]">
            <div className="grid content-start gap-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold">Map assets</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Add decorative layers over the map background.
                        </p>
                    </div>
                    <Button
                        onClick={() => addMapAsset(setForm, mode)}
                        type="button"
                    >
                        <Plus className="size-4" />
                        Add asset
                    </Button>
                </div>
                {values.assets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No map assets configured for {mode} mode yet.
                    </div>
                ) : null}
                {values.assets.map((asset, index) => (
                    <div
                        className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
                        key={asset.id}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold">Asset {index + 1}</h4>
                            <Button
                                onClick={() =>
                                    removeMapAsset(setForm, mode, asset.id)
                                }
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                <Trash2 className="size-4" />
                                Remove
                            </Button>
                        </div>
                        <ConfigImageInput
                            description="Image placed over the background."
                            error={
                                imageErrors[`${mode}-asset-${asset.id}`] ||
                                errors[
                                    `background_config.${mode}.assets.${index}.imageUrl`
                                ]
                            }
                            id={`${mode}-asset-${asset.id}-image`}
                            label="Asset image"
                            onChange={(value) =>
                                updateMapAsset(setForm, mode, asset.id, {
                                    imageUrl: value,
                                })
                            }
                            onUpload={(file) =>
                                onImageUpload(
                                    `${mode}-asset-${asset.id}`,
                                    file,
                                    (url) =>
                                        updateMapAsset(
                                            setForm,
                                            mode,
                                            asset.id,
                                            {
                                                imageUrl: url,
                                            },
                                        ),
                                )
                            }
                            uploading={
                                uploadingImageKey ===
                                `${mode}-asset-${asset.id}`
                            }
                            value={asset.imageUrl}
                        />
                        <div className="grid gap-3 sm:grid-cols-4">
                            <NumberTextField
                                label="X"
                                max={100}
                                min={0}
                                onChange={(value) =>
                                    updateMapAsset(setForm, mode, asset.id, {
                                        x: value,
                                    })
                                }
                                suffix="%"
                                value={asset.x}
                            />
                            <NumberTextField
                                label="Y"
                                max={100}
                                min={0}
                                onChange={(value) =>
                                    updateMapAsset(setForm, mode, asset.id, {
                                        y: value,
                                    })
                                }
                                suffix="%"
                                value={asset.y}
                            />
                            <NumberTextField
                                label="Size"
                                max={200}
                                min={1}
                                onChange={(value) =>
                                    updateMapAsset(setForm, mode, asset.id, {
                                        width: value,
                                    })
                                }
                                suffix="%"
                                value={asset.width}
                            />
                            <NumberTextField
                                label="Transparency"
                                max={100}
                                min={0}
                                onChange={(value) =>
                                    updateMapAsset(setForm, mode, asset.id, {
                                        opacity: value,
                                    })
                                }
                                suffix="%"
                                value={asset.opacity}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <MapScenePreview theme={theme} />
        </div>
    );
}

function AccessSection({
    accessGroups,
    editingGroupIds,
    errors,
    learningGroups,
    roles,
    setEditingGroupIds,
    setRoles,
}: {
    accessGroups: AccessGroup[];
    editingGroupIds: number[];
    errors: Record<string, string>;
    learningGroups: LearningGroupOption[];
    roles: string[];
    setEditingGroupIds: React.Dispatch<React.SetStateAction<number[]>>;
    setRoles: React.Dispatch<React.SetStateAction<string[]>>;
}) {
    return (
        <div className="grid h-full min-h-0 content-start gap-5 overflow-y-auto p-5">
            <div>
                <h2 className="text-xl font-semibold">Access</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Every available access group appears here automatically.
                    Public maps can be visited without logging in.
                </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
                {accessGroups.map((group) => (
                    <label
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                        key={group.slug}
                    >
                        <Checkbox
                            checked={roles.includes(group.slug)}
                            onCheckedChange={(checked) =>
                                setRoles((current) =>
                                    toggleRole(
                                        current,
                                        group.slug,
                                        checked === true,
                                    ),
                                )
                            }
                        />
                        <span className="grid gap-1">
                            <span className="font-semibold">{group.label}</span>
                            {group.description ? (
                                <span className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    {group.description}
                                </span>
                            ) : null}
                        </span>
                    </label>
                ))}
            </div>
            <InputError
                message={errors.access_roles ?? errors['access_roles.0']}
            />
            <div className="border-t border-slate-200 pt-5 dark:border-white/10">
                <h3 className="text-sm font-semibold">Group editors</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Selected groups can configure this map and its nodes, but
                    they cannot delete the map.
                </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
                {learningGroups.map((group) => (
                    <label
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                        key={group.id}
                    >
                        <Checkbox
                            checked={editingGroupIds.includes(group.id)}
                            onCheckedChange={(checked) =>
                                setEditingGroupIds((current) =>
                                    toggleNumber(
                                        current,
                                        group.id,
                                        checked === true,
                                    ),
                                )
                            }
                        />
                        <span className="grid gap-1">
                            <span className="font-semibold">{group.name}</span>
                            {group.description ? (
                                <span className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    {group.description}
                                </span>
                            ) : null}
                        </span>
                    </label>
                ))}
                {learningGroups.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        Create groups from Settings before assigning map
                        editors.
                    </p>
                ) : null}
            </div>
            <InputError message={errors.group_ids ?? errors['group_ids.0']} />
        </div>
    );
}

function DeleteWorldSection({
    canDelete,
    deleting,
    map,
    onDelete,
}: {
    canDelete: boolean;
    deleting: boolean;
    map: EditableMap;
    onDelete: () => void;
}) {
    return (
        <div className="grid h-full min-h-0 content-start gap-5 overflow-y-auto p-5">
            <div>
                <h2 className="text-xl font-semibold">Delete world</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Remove this map and all content that belongs to it.
                </p>
            </div>

            <div className="max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950 dark:border-red-400/30 dark:bg-red-950/25 dark:text-red-100">
                <div className="flex items-start gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white dark:bg-red-500">
                        <Trash2 className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold">
                            Delete {map.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-100/80">
                            This deletes {map.nodeCount} tile
                            {map.nodeCount === 1 ? '' : 's'}, activities, portal
                            links and learner progress connected to this map.
                            This action cannot be undone.
                        </p>
                        {canDelete ? (
                            <Button
                                className="mt-5"
                                disabled={deleting}
                                onClick={onDelete}
                                type="button"
                                variant="destructive"
                            >
                                <Trash2 className="size-4" />
                                Delete world map
                            </Button>
                        ) : (
                            <p className="mt-5 rounded-lg border border-red-200 bg-white/70 p-3 text-sm text-red-900 dark:border-red-300/20 dark:bg-black/20 dark:text-red-100">
                                Your current access level can read or update
                                this world, but cannot delete maps.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionPreview({
    section,
    theme,
}: {
    section: VisualSection;
    theme: MapVisualThemeFields;
}) {
    if (section === 'titlePanel') {
        return (
            <MapTitlePanelPreview
                description="A tiny learning landscape where each node is a place for active practice."
                theme={theme}
                title="First Clearing"
            />
        );
    }

    if (section === 'sidePanel') {
        return <SidePanelPreview theme={theme} />;
    }

    if (section === 'bottomNav') {
        return <BottomNavPreview theme={theme} />;
    }

    if (section === 'rightControl') {
        return <RightControlPreview theme={theme} />;
    }

    return <MapScenePreview theme={theme} />;
}

function MapScenePreview({ theme }: { theme: MapVisualThemeFields }) {
    const imageUrl = normalizeMediaUrl(theme.imageUrl);

    return (
        <div
            className="relative min-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-inner dark:border-white/10"
            style={{ background: theme.pageBackground || '#071017' }}
        >
            {imageUrl ? (
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${imageUrl})` }}
                />
            ) : null}
            <div
                className="absolute inset-0"
                style={{ background: theme.overlay || 'rgba(0, 0, 0, 0.36)' }}
            />
            {theme.assets.map((asset) => {
                const assetUrl = normalizeMediaUrl(asset.imageUrl);

                if (!assetUrl) {
                    return null;
                }

                return (
                    <img
                        alt=""
                        className="absolute h-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
                        draggable={false}
                        key={asset.id}
                        src={assetUrl}
                        style={{
                            left: `${percent(asset.x, 50)}%`,
                            opacity: percent(asset.opacity, 100) / 100,
                            top: `${percent(asset.y, 50)}%`,
                            width: `${percent(asset.width, 20, 1, 200)}%`,
                        }}
                    />
                );
            })}
            <div
                className="absolute top-5 left-5 rounded-xl border p-4"
                style={{
                    background:
                        theme.panelBackground || 'rgba(5, 15, 22, 0.72)',
                    borderColor:
                        theme.panelBorderColor || 'rgba(255,255,255,0.1)',
                    color: theme.panelTextColor || '#f8fafc',
                }}
            >
                <div
                    className="mb-2 flex items-center gap-2 text-sm"
                    style={{ color: theme.accentColor || '#99f6e4' }}
                >
                    <MapIcon className="size-4" />
                    Current map
                </div>
                <div className="text-xl font-semibold">Preview map</div>
                <p
                    className="mt-2 max-w-56 text-sm"
                    style={{
                        color:
                            theme.panelMutedTextColor ||
                            theme.panelTextColor ||
                            '#cbd5e1',
                    }}
                >
                    Background, overlay and assets share this scene.
                </p>
            </div>
        </div>
    );
}

function MapTitlePanelPreview({
    description,
    theme,
    title,
}: {
    description: string;
    theme: MapVisualThemeFields;
    title: string;
}) {
    return (
        <div className="grid content-start gap-3">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Preview
            </h3>
            <div
                className="rounded-xl border p-5 shadow-lg backdrop-blur-md"
                style={{
                    background:
                        theme.panelBackground || 'rgba(5, 15, 22, 0.72)',
                    borderColor:
                        theme.panelBorderColor || 'rgba(255,255,255,0.1)',
                    color: theme.panelTextColor || '#f8fafc',
                }}
            >
                <div
                    className="mb-3 flex items-center gap-2 text-sm"
                    style={{ color: theme.accentColor || '#99f6e4' }}
                >
                    <MapIcon className="size-4" />
                    Current map
                </div>
                <h3 className="text-3xl font-semibold tracking-normal">
                    {title || 'Untitled map'}
                </h3>
                <p
                    className="mt-3 text-sm leading-6"
                    style={{
                        color:
                            theme.panelMutedTextColor ||
                            theme.panelTextColor ||
                            '#cbd5e1',
                    }}
                >
                    {description || 'No description configured.'}
                </p>
            </div>
        </div>
    );
}

function SidePanelPreview({ theme }: { theme: MapVisualThemeFields }) {
    return (
        <PreviewFrame title="Preview">
            <div
                className="rounded-2xl border p-5"
                style={{
                    background:
                        theme.sidePanelBackground ||
                        theme.panelBackground ||
                        'rgba(5, 15, 22, 0.82)',
                    borderColor:
                        theme.sidePanelBorderColor || 'rgba(255,255,255,0.12)',
                    color: theme.sidePanelTextColor || '#f8fafc',
                }}
            >
                <p
                    className="text-xs font-semibold tracking-[0.18em] uppercase"
                    style={{
                        color:
                            theme.sidePanelHeadingColor ||
                            theme.accentColor ||
                            '#99f6e4',
                    }}
                >
                    Location
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                    Learning Village
                </h3>
                <p
                    className="mt-4 rounded-lg border p-3 text-sm leading-6"
                    style={{
                        borderColor:
                            theme.sidePanelBorderColor ||
                            'rgba(255,255,255,0.12)',
                        color:
                            theme.sidePanelMutedTextColor ||
                            theme.sidePanelTextColor ||
                            '#cbd5e1',
                    }}
                >
                    A focused node description lives here.
                </p>
            </div>
        </PreviewFrame>
    );
}

function BottomNavPreview({ theme }: { theme: MapVisualThemeFields }) {
    return (
        <PreviewFrame title="Preview">
            <div
                className="flex w-max items-center gap-1.5 rounded-2xl border p-1.5"
                style={{
                    background:
                        theme.bottomNavBackground ||
                        theme.panelBackground ||
                        'rgba(5, 15, 22, 0.82)',
                    borderColor:
                        theme.bottomNavBorderColor || 'rgba(255,255,255,0.12)',
                    color: theme.bottomNavIconColor || theme.bottomNavTextColor,
                }}
            >
                <PreviewIconButton active theme={theme} type="bottom" />
                <PreviewIconButton theme={theme} type="bottom" />
                <PreviewIconButton theme={theme} type="bottom" />
                <PreviewIconButton danger theme={theme} type="bottom" />
            </div>
        </PreviewFrame>
    );
}

function RightControlPreview({ theme }: { theme: MapVisualThemeFields }) {
    return (
        <PreviewFrame title="Preview">
            <div
                className="grid w-max gap-1.5 rounded-2xl border p-1.5"
                style={{
                    background:
                        theme.sideControlBackground ||
                        theme.panelBackground ||
                        'rgba(5, 15, 22, 0.82)',
                    borderColor:
                        theme.sideControlBorderColor ||
                        'rgba(255,255,255,0.12)',
                    color:
                        theme.sideControlIconColor ||
                        theme.sideControlTextColor,
                }}
            >
                <PreviewIconButton active theme={theme} type="side" />
                <PreviewIconButton theme={theme} type="side" />
                <PreviewIconButton theme={theme} type="side" />
            </div>
        </PreviewFrame>
    );
}

function PreviewIconButton({
    active = false,
    danger = false,
    theme,
    type,
}: {
    active?: boolean;
    danger?: boolean;
    theme: MapVisualThemeFields;
    type: 'bottom' | 'side';
}) {
    const activeBackground =
        type === 'bottom'
            ? theme.bottomNavActiveBackground
            : theme.sideControlActiveBackground;
    const iconColor =
        type === 'bottom'
            ? active
                ? theme.bottomNavActiveIconColor ||
                  theme.bottomNavActiveTextColor ||
                  '#0f172a'
                : danger
                  ? theme.bottomNavExitIconColor || '#ef4444'
                  : theme.bottomNavIconColor ||
                    theme.bottomNavTextColor ||
                    '#e2e8f0'
            : active
              ? theme.sideControlActiveIconColor ||
                theme.sideControlActiveTextColor ||
                '#0f172a'
              : theme.sideControlIconColor ||
                theme.sideControlTextColor ||
                '#e2e8f0';

    return (
        <div
            className="grid size-11 place-items-center rounded-xl"
            style={{
                background: active ? activeBackground || '#5eead4' : undefined,
                color: iconColor,
            }}
        >
            <MapIcon className="size-5" />
        </div>
    );
}

function PreviewFrame({
    children,
    title,
}: {
    children: React.ReactNode;
    title: string;
}) {
    return (
        <div className="grid content-start gap-3">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {title}
            </h3>
            <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-slate-100 p-6 dark:border-white/10 dark:bg-slate-900">
                {children}
            </div>
        </div>
    );
}

function CssColorOpacityField({
    error,
    label,
    onChange,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    const parsed = parseCssColor(value);

    return (
        <ColorOpacityField
            colorError={error}
            colorValue={parsed.hex}
            label={label}
            onColorChange={(hex) =>
                onChange(cssColorFromPicker(hex, parsed.opacity))
            }
            onOpacityChange={(opacity) =>
                onChange(cssColorFromPicker(parsed.hex, opacity))
            }
            opacityValue={parsed.opacity}
        />
    );
}

function TextField({
    error,
    label,
    onChange,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Input
                onChange={(event) => onChange(event.currentTarget.value)}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function NumberTextField({
    label,
    max,
    min,
    onChange,
    suffix,
    value,
}: {
    label: string;
    max: number;
    min: number;
    onChange: (value: string) => void;
    suffix: string;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    max={max}
                    min={min}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    type="number"
                    value={value}
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {suffix}
                </span>
            </div>
        </div>
    );
}

function setVisualField(
    setForm: React.Dispatch<React.SetStateAction<MapVisualForm>>,
    mode: ThemeMode,
    key: keyof MapVisualThemeFields,
    value: string | MapVisualAssetForm[],
) {
    setForm((current) => ({
        ...current,
        [mode]: {
            ...current[mode],
            [key]: value,
        },
    }));
}

function addMapAsset(
    setForm: React.Dispatch<React.SetStateAction<MapVisualForm>>,
    mode: ThemeMode,
) {
    setForm((current) => ({
        ...current,
        [mode]: {
            ...current[mode],
            assets: [
                ...current[mode].assets,
                {
                    id: crypto.randomUUID(),
                    imageUrl: '',
                    opacity: '100',
                    width: '20',
                    x: '50',
                    y: '50',
                },
            ],
        },
    }));
}

function updateMapAsset(
    setForm: React.Dispatch<React.SetStateAction<MapVisualForm>>,
    mode: ThemeMode,
    id: string,
    patch: Partial<MapVisualAssetForm>,
) {
    setForm((current) => ({
        ...current,
        [mode]: {
            ...current[mode],
            assets: current[mode].assets.map((asset) =>
                asset.id === id ? { ...asset, ...patch } : asset,
            ),
        },
    }));
}

function removeMapAsset(
    setForm: React.Dispatch<React.SetStateAction<MapVisualForm>>,
    mode: ThemeMode,
    id: string,
) {
    setForm((current) => ({
        ...current,
        [mode]: {
            ...current[mode],
            assets: current[mode].assets.filter((asset) => asset.id !== id),
        },
    }));
}

function saveDetails(
    mapId: number,
    form: DetailsForm,
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
) {
    setProcessing(true);
    router.patch(`/settings/worlds/maps/${mapId}/details`, form, {
        preserveScroll: true,
        onError: setErrors,
        onFinish: () => setProcessing(false),
        onSuccess: () => setErrors({}),
    });
}

function saveVisuals(
    mapId: number,
    form: MapVisualForm,
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
) {
    setProcessing(true);
    router.patch(
        `/settings/worlds/maps/${mapId}`,
        {
            background_config: {
                dark: form.dark,
                light: form.light,
            },
        },
        {
            preserveScroll: true,
            onError: setErrors,
            onFinish: () => setProcessing(false),
            onSuccess: () => setErrors({}),
        },
    );
}

function saveAccess(
    mapId: number,
    roles: string[],
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
) {
    setProcessing(true);
    router.patch(
        `/settings/worlds/maps/${mapId}/access`,
        { access_roles: roles },
        {
            preserveScroll: true,
            onError: setErrors,
            onFinish: () => setProcessing(false),
            onSuccess: () => setErrors({}),
        },
    );
}

function saveEditingGroups(
    mapId: number,
    groupIds: number[],
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
) {
    setProcessing(true);
    router.patch(
        `/settings/worlds/maps/${mapId}/editing-groups`,
        { group_ids: groupIds },
        {
            preserveScroll: true,
            onError: setErrors,
            onFinish: () => setProcessing(false),
            onSuccess: () => setErrors({}),
        },
    );
}

function toggleRole(
    current: string[],
    role: string,
    enabled: boolean,
): string[] {
    if (enabled) {
        return current.includes(role) ? current : [...current, role];
    }

    const nextRoles = current.filter((candidate) => candidate !== role);

    return nextRoles.length > 0 ? nextRoles : current;
}

function toggleNumber(
    current: number[],
    value: number,
    enabled: boolean,
): number[] {
    if (enabled) {
        return current.includes(value) ? current : [...current, value];
    }

    return current.filter((candidate) => candidate !== value);
}

function mapVisualFormFromConfig(config: MapVisualConfig): MapVisualForm {
    return {
        dark: mapVisualThemeFieldsFromConfig(config.dark),
        light: mapVisualThemeFieldsFromConfig(config.light),
    };
}

function mapVisualThemeFieldsFromConfig(
    config: Partial<MapVisualThemeFields> | undefined,
): MapVisualThemeFields {
    return {
        accentColor: stringConfig(config?.accentColor),
        assets: mapAssetsFromConfig(config?.assets),
        bottomNavActiveBackground: stringConfig(
            config?.bottomNavActiveBackground,
        ),
        bottomNavActiveIconColor: stringConfig(
            config?.bottomNavActiveIconColor,
        ),
        bottomNavActiveTextColor: stringConfig(
            config?.bottomNavActiveTextColor,
        ),
        bottomNavBackground: stringConfig(config?.bottomNavBackground),
        bottomNavBorderColor: stringConfig(config?.bottomNavBorderColor),
        bottomNavExitIconColor: stringConfig(config?.bottomNavExitIconColor),
        bottomNavIconColor: stringConfig(config?.bottomNavIconColor),
        bottomNavTextColor: stringConfig(config?.bottomNavTextColor),
        imageUrl: stringConfig(config?.imageUrl),
        overlay: stringConfig(config?.overlay),
        pageBackground: stringConfig(config?.pageBackground),
        panelBackground: stringConfig(config?.panelBackground),
        panelBorderColor: stringConfig(config?.panelBorderColor),
        panelMutedTextColor: stringConfig(config?.panelMutedTextColor),
        panelTextColor: stringConfig(config?.panelTextColor),
        sideControlActiveBackground: stringConfig(
            config?.sideControlActiveBackground,
        ),
        sideControlActiveIconColor: stringConfig(
            config?.sideControlActiveIconColor,
        ),
        sideControlActiveTextColor: stringConfig(
            config?.sideControlActiveTextColor,
        ),
        sideControlBackground: stringConfig(config?.sideControlBackground),
        sideControlBorderColor: stringConfig(config?.sideControlBorderColor),
        sideControlIconColor: stringConfig(config?.sideControlIconColor),
        sideControlTextColor: stringConfig(config?.sideControlTextColor),
        sidePanelBackground: stringConfig(config?.sidePanelBackground),
        sidePanelBorderColor: stringConfig(config?.sidePanelBorderColor),
        sidePanelHeadingColor: stringConfig(config?.sidePanelHeadingColor),
        sidePanelMutedTextColor: stringConfig(config?.sidePanelMutedTextColor),
        sidePanelTextColor: stringConfig(config?.sidePanelTextColor),
    };
}

function resolveThemePreview(
    form: MapVisualForm,
    mode: ThemeMode,
): MapVisualThemeFields {
    if (mode === 'dark') {
        return form.dark;
    }

    return {
        ...form.dark,
        ...Object.fromEntries(
            Object.entries(form.light).filter(([, value]) => {
                if (Array.isArray(value)) {
                    return value.length > 0;
                }

                return value !== '';
            }),
        ),
        assets:
            form.light.assets.length > 0 ? form.light.assets : form.dark.assets,
    } as MapVisualThemeFields;
}

function mapAssetsFromConfig(value: unknown): MapVisualAssetForm[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((asset): asset is MapVisualAsset => isRecord(asset))
        .map((asset) => ({
            id: stringConfig(asset.id) || crypto.randomUUID(),
            imageUrl: stringConfig(asset.imageUrl),
            opacity: inputString(asset.opacity, '100'),
            width: inputString(asset.width, '20'),
            x: inputString(asset.x, '50'),
            y: inputString(asset.y, '50'),
        }));
}

function parseCssColor(value: string): { hex: string; opacity: string } {
    const trimmedValue = value.trim();

    if (trimmedValue === '') {
        return { hex: '#000000', opacity: '100' };
    }

    if (isHexColor(trimmedValue)) {
        return { hex: trimmedValue, opacity: '100' };
    }

    const rgbaMatch = trimmedValue.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+)\s*)?\)$/i,
    );

    if (!rgbaMatch) {
        return { hex: '#000000', opacity: '100' };
    }

    const red = clampColorChannel(Number(rgbaMatch[1]));
    const green = clampColorChannel(Number(rgbaMatch[2]));
    const blue = clampColorChannel(Number(rgbaMatch[3]));
    const alpha = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);

    return {
        hex: rgbToHex(red, green, blue),
        opacity: Math.round(Math.min(1, Math.max(0, alpha)) * 100).toString(),
    };
}

function cssColorFromPicker(hexColor: string, opacity: string): string {
    const safeHex = isHexColor(hexColor) ? hexColor : '#000000';
    const numericOpacity = percent(opacity, 100);

    if (numericOpacity >= 100) {
        return safeHex;
    }

    const red = Number.parseInt(safeHex.slice(1, 3), 16);
    const green = Number.parseInt(safeHex.slice(3, 5), 16);
    const blue = Number.parseInt(safeHex.slice(5, 7), 16);
    const alpha = Number((numericOpacity / 100).toFixed(2));

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clampColorChannel(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(255, Math.max(0, Math.round(value)));
}

function rgbToHex(red: number, green: number, blue: number): string {
    return `#${[red, green, blue]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')}`;
}

function percent(value: unknown, fallback: number, min = 0, max = 100): number {
    const numeric = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, numeric));
}

function stringConfig(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function inputString(value: unknown, fallback: string): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toString();
    }

    return typeof value === 'string' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function labelPrefix(mode: ThemeMode): string {
    return mode === 'dark' ? 'Dark mode' : 'Light mode';
}
