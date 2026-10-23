#!/usr/bin/env python3
"""Rasterise the Aster icon ladder and assemble the platform containers.

The three SVG sources from `scripts/app-icon.py` are a size ladder, so the
rasters are not one drawing scaled down: 16–40 px come from the micro source,
48–80 px from the small source, and 128 px and up from the master. `resvg`
(through the Tauri CLI already vendored in `apps/studio/node_modules`) does the
rasterising so the output does not depend on a system librsvg.

Outputs, all in `apps/web/public/tenant/aster/`:

  icons/{n}x{n}.png   the ladder, also the Linux hicolor set
  icon.png            1024 px, the master raster
  icon.ico            multi-resolution Windows container
  icon.icns           multi-resolution macOS container, per-size frames

`tauri.conf.json` bundles the last three; `just studio-desktop` installs the
ladder into the hicolor theme so a dock can find it by name.

Usage:
    python3 scripts/app-icon-assets.py            # render and verify
    python3 scripts/app-icon-assets.py --check    # verify committed files
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TENANT_DIR = REPO / "apps" / "web" / "public" / "tenant" / "aster"
ICON_DIR = TENANT_DIR / "icons"
TAURI_CLI = REPO / "apps" / "studio" / "node_modules" / ".bin" / "tauri"

# size -> source without the `app-icon-` prefix and `.svg` suffix.
LADDER = {
    16: "micro",
    24: "micro",
    32: "micro",
    40: "micro",
    48: "small",
    64: "small",
    80: "small",
    128: "full",
    256: "full",
    512: "full",
    1024: "full",
}
# Windows asks for the container to carry the small frames; Explorer and the
# taskbar pick the frame that matches their own scale factor.
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
# (icl4 tag, pixel size). The `ic07`+ family takes PNG payloads, and the `ic1x`
# tags are the @2x entries macOS reads on Retina displays.
ICNS_FRAMES = [
    ("icp4", 16),
    ("icp5", 32),
    ("icp6", 64),
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
    ("ic11", 32),
    ("ic12", 64),
    ("ic13", 256),
    ("ic14", 512),
]


def source_name(level: str) -> str:
    return "app-icon.svg" if level == "full" else f"app-icon-{level}.svg"


def png_size(data: bytes) -> tuple[int, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def png_pixels(data: bytes) -> tuple[int, int, bytes]:
    """Decode an 8-bit RGBA, non-interlaced PNG into raw RGBA bytes.

    Only the shape `resvg` writes is supported, which keeps this dependency-free
    while still letting the verifier look at real alpha values instead of image
    dimensions alone.
    """
    width, height = png_size(data)
    depth, colour, _, _, interlace = data[24:29]
    if (depth, colour, interlace) != (8, 6, 0):
        raise ValueError(f"unsupported PNG layout {depth}/{colour}/{interlace}")
    offset = 8
    payload = bytearray()
    while offset < len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        chunk = data[offset + 8 : offset + 8 + length]
        if kind == b"IDAT":
            payload += chunk
        elif kind == b"IEND":
            break
        offset += 12 + length
    raw = zlib.decompress(bytes(payload))
    stride = width * 4
    out = bytearray(stride * height)
    previous = bytearray(stride)
    position = 0
    for row in range(height):
        filter_type = raw[position]
        position += 1
        line = bytearray(raw[position : position + stride])
        position += stride
        if filter_type == 1:
            for index in range(4, stride):
                line[index] = (line[index] + line[index - 4]) & 0xFF
        elif filter_type == 2:
            for index in range(stride):
                line[index] = (line[index] + previous[index]) & 0xFF
        elif filter_type == 3:
            for index in range(stride):
                left = line[index - 4] if index >= 4 else 0
                line[index] = (line[index] + ((left + previous[index]) >> 1)) & 0xFF
        elif filter_type == 4:
            for index in range(stride):
                left = line[index - 4] if index >= 4 else 0
                up = previous[index]
                up_left = previous[index - 4] if index >= 4 else 0
                estimate = left + up - up_left
                pa, pb, pc = (
                    abs(estimate - left),
                    abs(estimate - up),
                    abs(estimate - up_left),
                )
                predictor = left if pa <= pb and pa <= pc else (up if pb <= pc else up_left)
                line[index] = (line[index] + predictor) & 0xFF
        elif filter_type != 0:
            raise ValueError(f"unknown PNG filter {filter_type}")
        out[row * stride : (row + 1) * stride] = line
        previous = line
    return width, height, bytes(out)


def alpha_at(width: int, pixels: bytes, x: int, y: int) -> int:
    return pixels[(y * width + x) * 4 + 3]


def write_ico(path: Path, frames: list[tuple[int, bytes]]) -> None:
    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    directory = bytearray()
    payload = bytearray()
    for size, data in frames:
        # A zero entry means 256: the field is a single byte.
        dimension = 0 if size >= 256 else size
        directory += struct.pack(
            "<BBBBHHII", dimension, dimension, 0, 0, 1, 32, len(data), offset
        )
        offset += len(data)
        payload += data
    path.write_bytes(header + bytes(directory) + bytes(payload))


def write_icns(path: Path, frames: list[tuple[str, bytes]]) -> None:
    body = bytearray()
    for tag, data in frames:
        body += tag.encode("ascii") + struct.pack(">I", len(data) + 8) + data
    path.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + bytes(body))


def verify() -> list[str]:
    problems: list[str] = []
    for size, level in LADDER.items():
        path = ICON_DIR / f"{size}x{size}.png"
        if not path.is_file():
            problems.append(f"missing {path.relative_to(REPO)}")
            continue
        data = path.read_bytes()
        width, height = png_size(data)
        if (width, height) != (size, size):
            problems.append(f"{path.name}: {width}x{height}, expected {size}")
            continue
        width, _, pixels = png_pixels(data)
        # The plate keeps an optical margin, so the corners stay transparent at
        # every size; a corner that fills means the safe area was lost.
        if alpha_at(width, pixels, 1, 1) != 0:
            problems.append(f"{path.name}: corner is opaque, plate lost its margin")
        # ... and the plate still covers the middle of the canvas.
        middle = alpha_at(width, pixels, size // 2, size // 2)
        if middle != 255:
            problems.append(f"{path.name}: centre alpha {middle}, expected opaque")
    master = TENANT_DIR / "icon.png"
    if not master.is_file():
        problems.append("missing icon.png")
    elif png_size(master.read_bytes()) != (1024, 1024):
        problems.append("icon.png is not 1024x1024")
    ico = TENANT_DIR / "icon.ico"
    if not ico.is_file():
        problems.append("missing icon.ico")
    else:
        data = ico.read_bytes()
        count = struct.unpack("<H", data[4:6])[0]
        if count != len(ICO_SIZES):
            problems.append(f"icon.ico carries {count} frames, expected {len(ICO_SIZES)}")
    icns = TENANT_DIR / "icon.icns"
    if not icns.is_file():
        problems.append("missing icon.icns")
    elif icns.read_bytes()[:4] != b"icns":
        problems.append("icon.icns has no icns magic")
    config = (REPO / "apps" / "studio" / "src-tauri" / "tauri.conf.json").read_text()
    for name in ("icon.icns", "icon.png", "icon.ico"):
        if f'tenant/aster/{name}"' not in config:
            problems.append(f"tauri.conf.json does not bundle {name}")
    return problems


def render() -> None:
    if not TAURI_CLI.is_file():
        raise SystemExit(
            f"missing {TAURI_CLI.relative_to(REPO)}; run the package install in apps/studio"
        )
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    by_level: dict[str, list[int]] = {}
    for size, level in LADDER.items():
        by_level.setdefault(level, []).append(size)
    with tempfile.TemporaryDirectory(dir=REPO / "target") as scratch:
        staging = Path(scratch)
        for level, sizes in by_level.items():
            source = TENANT_DIR / source_name(level)
            if not source.is_file():
                raise SystemExit(f"missing icon source {source.relative_to(REPO)}")
            subprocess.run(
                [
                    str(TAURI_CLI),
                    "icon",
                    str(source),
                    "-o",
                    str(staging / level),
                    "-p",
                    ",".join(str(size) for size in sizes),
                ],
                cwd=REPO / "apps" / "studio",
                check=True,
                stdout=subprocess.DEVNULL,
            )
        for size in LADDER:
            level = LADDER[size]
            rendered = staging / level / f"{size}x{size}.png"
            shutil.copyfile(rendered, ICON_DIR / f"{size}x{size}.png")
        shutil.copyfile(ICON_DIR / "1024x1024.png", TENANT_DIR / "icon.png")
        write_ico(
            TENANT_DIR / "icon.ico",
            [(size, (ICON_DIR / f"{size}x{size}.png").read_bytes()) for size in ICO_SIZES],
        )
        write_icns(
            TENANT_DIR / "icon.icns",
            [
                (tag, (ICON_DIR / f"{size}x{size}.png").read_bytes())
                for tag, size in ICNS_FRAMES
            ],
        )
    print(f"rendered {len(LADDER)} rasters into {ICON_DIR.relative_to(REPO)}")
    print("wrote icon.png, icon.ico, icon.icns")


def main(argv: list[str]) -> int:
    check = "--check" in argv
    if not check:
        render()
    problems = verify()
    if problems:
        for problem in problems:
            print(f"icon: {problem}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
