import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import type { CompanionRecovery } from './playback-companion-refresh';

/** Framework transport failure only; the copied player remains mounted. */
export function PlaybackCompanionRecovery({ state }: { state: CompanionRecovery | null }) {
    if (!state) return null;
    return <section aria-label="Companion connection" aria-busy={state.pending} className="fixed inset-x-4 top-4 z-[100] mx-auto grid max-w-xl gap-2 rounded-lg border bg-background p-4 shadow-lg">
        <AlertError title="Companion is unavailable." errors={[state.message]} />
        <Button onClick={state.retry} disabled={state.pending}>{state.pending ? 'Reconnecting Companion…' : 'Retry Companion'}</Button>
        <Button variant="outline" onClick={state.dismiss}>Dismiss Companion error</Button>
    </section>;
}
