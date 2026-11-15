import { ArrowRight, Pencil } from 'lucide-react';
import { Link } from 'react-router';

import type { components } from './api/schema';
import { LiftedButton } from './lifted-button';

type RustPortalLink = components['schemas']['AdminPortalLink'];

type SourceNodeSummary = {
    description: string | null;
    id: string;
    slug: string;
    title: string;
};

type SourcePortalActivitySummary = {
    id: string;
    title: string;
    type: string;
};

type SourcePortalLinkSummary = {
    description: string | null;
    id: string;
    label: string | null;
    sourceActivity: SourcePortalActivitySummary | null;
    sourceMapId: string;
    sourceNode: SourceNodeSummary;
    targetActivity: SourcePortalActivitySummary | null;
    targetMapId: string;
    targetNode: SourceNodeSummary;
};

/**
 * Direct Rust transport adapter for the pinned `PortalLinkSummary` read shape.
 * Presentation and conditional source-activity navigation remain in the lifted
 * source component.
 */
function adaptRustPortalLink(portal: RustPortalLink): SourcePortalLinkSummary {
    return {
        description: portal.description,
        id: portal.id,
        label: portal.label,
        sourceActivity: portal.source_activity
            ? {
                  id: portal.source_activity.id,
                  title: portal.source_activity.title,
                  type: portal.source_activity.activity_type,
              }
            : null,
        sourceMapId: portal.source_map_id,
        sourceNode: {
            description: portal.source_node.description,
            id: portal.source_node.id,
            slug: portal.source_node.slug,
            title: portal.source_node.title,
        },
        targetActivity: portal.target_activity
            ? {
                  id: portal.target_activity.id,
                  title: portal.target_activity.title,
                  type: portal.target_activity.activity_type,
              }
            : null,
        targetMapId: portal.target_map_id,
        targetNode: {
            description: portal.target_node.description,
            id: portal.target_node.id,
            slug: portal.target_node.slug,
            title: portal.target_node.title,
        },
    };
}

type RustNavigationLinkProps = {
    children: React.ReactNode;
    className?: string;
    onNavigate: () => void;
    to: string;
};

/** React Router replacement for the source Inertia Link boundary. */
function RustNavigationLink({
    children,
    className,
    onNavigate,
    to,
}: RustNavigationLinkProps) {
    return (
        <Link
            className={className}
            onClick={(event) => {
                event.preventDefault();
                onNavigate();
            }}
            to={to}
        >
            {children}
        </Link>
    );
}

type Props = {
    onOpenSourceActivity: (mapId: string, nodeId: string) => void;
    portal: RustPortalLink;
};

/**
 * Direct lift of main:resources/js/pages/settings/worlds/index.tsx
 * `PortalDetails` and `PortalEndpoint`. Only the Inertia link uses a Rust
 * navigation adapter.
 */
export function LiftedWorldBuilderPortalDetails({
    onOpenSourceActivity,
    portal: rustPortal,
}: Props) {
    const portal = adaptRustPortalLink(rustPortal);

    return (
        <div data-wl-id="authoring.world-builder.graph.portal-inspector">
            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                Portal link
            </p>
            <h2 className="mt-2 text-xl font-semibold">
                {portal.label ?? 'Unnamed portal'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {portal.description ?? 'No portal description yet.'}
            </p>
            <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <PortalEndpoint
                    activity={portal.sourceActivity}
                    direction="From"
                    node={portal.sourceNode}
                />
                <ArrowRight className="mx-auto size-4 text-slate-400" />
                <PortalEndpoint
                    activity={portal.targetActivity}
                    direction="To"
                    node={portal.targetNode}
                />
            </div>
            {portal.sourceActivity ? (
                <LiftedButton asChild className="mt-5 w-full" variant="outline">
                    <RustNavigationLink
                        onNavigate={() =>
                            onOpenSourceActivity(
                                portal.sourceMapId,
                                portal.sourceNode.id,
                            )
                        }
                        to={`/settings?panel=admin-world-builder&worldSection=graph&map=${portal.sourceMapId}&node=${portal.sourceNode.id}&worldView=nodes`}
                    >
                        <Pencil className="size-4" />
                        Edit source activity
                    </RustNavigationLink>
                </LiftedButton>
            ) : null}
        </div>
    );
}

function PortalEndpoint({
    activity,
    direction,
    node,
}: {
    activity: SourcePortalActivitySummary | null;
    direction: string;
    node: SourceNodeSummary;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase dark:text-slate-400">
                {direction}
            </p>
            <p className="mt-1 text-sm font-semibold">{node.title}</p>
            {activity ? (
                <p className="mt-1 text-xs text-[var(--settings-accent)]">
                    {activity.title}
                </p>
            ) : null}
            <p className="text-xs text-slate-500 dark:text-slate-400">
                {node.description ?? node.slug}
            </p>
        </div>
    );
}
