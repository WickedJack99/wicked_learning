import { Link } from '@inertiajs/react';
import { Handle, MarkerType, Position } from '@xyflow/react';
import { CircleStop, MessageCircle, Pencil, Play, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
    ActivityGraphEdge,
    ActivityGraphNode,
    ActivityGraphPayload,
    ActivityNodeData,
    ActivityStartRoute,
    ActivitySummary,
    Connector,
    SpecialNodeData,
} from './edit-node-activity-types';

const edgeStyle: CSSProperties = {
    stroke: '#0e7490',
    strokeWidth: 2,
};

export const activityNodeTypes = {
    activity: ActivityGraphNodeCard,
    special: SpecialGraphNode,
};
function ActivityGraphNodeCard({
    data,
    selected,
}: {
    data: ActivityNodeData;
    selected: boolean;
}) {
    const activity = data.activity;

    return (
        <div
            className={cn(
                'relative w-64 rounded-xl border bg-slate-50 p-4 shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-cyan-600 ring-2 ring-cyan-600/20 dark:border-teal-200 dark:ring-teal-200/20',
            )}
        >
            <ConnectorHandles
                connectors={activity.connectors.inputs}
                position={Position.Left}
                type="target"
            />
            <ConnectorHandles
                connectors={activity.connectors.outputs}
                position={Position.Right}
                type="source"
            />

            <p className="text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200/70">
                {activity.type}
            </p>
            <h2 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {activity.title}
            </h2>
            {activity.introduction ? (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {activity.introduction}
                </p>
            ) : null}
            {activity.type === 'portal' ? (
                <p className="mt-2 rounded-md bg-slate-200 px-2 py-1 text-xs leading-5 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {activity.portalLink?.targetActivity
                        ? `Links to ${activity.portalLink.targetActivity.mapTitle} / ${activity.portalLink.targetActivity.nodeTitle} / ${activity.portalLink.targetActivity.title}`
                        : activity.config.portalMode === 'input'
                          ? 'Exit portal destination'
                          : 'No target portal selected'}
                </p>
            ) : null}
            {activity.type === 'npc_dialogue' ? (
                <p className="mt-2 rounded-md bg-slate-200 px-2 py-1 text-xs leading-5 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    Dialogue exits are defined by End nodes inside the NPC
                    dialogue graph.
                </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1">
                {activity.connectors.outputs.map((connector) => (
                    <span
                        className="rounded-md bg-cyan-100 px-2 py-1 text-[11px] font-medium text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200"
                        key={connector.id}
                        style={
                            connector.color
                                ? {
                                      backgroundColor: `${connector.color}22`,
                                      color: connector.color,
                                  }
                                : undefined
                        }
                    >
                        {connector.label}
                    </span>
                ))}
            </div>
            <div className="nodrag nopan mt-4 flex items-center gap-2">
                {activity.type === 'npc_dialogue' ? (
                    <Button
                        asChild
                        className="h-8 px-3 text-xs"
                        onClick={(event) => event.stopPropagation()}
                        type="button"
                        variant="secondary"
                    >
                        <Link
                            href={`/settings/worlds/activities/${activity.id}/npc-dialogue`}
                        >
                            <MessageCircle className="size-3.5" />
                            Edit dialogue
                        </Link>
                    </Button>
                ) : null}
                <Button
                    className="h-8 px-3 text-xs"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onEdit(activity);
                    }}
                    type="button"
                    variant="outline"
                >
                    <Pencil className="size-3.5" />
                    Edit
                </Button>
                <Button
                    aria-label={`Delete ${activity.title}`}
                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-300"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onDelete(activity);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function SpecialGraphNode({
    data,
}: {
    data: SpecialNodeData;
    selected: boolean;
}) {
    return (
        <div className="relative grid w-40 place-items-center rounded-xl border border-slate-200 bg-white p-4 text-center shadow-lg dark:border-white/10 dark:bg-slate-950">
            {data.kind === 'start' ? (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                    id="start"
                    position={Position.Right}
                    type="source"
                />
            ) : (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                    id="end"
                    position={Position.Left}
                    type="target"
                />
            )}
            <span className="mb-2 grid size-9 place-items-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                {data.kind === 'start' ? (
                    <Play className="size-4" />
                ) : (
                    <CircleStop className="size-4" />
                )}
            </span>
            <p className="text-sm font-semibold">{data.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {data.description}
            </p>
        </div>
    );
}

function ConnectorHandles({
    connectors,
    position,
    type,
}: {
    connectors: Connector[];
    position: Position;
    type: 'source' | 'target';
}) {
    return (
        <>
            {connectors.map((connector, index) => (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                    id={connector.id}
                    key={connector.id}
                    position={position}
                    style={{
                        backgroundColor: connector.color,
                        top: `${((index + 1) / (connectors.length + 1)) * 100}%`,
                    }}
                    title={connector.label}
                    type={type}
                />
            ))}
        </>
    );
}

export function buildGraphNodes(
    payload: ActivityGraphPayload,
    onEdit: (activity: ActivitySummary) => void,
    onDelete: (activity: ActivitySummary) => void,
): ActivityGraphNode[] {
    const activities = payload.activities.map((activity, index) => ({
        id: activity.id.toString(),
        type: 'activity' as const,
        data: { activity, onDelete, onEdit },
        position:
            activity.position.x !== null
                ? {
                      x: activity.position.x,
                      y: activity.position.y ?? 0,
                  }
                : {
                      x: 80 + index * 300,
                      y: (index % 2) * 180,
                  },
    }));

    const endX = Math.max(520, activities.length * 300 + 160);

    return [
        {
            id: 'start',
            type: 'special',
            data: {
                description: 'Connect this to every route learners can choose.',
                kind: 'start',
                title: 'Start',
            },
            position: { x: -220, y: 40 },
        },
        ...activities,
        {
            id: 'end',
            type: 'special',
            data: {
                description: 'Activities connect here when a path finishes.',
                kind: 'end',
                title: 'End',
            },
            position: { x: endX, y: 40 },
        },
    ];
}

export function buildGraphEdges(
    payload: ActivityGraphPayload,
): ActivityGraphEdge[] {
    const edges: ActivityGraphEdge[] = [];

    const startRoutes =
        payload.node.startRoutes.length > 0
            ? payload.node.startRoutes
            : payload.node.startActivityId
              ? [
                    {
                        activityId: payload.node.startActivityId,
                        buttonBorderColorDark: null,
                        buttonBorderColorLight: null,
                        buttonColorDark: null,
                        buttonColorLight: null,
                        id: 0,
                        imageDark: null,
                        imageLight: null,
                        label: 'Start',
                        sortOrder: 0,
                    },
                ]
              : [];

    startRoutes.forEach((startRoute) => {
        edges.push({
            id: `start:${startRoute.id}:${startRoute.activityId}`,
            source: 'start',
            sourceHandle: 'start',
            target: startRoute.activityId.toString(),
            targetHandle: 'in',
            label: startRoute.label,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: edgeStyle,
            data: {
                start: true,
                startRouteId: startRoute.id,
            },
        });
    });

    payload.transitions.forEach((transition) => {
        edges.push({
            id: `transition:${transition.id}`,
            source: transition.fromActivityId.toString(),
            sourceHandle: transition.fromConnector,
            target: transition.toActivityId?.toString() ?? 'end',
            targetHandle: transition.toActivityId
                ? transition.toConnector
                : 'end',
            label: transition.label ?? transition.trigger,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: edgeStyle,
            data: transition,
        });
    });

    return edges;
}

export function routeActivityTitle(
    activities: ActivitySummary[],
    route: ActivityStartRoute,
): string {
    return (
        activities.find((activity) => activity.id === route.activityId)
            ?.title ?? route.label
    );
}
