import { Languages, Palette, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    SettingsConfigurationLayout,
    SettingsPanelHeader,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { AdminPresentationPanel } from '@/features/platform-presentation/admin-presentation-panel';
import ColorPaletteSettings, {
    type ColorPaletteProps,
} from '@/pages/settings/color-palette';
import LanguageAdministration, {
    type Language,
} from '@/pages/settings/languages';
import type { PlatformInfoPageKey } from '@/features/platform-info/content';
import type { PublicPresentationSettings } from '@/theme/presentation';

export type PresentationLocalizationSection =
    | 'languages'
    | 'palette'
    | 'public';

type PlatformInfoContent = {
    key: PlatformInfoPageKey;
    markdown: string | null;
    updated_at: string | null;
    updated_by: {
        email: string;
        id: number;
        name: string;
    } | null;
};

type Props = {
    activeSection: PresentationLocalizationSection;
    colorPaletteSettings: ColorPaletteProps | null;
    languages: Language[];
    onSelectSection: (section: PresentationLocalizationSection) => void;
    platformInfoPages: Partial<
        Record<PlatformInfoPageKey, PlatformInfoContent>
    >;
    publicPresentation: PublicPresentationSettings | null;
};

const sections = [
    {
        description: 'Welcome pages, auth screens, cursors and source links.',
        icon: Sparkles,
        key: 'public',
        label: 'Public presentation',
    },
    {
        description: 'Public, journal and map color systems.',
        icon: Palette,
        key: 'palette',
        label: 'Color palette',
    },
    {
        description: 'Platform languages and translation catalogs.',
        icon: Languages,
        key: 'languages',
        label: 'Languages',
    },
] satisfies {
    description: string;
    icon: LucideIcon;
    key: PresentationLocalizationSection;
    label: string;
}[];

export function PresentationLocalizationPanel({
    activeSection,
    colorPaletteSettings,
    languages,
    onSelectSection,
    platformInfoPages,
    publicPresentation,
}: Props) {
    return (
        <div className="h-full min-h-0 p-4">
            <SettingsConfigurationLayout
                className="h-full"
                sidebar={
                    <SettingsSidebar>
                        {sections.map((section) => (
                            <SettingsSectionButton
                                active={activeSection === section.key}
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
                {activeSection === 'public' && publicPresentation ? (
                    <AdminPresentationPanel
                        platformInfoContent={platformInfoPages}
                        presentation={publicPresentation}
                    />
                ) : null}

                {activeSection === 'palette' && colorPaletteSettings ? (
                    <ColorPaletteSettings {...colorPaletteSettings} embedded />
                ) : null}

                {activeSection === 'languages' && languages.length > 0 ? (
                    <LanguageAdministration embedded languages={languages} />
                ) : null}

                {isMissingSectionContent(
                    activeSection,
                    colorPaletteSettings,
                    languages,
                    publicPresentation,
                ) ? (
                    <section className="grid h-full place-items-center rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-white/10">
                        <SettingsPanelHeader
                            description="Your current role can open this settings group, but this sub-section is not available with the current permissions."
                            eyebrow="Unavailable"
                            icon={Palette}
                            title="Nothing to configure here"
                        />
                    </section>
                ) : null}
            </SettingsConfigurationLayout>
        </div>
    );
}

function isMissingSectionContent(
    section: PresentationLocalizationSection,
    colorPaletteSettings: ColorPaletteProps | null,
    languages: Language[],
    publicPresentation: PublicPresentationSettings | null,
): boolean {
    if (section === 'public') {
        return !publicPresentation;
    }

    if (section === 'palette') {
        return !colorPaletteSettings;
    }

    return languages.length === 0;
}
