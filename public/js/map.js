mapboxgl.accessToken = 'pk.eyJ1IjoiaW5kZWxpYmUiLCJhIjoiY2xvM2k1Z25jMGZmbjJsbW9iMGV0M293cyJ9.UPel041iNYR3w_gq01-X8g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-105.5, 39.1],
  zoom: 6
});

// Create a popup but don't add it to the map yet
const popup = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: false,
  maxWidth: '300px'
});

// Add city layers before the map fully loads to place them below base layers
map.on('style.load', async () => {
  const response = await fetch('../data/colorado-cities-enriched-detailed-app.geojson');
  const geojson = await response.json();

  // Add IDs to features if they don't exist
  geojson.features.forEach((feature, index) => {
    if (!feature.id) {
      feature.id = feature.properties.GEOID || index;
    }
  });

  map.addSource('colorado-cities', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'city-fills',
    type: 'fill',
    source: 'colorado-cities',
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'Total_Pop'],
        0, '#53D6FC',      // Very light blue for small cities
        5000, '#02C7FC',   // Light blue
        25000, '#018CB5',  // Medium light blue
        100000, '#d79ff7', // Light purple
        300000, '#a654db', // Medium purple
        600000, '#7123a8' // Dark purple
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1, 0.5
      ]
    }
  }, 'road-simple');

  map.addLayer({
    id: 'city-borders',
    type: 'line',
    source: 'colorado-cities',
    paint: {
      'line-color': '#cccccc',
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1, 0.5
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1, 0.6
      ]
    }
  }, 'road-simple');

  // Add hover effect
  let hoveredCityId = null;

  map.on('mouseenter', 'city-fills', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mousemove', 'city-fills', (e) => {
    if (e.features.length > 0) {
      const newHoveredCityId = e.features[0].id;
      
      if (hoveredCityId !== newHoveredCityId) {
        // Reset the previously hovered city
        if (hoveredCityId !== null) {
          map.setFeatureState(
            { source: 'colorado-cities', id: hoveredCityId },
            { hover: false }
          );
        }
        
        // Set the new hovered city
        hoveredCityId = newHoveredCityId;
        map.setFeatureState(
          { source: 'colorado-cities', id: hoveredCityId },
          { hover: true }
        );
      }
    }
  });

  map.on('mouseleave', 'city-fills', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredCityId !== null) {
      map.setFeatureState(
        { source: 'colorado-cities', id: hoveredCityId },
        { hover: false }
      );
      hoveredCityId = null;
    }
  });

  // Add click event for popup
  map.on('click', 'city-fills', (e) => {
    const coordinates = e.lngLat;
    const properties = e.features[0].properties;
    
    // Format the popup content
    const popupContent = formatPopupContent(properties);
    
    popup
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
  });

  // Uncomment to see available layers
  // const layers = map.getStyle().layers;
  // console.log("Available layers:");
  // layers.forEach(layer => {
  //   console.log(layer.id);
  // });

  console.log("Map loaded with Colorado cities");
});

// Function to format popup content
function formatPopupContent(properties) {
  const formatNumber = (num) => {
    if (num === -666666666 || num === null || num === undefined) return 'N/A';
    return num.toLocaleString();
  };

  const formatCurrency = (num) => {
    if (num === -666666666 || num === null || num === undefined) return 'N/A';
    return `$${num.toLocaleString()}`;
  };

  const formatPercentage = (num) => {
    if (num === -666666666 || num === null || num === undefined) return 'N/A';
    return `${num.toFixed(1)}%`;
  };

  return `
    <div class="popup-content">
      <h3>${properties.NAME}</h3>
      <p><strong>Type:</strong> ${properties.NAMELSAD}</p>
      
      <h4>Demographics</h4>
      <p><strong>Population:</strong> ${formatNumber(properties.Total_Pop)}</p>
      <p><strong>Median Income:</strong> ${formatCurrency(properties.Median_Income)}</p>
      <p><strong>Poverty Rate:</strong> ${formatPercentage(properties.Poverty_Rate)}</p>
      
      <h4>Housing</h4>
      <p><strong>Median Rent:</strong> ${formatCurrency(properties.Median_Rent)}</p>
      <p><strong>Median Home Value:</strong> ${formatCurrency(properties.Median_Home_Value)}</p>
      
      <h4>Education</h4>
      <p><strong>Bachelor's Degree or Higher:</strong> ${formatPercentage(properties.Pct_Bachelors_or_Higher)}</p>
      <p><strong>Total Education Population:</strong> ${formatNumber(properties.Educ_Total)}</p>
    </div>
  `;
}
