#!/usr/bin/env python3
"""
make_colorado_geojson.py

This script converts the 2024 TIGER/Line shapefile for Colorado places into
a simplified GeoJSON file, reprojected to WGS84 for use in web maps or GIS apps.

Usage:
    python scripts/make_colorado_geojson.py
"""

import geopandas as gpd
from pathlib import Path


def main():
    # Define input and output paths
    input_path = Path("raw-data/tl_2024_08_place/tl_2024_08_place.shp")
    output_path = Path("data/colorado-cities.geojson")

    # Load shapefile
    gdf = gpd.read_file(input_path)

    # Reproject to WGS84
    gdf = gdf.to_crs(epsg=4326)

    # Simplify geometry (optional, adjust tolerance as needed)
    gdf["geometry"] = gdf["geometry"].simplify(0.001, preserve_topology=True)

    # Export to GeoJSON
    output_path.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_file(output_path, driver="GeoJSON")

    print(f"Exported Colorado cities to {output_path}")


if __name__ == "__main__":
    main()
