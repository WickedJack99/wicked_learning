import { completePlaybackActivityOnce } from './playback-completion';
import { playbackContext } from './playback-context';

// Only renderer URL sinks use this mapping. The authored Markdown string and
// its visible code/text remain untouched, as do external and custom URLs.
export function learnerMarkdownUrl(value: string): string {
    return /^\/api\/v1\/admin\/media-assets\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/content$/.test(value)
        ? value.replace('/api/v1/admin/media-assets/', '/api/v1/learner/media-assets/') : value;
}

export function completeMarkdownActivity(activity: unknown, run: unknown) {
    return completePlaybackActivityOnce(playbackContext(run, activity, ['markdown']), {});
}
