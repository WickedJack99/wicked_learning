/**
 * Source-shaped values carried across the Rust transport adapter. IDs remain
 * opaque UUID strings instead of Laravel integers; the React component tree
 * otherwise keeps the pinned source field names.
 */
export type ResolvedAppearance = 'dark' | 'light';

export type ThemeVariant<T> = T & {
    dark?: Partial<T>;
    light?: Partial<T>;
};

export type MapAssetInteractionMode =
    | 'focusable'
    | 'decorative'
    | 'hide_on_hover'
    | 'toggle';

export type MapAssetStateSprite = {
    imageUrl?: string | null;
    width?: number;
    x?: number;
    y?: number;
};

export type MapAssetInteractionConfig = {
    states?: {
        first?: MapAssetStateSprite;
        second?: MapAssetStateSprite;
    };
};

export type MapAsset = {
    focusable: boolean;
    id: string;
    imageUrl: string | null;
    interactionConfig: MapAssetInteractionConfig;
    interactionMode: MapAssetInteractionMode;
    locked: boolean;
    nodeId: string | null;
    opacity: number;
    soundConfig: Record<string, unknown>;
    text: string | null;
    visualConfig: Record<string, unknown>;
    width: number;
    x: number;
    y: number;
    z: number;
};
