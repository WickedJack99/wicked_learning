import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';

type Playback = components['schemas']['LearnerPlaybackDocument'];
const documents = new Map<string, { document: Playback }>();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** A route owns its binding; an older render cannot release a newer binding. */
export function bindPlaybackDocument(document: Playback) {
    const binding = { document };
    documents.set(document.play_run_id, binding);
    return () => {
        if (documents.get(document.play_run_id) === binding) documents.delete(document.play_run_id);
    };
}

export function playbackIdentity(value: unknown): string {
    if (typeof value !== 'string' || !uuid.test(value)) throw new JsonRequestError('The player identity is invalid.', 400);
    return value;
}

export function playbackContext(runValue: unknown, activityValue: unknown, types: string[]) {
    const run = playbackIdentity(runValue); const id = playbackIdentity(activityValue);
    const document = documents.get(run)?.document;
    const activity = document?.graph.activities.find((entry) => entry.id === id && types.includes(entry.activity_type));
    if (!document || !activity) throw new JsonRequestError('The player context is unavailable.', 409);
    // Graph membership permits the copied player to move locally. The Rust
    // command still authorizes its own current activity and run on every write.
    return { document, activity, run, id };
}
