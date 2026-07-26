import { Hammer, Image, MousePointer2, Music, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    SettingsConfigurationLayout,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import AdminItemsPage, { type AdminItem } from '@/pages/settings/assets/items';
import AdminMediaAssets, {
    type ReusableMediaAsset,
} from '@/pages/settings/assets/media';
import AdminSoundsPage from '@/pages/settings/assets/sounds';
import AdminToolsPage, { type AdminTool } from '@/pages/settings/assets/tools';
import { CursorImageSettingsPanel } from '@/features/settings/cursor-image-settings-panel';
import type { PublicPresentationSettings } from '@/theme/presentation';
import type { LearningSound } from '@/types';

export type AssetsWorldObjectsSection =
    | 'cursors'
    | 'items'
    | 'sounds'
    | 'tools'
    | 'visuals';

export type AssetsWorldObjectsSettings = {
    items: AdminItem[];
    sounds: LearningSound[];
    tools: AdminTool[];
    visuals: ReusableMediaAsset[];
};

type Props = {
    activeSection: AssetsWorldObjectsSection;
    assets: AssetsWorldObjectsSettings;
    canViewAssets: boolean;
    canViewCursors: boolean;
    canViewSounds: boolean;
    onSelectSection: (section: AssetsWorldObjectsSection) => void;
    publicPresentation: PublicPresentationSettings | null;
};

const sections = [
    {
        description: 'Reusable images, animations and uploaded media.',
        icon: Image,
        key: 'visuals',
        label: 'Visuals',
    },
    {
        description: 'Ambience, music, UI sounds and voice clips.',
        icon: Music,
        key: 'sounds',
        label: 'Sounds',
    },
    {
        description: 'Normal, action, grab, text and denied cursor images.',
        icon: MousePointer2,
        key: 'cursors',
        label: 'Cursor images',
    },
    {
        description: 'Inspectable tools and map interaction helpers.',
        icon: Hammer,
        key: 'tools',
        label: 'Tools',
    },
    {
        description: 'Consumable or collectible inventory objects.',
        icon: Package,
        key: 'items',
        label: 'Items',
    },
] satisfies {
    description: string;
    icon: LucideIcon;
    key: AssetsWorldObjectsSection;
    label: string;
}[];

export function AssetsWorldObjectsPanel({
    activeSection,
    assets,
    canViewAssets,
    canViewCursors,
    canViewSounds,
    onSelectSection,
    publicPresentation,
}: Props) {
    const visibleSections = sections.filter((section) => {
        if (section.key === 'sounds') {
            return canViewSounds;
        }

        if (section.key === 'cursors') {
            return canViewCursors && publicPresentation !== null;
        }

        return canViewAssets;
    });
    const resolvedSection = visibleSections.some(
        (section) => section.key === activeSection,
    )
        ? activeSection
        : visibleSections[0]?.key;

    if (!resolvedSection) {
        return (
            <section className="grid h-full place-items-center p-6 text-center">
                <p className="max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
                    No asset libraries are available with the current
                    permissions.
                </p>
            </section>
        );
    }

    return (
        <div className="h-full min-h-0 p-4">
            <SettingsConfigurationLayout
                className="h-full"
                sidebar={
                    <SettingsSidebar>
                        {visibleSections.map((section) => (
                            <SettingsSectionButton
                                active={resolvedSection === section.key}
                                description={section.description}
                                icon={section.icon}
                                id={section.key}
                                key={section.key}
                                label={section.label}
                                onSelect={onSelectSection}
                            />
                        ))}
                    </SettingsSidebar>
                }
            >
                {resolvedSection === 'visuals' ? (
                    <AdminMediaAssets assets={assets.visuals} embedded />
                ) : null}

                {resolvedSection === 'sounds' ? (
                    <AdminSoundsPage embedded sounds={assets.sounds} />
                ) : null}

                {resolvedSection === 'cursors' && publicPresentation ? (
                    <CursorImageSettingsPanel
                        presentation={publicPresentation}
                    />
                ) : null}

                {resolvedSection === 'tools' ? (
                    <AdminToolsPage embedded tools={assets.tools} />
                ) : null}

                {resolvedSection === 'items' ? (
                    <AdminItemsPage embedded items={assets.items} />
                ) : null}
            </SettingsConfigurationLayout>
        </div>
    );
}
