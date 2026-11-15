import { GitBranch, Map as MapIcon, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { SettingsSectionButton } from './extracted-settings-configuration-shell';

export type LiftedWorldBuilderMapView = 'configure' | 'nodes';

type WorldBuilderMapDetail = {
    activeView: LiftedWorldBuilderMapView;
    content: ReactNode;
    mapId: string;
    mapTitle: string;
    nodeId?: string;
    nodeTitle?: string;
};

const mapViewSections = [
    {
        description: 'Edit MapAssets, placement and connected activities.',
        icon: GitBranch,
        key: 'nodes',
        label: 'Configure MapAssets',
    },
    {
        description: 'Edit map details, visuals and access.',
        icon: SlidersHorizontal,
        key: 'configure',
        label: 'Configure map',
    },
] as const;

/**
 * Direct lift of main:resources/js/features/settings/world-builder-settings-panel.tsx
 * `WorldBuilderMapWorkspace`. Only its Inertia router visit is replaced with
 * the supplied Rust URL-selection adapter; editor content remains a slot.
 */
export function LiftedWorldBuilderMapWorkspace({
    detail,
    onSelectMapView,
}: {
    detail: WorldBuilderMapDetail;
    onSelectMapView: (view: LiftedWorldBuilderMapView) => void;
}) {
    return (
        <section
            className="grid h-full min-h-0 gap-0 overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)]"
            data-wl-id="authoring.world-builder.map-workspace"
        >
            <aside className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                <div className="mb-3 flex items-center gap-2 px-3 py-2 text-[var(--settings-accent)]">
                    <MapIcon className="size-4" />
                    <p className="truncate text-xs font-medium tracking-[0.18em] uppercase">
                        {detail.mapTitle}
                    </p>
                </div>
                <nav className="grid gap-2">
                    {mapViewSections.map((section) => (
                        <SettingsSectionButton
                            active={detail.activeView === section.key}
                            description={section.description}
                            icon={section.icon}
                            id={section.key}
                            key={section.key}
                            label={section.label}
                            onSelect={onSelectMapView}
                        />
                    ))}
                </nav>
            </aside>

            <div className="min-h-0 overflow-hidden bg-[var(--settings-content-background)]">
                {detail.content}
            </div>
        </section>
    );
}
