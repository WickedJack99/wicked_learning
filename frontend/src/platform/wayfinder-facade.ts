/** A typed Rust adapter may pass an already-audited source URL through here. */
export interface SourceRouteTarget {
    readonly method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    readonly url: string;
}

export function sourceRouteTarget(target: SourceRouteTarget): SourceRouteTarget {
    return target;
}
