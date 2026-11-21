import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import type { PortalFailure } from './playback-portal-api';

/** Framework transport errors retain the whole copied player's local state. */
export function PlaybackPortalRecovery({ state }: { state: PortalFailure | null }) {
    if (!state) return null;
    return <section aria-label="Portal connection" className="fixed inset-x-4 top-4 z-[100] mx-auto grid max-w-xl gap-2 rounded-lg border bg-background p-4 shadow-lg">
        <AlertError title="Portal is unavailable." errors={[state.message]} />
        <Button onClick={state.retry}>Retry portal</Button>
        <Button variant="outline" onClick={state.dismiss}>Dismiss portal error</Button>
    </section>;
}
