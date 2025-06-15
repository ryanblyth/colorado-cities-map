# colorado-cities-map
Boundaries and data for Colorado cities

## Steps to Reproduce Project

### Create Python virtual environment, add libraries, add to .gitgnore.

python3 -m venv venv<br />
source venv/bin/activate<br />
pip install geopandas censusdata pandas<br />
pip freeze > requirements.txt

### Add the 2024 shapefile for Colorado places./

Source: https://www2.census.gov/geo/tiger/TIGER2024/PLACE/<br />
Note: The the tl_2024_08_place.zip is specific to Colorado as the Colorado state code is 08.	
