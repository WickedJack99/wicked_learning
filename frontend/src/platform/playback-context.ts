import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';

type Playback = components['schemas']['LearnerPlaybackDocument'];
const documents = new Map<string, { document: Playback; mediaTypes: Map<string, string> }>();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** A route owns its binding; an older render cannot release a newer binding. */
export function bindPlaybackDocument(document: Playback) {
    const mediaTypes = new Map<string, string>();
    for (const activity of document.graph.activities) for (const media of activity.presentation.markdown_media) {
        if (media.url !== `/api/v1/learner/media-assets/${playbackIdentity(media.id)}/content` || !/^(image|video)\//.test(media.content_type)) throw new JsonRequestError('The player media projection is unavailable.', 503);
        mediaTypes.set(media.url, media.content_type);
    }
    const binding = { document, mediaTypes };
    documents.set(document.play_run_id, binding);
    return () => {
        if (documents.get(document.play_run_id) === binding) documents.delete(document.play_run_id);
    };
}

export function playbackIdentity(value: unknown): string {
    if (!isPlaybackIdentity(value)) throw new JsonRequestError('The player identity is invalid.', 400);
    return value;
}

export function isPlaybackIdentity(value: unknown): value is string {
    return typeof value === 'string' && uuid.test(value);
}

export function playbackContext(runValue: unknown, activityValue: unknown, types: string[]) {
    const run = playbackIdentity(runValue); const id = playbackIdentity(activityValue);
    const binding = documents.get(run);
    const document = binding?.document;
    const activity = document?.graph.activities.find((entry) => entry.id === id && types.includes(entry.activity_type));
    if (!binding || !document || !activity) throw new JsonRequestError('The player context is unavailable.', 409);
    // Graph membership permits the copied player to move locally. The Rust
    // command still authorizes its own current activity and run on every write.
    return { binding, document, activity, run, id };
}

/** Only active, successfully loaded documents can classify their managed URLs.
 * Releasing/replacing a document releases its metadata with the binding. */
export function playbackMediaType(url: string): string | undefined {
    for (const binding of documents.values()) {
        const type = binding.mediaTypes.get(url);
        if (type) return type;
    }
}
