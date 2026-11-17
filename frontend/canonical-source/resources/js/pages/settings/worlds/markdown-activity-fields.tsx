import { router } from '@inertiajs/react';
import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import {
    CircleStop,
    FileText,
    ImagePlus,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ColorField } from '@/components/color-input';
import InputError from '@/components/input-error';
import { ReusableImagePicker } from '@/components/reusable-image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type {
    ActivityForm,
    GraphLayout,
    MarkdownPageForm,
    MarkdownTransitionForm,
} from './edit-node-activity-types';

type MarkdownGraphNode =
    | Node<{ kind: 'start' | 'end'; title: string }, 'special'>
    | Node<
          { onEdit: (pageId: string) => void; page: MarkdownPageForm },
          'page'
      >;

type MarkdownGraphEdge = Edge<MarkdownTransitionForm>;

const nodeTypes = {
    page: MarkdownPageNode,
    special: MarkdownSpecialNode,
};

export function MarkdownActivityFields({
    activityId,
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    uploadingImageKey,
}: {
    activityId: number;
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const openPageEditor = useCallback((pageId: string) => {
        setSelectedPageId(pageId);
    }, []);

    const graphNodes = useMemo(
        () =>
            buildMarkdownNodes(
                form.markdown_pages,
                form.markdown_graph_layout,
                openPageEditor,
            ),
        [form.markdown_graph_layout, form.markdown_pages, openPageEditor],
    );
    const graphEdges = useMemo(
        () => buildMarkdownEdges(form.markdown_transitions),
        [form.markdown_transitions],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges);

    useEffect(() => setNodes(graphNodes), [graphNodes, setNodes]);
    useEffect(() => setEdges(graphEdges), [graphEdges, setEdges]);

    const selectedPage =
        form.markdown_pages.find((page) => page.id === selectedPageId) ?? null;

    const addPage = () => {
        const nextNumber = form.markdown_pages.length + 1;
        const id = `page-${Date.now()}`;

        onChange((current) => ({
            ...current,
            markdown_pages: [
                ...current.markdown_pages,
                {
                    body: `# Page ${nextNumber}\n\nAdd markdown content here.`,
                    id,
                    position: {
                        x: 140 + nextNumber * 260,
                        y: 80 + (nextNumber % 2) * 160,
                    },
                    title: `Page ${nextNumber}`,
                    visual: {
                        borderColorDark: '#2dd4bf',
                        borderColorLight: '#0891b2',
                        headingColorDark: '#67e8f9',
                        headingColorLight: '#0e7490',
                        pageColorDark: '#0f172a',
                        pageColorLight: '#ffffff',
                        textColorDark: '#f8fafc',
                        textColorLight: '#0f172a',
                    },
                },
            ],
        }));
        setSelectedPageId(id);
    };

    const updatePage = (
        pageId: string,
        updater: (page: MarkdownPageForm) => MarkdownPageForm,
    ) => {
        onChange((current) => ({
            ...current,
            markdown_pages: current.markdown_pages.map((page) =>
                page.id === pageId ? updater(page) : page,
            ),
        }));
    };

    const deletePage = (pageId: string) => {
        onChange((current) => ({
            ...current,
            markdown_pages: current.markdown_pages.filter(
                (page) => page.id !== pageId,
            ),
            markdown_transitions: current.markdown_transitions.filter(
                (transition) =>
                    transition.from !== pageId && transition.to !== pageId,
            ),
        }));
        setSelectedPageId((current) => (current === pageId ? null : current));
    };

    const connectPages = (connection: Connection) => {
        if (!connection.source || !connection.target) {
            return;
        }

        onChange((current) => ({
            ...current,
            markdown_transitions: [
                ...current.markdown_transitions.filter(
                    (transition) => transition.from !== connection.source,
                ),
                {
                    from: connection.source,
                    id: `markdown-edge-${Date.now()}`,
                    to: connection.target,
                },
            ],
        }));
    };

    const removeEdge = (edge: MarkdownGraphEdge) => {
        onChange((current) => ({
            ...current,
            markdown_transitions: current.markdown_transitions.filter(
                (transition) => transition.id !== edge.id,
            ),
        }));
    };

    const savePosition = (node: MarkdownGraphNode) => {
        const position = {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
        };

        if (node.type === 'special') {
            onChange((current) => ({
                ...current,
                markdown_graph_layout: {
                    ...current.markdown_graph_layout,
                    [node.id]: position,
                },
            }));

            router.patch(
                `/settings/worlds/activities/${activityId}/graph-layout`,
                {
                    node: node.id,
                    position,
                },
                { preserveScroll: true },
            );

            return;
        }

        updatePage(node.id, (page) => ({
            ...page,
            position,
        }));
    };

    const insertMedia = (url: string) => {
        if (!selectedPage || !url) {
            return;
        }

        updatePage(selectedPage.id, (page) => ({
            ...page,
            body: `${page.body.trimEnd()}\n\n![Media](${normalizeMediaUrl(url)})\n`,
        }));
    };

    return (
        <div className="relative h-full min-h-[32rem] overflow-hidden">
            <div className="absolute top-4 left-4 z-10 flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/85">
                <div>
                    <p className="text-sm font-semibold">Markdown page graph</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Connect Start to a page, chain pages, then connect the
                        final page to End.
                    </p>
                </div>
                <Button onClick={addPage} type="button">
                    <Plus className="size-4" />
                    Add page
                </Button>
            </div>

            <ReactFlow
                colorMode={resolvedAppearance}
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.28 }}
                nodeTypes={nodeTypes}
                nodes={nodes}
                onConnect={connectPages}
                onEdgeClick={(_, edge) => removeEdge(edge as MarkdownGraphEdge)}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => {
                    if (node.type !== 'page') {
                        setSelectedPageId(null);
                    }
                }}
                onNodeDragStop={(_, node) =>
                    savePosition(node as MarkdownGraphNode)
                }
                onNodesChange={onNodesChange}
                onPaneClick={() => setSelectedPageId(null)}
            >
                <Background gap={24} />
                <Controls />
                <MiniMap pannable zoomable />
            </ReactFlow>

            <div className="pointer-events-none absolute bottom-4 left-4 z-10 grid gap-1">
                <InputError message={errors.markdown_pages} />
                <InputError message={errors.markdown_transitions} />
            </div>

            {selectedPage ? (
                <aside className="absolute inset-y-3 right-3 z-20 flex w-[min(34rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-2">
                            <Label htmlFor="markdown-page-title">
                                Selected page
                            </Label>
                            <Input
                                id="markdown-page-title"
                                onChange={(event) => {
                                    const title = event.currentTarget.value;

                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        title,
                                    }));
                                }}
                                value={selectedPage.title}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/10"
                                disabled={form.markdown_pages.length <= 1}
                                onClick={() => deletePage(selectedPage.id)}
                                type="button"
                                variant="ghost"
                            >
                                <Trash2 className="size-4" />
                                Delete
                            </Button>
                            <Button
                                aria-label="Close page editor"
                                onClick={() => setSelectedPageId(null)}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <X className="size-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                        <div className="grid gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label htmlFor="markdown-page-body">
                                    Markdown
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        onClick={() => setIsPickerOpen(true)}
                                        size="sm"
                                        type="button"
                                        variant="secondary"
                                    >
                                        <ImagePlus className="size-4" />
                                        Insert existing image
                                    </Button>
                                    <Button
                                        asChild
                                        disabled={
                                            uploadingImageKey ===
                                            `markdown-${selectedPage.id}`
                                        }
                                        size="sm"
                                        type="button"
                                        variant="secondary"
                                    >
                                        <label
                                            htmlFor={`markdown-${selectedPage.id}-upload`}
                                        >
                                            <ImagePlus className="size-4" />
                                            {uploadingImageKey ===
                                            `markdown-${selectedPage.id}`
                                                ? 'Uploading...'
                                                : 'Upload media'}
                                        </label>
                                    </Button>
                                    <input
                                        accept=".gif,.jpg,.jpeg,.m4v,.mov,.mp4,.ogg,.ogv,.png,.svg,.webm,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp,video/mp4,video/ogg,video/quicktime,video/webm"
                                        className="sr-only"
                                        id={`markdown-${selectedPage.id}-upload`}
                                        onChange={(event) => {
                                            const file =
                                                event.currentTarget.files?.[0];

                                            if (file) {
                                                onUpload(
                                                    `markdown-${selectedPage.id}`,
                                                    file,
                                                    insertMedia,
                                                );
                                            }

                                            event.currentTarget.value = '';
                                        }}
                                        type="file"
                                    />
                                </div>
                            </div>
                            <textarea
                                className="min-h-56 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-950 shadow-sm transition outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] dark:border-white/10 dark:bg-slate-950 dark:text-white"
                                id="markdown-page-body"
                                onChange={(event) => {
                                    const body = event.currentTarget.value;

                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        body,
                                    }));
                                }}
                                value={selectedPage.body}
                            />
                            <InputError
                                message={
                                    imageUploadErrors[
                                        `markdown-${selectedPage.id}`
                                    ]
                                }
                            />
                        </div>

                        <MarkdownPagePreview
                            mode={resolvedAppearance}
                            page={selectedPage}
                        />

                        <div className="grid gap-3 md:grid-cols-2">
                            <PageColorField
                                id="markdown-page-color-dark"
                                label="Dark page"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            pageColorDark: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.pageColorDark}
                            />
                            <PageColorField
                                id="markdown-border-color-dark"
                                label="Dark border"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            borderColorDark: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.borderColorDark}
                            />
                            <PageColorField
                                id="markdown-text-color-dark"
                                label="Dark text"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            textColorDark: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.textColorDark}
                            />
                            <PageColorField
                                id="markdown-heading-color-dark"
                                label="Dark headings"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            headingColorDark: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.headingColorDark}
                            />
                            <PageColorField
                                id="markdown-page-color-light"
                                label="Light page"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            pageColorLight: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.pageColorLight}
                            />
                            <PageColorField
                                id="markdown-border-color-light"
                                label="Light border"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            borderColorLight: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.borderColorLight}
                            />
                            <PageColorField
                                id="markdown-text-color-light"
                                label="Light text"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            textColorLight: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.textColorLight}
                            />
                            <PageColorField
                                id="markdown-heading-color-light"
                                label="Light headings"
                                onChange={(value) =>
                                    updatePage(selectedPage.id, (page) => ({
                                        ...page,
                                        visual: {
                                            ...page.visual,
                                            headingColorLight: value,
                                        },
                                    }))
                                }
                                value={selectedPage.visual.headingColorLight}
                            />
                        </div>
                    </div>
                </aside>
            ) : null}

            {isPickerOpen ? (
                <ReusableImagePicker
                    currentValue=""
                    onClear={() => setIsPickerOpen(false)}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(url) => {
                        insertMedia(url);
                        setIsPickerOpen(false);
                    }}
                />
            ) : null}
        </div>
    );
}

function MarkdownPagePreview({
    mode,
    page,
}: {
    mode: 'dark' | 'light';
    page: MarkdownPageForm;
}) {
    const isLight = mode === 'light';
    const pageColor = isLight
        ? page.visual.pageColorLight
        : page.visual.pageColorDark;
    const borderColor = isLight
        ? page.visual.borderColorLight
        : page.visual.borderColorDark;
    const textColor = isLight
        ? page.visual.textColorLight
        : page.visual.textColorDark;
    const headingColor = isLight
        ? page.visual.headingColorLight
        : page.visual.headingColorDark;
    const bodyPreview = page.body
        .split('\n')
        .filter((line) => line.trim() !== '')
        .slice(0, 3)
        .join(' ')
        .replace(/^#+\s*/, '');

    return (
        <div className="grid gap-2">
            <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Page preview
                </p>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Uses the current appearance mode.
                </p>
            </div>
            <div
                className="rounded-xl border p-5 shadow-sm"
                style={{
                    backgroundColor: pageColor,
                    borderColor,
                    color: textColor,
                }}
            >
                <h3
                    className="mb-3 text-xl font-semibold"
                    style={{ color: headingColor }}
                >
                    {page.title}
                </h3>
                <p className="text-sm leading-6">
                    {bodyPreview || 'Markdown content preview appears here.'}
                </p>
            </div>
        </div>
    );
}

function PageColorField({
    id,
    label,
    onChange,
    value,
}: {
    id: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <ColorField
            className="rounded-md bg-white p-3 dark:bg-slate-950/70"
            id={id}
            label={label}
            onChange={onChange}
            value={value}
        />
    );
}

function MarkdownPageNode({
    data,
    selected,
}: {
    data: { onEdit: (pageId: string) => void; page: MarkdownPageForm };
    selected: boolean;
}) {
    return (
        <div
            className={cn(
                'relative w-56 rounded-lg border bg-white p-4 shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-[var(--settings-accent)] ring-2 ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)]',
            )}
        >
            <Handle
                className="!size-3 !border-2 !border-white !bg-[var(--settings-accent)]"
                id="in"
                position={Position.Left}
                type="target"
            />
            <Handle
                className="!size-3 !border-2 !border-white !bg-[var(--settings-accent)]"
                id="out"
                position={Position.Right}
                type="source"
            />
            <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                Page
            </p>
            <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {data.page.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {data.page.body || 'Empty markdown page'}
            </p>
            <Button
                className="nodrag nopan mt-3 h-8 px-3 text-xs"
                onClick={(event) => {
                    event.stopPropagation();
                    data.onEdit(data.page.id);
                }}
                type="button"
                variant="secondary"
            >
                <Pencil className="size-3.5" />
                Edit
            </Button>
        </div>
    );
}

function MarkdownSpecialNode({
    data,
}: {
    data: { kind: 'start' | 'end'; title: string };
}) {
    return (
        <div className="relative grid w-36 place-items-center rounded-lg border border-slate-200 bg-white p-4 text-center shadow-lg dark:border-white/10 dark:bg-slate-950">
            {data.kind === 'start' ? (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-[var(--settings-accent)]"
                    id="start"
                    position={Position.Right}
                    type="source"
                />
            ) : (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-[var(--settings-accent)]"
                    id="end"
                    position={Position.Left}
                    type="target"
                />
            )}
            <span className="mb-2 grid size-9 place-items-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                {data.kind === 'start' ? (
                    <FileText className="size-4" />
                ) : (
                    <CircleStop className="size-4" />
                )}
            </span>
            <p className="text-sm font-semibold">{data.title}</p>
        </div>
    );
}

function buildMarkdownNodes(
    pages: MarkdownPageForm[],
    graphLayout: GraphLayout,
    onEdit: (pageId: string) => void,
): MarkdownGraphNode[] {
    const pageNodes: MarkdownGraphNode[] = pages.map((page, index) => ({
        id: page.id,
        type: 'page',
        data: { onEdit, page },
        position: page.position ?? {
            x: 140 + index * 260,
            y: 80,
        },
    }));

    return [
        {
            id: 'start',
            type: 'special',
            data: { kind: 'start', title: 'Start' },
            position: graphLayout.start ?? { x: -160, y: 80 },
        },
        ...pageNodes,
        {
            id: 'end',
            type: 'special',
            data: { kind: 'end', title: 'End' },
            position: graphLayout.end ?? {
                x: Math.max(520, pages.length * 280),
                y: 80,
            },
        },
    ];
}

function buildMarkdownEdges(
    transitions: MarkdownTransitionForm[],
): MarkdownGraphEdge[] {
    return transitions.map((transition) => ({
        id: transition.id,
        source: transition.from,
        sourceHandle: transition.from === 'start' ? 'start' : 'out',
        target: transition.to,
        targetHandle: transition.to === 'end' ? 'end' : 'in',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
            stroke: 'var(--settings-accent)',
            strokeWidth: 2,
        },
        data: transition,
    }));
}
