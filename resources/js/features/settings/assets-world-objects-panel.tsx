import { Hammer, Image, Music, Package } from 'lucide-react';
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
import type { LearningSound } from '@/types';

export type AssetsWorldObjectsSection =
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
    canViewSounds: boolean;
    onSelectSection: (section: AssetsWorldObjectsSection) => void;
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
    canViewSounds,
    onSelectSection,
}: Props) {
    const visibleSections = sections.filter((section) =>
        section.key === 'sounds' ? canViewSounds : canViewAssets,
    );
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
