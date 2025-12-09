#!/usr/bin/env python3
"""
Preprocess Hansen Global Forest Change data into H3 hexagons.

Downloads and processes the lossyear raster, aggregating pixel counts
into H3 cells at multiple resolutions for dynamic zoom-based display.

Usage:
    python preprocess_forest_loss.py

Output:
    public/data/forest-loss-res{4,5,6,7}.json
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import h3
import numpy as np
import rasterio
import requests
from tqdm import tqdm

# Configuration
TILE_URL = "https://storage.googleapis.com/earthenginepartners-hansen/GFC-2023-v1.11/Hansen_GFC-2023-v1.11_lossyear_50N_130W.tif"
CACHE_DIR = Path(__file__).parent / ".cache"
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
RESOLUTIONS = [4, 5, 6, 7]

# Pacific Northwest bounds (subset of full 10x10 degree tile)
# Full tile covers 40N-50N, 130W-120W
# We'll focus on WA/OR/Northern CA
BOUNDS = {
    "north": 49.0,
    "south": 42.0,
    "east": -117.0,
    "west": -125.0,
}

# Sampling rate - process every Nth pixel for performance
# Set to 1 for full resolution (slow), higher for faster testing
SAMPLE_RATE = 10  # Process every 10th pixel in each dimension


def download_tile(url: str, dest: Path) -> Path:
    """Download tile if not already cached."""
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        print(f"Using cached tile: {dest}")
        return dest

    print(f"Downloading tile from {url}...")
    print("(This is a large file ~500MB, please wait)")

    response = requests.get(url, stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))

    with open(dest, "wb") as f:
        with tqdm(total=total_size, unit="B", unit_scale=True) as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                pbar.update(len(chunk))

    print(f"Downloaded to {dest}")
    return dest


def process_tile(tif_path: Path, resolution: int, bounds: dict, sample_rate: int = 1) -> list[dict]:
    """
    Process raster tile into H3 cells at given resolution.

    Args:
        tif_path: Path to GeoTIFF file
        resolution: H3 resolution (4-7)
        bounds: Geographic bounds to process
        sample_rate: Sample every Nth pixel (1 = all pixels)

    Returns:
        List of H3 cell dictionaries with loss counts
    """
    cells: dict[str, dict] = defaultdict(lambda: {"totalLoss": 0, "byYear": defaultdict(int)})

    with rasterio.open(tif_path) as src:
        # Get the window for our bounds
        window = rasterio.windows.from_bounds(
            bounds["west"],
            bounds["south"],
            bounds["east"],
            bounds["north"],
            src.transform,
        )

        # Read the windowed data
        data = src.read(1, window=window)
        transform = rasterio.windows.transform(window, src.transform)

        height, width = data.shape
        print(f"Processing {height}x{width} pixels at resolution {resolution} (sample rate: {sample_rate})")

        # Count non-zero pixels for progress bar
        nonzero_mask = data > 0
        total_nonzero = np.count_nonzero(nonzero_mask)
        print(f"Found {total_nonzero:,} pixels with forest loss")

        processed = 0
        with tqdm(total=total_nonzero // (sample_rate * sample_rate), desc=f"Res {resolution}") as pbar:
            for row in range(0, height, sample_rate):
                for col in range(0, width, sample_rate):
                    value = data[row, col]

                    # Skip zero values (no loss) and nodata
                    if value == 0 or value > 23:  # lossyear 1-23 = 2001-2023
                        continue

                    # Convert pixel coordinates to lat/lon
                    # rasterio.transform.xy returns (x, y) = (lon, lat)
                    lon, lat = rasterio.transform.xy(transform, row, col)

                    # Convert to H3 index
                    try:
                        h3_index = h3.latlng_to_cell(lat, lon, resolution)
                    except Exception:
                        continue

                    # Aggregate into H3 cell
                    # Weight by sample_rate^2 to approximate true counts
                    weight = sample_rate * sample_rate
                    year = int(value)
                    cells[h3_index]["totalLoss"] += weight
                    cells[h3_index]["byYear"][year] += weight

                    processed += 1
                    pbar.update(1)

    # Convert to list format
    result = []
    for h3_index, cell_data in cells.items():
        result.append(
            {
                "h3": h3_index,
                "totalLoss": cell_data["totalLoss"],
                "byYear": dict(cell_data["byYear"]),
            }
        )

    return result


def main():
    """Main preprocessing pipeline."""
    print("=" * 60)
    print("Hansen Global Forest Change -> H3 Preprocessor")
    print("=" * 60)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Download tile
    tile_path = CACHE_DIR / "Hansen_GFC-2023-v1.11_lossyear_50N_130W.tif"
    download_tile(TILE_URL, tile_path)

    # Process at each resolution
    for resolution in RESOLUTIONS:
        print(f"\n--- Processing H3 resolution {resolution} ---")

        cells = process_tile(tile_path, resolution, BOUNDS, SAMPLE_RATE)

        output = {
            "generated": datetime.now(timezone.utc).isoformat(),
            "source": "Hansen GFC 2023 v1.11",
            "resolution": resolution,
            "bounds": BOUNDS,
            "sampleRate": SAMPLE_RATE,
            "totalCells": len(cells),
            "cells": cells,
        }

        output_path = OUTPUT_DIR / f"forest-loss-res{resolution}.json"
        with open(output_path, "w") as f:
            json.dump(output, f)

        print(f"Wrote {len(cells):,} cells to {output_path}")

    print("\n" + "=" * 60)
    print("Preprocessing complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
