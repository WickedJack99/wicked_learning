import {
    CircleAlert,
    CircleCheck,
    Download,
    Pencil,
    SlidersHorizontal,
    Sparkles,
} from 'lucide-react';
import { Link } from 'react-router';
import type { ReactNode } from 'react';

import type { components } from './api/schema';
import { LiftedButton } from './lifted-button';
import { LiftedDuplicateMapDialog } from './lifted-duplicate-map-dialog';
import { LiftedLearnerPaginatedItems } from './lifted-learner-paginated-items';
import { usePlatformTranslation } from './original-platform-translation';

type RustMapSummary = components['schemas']['AdminMapSummary'];

type SourceNodeSummary = {
    activityReviewCount: number;
    id: string;
    title: string;
};

type SourceMapSummary = {
    description: string | null;
    id: string;
    nodeCount: number;
    nodes: SourceNodeSummary[];
    reviewCount: number;
    slug: string;
    title: string;
};

/**
 * Direct Rust transport adapter for the pinned `MapSummary` read shape.
 * Presentation and review pagination stay in the lifted source component.
 */
function adaptRustMapSummary(map: RustMapSummary): SourceMapSummary {
    return {
        description: map.description,
        id: map.id,
        nodeCount: map.node_count,
        nodes: map.nodes.map((node) => ({
            activityReviewCount: node.activity_review_count,
            id: node.id,
            title: node.title,
        })),
        reviewCount: map.review_count,
        slug: map.slug,
        title: map.title,
    };
}

type RustNavigationLinkProps = {
    children: ReactNode;
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
    map: RustMapSummary;
    onConfigureMap: (mapId: string) => void;
    onConfigureMapAssets: (mapId: string) => void;
    onDuplicated: (mapId: string) => void;
    onOpenReviewNode: (mapId: string, nodeId: string) => void;
};

/**
 * Direct lift of main:resources/js/pages/settings/worlds/index.tsx `MapDetails`.
 * Only its Inertia links and duplicate form post use Rust adapters.
 */
export function LiftedWorldBuilderMapDetails({
    map: rustMap,
    onConfigureMap,
    onConfigureMapAssets,
    onDuplicated,
    onOpenReviewNode,
}: Props) {
    const map = adaptRustMapSummary(rustMap);
    const t = usePlatformTranslation();
    const nodesNeedingReview = map.nodes.filter(
        (node) => node.activityReviewCount > 0,
    );

    return (
        <div data-wl-id="authoring.world-builder.graph.map-inspector">
            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                Map
            </p>
            <h2 className="mt-2 text-xl font-semibold">{map.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {map.description ?? 'No description yet.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
                <Detail label="Slug" value={map.slug} />
                <Detail label="Tiles" value={map.nodeCount.toString()} />
            </dl>
            <section className="mt-6 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <div className="flex items-start gap-3">
                    {map.reviewCount > 0 ? (
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
                    ) : (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    )}
                    <div>
                        <p className="text-sm font-semibold">Authoring review</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                            {map.reviewCount > 0
                                ? `${map.reviewCount} ${map.reviewCount === 1 ? 'activity needs' : 'activities need'} AI review before the next authoring pass.`
                                : 'No activities are waiting for AI review.'}
                        </p>
                    </div>
                </div>
                {nodesNeedingReview.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                        <LiftedButton
                            asChild
                            className="justify-between gap-3"
                            variant="secondary"
                        >
                            <RustNavigationLink
                                onNavigate={() =>
                                    onOpenReviewNode(
                                        map.id,
                                        nodesNeedingReview[0].id,
                                    )
                                }
                                to={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&node=${nodesNeedingReview[0].id}&worldView=nodes`}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <Sparkles className="size-4" />
                                    Open review queue
                                </span>
                                <span aria-hidden="true">→</span>
                            </RustNavigationLink>
                        </LiftedButton>
                        <LiftedLearnerPaginatedItems
                            className="grid gap-2"
                            items={nodesNeedingReview}
                            pageSize={5}
                            paginationButtonClassName="inline-flex items-center gap-1 text-sm text-[var(--settings-accent)] transition hover:text-slate-950 dark:hover:text-white disabled:pointer-events-none disabled:opacity-40"
                            paginationClassName="flex items-center justify-between border-t border-[var(--settings-border-color)] pt-3"
                            paginationLabel="Activities awaiting review"
                            paginationTextClassName="text-xs text-slate-500 dark:text-slate-400"
                            renderItem={(node) => (
                                <LiftedButton
                                    asChild
                                    className="h-auto justify-between gap-3 px-3 py-2 text-left"
                                    key={node.id}
                                    variant="outline"
                                >
                                    <RustNavigationLink
                                        onNavigate={() =>
                                            onOpenReviewNode(map.id, node.id)
                                        }
                                        to={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&node=${node.id}&worldView=nodes`}
                                    >
                                        <span className="min-w-0 truncate text-xs">
                                            {node.title}
                                        </span>
                                        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                                            {node.activityReviewCount}{' '}
                                            {node.activityReviewCount === 1
                                                ? 'activity'
                                                : 'activities'}
                                        </span>
                                    </RustNavigationLink>
                                </LiftedButton>
                            )}
                        />
                    </div>
                ) : null}
            </section>
            <LiftedButton asChild className="mt-6 w-full">
                <RustNavigationLink
                    onNavigate={() => onConfigureMapAssets(map.id)}
                    to={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&worldView=nodes`}
                >
                    <Pencil className="size-4" />
                    Configure MapAssets
                </RustNavigationLink>
            </LiftedButton>
            <LiftedButton asChild className="mt-2 w-full" variant="secondary">
                <RustNavigationLink
                    onNavigate={() => onConfigureMap(map.id)}
                    to={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&worldView=configure`}
                >
                    <SlidersHorizontal className="size-4" />
                    Configure map
                </RustNavigationLink>
            </LiftedButton>
            <LiftedButton asChild className="mt-2 w-full" variant="outline">
                <a
                    data-wl-id="settings.world-builder.map.export"
                    download
                    href={`/api/v1/admin/world-builder/maps/${map.id}/export`}
                >
                    <Download className="size-4" />
                    {t('settings.world_builder.map.export', 'Export map')}
                </a>
            </LiftedButton>
            <LiftedButton asChild className="mt-2 w-full" variant="outline">
                <a
                    data-wl-id="settings.world-builder.map.export-package"
                    download
                    href={`/api/v1/admin/world-builder/maps/${map.id}/export-package`}
                >
                    <Download className="size-4" />
                    {t(
                        'settings.world_builder.map.export_package',
                        'Export map with media',
                    )}
                </a>
            </LiftedButton>
            <LiftedDuplicateMapDialog
                mapId={map.id}
                mapTitle={map.title}
                onDuplicated={onDuplicated}
            />
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                {label}
            </dt>
            <dd className="mt-1 text-slate-950 dark:text-white">{value}</dd>
        </div>
    );
}
