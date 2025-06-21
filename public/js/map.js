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

  // Add IDs to features if they don't exist and calculate population density
  geojson.features.forEach((feature, index) => {
    if (!feature.id) {
      feature.id = feature.properties.GEOID || index;
    }
    
    // Calculate population density (people per square mile)
    // ALAND is in square meters, convert to square miles (1 sq mile = 2,589,988 sq meters)
    const areaSqMiles = feature.properties.ALAND / 2589988;
    feature.properties.Pop_Density = areaSqMiles > 0 ? 
      Math.round(feature.properties.Total_Pop / areaSqMiles) : 0;
  });

  map.addSource('colorado-cities', {
    type: 'geojson',
    data: geojson
  });

  // Total Population Layer
  map.addLayer({
    id: 'city-fills-population',
    type: 'fill',
    source: 'colorado-cities',
    paint: {
      'fill-color': [
        'case',
        ['any', ['in', 'CDP', ['get', 'NAMELSAD']]],
        '#808080', // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Total_Pop'],
          0, '#53D6FC',      // Very light blue for small cities
          5000, '#02C7FC',   // Light blue
          25000, '#018CB5',  // Medium light blue
          100000, '#d79ff7', // Light purple
          300000, '#a654db', // Medium purple
          600000, '#7123a8' // Dark purple
        ]
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1, 0.5
      ]
    }
  }, 'water');

  // Population Density Layer (initially hidden)
  map.addLayer({
    id: 'city-fills-density',
    type: 'fill',
    source: 'colorado-cities',
    paint: {
      'fill-color': [
        'case',
        ['any', ['in', 'CDP', ['get', 'NAMELSAD']]],
        '#808080', // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Pop_Density'],
          0, '#e8f5e8',      // Very light green for low density
          100, '#90ee90',    // Light green
          500, '#32cd32',    // Medium green
          1000, '#ffd700',   // Yellow
          2000, '#ff8c00',   // Orange
          5000, '#ff4500'    // Red for high density
        ]
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1, 0.5
      ]
    }
  }, 'water');

  // Hide density layer initially
  map.setLayoutProperty('city-fills-density', 'visibility', 'none');

  // Border layer (shared between both views)
  map.addLayer({
    id: 'city-borders',
    type: 'line',
    source: 'colorado-cities',
    paint: {
      'line-color': [
        'case',
        ['any', ['in', 'CDP', ['get', 'NAMELSAD']]],
        '#808080', // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Total_Pop'],
          0, '#53D6FC',      // Very light blue for small cities
          5000, '#02C7FC',   // Light blue
          25000, '#018CB5',  // Medium light blue
          100000, '#d79ff7', // Light purple
          300000, '#a654db', // Medium purple
          600000, '#7123a8' // Dark purple
        ]
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1, 0.5
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1, 0.6
      ]
    }
  }, 'water');

  // Add click event for popup
  map.on('click', 'city-fills-population', (e) => {
    const coordinates = e.lngLat;
    const properties = e.features[0].properties;
    
    // Format the popup content
    const popupContent = formatPopupContent(properties);
    
    popup
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
  });

  map.on('click', 'city-fills-density', (e) => {
    const coordinates = e.lngLat;
    const properties = e.features[0].properties;
    
    // Format the popup content
    const popupContent = formatPopupContent(properties);
    
    popup
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
  });

  // Add layer control after everything else is set up
  setTimeout(() => {
    const layerControl = document.createElement('div');
    layerControl.className = 'layer-control';
    layerControl.innerHTML = `
      <div class="layer-control-header">Map Layer</div>
      <div class="layer-control-buttons">
        <button id="population-btn" class="layer-btn active">Total Population</button>
        <button id="density-btn" class="layer-btn">Population Density</button>
      </div>
      <div class="color-key">
        <div class="key-header">Population</div>
        <div class="key-items">
          <div class="key-item">
            <div class="key-color" style="background: #53D6FC;"></div>
            <div class="key-label">0 - 5K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #02C7FC;"></div>
            <div class="key-label">5K - 25K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #018CB5;"></div>
            <div class="key-label">25K - 100K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #d79ff7;"></div>
            <div class="key-label">100K - 300K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #a654db;"></div>
            <div class="key-label">300K - 600K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #7123a8;"></div>
            <div class="key-label">600K+</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #808080;"></div>
            <div class="key-label">CDP</div>
          </div>
        </div>
      </div>
    `;
    
    // Add to the map container
    const mapContainer = map.getContainer();
    mapContainer.appendChild(layerControl);
    
    console.log('Layer control added to:', mapContainer);
    console.log('Layer control element:', layerControl);

    // Function to update color key
    function updateColorKey(type) {
      const keyHeader = layerControl.querySelector('.key-header');
      const keyItems = layerControl.querySelector('.key-items');
      
      if (type === 'population') {
        keyHeader.textContent = 'Population';
        keyItems.innerHTML = `
          <div class="key-item">
            <div class="key-color" style="background: #53D6FC;"></div>
            <div class="key-label">0 - 5K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #02C7FC;"></div>
            <div class="key-label">5K - 25K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #018CB5;"></div>
            <div class="key-label">25K - 100K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #d79ff7;"></div>
            <div class="key-label">100K - 300K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #a654db;"></div>
            <div class="key-label">300K - 600K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #7123a8;"></div>
            <div class="key-label">600K+</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #808080;"></div>
            <div class="key-label">CDP</div>
          </div>
        `;
      } else {
        keyHeader.textContent = 'Density (per sq mile)';
        keyItems.innerHTML = `
          <div class="key-item">
            <div class="key-color" style="background: #e8f5e8;"></div>
            <div class="key-label">0 - 100</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #90ee90;"></div>
            <div class="key-label">100 - 500</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #32cd32;"></div>
            <div class="key-label">500 - 1K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #ffd700;"></div>
            <div class="key-label">1K - 2K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #ff8c00;"></div>
            <div class="key-label">2K - 5K</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #ff4500;"></div>
            <div class="key-label">5K+</div>
          </div>
          <div class="key-item">
            <div class="key-color" style="background: #808080;"></div>
            <div class="key-label">CDP</div>
          </div>
        `;
      }
    }

    // Layer switching functionality
    document.getElementById('population-btn').addEventListener('click', function() {
      map.setLayoutProperty('city-fills-population', 'visibility', 'visible');
      map.setLayoutProperty('city-fills-density', 'visibility', 'none');
      
      // Update border colors to match population layer
      map.setPaintProperty('city-borders', 'line-color', [
        'case',
        ['any', ['in', 'CDP', ['get', 'NAMELSAD']]],
        '#808080', // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Total_Pop'],
          0, '#53D6FC',      // Very light blue for small cities
          5000, '#02C7FC',   // Light blue
          25000, '#018CB5',  // Medium light blue
          100000, '#d79ff7', // Light purple
          300000, '#a654db', // Medium purple
          600000, '#7123a8' // Dark purple
        ]
      ]);
      
      // Update color key
      updateColorKey('population');
      
      document.getElementById('population-btn').classList.add('active');
      document.getElementById('density-btn').classList.remove('active');
    });

    document.getElementById('density-btn').addEventListener('click', function() {
      map.setLayoutProperty('city-fills-population', 'visibility', 'none');
      map.setLayoutProperty('city-fills-density', 'visibility', 'visible');
      
      // Update border colors to match density layer
      map.setPaintProperty('city-borders', 'line-color', [
        'case',
        ['any', ['in', 'CDP', ['get', 'NAMELSAD']]],
        '#808080', // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Pop_Density'],
          0, '#e8f5e8',      // Very light green for low density
          100, '#90ee90',    // Light green
          500, '#32cd32',    // Medium green
          1000, '#ffd700',   // Yellow
          2000, '#ff8c00',   // Orange
          5000, '#ff4500'    // Red for high density
        ]
      ]);
      
      // Update color key
      updateColorKey('density');
      
      document.getElementById('density-btn').classList.add('active');
      document.getElementById('population-btn').classList.remove('active');
    });
  }, 100);

  // Add hover effect
  let hoveredCityId = null;

  map.on('mouseenter', 'city-fills-population', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseenter', 'city-fills-density', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mousemove', 'city-fills-population', (e) => {
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

  map.on('mousemove', 'city-fills-density', (e) => {
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

  map.on('mouseleave', 'city-fills-population', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredCityId !== null) {
      map.setFeatureState(
        { source: 'colorado-cities', id: hoveredCityId },
        { hover: false }
      );
      hoveredCityId = null;
    }
  });

  map.on('mouseleave', 'city-fills-density', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredCityId !== null) {
      map.setFeatureState(
        { source: 'colorado-cities', id: hoveredCityId },
        { hover: false }
      );
      hoveredCityId = null;
    }
  });

  // Uncomment to see available layers
  const layers = map.getStyle().layers;
  console.log("Available layers:");
  layers.forEach(layer => {
    console.log(layer.id);
  });

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

  // Parse place type from NAMELSAD
  const getPlaceType = (namelsad) => {
    if (namelsad.includes('CDP')) return 'Census Designated Place';
    if (namelsad.includes('city')) return 'City';
    if (namelsad.includes('town')) return 'Town';
    return 'Place';
  };

  const placeType = getPlaceType(properties.NAMELSAD);

  return `
    <div class="popup-content">
      <h3>${properties.NAME}</h3>
      <p><strong>Type:</strong> ${placeType}</p>
      
      <h4>Demographics</h4>
      <p><strong>Population:</strong> ${formatNumber(properties.Total_Pop)}</p>
      <p><strong>Population Density:</strong> ${formatNumber(properties.Pop_Density)} people/sq mile</p>
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
