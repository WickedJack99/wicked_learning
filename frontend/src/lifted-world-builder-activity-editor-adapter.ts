import type { components } from './api/schema';
import type {
    ActivityGraphPayload,
    ActivityQuestion,
    ActivityQuestionOption,
    ActivityStartRoute,
    ActivitySummary,
    ActivityTemplateTargetGraph,
    EditableItem,
    EditableSound,
    EditableSourceRecord,
    EditableTool,
    GraphLayout,
    PortalActivityLink,
} from './lifted-world-builder-edit-node-activity-types';

type RustNodeDocument = components['schemas']['AdminEditableNode'];
type RustWorldGraph = components['schemas']['AdminWorldGraph'];

/**
 * The only selected-node data seam for the direct source activity-editor lift.
 *
 * `main` uses Laravel numeric IDs and camel-case Inertia props; Rust intentionally
 * exposes UUIDs and OpenAPI snake_case fields. This adapter changes only that
 * transport representation before the lifted source tree runs. It never creates
 * numeric aliases, fetches another document, or derives authorization/client
 * policy from the payload.
 */
export function adaptRustActivityEditorDocument(
    document: RustNodeDocument,
    worldGraph: RustWorldGraph | null,
): {
    activityGraph: ActivityGraphPayload;
    items: EditableItem[];
    sounds: EditableSound[];
    tools: EditableTool[];
    worldGraph: ActivityTemplateTargetGraph | null;
} {
    const graph = document.activity_graph;

    return {
        activityGraph: {
            activities: graph.activities.map(adaptActivity),
            activityTypes: graph.activity_types.map((activityType) => ({
                description: activityType.description,
                key: activityType.key,
                label: activityType.label,
                ...(activityType.portal_modes
                    ? {
                          portalModes: activityType.portal_modes.map((mode) => ({
                              key: mode.key,
                              label: mode.label,
                          })),
                      }
                    : {}),
            })),
            aiReviewTemplates: graph.ai_review_templates.map((template) => ({
                id: template.id,
                model: template.model,
                name: template.name,
                providerLabel: template.provider_label,
            })),
            canManageAiReview: graph.can_manage_ai_review,
            competenceTopicOptions: graph.competence_topic_options,
            evidenceConceptOptions: graph.evidence_concept_options,
            map: {
                id: graph.map.id,
                slug: graph.map.slug,
                title: graph.map.title,
            },
            messageTopics: graph.message_topics.map((topic) => ({
                id: topic.id,
                title: topic.title,
            })),
            node: {
                description: graph.node.description,
                graphLayout: adaptGraphLayout(graph.node.graph_layout),
                id: graph.node.id,
                slug: graph.node.slug,
                startActivityId: graph.node.start_activity_id,
                startRoutes: graph.node.start_routes.map(adaptStartRoute),
                title: graph.node.title,
            },
            portalCandidates: graph.portal_candidates.map((candidate) => ({
                id: candidate.id,
                mapId: candidate.map_id,
                mapTitle: candidate.map_title,
                nodeId: candidate.node_id,
                nodeTitle: candidate.node_title,
                title: candidate.title,
            })),
            sourceRecords: graph.source_records.items.map(adaptSourceRecord),
            sourceRecordsPagination: {
                currentPage: graph.source_records.pagination.current_page,
                lastPage: graph.source_records.pagination.last_page,
                perPage: graph.source_records.pagination.per_page,
                total: graph.source_records.pagination.total,
            },
            transitions: graph.transitions.map((transition) => ({
                fromActivityId: transition.from_activity_id,
                fromConnector: transition.from_connector,
                id: transition.id,
                label: transition.label,
                toActivityId: transition.to_activity_id,
                toConnector: transition.to_connector,
                trigger: transition.trigger,
                triggerValue: transition.trigger_value,
            })),
            world: {
                id: graph.world.id,
                slug: graph.world.slug,
                title: graph.world.title,
            },
        },
        items: document.items.map((item) => ({
            id: item.id,
            imageDark: item.image_dark,
            imageLight: item.image_light,
            slug: item.slug,
            title: item.title,
        })),
        sounds: document.sounds.map((sound) => ({
            id: sound.id,
            name: sound.name,
            slug: sound.slug,
            url: sound.url,
        })),
        tools: document.tools.map((tool) => ({
            id: tool.id,
            imageDark: tool.image_dark,
            imageLight: tool.image_light,
            slug: tool.slug,
            title: tool.title,
        })),
        worldGraph: worldGraph
            ? {
                  maps: worldGraph.maps.map((map) => ({
                      id: map.id,
                      nodes: map.nodes.map((node) => ({
                          id: node.id,
                          title: node.title,
                      })),
                      title: map.title,
                  })),
              }
            : null,
    };
}

function adaptActivity(
    activity: components['schemas']['AdminEditableActivity'],
): ActivitySummary {
    return {
        aiReview: activity.ai_review as ActivitySummary['aiReview'],
        aiReviewedAt: activity.ai_reviewed_at,
        aiReviewHistory: activity.ai_review_history.map((entry) => ({
            id: entry.id,
            model: entry.model,
            provider: entry.provider,
            reviewedAt: entry.reviewed_at,
            summary: entry.summary,
        })),
        aiReviewStatus: activity.ai_review_status,
        config: activity.config as ActivitySummary['config'],
        connectors: {
            inputs: activity.connectors.inputs,
            outputs: activity.connectors.outputs,
        },
        graphLayout: graphLayoutFromConfig(activity.config),
        id: activity.id,
        introduction: activity.introduction,
        portalLink: adaptPortalLink(activity.portal_link),
        position: activity.position,
        question: adaptQuestion(activity.question),
        slug: activity.slug,
        title: activity.title,
        type: activity.activity_type,
        updatedAt: activity.updated_at,
    };
}

function adaptPortalLink(
    portalLink: components['schemas']['AdminActivityPortalLink'] | null,
): PortalActivityLink | null {
    if (!portalLink) {
        return null;
    }

    return {
        description: portalLink.description,
        id: portalLink.id,
        label: portalLink.label,
        targetActivity: portalLink.target_activity
            ? {
                  id: portalLink.target_activity.id,
                  mapTitle: portalLink.target_activity.map_title,
                  nodeTitle: portalLink.target_activity.node_title,
                  title: portalLink.target_activity.title,
              }
            : null,
        targetNode: {
            id: portalLink.target_node.id,
            mapTitle: portalLink.target_node.map_title,
            title: portalLink.target_node.title,
        },
    };
}

function adaptQuestion(value: Record<string, unknown> | null): ActivityQuestion | null {
    if (!value) {
        return null;
    }

    return {
        allowMultiple: booleanValue(value.allowMultiple),
        explanation: nullableString(value.explanation),
        feedbackCorrect: nullableString(value.feedbackCorrect),
        feedbackIncorrect: nullableString(value.feedbackIncorrect),
        options: arrayValue(value.options).map(adaptQuestionOption),
        prompt: stringValue(value.prompt),
    };
}

function adaptQuestionOption(value: unknown): ActivityQuestionOption {
    const option = recordValue(value);
    const weights = recordValue(option.weights);

    return {
        body: stringValue(option.body),
        feedback: nullableString(option.feedback),
        isCorrect: booleanValue(option.isCorrect),
        label: stringValue(option.label),
        outcomeKey: nullableString(option.outcomeKey),
        weights: Object.fromEntries(
            Object.entries(weights).flatMap(([key, weight]) =>
                typeof weight === 'number' && Number.isFinite(weight)
                    ? [[key, weight]]
                    : [],
            ),
        ),
    };
}

function adaptSourceRecord(
    source: components['schemas']['AdminSourceRecord'],
): EditableSourceRecord {
    return {
        anchor: source.anchor ?? '',
        concepts: source.concepts,
        excerpt: source.excerpt ?? '',
        id: source.id,
        publishedAt: source.published_at ?? '',
        publisher: source.publisher ?? '',
        rights: source.rights ?? '',
        title: source.title,
        url: source.url,
    };
}

function adaptStartRoute(
    route: components['schemas']['AdminActivityStartRoute'],
): ActivityStartRoute {
    return {
        activityId: route.activity_id,
        buttonBorderColorDark: route.button_border_color_dark,
        buttonBorderColorLight: route.button_border_color_light,
        buttonColorDark: route.button_color_dark,
        buttonColorLight: route.button_color_light,
        customLabel: null,
        description: route.description,
        id: route.id,
        imageDark: route.image_dark,
        imageLight: route.image_light,
        label: route.label,
        sortOrder: route.sort_order,
    };
}

function graphLayoutFromConfig(config: Record<string, unknown>): GraphLayout | undefined {
    const value = config.graphLayout;
    return value ? adaptGraphLayout(value) : undefined;
}

function adaptGraphLayout(value: unknown): GraphLayout {
    const layout = recordValue(value);
    const start = positionValue(layout.start);
    const end = positionValue(layout.end);

    return {
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
    };
}

function positionValue(value: unknown): { x: number; y: number } | null {
    const position = recordValue(value);
    return typeof position.x === 'number' && Number.isFinite(position.x) &&
        typeof position.y === 'number' && Number.isFinite(position.y)
        ? { x: position.x, y: position.y }
        : null;
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function booleanValue(value: unknown): boolean {
    return value === true;
}
