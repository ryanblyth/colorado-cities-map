mapboxgl.accessToken = 'pk.eyJ1IjoiaW5kZWxpYmUiLCJhIjoiY2xvM2k1Z25jMGZmbjJsbW9iMGV0M293cyJ9.UPel041iNYR3w_gq01-X8g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-105.5, 39.1],
  zoom: 6
});

map.on('load', async () => {
  const response = await fetch('../data/colorado-cities-enriched-app.geojson');
  const geojson = await response.json();

  map.addSource('colorado-cities', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'city-fills',
    type: 'fill',
    source: 'colorado-cities',
    paint: {
      'fill-color': '#3B9C9C',
      'fill-opacity': 0.6
    }
  });

  map.addLayer({
    id: 'city-borders',
    type: 'line',
    source: 'colorado-cities',
    paint: {
      'line-color': '#333',
      'line-width': 0.8
    }
  });

  console.log("Map loaded with Colorado cities");
});
