import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LearningTool } from '@/types';
import {
    toolImageUrl,
    toolImageWidthPercent,
    toolImageWidthStyle,
} from './tool-visuals';
import type { ToolAppearanceMode } from './tool-visuals';

type ToolCursorPosition = {
    x: number;
    y: number;
};

export function equippedToolCursorStyle(
    tool: LearningTool | null,
    mode: ToolAppearanceMode,
): CSSProperties {
    return toolImageUrl(tool, mode) ? { cursor: 'none' } : {};
}

export function EquippedToolCursorOverlay({
    mode,
    tool,
}: {
    mode: ToolAppearanceMode;
    tool: LearningTool | null;
}) {
    const [position, setPosition] = useState<ToolCursorPosition | null>(null);
    const imageUrl = toolImageUrl(tool, mode);

    useEffect(() => {
        if (!imageUrl) {
            return;
        }

        const updatePosition = (event: PointerEvent) => {
            setPosition({ x: event.clientX, y: event.clientY });
        };

        window.addEventListener('pointermove', updatePosition);

        return () => window.removeEventListener('pointermove', updatePosition);
    }, [imageUrl]);

    if (!tool || !imageUrl || !position) {
        return null;
    }

    return (
        <ToolCursorImage
            imageUrl={imageUrl}
            isFixed
            position={position}
            widthPercent={toolImageWidthPercent(tool)}
        />
    );
}

export function ToolCursorImage({
    imageUrl,
    isFixed = false,
    position,
    widthPercent,
}: {
    imageUrl: string;
    isFixed?: boolean;
    position: ToolCursorPosition;
    widthPercent: number;
}) {
    return (
        <img
            alt=""
            className={
                isFixed
                    ? 'pointer-events-none fixed z-[9999] h-auto max-w-none object-contain'
                    : 'pointer-events-none absolute z-30 h-auto max-w-none object-contain'
            }
            draggable={false}
            src={imageUrl}
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-12px, -12px)',
                width: toolImageWidthStyle(widthPercent),
            }}
        />
    );
}
