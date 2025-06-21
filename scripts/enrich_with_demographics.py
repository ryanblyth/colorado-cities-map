#!/usr/bin/env python3
"""
enrich_with_demographics.py

Loads a GeoJSON file of Colorado places and enriches it with ACS 5-Year demographic data (2023).
Outputs a new GeoJSON file with additional population, income, education, and housing fields.
"""

import geopandas as gpd
import pandas as pd
import censusdata
from pathlib import Path


def get_acs_data():
    """Download ACS data for Colorado places and return it as a cleaned DataFrame."""
    acs_vars = [
        'B01003_001E',  # Total Population
        'B19013_001E',  # Median Household Income
        'B17001_002E',  # Below Poverty Count
        'B17001_001E',  # Poverty Universe Total
        'B25064_001E',  # Median Gross Rent
        'B25077_001E',  # Median Home Value
        'B15003_001E',  # Total Education Population
        'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E'  # Bachelor's+
    ]

    acs_df = censusdata.download(
        'acs5', 2023,
        censusdata.censusgeo([('state', '08'), ('place', '*')]),
        acs_vars
    )

    acs_df.columns = [
        'Total_Pop', 'Median_Income', 'Poverty_Count', 'Poverty_Total',
        'Median_Rent', 'Median_Home_Value',
        'Educ_Total', 'Bach_1', 'Bach_2', 'Bach_3', 'Bach_4'
    ]

    # Build GEOID for joining with shapefile
    acs_df['GEOID'] = acs_df.index.map(lambda geo: geo.geo[0][1] + geo.geo[1][1])

    # Add calculated fields
    acs_df['Poverty_Rate'] = acs_df['Poverty_Count'] / acs_df['Poverty_Total'] * 100
    acs_df['Bachelors_Total'] = acs_df[['Bach_1', 'Bach_2', 'Bach_3', 'Bach_4']].sum(axis=1)
    acs_df['Pct_Bachelors_or_Higher'] = acs_df['Bachelors_Total'] / acs_df['Educ_Total'] * 100

    # Drop intermediate columns
    return acs_df.drop(columns=['Bach_1', 'Bach_2', 'Bach_3', 'Bach_4'])


def main():
    input_geojson = Path("data/colorado-cities-detailed.geojson")
    output_geojson = Path("data/colorado-cities-enriched-detailed.geojson")

    # Load existing Colorado GeoJSON
    gdf = gpd.read_file(input_geojson)

    # Get ACS demographic data
    acs_df = get_acs_data()

    # Merge on GEOID
    enriched = gdf.merge(acs_df, on="GEOID", how="left")

    # Save enriched GeoJSON
    enriched.to_file(output_geojson, driver="GeoJSON")
    print(f"Exported enriched GeoJSON to {output_geojson}")


if __name__ == "__main__":
    main()
