"""Build seamless clockwise GIF loops from the transparent portal swirls."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


SOURCE_DIRECTORY = Path(__file__).resolve().parents[1] / "public" / "images" / "portals"
FRAME_COUNT = 48
FRAME_DURATION_MS = 50
MAX_EDGE = 512
TRANSPARENT_INDEX = 255
ALPHA_THRESHOLD = 96


def prepare_source(path: Path) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    size = min(max(source.size), MAX_EDGE)
    source.thumbnail((size, size), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(
        source,
        ((size - source.width) // 2, (size - source.height) // 2),
    )

    clean = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    clean.putdata([clean_pixel(pixel) for pixel in canvas.getdata()])

    return clean


def clean_pixel(pixel: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    red, green, blue, alpha = pixel
    is_chroma_green = green > 160 and green > red * 2 and green > blue * 2

    if alpha <= ALPHA_THRESHOLD or is_chroma_green:
        return (0, 0, 0, 0)

    return pixel


def gif_frame(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    palette_frame = frame.convert("RGB").quantize(
        colors=255,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.FLOYDSTEINBERG,
    )
    transparent = alpha.point(
        lambda value: 255 if value <= ALPHA_THRESHOLD else 0,
    )
    palette_frame.paste(TRANSPARENT_INDEX, mask=transparent)
    palette_frame.info["transparency"] = TRANSPARENT_INDEX

    return palette_frame


def build_loop(source_path: Path) -> Path:
    source = prepare_source(source_path)
    frames = [
        gif_frame(
            source.rotate(
                -(360 * index / FRAME_COUNT),
                resample=Image.Resampling.BICUBIC,
                expand=False,
            ),
        )
        for index in range(FRAME_COUNT)
    ]
    output_path = source_path.with_name(f"{source_path.stem}-rotation-loop.gif")
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        disposal=2,
        transparency=TRANSPARENT_INDEX,
        optimize=True,
    )

    return output_path


def main() -> None:
    sources = sorted(SOURCE_DIRECTORY.glob("*swirl*.png"))

    if not sources:
        raise SystemExit(f"No portal swirls found in {SOURCE_DIRECTORY}")

    for source_path in sources:
        output_path = build_loop(source_path)
        print(output_path.relative_to(SOURCE_DIRECTORY.parents[2]))


if __name__ == "__main__":
    main()
