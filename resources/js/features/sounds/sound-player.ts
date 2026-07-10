import { useCallback, useEffect, useRef, useState } from 'react';

export type PlayableSound = {
    id?: number | string;
    loop?: boolean;
    playSeconds?: number | null;
    url: string;
    volume?: number | null;
};

type SoundLayer = {
    audio: HTMLAudioElement;
    timeoutId: number | null;
};

export function useLayeredSoundPlayer() {
    const layers = useRef<Map<string, SoundLayer>>(new Map());
    const [playingLayers, setPlayingLayers] = useState<string[]>([]);

    const refreshPlayingLayers = useCallback(() => {
        setPlayingLayers(Array.from(layers.current.keys()));
    }, []);

    const stop = useCallback(
        (layerKey: string) => {
            const layer = layers.current.get(layerKey);

            if (!layer) {
                return;
            }

            if (layer.timeoutId) {
                window.clearTimeout(layer.timeoutId);
            }

            layer.audio.pause();
            layer.audio.currentTime = 0;
            layers.current.delete(layerKey);
            refreshPlayingLayers();
        },
        [refreshPlayingLayers],
    );

    const pause = useCallback(
        (layerKey: string) => {
            const layer = layers.current.get(layerKey);

            if (!layer) {
                return;
            }

            layer.audio.pause();
            refreshPlayingLayers();
        },
        [refreshPlayingLayers],
    );

    const play = useCallback(
        (sound: PlayableSound, layerKey = soundLayerKey(sound)) => {
            if (!sound.url) {
                return layerKey;
            }

            stop(layerKey);

            const audio = new Audio(sound.url);
            audio.loop = Boolean(sound.loop);
            audio.volume = normalizedVolume(sound.volume);

            const layer: SoundLayer = {
                audio,
                timeoutId: null,
            };

            const playSeconds =
                typeof sound.playSeconds === 'number' &&
                Number.isFinite(sound.playSeconds)
                    ? sound.playSeconds
                    : null;

            if (playSeconds && playSeconds > 0) {
                layer.timeoutId = window.setTimeout(
                    () => stop(layerKey),
                    playSeconds * 1000,
                );
            }

            audio.addEventListener('ended', () => {
                if (!audio.loop) {
                    layers.current.delete(layerKey);
                    refreshPlayingLayers();
                }
            });

            layers.current.set(layerKey, layer);
            void audio.play().catch(() => {
                layers.current.delete(layerKey);
                refreshPlayingLayers();
            });
            refreshPlayingLayers();

            return layerKey;
        },
        [refreshPlayingLayers, stop],
    );

    const stopAll = useCallback(() => {
        for (const layerKey of layers.current.keys()) {
            stop(layerKey);
        }
    }, [stop]);

    useEffect(() => stopAll, [stopAll]);

    return {
        pause,
        play,
        playingLayers,
        stop,
        stopAll,
    };
}

export function soundLayerKey(sound: PlayableSound): string {
    return `sound-${sound.id ?? sound.url}`;
}

function normalizedVolume(volume: number | null | undefined): number {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) {
        return 0.7;
    }

    return Math.min(Math.max(volume, 0), 100) / 100;
}
