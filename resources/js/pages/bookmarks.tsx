import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Bookmark, MapPin, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { deleteJson } from '@/features/world/api';
import { resolveThemeVariant } from '@/features/world/theme';
import { WorldMap } from '@/features/world/world-map';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type { LearningMap, LearningNode } from '@/types';

type BookmarksProps = {
    bookmarkMap: LearningMap;
};

export default function Bookmarks({ bookmarkMap }: BookmarksProps) {
    const { resolvedAppearance } = useAppearance();
    const [map, setMap] = useState(bookmarkMap);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const mapTheme = resolveThemeVariant(
        map.backgroundConfig,
        resolvedAppearance,
    );
    const selectedNode = useMemo(
        () => map.nodes.find((node) => node.id === selectedNodeId) ?? null,
        [map.nodes, selectedNodeId],
    );

    const removeBookmark = async (node: LearningNode) => {
        await deleteJson(`/learning/nodes/${node.id}/bookmark`);

        setMap((current) => ({
            ...current,
            nodes: current.nodes.filter(
                (candidate) => candidate.id !== node.id,
            ),
        }));
        setSelectedNodeId(null);
    };

    return (
        <>
            <Head title="Bookmarked Places" />
            <main
                className="relative min-h-svh overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
                data-world-appearance={resolvedAppearance}
                style={{
                    background: mapTheme.pageBackground,
                    color: mapTheme.sidePanelTextColor,
                }}
            >
                <section className="absolute inset-0 overflow-hidden">
                    {map.nodes.length > 0 ? (
                        <WorldMap
                            activityProgress={{}}
                            allowLockedSelection
                            map={map}
                            mode={resolvedAppearance}
                            onClearFocus={() => setSelectedNodeId(null)}
                            onClearEquippedTool={() => undefined}
                            onSelectNode={(node) => setSelectedNodeId(node.id)}
                            onUseToolOnNode={() => undefined}
                            selectedNode={selectedNode}
                            selectedTool={null}
                        />
                    ) : (
                        <EmptyBookmarksState />
                    )}
                </section>

                <aside
                    className={cn(
                        'absolute inset-0 z-50 w-full border-l border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-300 ease-out md:left-auto md:max-w-[420px] dark:border-white/10 dark:bg-[#111820] dark:text-slate-100',
                        selectedNode
                            ? 'translate-x-0'
                            : 'pointer-events-none translate-x-full',
                    )}
                    style={{
                        background: mapTheme.sidePanelBackground,
                        borderColor: mapTheme.sidePanelBorderColor,
                        color: mapTheme.sidePanelTextColor,
                    }}
                >
                    {selectedNode ? (
                        <BookmarkPanel
                            mapTheme={mapTheme}
                            node={selectedNode}
                            onClose={() => setSelectedNodeId(null)}
                            onRemove={() => void removeBookmark(selectedNode)}
                        />
                    ) : null}
                </aside>
            </main>
        </>
    );
}

Bookmarks.layout = {
    breadcrumbs: [
        {
            title: 'Bookmarked Places',
            href: '/bookmarks',
        },
    ],
};

function EmptyBookmarksState() {
    return (
        <div className="grid h-full place-items-center px-6 text-center">
            <div className="max-w-sm rounded-lg border border-slate-200 bg-white/82 p-6 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                <Bookmark className="mx-auto mb-4 size-10 text-cyan-700 dark:text-teal-200" />
                <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">
                    No bookmarks yet
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Open a node on the world map and use the bookmark icon to
                    add it to your personal map.
                </p>
                <Button asChild className="mt-5">
                    <Link href="/world">Open world map</Link>
                </Button>
            </div>
        </div>
    );
}

function BookmarkPanel({
    mapTheme,
    node,
    onClose,
    onRemove,
}: {
    mapTheme: ReturnType<typeof resolveThemeVariant>;
    node: LearningNode;
    onClose: () => void;
    onRemove: () => void;
}) {
    const panelBorderColor =
        typeof mapTheme.sidePanelBorderColor === 'string'
            ? mapTheme.sidePanelBorderColor
            : undefined;

    return (
        <div className="flex h-full min-h-[44vh] flex-col gap-5 overflow-y-auto overscroll-contain p-5 md:p-7">
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/78">
                        Bookmarked place
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
                        {node.title}
                    </h2>
                </div>
                <Button
                    aria-label="Close bookmark panel"
                    onClick={onClose}
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <X className="size-4" />
                </Button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-teal-100">
                    <MapPin className="size-4" />
                    <span>{node.mapTitle}</span>
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {node.description ?? 'No summary has been added yet.'}
                </p>
                {node.state === 'locked' ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        This node is visible but currently locked. You can still
                        use it for orientation.
                    </p>
                ) : null}
            </div>

            <div className="mt-auto grid gap-3">
                <Button
                    asChild
                    className="border border-slate-200 bg-white/90 text-slate-950 shadow-none hover:bg-cyan-50 hover:text-slate-950 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 dark:hover:text-white"
                    variant="ghost"
                >
                    <Link
                        href={`/world?map=${encodeURIComponent(node.mapSlug)}&focused=${encodeURIComponent(node.slug)}`}
                    >
                        Go to node
                        <ArrowRight className="ml-2 size-4" />
                    </Link>
                </Button>
                <Button
                    onClick={onRemove}
                    style={{
                        borderColor: panelBorderColor,
                    }}
                    type="button"
                    variant="outline"
                >
                    <Bookmark className="size-4 fill-current" />
                    Remove bookmark
                </Button>
            </div>
        </div>
    );
}
