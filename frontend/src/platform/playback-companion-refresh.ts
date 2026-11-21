import { releaseCompanion, type loadCompanion } from './companion-api';
import { JsonRequestError } from './json-request-error';

type Companion = Awaited<ReturnType<typeof loadCompanion>>;
export type CompanionRecovery = { message: string; pending: boolean; retry: () => void; dismiss: () => void };
type Request = { activity: string; controller: AbortController; finish: (success: boolean) => void; attempting: boolean };

/** One exact Companion partial reload. Retries keep the source's request
 * pending until a real projection arrives or navigation cancels it. */
export class PlaybackCompanionRefresh {
    private request?: Request;
    private disposed = false;

    constructor(
        private companion: Companion,
        private readonly load: (activity: string, signal: AbortSignal) => Promise<Companion>,
        private readonly apply: (companion: Companion) => void,
        private readonly recover: (state: CompanionRecovery | null) => void,
    ) {}

    reload(activity: string): Promise<boolean> {
        if (this.disposed) return Promise.resolve(false);
        this.cancel();
        releaseCompanion(this.companion);
        this.recover(null);
        return new Promise((finish) => {
            const request = { activity, controller: new AbortController(), finish, attempting: false };
            this.request = request;
            void this.attempt(request);
        });
    }

    dispose() {
        this.disposed = true;
        this.cancel();
        releaseCompanion(this.companion);
    }

    private cancel() {
        this.request?.controller.abort();
        this.request?.finish(false);
        this.request = undefined;
    }

    private async attempt(request: Request, previousMessage?: string) {
        if (this.request !== request || request.attempting || this.disposed) return;
        request.attempting = true;
        const dismiss = () => {
            if (this.request !== request) return;
            this.cancel();
            this.recover(null);
        };
        if (previousMessage) this.recover({ message: previousMessage, pending: true, retry: () => {}, dismiss });
        try {
            const companion = await this.load(request.activity, request.controller.signal);
            if (this.request !== request || this.disposed) { releaseCompanion(companion); return; }
            this.companion = companion;
            this.apply(companion);
            this.recover(null);
            this.request = undefined;
            request.finish(true);
        } catch (error) {
            if (this.request !== request || this.disposed) return;
            const message = error instanceof JsonRequestError ? error.message : 'The Companion connection is unavailable.';
            this.recover({ message, pending: false, retry: () => { void this.attempt(request, message); }, dismiss });
        } finally { request.attempting = false; }
    }
}
