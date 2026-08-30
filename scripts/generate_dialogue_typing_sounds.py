"""Generate original, short dialogue typing sounds with the Python standard library.

The sounds are deliberately procedural rather than sampled. This keeps the set
small, license-safe, deterministic, and easy to retune for repeated playback.

Usage:
    py scripts/generate_dialogue_typing_sounds.py
    py scripts/generate_dialogue_typing_sounds.py --seed 24
    py scripts/generate_dialogue_typing_sounds.py --output-dir public/sounds/dialogue-typing
"""

from __future__ import annotations

import argparse
import json
import math
import random
import struct
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


SAMPLE_RATE = 44_100
MASTER_PEAK = 0.76
LETTER_KEYS = tuple('abcdefghijklmnopqrstuvwxyz')
WORD_AUDITIONS = ('apple', 'hello', 'user')


@dataclass(frozen=True)
class SoundSpec:
    """A family of related sounds with a stable, human-readable description."""

    slug: str
    label: str
    description: str
    duration_ms: int
    render: Callable[[int, random.Random], list[float]]


def envelope(sample_count: int, attack_ms: float, release_ms: float) -> list[float]:
    """Return a smooth attack/release envelope for one short sound."""

    attack_samples = max(1, int(SAMPLE_RATE * attack_ms / 1000))
    release_samples = max(1, int(SAMPLE_RATE * release_ms / 1000))
    sustain_end = max(attack_samples, sample_count - release_samples)
    values: list[float] = []

    for index in range(sample_count):
        if index < attack_samples:
            phase = index / attack_samples
            value = math.sin(phase * math.pi / 2) ** 2
        elif index >= sustain_end:
            phase = (index - sustain_end) / max(1, sample_count - sustain_end)
            value = math.cos(phase * math.pi / 2) ** 2
        else:
            value = 1.0

        values.append(value)

    return values


def decaying_sine(
    frequency: float,
    sample_count: int,
    decay: float,
    amplitude: float = 1.0,
    phase: float = 0.0,
    glide: float = 0.0,
) -> list[float]:
    """Create a sine partial with exponential decay and optional pitch glide."""

    values: list[float] = []
    phase_value = phase

    for index in range(sample_count):
        progress = index / SAMPLE_RATE
        current_frequency = frequency * (1.0 + glide * index / max(1, sample_count))
        phase_value += 2 * math.pi * current_frequency / SAMPLE_RATE
        values.append(
            math.sin(phase_value)
            * amplitude
            * math.exp(-decay * progress)
        )

    return values


def add_signal(target: list[float], source: list[float], gain: float = 1.0) -> None:
    """Mix one signal into another without changing either signal's length."""

    for index, value in enumerate(source[: len(target)]):
        target[index] += value * gain


def noise_burst(
    sample_count: int,
    rng: random.Random,
    attack_ms: float,
    release_ms: float,
    gain: float,
    high_pass: bool = False,
) -> list[float]:
    """Create a shaped noise burst; differencing adds a light paper-like edge."""

    values: list[float] = []
    shape = envelope(sample_count, attack_ms, release_ms)
    previous = 0.0

    for index in range(sample_count):
        current = rng.uniform(-1.0, 1.0)
        sample = current - previous if high_pass else current
        previous = current
        values.append(sample * shape[index] * gain)

    return values


def render_wooden_click(sample_count: int, rng: random.Random) -> list[float]:
    """A tiny hollow tap: dry transient, low wood body, uneven resonances."""

    values = [0.0] * sample_count
    add_signal(values, noise_burst(sample_count, rng, 0.12, 18, 0.22, True))
    add_signal(values, decaying_sine(540 + rng.uniform(-25, 25), sample_count, 72, 0.42))
    add_signal(values, decaying_sine(910 + rng.uniform(-35, 35), sample_count, 105, 0.18), 1.0)
    add_signal(values, decaying_sine(1_420 + rng.uniform(-45, 45), sample_count, 125, 0.09))
    return [value * envelope(sample_count, 0.15, 16)[index] for index, value in enumerate(values)]


def render_warm_rounded_blip(sample_count: int, rng: random.Random) -> list[float]:
    """A friendly rounded blip with a soft downward pitch motion."""

    values = [0.0] * sample_count
    frequency = 380 + rng.uniform(-24, 24)
    add_signal(values, decaying_sine(frequency, sample_count, 34, 0.68, glide=-0.20))
    add_signal(values, decaying_sine(frequency * 2, sample_count, 48, 0.18, glide=-0.20))
    add_signal(values, decaying_sine(frequency * 0.5, sample_count, 30, 0.14, glide=-0.20))
    shape = envelope(sample_count, 1.5, 28)
    return [value * shape[index] for index, value in enumerate(values)]


def render_marimba_tick(sample_count: int, rng: random.Random) -> list[float]:
    """A muted miniature mallet tone with gently inharmonic partials."""

    values = [0.0] * sample_count
    frequency = 680 + rng.uniform(-34, 34)
    add_signal(values, decaying_sine(frequency, sample_count, 42, 0.48))
    add_signal(values, decaying_sine(frequency * 2.01, sample_count, 58, 0.20))
    add_signal(values, decaying_sine(frequency * 3.96, sample_count, 76, 0.12))
    add_signal(values, decaying_sine(frequency * 5.12, sample_count, 95, 0.05))
    add_signal(values, noise_burst(sample_count, rng, 0.08, 10, 0.08, True))
    return [value * envelope(sample_count, 0.3, 20)[index] for index, value in enumerate(values)]


def render_papery_pencil_tick(sample_count: int, rng: random.Random) -> list[float]:
    """A soft graphite scrape, kept quiet so it can repeat without fatigue."""

    values = [0.0] * sample_count
    add_signal(values, noise_burst(sample_count, rng, 0.05, 9, 0.38, True))
    add_signal(values, noise_burst(sample_count, rng, 0.1, 18, 0.12, False))
    add_signal(values, decaying_sine(245 + rng.uniform(-15, 15), sample_count, 80, 0.12))
    shape = envelope(sample_count, 0.08, 12)
    return [value * shape[index] for index, value in enumerate(values)]


def render_mechanical_click(sample_count: int, rng: random.Random) -> list[float]:
    """A restrained clockwork click made from two offset, band-like impacts."""

    values = [0.0] * sample_count
    first_length = max(1, int(sample_count * 0.40))
    second_start = max(1, int(sample_count * 0.22))
    add_signal(values, noise_burst(first_length, rng, 0.02, 3.5, 0.34, True))
    second = noise_burst(sample_count - second_start, rng, 0.02, 4.5, 0.20, True)
    for index, value in enumerate(second):
        if second_start + index < sample_count:
            values[second_start + index] += value

    add_signal(values, decaying_sine(2_180 + rng.uniform(-100, 100), sample_count, 170, 0.08))
    return [value * envelope(sample_count, 0.02, 7)[index] for index, value in enumerate(values)]


def render_glassy_tick(sample_count: int, rng: random.Random) -> list[float]:
    """A small glassy sparkle with a quick attack and a non-harsh tail."""

    values = [0.0] * sample_count
    frequency = 1_180 + rng.uniform(-45, 45)
    add_signal(values, decaying_sine(frequency, sample_count, 34, 0.40))
    add_signal(values, decaying_sine(frequency * 2.73, sample_count, 58, 0.18))
    add_signal(values, decaying_sine(frequency * 4.14, sample_count, 82, 0.08))
    add_signal(values, decaying_sine(frequency * 6.19, sample_count, 120, 0.035))
    return [value * envelope(sample_count, 0.12, 35)[index] for index, value in enumerate(values)]


def render_clockwork_pebble(sample_count: int, rng: random.Random) -> list[float]:
    """Experimental variant: a warm pebble tap with a tiny resonant overtone."""

    values = [0.0] * sample_count
    add_signal(values, decaying_sine(290 + rng.uniform(-20, 20), sample_count, 50, 0.34, glide=0.08))
    add_signal(values, decaying_sine(610 + rng.uniform(-30, 30), sample_count, 78, 0.18, glide=0.06))
    add_signal(values, noise_burst(sample_count, rng, 0.04, 6, 0.16, True))
    return [value * envelope(sample_count, 0.1, 21)[index] for index, value in enumerate(values)]


def render_curious_double_blip(sample_count: int, rng: random.Random) -> list[float]:
    """Experimental variant: two close, low-volume notes suggesting discovery."""

    values = [0.0] * sample_count
    first_count = max(1, int(sample_count * 0.56))
    second_start = max(1, int(sample_count * 0.39))
    first = decaying_sine(505 + rng.uniform(-25, 25), first_count, 38, 0.40, glide=-0.08)
    second = decaying_sine(690 + rng.uniform(-25, 25), sample_count - second_start, 45, 0.28, glide=-0.05)
    add_signal(values, first)
    for index, value in enumerate(second):
        if second_start + index < sample_count:
            values[second_start + index] += value

    return [value * envelope(sample_count, 0.7, 24)[index] for index, value in enumerate(values)]


def letter_keyed_profile(letter_index: int) -> dict[str, float]:
    """Return a small, stable variation profile for one alphabetic key."""

    frequency_offsets = (
        -34, -18, -7, 8, 21, 33, 44, -26, -12, 3, 15, 28, 39,
        -30, -16, -2, 11, 24, 36, -22, -9, 5, 18, 30, 42, -14,
    )
    interval_offsets = (-0.035, -0.018, 0.0, 0.014, 0.028, 0.04)
    delay_offsets = (0.0, 0.018, 0.034, 0.012, 0.026)

    return {
        'frequency_hz': 512 + frequency_offsets[letter_index],
        'second_ratio': 1.23 + interval_offsets[letter_index % len(interval_offsets)],
        'second_start_ratio': 0.35 + delay_offsets[letter_index % len(delay_offsets)],
        'first_decay': 35 + (letter_index % 4) * 2,
        'second_decay': 43 + (letter_index % 5) * 2,
        'brightness': 0.13 + (letter_index % 3) * 0.012,
        'duration_ms': 82 + (letter_index % 5) * 2,
        'release_ms': 22 + (letter_index % 4) * 2,
    }


def render_letter_keyed_blip(
    sample_count: int,
    rng: random.Random,
    profile: dict[str, float],
) -> list[float]:
    """Render one gentle double-blip with a controlled letter-specific tilt."""

    values = [0.0] * sample_count
    first_count = max(1, int(sample_count * 0.58))
    second_start = max(1, int(sample_count * profile['second_start_ratio']))
    base_frequency = profile['frequency_hz'] + rng.uniform(-3.5, 3.5)
    first_amplitude = 0.36 + (profile['brightness'] - 0.13) * 0.8
    second_amplitude = 0.25 + (profile['brightness'] - 0.13) * 0.55

    add_signal(
        values,
        decaying_sine(
            base_frequency,
            first_count,
            profile['first_decay'],
            first_amplitude,
            glide=-0.07,
        ),
    )
    second = decaying_sine(
        base_frequency * profile['second_ratio'],
        sample_count - second_start,
        profile['second_decay'],
        second_amplitude,
        glide=-0.05,
    )
    for index, value in enumerate(second):
        if second_start + index < sample_count:
            values[second_start + index] += value

    add_signal(values, decaying_sine(base_frequency * 0.5, sample_count, 30, 0.07))
    add_signal(
        values,
        decaying_sine(base_frequency * (2.0 + profile['brightness']), sample_count, 105, 0.025),
    )
    shape = envelope(sample_count, 0.6, profile['release_ms'])
    return [value * shape[index] for index, value in enumerate(values)]


SOUND_SPECS = (
    SoundSpec(
        'soft-wooden-click',
        'Soft wooden click',
        'Dry hollow tap with low, uneven wood resonances.',
        68,
        render_wooden_click,
    ),
    SoundSpec(
        'warm-rounded-blip',
        'Warm rounded blip',
        'Friendly low blip with a gentle downward pitch glide.',
        84,
        render_warm_rounded_blip,
    ),
    SoundSpec(
        'muted-marimba-tick',
        'Muted marimba tick',
        'Miniature mallet tone with softened inharmonic partials.',
        92,
        render_marimba_tick,
    ),
    SoundSpec(
        'papery-pencil-tick',
        'Papery pencil tick',
        'Quiet graphite-like texture with a soft low body.',
        48,
        render_papery_pencil_tick,
    ),
    SoundSpec(
        'subtle-mechanical-click',
        'Subtle mechanical click',
        'Restrained two-stage clockwork impact with a tiny metal edge.',
        42,
        render_mechanical_click,
    ),
    SoundSpec(
        'soft-glassy-tick',
        'Soft glassy tick',
        'Small rounded sparkle with a light, non-sharp tail.',
        104,
        render_glassy_tick,
    ),
    SoundSpec(
        'clockwork-pebble',
        'Clockwork pebble',
        'Experimental warm pebble tap with a subtle resonant overtone.',
        76,
        render_clockwork_pebble,
    ),
    SoundSpec(
        'curious-double-blip',
        'Curious double blip',
        'Experimental two-note nudge for moments of discovery.',
        98,
        render_curious_double_blip,
    ),
)


def normalize(samples: list[float]) -> list[float]:
    """Keep headroom for browser playback and avoid clipping."""

    peak = max((abs(value) for value in samples), default=0.0)
    if peak == 0:
        return samples

    gain = MASTER_PEAK / peak
    return [value * gain for value in samples]


def write_wav(path: Path, samples: list[float]) -> None:
    """Write normalized samples as browser-friendly mono PCM."""

    pcm = b''.join(
        struct.pack('<h', max(-32768, min(32767, int(round(value * 32767)))))
        for value in normalize(samples)
    )

    with wave.open(str(path), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm)


def read_wav_samples(path: Path) -> list[float]:
    """Read one generated mono 16-bit WAV back into normalized float samples."""

    with wave.open(str(path), 'rb') as source:
        if source.getnchannels() != 1 or source.getsampwidth() != 2 or source.getframerate() != SAMPLE_RATE:
            raise ValueError(f'Unexpected format in generated sound: {path}')

        frame_count = source.getnframes()
        frames = source.readframes(frame_count)

    return [value / 32767 for value in struct.unpack('<' + 'h' * frame_count, frames)]


def build_sounds(
    output_dir: Path,
    seed: int,
    variations: int,
    word_gap_ms: int = 16,
) -> list[dict[str, object]]:
    """Render every family and return metadata for easy auditioning."""

    output_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, object]] = []

    for spec_index, spec in enumerate(SOUND_SPECS):
        sample_count = round(SAMPLE_RATE * spec.duration_ms / 1000)

        for variation in range(1, variations + 1):
            variation_seed = seed + spec_index * 1_000 + variation
            samples = spec.render(sample_count, random.Random(variation_seed))
            filename = f'{spec.slug}-{variation:02d}.wav'
            path = output_dir / filename
            write_wav(path, samples)
            manifest.append({
                'file': filename,
                'family': spec.slug,
                'label': spec.label,
                'description': spec.description,
                'variation': variation,
                'seed': variation_seed,
                'duration_ms': round(len(samples) * 1000 / SAMPLE_RATE, 2),
                'sample_rate': SAMPLE_RATE,
                'channels': 1,
                'format': 'PCM 16-bit little-endian',
                'license': 'CC0 1.0 via original procedural synthesis',
            })

    letter_keyed = build_letter_keyed_sounds(output_dir, seed)
    word_auditions = build_word_auditions(output_dir, gap_ms=word_gap_ms)
    manifest_path = output_dir / 'manifest.json'
    manifest_path.write_text(
        json.dumps({
            'generator': 'scripts/generate_dialogue_typing_sounds.py',
            'seed': seed,
            'variations_per_family': variations,
            'sounds': manifest,
            'letter_keyed_sounds': letter_keyed,
            'word_auditions': word_auditions,
        }, indent=2) + '\n',
        encoding='utf-8',
    )

    return manifest


def build_letter_keyed_sounds(output_dir: Path, seed: int) -> list[dict[str, object]]:
    """Render one subtle curious double-blip for each letter A through Z."""

    keyed_dir = output_dir / 'letter-keyed'
    keyed_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, object]] = []

    for letter_index, character in enumerate(LETTER_KEYS):
        profile = letter_keyed_profile(letter_index)
        sample_count = round(SAMPLE_RATE * profile['duration_ms'] / 1000)
        variation_seed = seed + 50_000 + letter_index
        samples = render_letter_keyed_blip(
            sample_count,
            random.Random(variation_seed),
            profile,
        )
        filename = f'curious-double-blip-keyed-{character}.wav'
        write_wav(keyed_dir / filename, samples)
        manifest.append({
            'key': character.upper(),
            'character': character,
            'file': f'letter-keyed/{filename}',
            'family': 'curious-double-blip-keyed',
            'description': 'Letter-keyed curious double blip with a small tonal and timing variation.',
            'seed': variation_seed,
            'duration_ms': round(len(samples) * 1000 / SAMPLE_RATE, 2),
            'frequency_hz': profile['frequency_hz'],
            'second_ratio': profile['second_ratio'],
            'second_start_ratio': profile['second_start_ratio'],
            'sample_rate': SAMPLE_RATE,
            'channels': 1,
            'format': 'PCM 16-bit little-endian',
            'license': 'CC0 1.0 via original procedural synthesis',
        })

    return manifest


def build_word_auditions(output_dir: Path, gap_ms: int) -> list[dict[str, object]]:
    """Chain the generated letter sounds into a few easy-to-audition words."""

    keyed_dir = output_dir / 'letter-keyed'
    audition_dir = output_dir / 'word-auditions'
    audition_dir.mkdir(parents=True, exist_ok=True)
    gap_samples = round(SAMPLE_RATE * gap_ms / 1000)
    silence = [0.0] * gap_samples
    manifest: list[dict[str, object]] = []

    for word in WORD_AUDITIONS:
        samples: list[float] = []
        source_files: list[str] = []

        for index, character in enumerate(word):
            filename = f'curious-double-blip-keyed-{character}.wav'
            source_path = keyed_dir / filename
            samples.extend(read_wav_samples(source_path))
            source_files.append(f'letter-keyed/{filename}')

            if index < len(word) - 1:
                samples.extend(silence)

        filename = f'{word}.wav'
        write_wav(audition_dir / filename, samples)
        manifest.append({
            'word': word,
            'file': f'word-auditions/{filename}',
            'letters': [character.upper() for character in word],
            'source_files': source_files,
            'gap_ms': gap_ms,
            'duration_ms': round(len(samples) * 1000 / SAMPLE_RATE, 2),
            'sample_rate': SAMPLE_RATE,
            'channels': 1,
            'format': 'PCM 16-bit little-endian',
            'license': 'CC0 1.0 via original procedural synthesis',
        })

    return manifest


def parse_args() -> argparse.Namespace:
    """Parse the small set of options useful when auditioning a new render."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path('public/sounds/dialogue-typing'),
        help='directory for generated WAV files and manifest.json',
    )
    parser.add_argument('--seed', type=int, default=20260830, help='deterministic variation seed')
    parser.add_argument('--variations', type=int, default=3, help='samples per sound family')
    parser.add_argument('--word-gap-ms', type=int, default=16, help='silence between letters in word auditions')
    return parser.parse_args()


def main() -> None:
    """Render the sound set and print a concise summary."""

    args = parse_args()
    if args.variations < 1:
        raise SystemExit('--variations must be at least 1')
    if args.word_gap_ms < 0:
        raise SystemExit('--word-gap-ms must be zero or greater')

    manifest = build_sounds(args.output_dir, args.seed, args.variations, args.word_gap_ms)
    families = len(SOUND_SPECS)
    keyed_count = len(LETTER_KEYS)
    word_count = len(WORD_AUDITIONS)
    print(
        f'Generated {len(manifest) + keyed_count + word_count} WAV files across '
        f'{families} sound families, {keyed_count} letter-keyed sounds, and '
        f'{word_count} word auditions in {args.output_dir}'
    )
    print(f'Sample format: {SAMPLE_RATE} Hz, mono, 16-bit PCM; seed: {args.seed}')


if __name__ == '__main__':
    main()
