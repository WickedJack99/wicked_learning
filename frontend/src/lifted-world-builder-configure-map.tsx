import {
    Download,
    History,
    Image,
    Images,
    LayoutPanelTop,
    Map as MapIcon,
    Palette,
    PanelRight,
    Plus,
    Save,
    ShieldCheck,
    SlidersHorizontal,
    Trash2,
    RotateCcw,
    Moon,
    Sun,
    Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { LiftedButton as Button } from './lifted-button';
import { ColorOpacityField, isHexColor } from './lifted-color-input';
import {
    LiftedDialog as Dialog,
    LiftedDialogContent as DialogContent,
    LiftedDialogDescription as DialogDescription,
    LiftedDialogFooter as DialogFooter,
    LiftedDialogHeader as DialogHeader,
    LiftedDialogTitle as DialogTitle,
} from './lifted-dialog';
import { LiftedInputError as InputError } from './lifted-input-error';
import { LiftedInput as Input } from './lifted-input';
import { LiftedLabel as Label } from './lifted-label';
import { LiftedPaginationControls as PaginationControls } from './lifted-pagination-controls';
import { useCurrentUser } from './current-user';
import {
    SettingsConfigurationShell,
    SettingsNestedWorkspace,
    SettingsSectionButton,
} from './extracted-settings-configuration-shell';
import { LiftedReusableImagePicker } from './lifted-reusable-image-picker';
import { usePlatformTranslation } from './original-platform-translation';

type MapVisualAsset = Record<string, unknown>;

/** Rust's media API already returns same-origin authorized content URLs. */
function normalizeMediaUrl(value: string): string {
    return value;
}

function useDirtyState<T>(value: T, baseline: T): boolean {
    return JSON.stringify(value) !== JSON.stringify(baseline);
}

/** Direct source control adapted only from the source Radix checkbox primitive
 * to the browser's native checkbox, which is the available standalone seam. */
function Checkbox({
    checked,
    onCheckedChange,
}: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <input
            checked={checked}
            className="peer size-5 shrink-0 rounded-[5px] border border-input accent-primary shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onChange={(event) => onCheckedChange(event.currentTarget.checked)}
            type="checkbox"
        />
    );
}

/** Direct lift of the source dark/light configuration mode switch. */
function ConfigModeSwitch({
    className,
    mode,
    onChange,
    size = 'default',
}: {
    className?: string;
    mode: ThemeMode;
    onChange: (mode: ThemeMode) => void;
    size?: 'default' | 'large';
}) {
    const t = usePlatformTranslation();
    const buttonSize = size === 'large' ? 'size-11' : 'size-10';
    const iconSize = size === 'large' ? 'size-5' : 'size-4';
    return (
        <div
            aria-label={t('common.configuration.mode', 'Configuration mode')}
            className={`inline-flex rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/80 ${className ?? ''}`}
            onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                    onChange('dark');
                }
                if (event.key === 'ArrowRight') {
                    onChange('light');
                }
            }}
            role="tablist"
        >
            {[
                { icon: Moon, label: t('common.configuration.dark', 'Dark configuration'), value: 'dark' as const },
                { icon: Sun, label: t('common.configuration.light', 'Light configuration'), value: 'light' as const },
            ].map((option) => {
                const Icon = option.icon;
                return (
                    <button
                        aria-label={option.label}
                        aria-selected={mode === option.value}
                        className={`grid place-items-center rounded-xl transition ${buttonSize} ${mode === option.value ? 'text-white dark:text-slate-950' : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        role="tab"
                        style={mode === option.value ? { background: 'var(--settings-accent)', color: 'var(--settings-accent-foreground)' } : undefined}
                        type="button"
                    >
                        <Icon className={iconSize} />
                        <span className="sr-only">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Direct lift of main:resources/js/components/config-image-input.tsx. The
 * source's Inertia page-prop and asset-route seams are isolated to the Rust
 * current-user capability projection and same-origin media content endpoint.
 */
function ConfigImageInput({
    className,
    description,
    error,
    id,
    label,
    onChange,
    onUpload,
    uploading,
    value,
}: {
    className?: string;
    description?: string;
    error?: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    value: string;
}) {
    const { currentUser } = useCurrentUser();
    const canViewPath = currentUser.kind === 'loaded' && currentUser.canViewMediaPaths;
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const uploadId = `${id}-upload`;
    const previewUrl = normalizeMediaUrl(value);
    const downloadUrl = previewUrl.startsWith('/api/v1/admin/media-assets/') || previewUrl.includes('/visual-media/')
        ? `${previewUrl}?download=1`
        : previewUrl || '#';
    return (
        <div className={`grid min-w-0 gap-2 overflow-hidden ${className ?? ''}`}>
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]"><Image className="size-4" /></span>
                <div className="min-w-0"><Label htmlFor={id}>{label}</Label>{description ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p> : null}</div>
            </div>
            {canViewPath ? <Input className="min-w-0" id={id} onChange={(event) => onChange(event.currentTarget.value)} placeholder="/storage/learning/nodes/example.svg" value={value} /> : null}
            <InputError message={error} />
            {previewUrl ? <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] p-2"><img alt="" className="size-12 rounded object-contain" src={previewUrl} /><span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">{canViewPath ? value : 'Path hidden by role permissions.'}</span></div> : null}
            <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="secondary"><label htmlFor={uploadId}><Upload className="size-4" />{uploading ? 'Uploading...' : 'Upload'}</label></Button>
                <input accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp" className="sr-only" disabled={uploading} id={uploadId} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ''; }} type="file" />
                <Button onClick={() => setIsPickerOpen(true)} size="sm" type="button" variant="secondary"><Images className="size-4" />Select existing</Button>
                <Button asChild disabled={!previewUrl} size="sm" variant="ghost"><a download href={downloadUrl} rel="noreferrer"><Download className="size-4" />Download</a></Button>
                <Button disabled={!value} onClick={() => onChange('')} size="sm" type="button" variant="ghost">Clear</Button>
            </div>
            {isPickerOpen ? <LiftedReusableImagePicker currentValue={value} onClear={() => { onChange(''); setIsPickerOpen(false); }} onClose={() => setIsPickerOpen(false)} onSelect={(url) => { onChange(normalizeMediaUrl(url)); setIsPickerOpen(false); }} /> : null}
        </div>
    );
}

type EditableWorld = {
    description: string | null;
    id: string;
    slug: string;
    title: string;
};

type EditableMap = {
    accessRoles: string[];
    backgroundConfig: MapVisualConfig;
    description: string | null;
    editingGroupIds: string[];
    id: string;
    mapAssetsLocked: boolean;
    nodeCount: number;
    slug: string;
    topicId: string | null;
    title: string;
    updatedAt: string | null;
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
    id: string;
    name: string;
    slug: string;
};

type LearningTopicOption = {
    id: string;
    label: string;
    title: string;
};

type ThemeMode = 'dark' | 'light';
type MainSection = 'details' | 'visuals' | 'access' | 'delete';
type VisualSection =
    | 'general'
    | 'titlePanel'
    | 'sidePanel'
    | 'rightControl'
    | 'backgroundImage'
    | 'assets';

type MapVisualThemeFields = {
    accentColor: string;
    assets: MapVisualAssetForm[];
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
    map_assets_locked: boolean;
    topic_id: string | null;
    title: string;
    updated_at: string;
};

type MapDetailsVersion = {
    createdAt: string | null;
    description: string | null;
    id: string;
    learningTopicId: string | null;
    mapAssetsLocked: boolean;
    title: string;
};

type MapDetailsVersionPage = {
    items: MapDetailsVersion[];
    pagination: {
        lastPage: number;
        page: number;
        perPage: number;
        total: number;
    };
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
        description: 'The focused MapAsset description panel.',
        icon: PanelRight,
        id: 'sidePanel',
        label: 'MapAsset side panel',
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

function readMainSectionFromUrl(): MainSection {
    if (typeof window === 'undefined') {
        return 'details';
    }

    const value = new URL(window.location.href).searchParams.get('mapConfig');

    return mainSections.some((section) => section.id === value)
        ? (value as MainSection)
        : 'details';
}

function readVisualSectionFromUrl(): VisualSection {
    if (typeof window === 'undefined') {
        return 'general';
    }

    const value = new URL(window.location.href).searchParams.get('mapVisual');

    return visualSections.some((section) => section.id === value)
        ? (value as VisualSection)
        : 'general';
}

function writeMapSectionToUrl(
    section: MainSection,
    visualSection: VisualSection,
): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-world-builder');
    url.searchParams.set('worldView', 'configure');
    url.searchParams.set('mapConfig', section);
    url.searchParams.set('mapVisual', visualSection);
    window.history.pushState({ panel: 'admin-world-builder' }, '', url);
}

/**
 * Direct lift of main@32c3113:resources/js/pages/settings/worlds/configure-map.tsx.
 * The caller adapts the typed Rust editable-map document at this one boundary.
 */
export function LiftedWorldBuilderConfigureMap({
    accessGroups,
    embedded = false,
    canDeleteWorldMaps,
    editableMap,
    learningGroups,
    onDeleted,
    onUpdated,
    topicOptions,
}: {
    accessGroups: AccessGroup[];
    embedded?: boolean;
    canDeleteWorldMaps: boolean;
    editableMap: EditableMapPayload;
    learningGroups: LearningGroupOption[];
    onDeleted: () => void;
    onUpdated: () => void;
    topicOptions: LearningTopicOption[];
}) {
    const { map, world } = editableMap;
    const [mainSection, setMainSection] = useState<MainSection>(() =>
        readMainSectionFromUrl(),
    );
    const [visualSection, setVisualSection] = useState<VisualSection>(() =>
        readVisualSectionFromUrl(),
    );
    const [mode, setMode] = useState<ThemeMode>('dark');
    const [detailsForm, setDetailsForm] = useState<DetailsForm>({
        description: map.description ?? '',
        map_assets_locked: map.mapAssetsLocked,
        topic_id: map.topicId,
        title: map.title,
        updated_at: map.updatedAt ?? '',
    });
    const [detailsBaseline, setDetailsBaseline] = useState<DetailsForm>({
        description: map.description ?? '',
        map_assets_locked: map.mapAssetsLocked,
        topic_id: map.topicId,
        title: map.title,
        updated_at: map.updatedAt ?? '',
    });
    const [visualForm, setVisualForm] = useState<MapVisualForm>(() =>
        mapVisualFormFromConfig(map.backgroundConfig),
    );
    const [accessRoles, setAccessRoles] = useState<string[]>(
        map.accessRoles.length > 0 ? map.accessRoles : ['user', 'admin'],
    );
    const [editingGroupIds, setEditingGroupIds] = useState<string[]>(
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
    const [detailsHistoryOpen, setDetailsHistoryOpen] = useState(false);
    const [detailsHistory, setDetailsHistory] =
        useState<MapDetailsVersionPage | null>(null);
    const [detailsHistoryLoading, setDetailsHistoryLoading] = useState(false);
    const [detailsHistoryError, setDetailsHistoryError] = useState(false);
    const [restoringDetailsVersionId, setRestoringDetailsVersionId] = useState<
        string | null
    >(null);
    const resolvedTheme = useMemo(
        () => resolveThemePreview(visualForm, mode),
        [mode, visualForm],
    );
    const hasDetailsChanges = useDirtyState(detailsForm, {
        ...detailsBaseline,
    });
    const hasVisualChanges = useDirtyState(
        visualForm,
        mapVisualFormFromConfig(map.backgroundConfig),
    );
    const hasAccessChanges = useDirtyState(
        { accessRoles, editingGroupIds },
        {
            accessRoles:
                map.accessRoles.length > 0
                    ? map.accessRoles
                    : ['user', 'admin'],
            editingGroupIds: map.editingGroupIds,
        },
    );
    const currentSectionHasChanges =
        mainSection === 'details'
            ? hasDetailsChanges
            : mainSection === 'access'
              ? hasAccessChanges
              : mainSection === 'visuals'
                ? hasVisualChanges
                : false;

    useEffect(() => {
        const syncNavigationState = () => {
            setMainSection(readMainSectionFromUrl());
            setVisualSection(readVisualSectionFromUrl());
        };

        window.addEventListener('popstate', syncNavigationState);

        return () => {
            window.removeEventListener('popstate', syncNavigationState);
        };
    }, []);

    const selectMainSection = (section: MainSection) => {
        setMainSection(section);
        writeMapSectionToUrl(section, visualSection);
    };

    const selectVisualSection = (section: VisualSection) => {
        setVisualSection(section);
        writeMapSectionToUrl('visuals', section);
    };

    const saveCurrentSection = () => {
        if (!currentSectionHasChanges) {
            return;
        }

        if (mainSection === 'details') {
            void saveDetails(
                map.id,
                detailsForm,
                setErrors,
                setProcessing,
                (updatedAt) => {
                    const nextForm = { ...detailsForm, updated_at: updatedAt };
                    setDetailsForm(nextForm);
                    setDetailsBaseline(nextForm);
                    onUpdated();
                },
            );

            return;
        }

        if (mainSection === 'access') {
            void saveAccess(map.id, accessRoles, setErrors, setProcessing);
            void saveEditingGroups(
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

        void saveVisuals(map.id, visualForm, setErrors, setProcessing, onUpdated);
    };

    const deleteMap = async () => {
        setDeleting(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/maps/{map_id}',
                { params: { header: { 'X-CSRF-Token': token }, path: { map_id: map.id } } },
            );
            if (!response.ok) {
                setErrors({ delete: 'The world map could not be deleted. Try again.' });
                return;
            }
            onDeleted();
        } catch {
            setErrors({ delete: 'The world map could not be deleted. Try again.' });
        } finally {
            setDeleting(false);
        }
    };

    const loadDetailsHistory = async (page = 1) => {
        setDetailsHistoryLoading(true);
        setDetailsHistoryError(false);

        try {
            const { data, response } = await apiClient.GET(
                '/admin/world-builder/maps/{map_id}/versions',
                { params: { path: { map_id: map.id }, query: { page, per_page: 4 } } },
            );
            if (!response.ok || !data) {
                throw new Error('The map history could not be loaded.');
            }
            setDetailsHistory({
                items: data.items.map((version) => ({
                    createdAt: version.created_at,
                    description: version.description,
                    id: version.id,
                    learningTopicId: version.topic_id,
                    mapAssetsLocked: version.map_assets_locked,
                    title: version.title,
                })),
                pagination: {
                    lastPage: data.last_page,
                    page: data.page,
                    perPage: data.per_page,
                    total: data.total,
                },
            });
        } catch {
            setDetailsHistoryError(true);
        } finally {
            setDetailsHistoryLoading(false);
        }
    };

    const openDetailsHistory = () => {
        setDetailsHistoryOpen(true);
        void loadDetailsHistory();
    };

    const restoreDetailsVersion = async (version: MapDetailsVersion) => {
        if (
            !window.confirm(
                'Restore this map detail version? The current details will be preserved in history.',
            )
        ) {
            return;
        }

        setRestoringDetailsVersionId(version.id);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps/{map_id}/versions/{version_id}',
                { params: { header: { 'X-CSRF-Token': token }, path: { map_id: map.id, version_id: version.id } } },
            );
            if (!response.ok || !data) {
                throw new Error('The map version could not be restored.');
            }
            const restoredForm = {
                description: data.description ?? '',
                map_assets_locked: data.map_assets_locked,
                topic_id: data.topic_id,
                title: data.title,
                updated_at: data.updated_at,
            };
            setDetailsForm(restoredForm);
            setDetailsBaseline(restoredForm);
            await loadDetailsHistory(detailsHistory?.pagination.page ?? 1);
            onUpdated();
        } catch {
            setDetailsHistoryError(true);
        } finally {
            setRestoringDetailsVersionId(null);
        }
    };

    const uploadImage = async (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => {
        setUploadingImageKey(key);
        setImageErrors((current) => ({ ...current, [key]: '' }));

        try {
            const token = await getCsrfToken();
            const body = new FormData();
            body.append('file', file);
            const response = await fetch(`/api/v1/admin/world-builder/maps/${map.id}/visual-media`, {
                body,
                credentials: 'same-origin',
                headers: { 'X-CSRF-Token': token },
                method: 'POST',
            });
            const payload = await response.json() as { preview_url?: string };
            if (!response.ok || !payload.preview_url) throw new Error('The image could not be uploaded.');
            onUploaded(payload.preview_url);
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
                disabled={processing || !currentSectionHasChanges}
                onClick={saveCurrentSection}
                type="button"
            >
                <Save className="size-4" />
                {processing ? 'Saving...' : 'Save changes'}
            </Button>
        ) : null;
    const sidebar = (
        <>
            {mainSections.map((section) => (
                <SettingsSectionButton
                    active={mainSection === section.id}
                    compact
                    danger={section.danger}
                    icon={section.icon}
                    id={section.id}
                    key={section.id}
                    label={section.label}
                    onSelect={selectMainSection}
                />
            ))}
        </>
    );
    const body = (
        <div className="h-full min-h-0 overflow-hidden bg-[var(--settings-panel-background)]">
            {mainSection === 'details' ? (
                <MapDetailsSection
                    action={action}
                    errors={errors}
                    exportHref={`/api/v1/admin/world-builder/maps/${map.id}/export`}
                    form={detailsForm}
                    onOpenHistory={openDetailsHistory}
                    onChange={setDetailsForm}
                    previewTheme={resolvedTheme}
                    topicOptions={topicOptions}
                />
            ) : null}
            {mainSection === 'visuals' ? (
                <MapVisualsSection
                    action={action}
                    errors={errors}
                    imageErrors={imageErrors}
                    mode={mode}
                    onImageUpload={uploadImage}
                    onModeChange={setMode}
                    onVisualSectionChange={selectVisualSection}
                    setForm={setVisualForm}
                    theme={resolvedTheme}
                    uploadingImageKey={uploadingImageKey}
                    visualSection={visualSection}
                    visualForm={visualForm}
                />
            ) : null}
            {mainSection === 'access' ? (
                <AccessSection
                    action={action}
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
            {embedded ? (
                <SettingsNestedWorkspace
                    collapseSidebarBelowWide
                    contentClassName="p-0 sm:p-0"
                    description={
                        map.description ??
                        'Configure map details, visuals and access.'
                    }
                    eyebrow={world.title}
                    headerContentClassName="lg:max-w-none"
                    icon={SlidersHorizontal}
                    sidebar={sidebar}
                    title={`Configure ${map.title}`}
                >
                    {body}
                </SettingsNestedWorkspace>
            ) : (
                <SettingsConfigurationShell
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
            <Dialog
                onOpenChange={setDetailsHistoryOpen}
                open={detailsHistoryOpen}
            >
                <DialogContent className="max-h-[min(44rem,calc(100vh-2rem))] overflow-hidden sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Map detail history</DialogTitle>
                        <DialogDescription>
                            Review earlier map title, description, topic and
                            asset-lock settings. Restoring preserves the current
                            details as a new history entry.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid min-h-0 gap-3 overflow-hidden">
                        {detailsHistoryLoading ? (
                            <p
                                aria-live="polite"
                                className="text-sm"
                                role="status"
                            >
                                Loading map history…
                            </p>
                        ) : detailsHistoryError ? (
                            <p
                                aria-live="polite"
                                className="text-sm text-red-400"
                                role="status"
                            >
                                Map history could not be loaded. Try again.
                            </p>
                        ) : detailsHistory &&
                          detailsHistory.items.length > 0 ? (
                            <div className="grid min-h-0 gap-2">
                                {detailsHistory.items.map((version) => (
                                    <div
                                        className="grid gap-1 rounded-md border border-[var(--settings-border-color)] p-3"
                                        key={version.id}
                                    >
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p className="text-sm font-medium">
                                                {version.title}
                                            </p>
                                            <time className="text-xs text-[var(--settings-muted-text)]">
                                                {formatMapVersionDate(
                                                    version.createdAt,
                                                )}
                                            </time>
                                        </div>
                                        <p className="line-clamp-2 text-xs text-[var(--settings-muted-text)]">
                                            {version.description ||
                                                'No description'}
                                        </p>
                                        <Button
                                            className="justify-self-end"
                                            disabled={
                                                restoringDetailsVersionId !==
                                                null
                                            }
                                            onClick={() =>
                                                void restoreDetailsVersion(
                                                    version,
                                                )
                                            }
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >
                                            <RotateCcw className="size-4" />
                                            {restoringDetailsVersionId ===
                                            version.id
                                                ? 'Restoring…'
                                                : 'Restore this version'}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--settings-muted-text)]">
                                No earlier map details yet. The first update
                                will create one.
                            </p>
                        )}
                        {detailsHistory ? (
                            <PaginationControls
                                buttonClassName="text-[var(--settings-accent)]"
                                currentPage={detailsHistory.pagination.page}
                                disabled={detailsHistoryLoading}
                                label="Map detail history pagination"
                                onPageChange={(page) =>
                                    void loadDetailsHistory(page)
                                }
                                pageCount={detailsHistory.pagination.lastPage}
                                showSinglePage
                                textClassName="text-[var(--settings-muted-text)]"
                            />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Only converts Rust wire names/UUIDs into the pinned source page props. */
export function LiftedWorldBuilderConfigureMapDocument({
    document,
    onDeleted,
    onUpdated,
}: {
    document: components['schemas']['AdminEditableMap'];
    onDeleted: () => void;
    onUpdated: () => void;
}) {
    const editableMap: EditableMapPayload = {
        map: {
            accessRoles: document.editable_map.map.access_roles,
            backgroundConfig: document.editable_map.map.background_config as MapVisualConfig,
            description: document.editable_map.map.description,
            editingGroupIds: document.editable_map.map.editing_group_ids,
            id: document.editable_map.map.id,
            mapAssetsLocked: document.editable_map.map.map_assets_locked,
            nodeCount: document.editable_map.map.node_count,
            slug: document.editable_map.map.slug,
            title: document.editable_map.map.title,
            topicId: document.editable_map.map.topic_id,
            updatedAt: document.editable_map.map.updated_at,
        },
        world: {
            description: document.editable_map.world.description,
            id: document.editable_map.world.id,
            slug: document.editable_map.world.slug,
            title: document.editable_map.world.title,
        },
    };

    return (
        <LiftedWorldBuilderConfigureMap
            accessGroups={document.access_groups}
            canDeleteWorldMaps={document.can_delete_world_maps}
            editableMap={editableMap}
            embedded
            learningGroups={document.learning_groups}
            onDeleted={onDeleted}
            onUpdated={onUpdated}
            topicOptions={document.topic_options}
        />
    );
}

function MapDetailsSection({
    action,
    errors,
    exportHref,
    form,
    onChange,
    onOpenHistory,
    previewTheme,
    topicOptions,
}: {
    action: ReactNode;
    errors: Record<string, string>;
    exportHref: string;
    form: DetailsForm;
    onChange: (form: DetailsForm) => void;
    onOpenHistory: () => void;
    previewTheme: MapVisualThemeFields;
    topicOptions: LearningTopicOption[];
}) {
    return (
        <div className="flex h-full min-h-0 flex-col">
            <ConfigureMapSectionHeader
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            onClick={onOpenHistory}
                            type="button"
                            variant="outline"
                        >
                            <History className="size-4" />
                            History
                        </Button>
                        <Button asChild variant="outline">
                            <a download href={exportHref}>
                                <Download className="size-4" />
                                Download export
                            </a>
                        </Button>
                    </div>
                }
                description="These fields are shown in the top-left map title panel."
                title="Map details"
            />
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
                <div className="grid min-w-0 content-start gap-5">
                    <TextField
                        error={errors.title}
                        label="Title"
                        onChange={(title) => onChange({ ...form, title })}
                        value={form.title}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="map-topic">Learning topic</Label>
                        <select
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-xs transition focus-visible:border-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] focus-visible:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
                            id="map-topic"
                            onChange={(event) =>
                                onChange({
                                    ...form,
                                    topic_id: event.currentTarget.value || null,
                                })
                            }
                            value={form.topic_id ?? ''}
                        >
                            <option value="">No topic assigned</option>
                            {topicOptions.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.topic_id} />
                        <p className="text-xs leading-5 text-[var(--settings-muted-text)]">
                            This map will appear as an exploration surface on
                            the selected topic page.
                        </p>
                    </div>
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
                        <InputError message={errors.updated_at} />
                    </div>
                    <label className="flex items-start gap-3 border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] p-3 text-sm">
                        <Checkbox
                            checked={form.map_assets_locked}
                            onCheckedChange={(checked) =>
                                onChange({
                                    ...form,
                                    map_assets_locked: checked === true,
                                })
                            }
                        />
                        <span>
                            <span className="block font-semibold">
                                Lock MapAsset surface
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--settings-muted-text)]">
                                Keep the surface fixed in editor and learner
                                view. Position changes remain available through
                                the edit fields.
                            </span>
                        </span>
                    </label>
                </div>
                <MapTitlePanelPreview
                    description={form.description}
                    theme={previewTheme}
                    title={form.title}
                />
            </div>
            <ConfigureMapSectionFooter action={action} />
        </div>
    );
}

function MapVisualsSection({
    action,
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
    action: ReactNode;
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
            <ConfigureMapSectionHeader
                action={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {visualSection === 'assets' ? (
                            <Button
                                onClick={() => addMapAsset(setForm, mode)}
                                type="button"
                            >
                                <Plus className="size-4" />
                                Add asset
                            </Button>
                        ) : null}
                        <ConfigModeSwitch
                            mode={mode}
                            onChange={onModeChange}
                            size="large"
                        />
                    </div>
                }
                description="Switch between light and dark configuration, then select the map element you want to tune."
                title="Map visuals"
            />

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 2xl:grid-cols-[17rem_minmax(0,1fr)]">
                <nav className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 2xl:border-r 2xl:border-b-0">
                    <div className="flex flex-wrap gap-2 2xl:grid 2xl:gap-2">
                        {visualSections.map((section) => (
                            <SettingsSectionButton
                                active={visualSection === section.id}
                                compact
                                description={section.description}
                                icon={section.icon}
                                id={section.id}
                                key={section.id}
                                label={section.label}
                                onSelect={onVisualSectionChange}
                            />
                        ))}
                    </div>
                </nav>

                <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
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
            <ConfigureMapSectionFooter action={action} />
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
            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_24rem]">
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
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_24rem]">
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
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_30rem]">
            <div className="grid content-start gap-4">
                <div>
                    <div>
                        <h3 className="text-lg font-semibold">Map assets</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Add decorative layers over the map background.
                        </p>
                    </div>
                </div>
                {values.assets.length === 0 ? (
                    <div className="border border-dashed border-[var(--settings-border-color)] p-5 text-sm text-[var(--settings-muted-text)]">
                        No map assets configured for {mode} mode yet.
                    </div>
                ) : null}
                {values.assets.map((asset, index) => (
                    <div
                        className="grid gap-4 border-t border-[var(--settings-border-color)] pt-4 first:border-t-0 first:pt-0"
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
    action,
    accessGroups,
    editingGroupIds,
    errors,
    learningGroups,
    roles,
    setEditingGroupIds,
    setRoles,
}: {
    action: ReactNode;
    accessGroups: AccessGroup[];
    editingGroupIds: string[];
    errors: Record<string, string>;
    learningGroups: LearningGroupOption[];
    roles: string[];
    setEditingGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
    setRoles: React.Dispatch<React.SetStateAction<string[]>>;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col">
            <ConfigureMapSectionHeader
                description="Every available access group appears here automatically. Public maps can be visited without logging in."
                title="Access"
            />
            <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-5">
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
                                <span className="font-semibold">
                                    {group.label}
                                </span>
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
                        Selected groups can configure this map and its nodes,
                        but they cannot delete the map.
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
                                <span className="font-semibold">
                                    {group.name}
                                </span>
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
                <InputError
                    message={errors.group_ids ?? errors['group_ids.0']}
                />
            </div>
            <ConfigureMapSectionFooter action={action} />
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
        <div className="flex h-full min-h-0 flex-col">
            <ConfigureMapSectionHeader
                description="Remove this map and all content that belongs to it."
                title="Delete world"
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
                                {map.nodeCount === 1 ? '' : 's'}, activities,
                                portal links and learner progress connected to
                                this map. This action cannot be undone.
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
        </div>
    );
}

function ConfigureMapSectionHeader({
    action,
    description,
    title,
}: {
    action?: ReactNode;
    description: string;
    title: string;
}) {
    return (
        <header className="flex shrink-0 flex-col gap-4 border-b border-[var(--settings-border-color)] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {description}
                </p>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </header>
    );
}

function ConfigureMapSectionFooter({ action }: { action: ReactNode }) {
    return (
        <footer className="flex shrink-0 justify-start border-t border-[var(--settings-border-color)] px-5 py-4">
            {action}
        </footer>
    );
}

function formatMapVersionDate(value: string | null): string {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(date);
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
        <div className="grid min-w-0 content-start gap-3 overflow-hidden">
            <h3 className="text-sm font-semibold text-[var(--settings-muted-text)]">
                Preview
            </h3>
            <div
                className="min-w-0 overflow-hidden rounded-xl border p-5 shadow-lg backdrop-blur-md"
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
                <h3 className="text-3xl font-semibold tracking-normal break-words">
                    {title || 'Untitled map'}
                </h3>
                <p
                    className="mt-3 text-sm leading-6 break-words"
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
                    A focused MapAsset description lives here.
                </p>
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
                <PreviewIconButton active theme={theme} />
                <PreviewIconButton theme={theme} />
                <PreviewIconButton theme={theme} />
            </div>
        </PreviewFrame>
    );
}

function PreviewIconButton({
    active = false,
    theme,
}: {
    active?: boolean;
    theme: MapVisualThemeFields;
}) {
    const activeBackground = theme.sideControlActiveBackground;
    const iconColor = active
        ? theme.sideControlActiveIconColor ||
          theme.sideControlActiveTextColor ||
          '#0f172a'
        : theme.sideControlIconColor || theme.sideControlTextColor || '#e2e8f0';

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
            <h3 className="text-sm font-semibold text-[var(--settings-muted-text)]">
                {title}
            </h3>
            <div className="grid min-h-64 place-items-center border-t border-[var(--settings-border-color)] pt-6">
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

async function saveDetails(
    mapId: string,
    form: DetailsForm,
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
    onSuccess: (updatedAt: string) => void,
) : Promise<void> {
    setProcessing(true);
    try {
        const token = await getCsrfToken();
        const { data, response } = await apiClient.PATCH(
            '/admin/world-builder/maps/{map_id}/details',
            { body: form, params: { header: { 'X-CSRF-Token': token }, path: { map_id: mapId } } },
        );
        if (!response.ok || !data) {
            setErrors({ title: response.status === 409 ? 'This map changed in another session. Reload it before saving.' : 'The map details could not be saved.' });
            return;
        }
        setErrors({});
        onSuccess(data.updated_at);
    } catch {
        setErrors({ title: 'The map details could not be saved. Check your connection and try again.' });
    } finally {
        setProcessing(false);
    }
}

async function saveVisuals(
    mapId: string,
    form: MapVisualForm,
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
    onSuccess: () => void,
): Promise<void> {
    setProcessing(true);
    try {
        const token = await getCsrfToken();
        const { response } = await apiClient.PATCH(
            '/admin/world-builder/maps/{map_id}/visuals',
            { body: { background_config: { dark: mapVisualThemeRequest(form.dark), light: mapVisualThemeRequest(form.light) } }, params: { header: { 'X-CSRF-Token': token }, path: { map_id: mapId } } },
        );
        if (!response.ok) {
            setErrors({ background_config: 'The map visuals could not be saved.' });
            return;
        }
        setErrors({});
        onSuccess();
    } catch {
        setErrors({ background_config: 'The map visuals could not be saved. Check your connection and try again.' });
    } finally {
        setProcessing(false);
    }
}

function mapVisualThemeRequest(theme: MapVisualThemeFields) {
    return {
        ...theme,
        imageUrl: persistedMapVisualMediaUrl(theme.imageUrl),
        assets: theme.assets.map((asset) => ({
            id: asset.id,
            imageUrl: persistedMapVisualMediaUrl(asset.imageUrl),
            opacity: percent(asset.opacity, 100),
            width: percent(asset.width, 20, 1, 200),
            x: percent(asset.x, 50),
            y: percent(asset.y, 50),
        })),
    };
}

/**
 * The scoped preview route is intentionally browser-local. The source form
 * still persists a stable media path; converting only our exact Rust preview
 * URL keeps saved map references on the existing learner-safe media contract.
 */
function persistedMapVisualMediaUrl(value: string): string {
    const match = /^\/api\/v1\/admin\/world-builder\/maps\/[0-9a-f-]{36}\/visual-media\/([0-9a-f-]{36})\/content$/i.exec(value);
    return match
        ? `/api/v1/admin/media-assets/${match[1]}/content`
        : value;
}

async function saveAccess(
    mapId: string,
    roles: string[],
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
): Promise<void> {
    setProcessing(true);
    try {
        const token = await getCsrfToken();
        const { response } = await apiClient.PATCH(
            '/admin/world-builder/maps/{map_id}/access',
            { body: { access_roles: roles }, params: { header: { 'X-CSRF-Token': token }, path: { map_id: mapId } } },
        );
        if (!response.ok) setErrors({ access_roles: 'The map access could not be saved.' });
        else setErrors({});
    } catch {
        setErrors({ access_roles: 'The map access could not be saved. Check your connection and try again.' });
    } finally {
        setProcessing(false);
    }
}

async function saveEditingGroups(
    mapId: string,
    groupIds: string[],
    setErrors: (errors: Record<string, string>) => void,
    setProcessing: (processing: boolean) => void,
): Promise<void> {
    setProcessing(true);
    try {
        const token = await getCsrfToken();
        const { response } = await apiClient.PATCH(
            '/admin/world-builder/maps/{map_id}/editing-groups',
            { body: { group_ids: groupIds }, params: { header: { 'X-CSRF-Token': token }, path: { map_id: mapId } } },
        );
        if (!response.ok) setErrors({ group_ids: 'The group editors could not be saved.' });
        else setErrors({});
    } catch {
        setErrors({ group_ids: 'The group editors could not be saved. Check your connection and try again.' });
    } finally {
        setProcessing(false);
    }
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
    current: string[],
    value: string,
    enabled: boolean,
): string[] {
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
