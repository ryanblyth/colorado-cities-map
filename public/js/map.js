mapboxgl.accessToken = 'pk.eyJ1IjoiaW5kZWxpYmUiLCJhIjoiY2xvM2k1Z25jMGZmbjJsbW9iMGV0M293cyJ9.UPel041iNYR3w_gq01-X8g';

// Color variables for consistent use across the application
const COLORS = {
  // Population/Density color scale - more differentiated
  VERY_LIGHT: '#8DF6FC',    // Brighter lightest blue
  LIGHT: '#5DE7FC',          // Brighter light blue  
  MEDIUM: '#4AACD5',        // Brighter medium blue
  LIGHT_PURPLE: '#F7BFF7',  // Brighter light purple
  MEDIUM_PURPLE: '#D674FB', // Brighter medium purple
  DARK_PURPLE: '#A143C8',   // Brighter dark purple
  CDP: '#808080'             // Gray for CDPs
};

// Population thresholds for color mapping
const POPULATION_THRESHOLDS = {
  SMALL: 5000,
  MEDIUM: 25000,
  LARGE: 100000,
  VERY_LARGE: 300000,
  MEGA: 600000
};

// Density thresholds for color mapping
const DENSITY_THRESHOLDS = {
  LOW: 100,
  MEDIUM: 500,
  HIGH: 1000,
  VERY_HIGH: 2000,
  EXTREME: 5000
};

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
  maxWidth: '300px',
  className: 'custom-popup',
  focusAfterOpen: false
});

// Chart functionality - moved outside setTimeout for proper scope
let currentChart = null;
let chartData = null;
let selectedCity = null;

// Track the current key type
let currentKeyType = 'population';

/**
 * Gets the appropriate color for a city based on its properties and display type
 * @param {Object} cityProperties - The city's properties from GeoJSON
 * @param {string} type - The display type ('population' or 'density')
 * @returns {string} The color hex code for the city
 */
function getCityColor(cityProperties, type) {
  if (cityProperties.NAMELSAD.includes('CDP')) return COLORS.CDP;
  
  if (type === 'population') {
    const pop = cityProperties.Total_Pop;
    if (pop < POPULATION_THRESHOLDS.SMALL) return COLORS.VERY_LIGHT;
    if (pop < POPULATION_THRESHOLDS.MEDIUM) return COLORS.LIGHT;
    if (pop < POPULATION_THRESHOLDS.LARGE) return COLORS.MEDIUM;
    if (pop < POPULATION_THRESHOLDS.VERY_LARGE) return COLORS.LIGHT_PURPLE;
    if (pop < POPULATION_THRESHOLDS.MEGA) return COLORS.MEDIUM_PURPLE;
    return COLORS.DARK_PURPLE;
  } else {
    const density = cityProperties.Pop_Density;
    if (density < DENSITY_THRESHOLDS.LOW) return COLORS.VERY_LIGHT;
    if (density < DENSITY_THRESHOLDS.MEDIUM) return COLORS.LIGHT;
    if (density < DENSITY_THRESHOLDS.HIGH) return COLORS.MEDIUM;
    if (density < DENSITY_THRESHOLDS.VERY_HIGH) return COLORS.LIGHT_PURPLE;
    if (density < DENSITY_THRESHOLDS.EXTREME) return COLORS.MEDIUM_PURPLE;
    return COLORS.DARK_PURPLE;
  }
}

// Function to prepare chart data
function prepareChartData(data, type) {
  const cities = data.features
    .filter(f => !f.properties.NAMELSAD.includes('CDP'))
    .sort((a, b) => b.properties[type === 'population' ? 'Total_Pop' : 'Pop_Density'] - a.properties[type === 'population' ? 'Total_Pop' : 'Pop_Density'])
    .slice(0, 15); // Top 15 cities

  const colors = cities.map(f => {
    const color = getCityColor(f.properties, type);
    return color;
  });

  // Function to split long labels at spaces
  const formatLabel = (label) => {
    if (label.length > 15 && label.includes(' ')) {
      const words = label.split(' ');
      const midPoint = Math.ceil(words.length / 2);
      const firstLine = words.slice(0, midPoint).join(' ');
      const secondLine = words.slice(midPoint).join(' ');
      return [firstLine, secondLine];
    }
    return [label];
  };

  return {
    labels: cities.map(f => formatLabel(f.properties.NAME)),
    values: cities.map(f => f.properties[type === 'population' ? 'Total_Pop' : 'Pop_Density']),
    colors: colors
  };
}

// Function to calculate state averages
function calculateStateAverages(data) {
  const cities = data.features.filter(f => !f.properties.NAMELSAD.includes('CDP'));
  
  const totals = cities.reduce((acc, city) => {
    acc.population += city.properties.Total_Pop || 0;
    acc.density += city.properties.Pop_Density || 0;
    
    // Only add valid income values (positive numbers)
    const income = city.properties.Median_Income;
    if (income && income > 0 && income !== -666666666) {
      acc.income += income;
      acc.validIncomeCount += 1;
    }
    
    // Only add valid rent values
    const rent = city.properties.Median_Rent;
    if (rent && rent > 0 && rent !== -666666666) {
      acc.rent += rent;
      acc.validRentCount += 1;
    }
    
    // Only add valid home value values
    const homeValue = city.properties.Median_Home_Value;
    if (homeValue && homeValue > 0 && homeValue !== -666666666) {
      acc.homeValue += homeValue;
      acc.validHomeValueCount += 1;
    }
    
    // Only add valid poverty values
    const poverty = city.properties.Poverty_Rate;
    if (poverty && poverty >= 0 && poverty !== -666666666) {
      acc.poverty += poverty;
      acc.validPovertyCount += 1;
    }
    
    acc.validCities += 1;
    return acc;
  }, {
    population: 0,
    density: 0,
    income: 0,
    rent: 0,
    homeValue: 0,
    poverty: 0,
    validCities: 0,
    validIncomeCount: 0,
    validRentCount: 0,
    validHomeValueCount: 0,
    validPovertyCount: 0
  });

  return {
    population: Math.round(totals.population / totals.validCities),
    density: Math.round(totals.density / totals.validCities),
    income: totals.validIncomeCount > 0 ? Math.round(totals.income / totals.validIncomeCount) : 0,
    rent: totals.validRentCount > 0 ? Math.round(totals.rent / totals.validRentCount) : 0,
    homeValue: totals.validHomeValueCount > 0 ? Math.round(totals.homeValue / totals.validHomeValueCount) : 0,
    poverty: totals.validPovertyCount > 0 ? Math.round((totals.poverty / totals.validPovertyCount) * 100) / 100 : 0
  };
}

// Function to prepare demographics chart data
function prepareDemographicsData(cityData, stateAverages) {
  if (!cityData || !stateAverages) return null;

  const categories = [
    'Population Density',
    'Median Income',
    'Median Rent',
    'Median Home Value',
    'Poverty Rate'
  ];

  const cityValues = [
    cityData.Pop_Density,
    cityData.Median_Income,
    cityData.Median_Rent,
    cityData.Median_Home_Value,
    cityData.Poverty_Rate
  ];

  const stateValues = [
    stateAverages.density,
    stateAverages.income,
    stateAverages.rent,
    stateAverages.homeValue,
    stateAverages.poverty
  ];

  // Format values for display
  const formattedCityValues = cityValues.map((val, index) => {
    if (val === -666666666 || val === null || val === undefined || val < 0 || isNaN(val)) return 0;
    return val;
  });

  const formattedStateValues = stateValues.map((val, index) => {
    if (val === -666666666 || val === null || val === undefined || val < 0 || isNaN(val)) return 0;
    return val;
  });

  return {
    categories,
    cityValues: formattedCityValues,
    stateValues: formattedStateValues,
    rawCityValues: cityValues,
    rawStateValues: stateValues
  };
}

// Function to create/update chart
function updateChart(type) {
  if (!chartData) return;

  if (type === 'demographics') {
    if (!selectedCity) {
      // Show message when no city is selected
      const options = {
        chart: {
          type: 'bar',
          height: 380,
          background: 'transparent',
          toolbar: { show: false }
        },
        series: [{
          name: 'No Data',
          data: [0]
        }],
        xaxis: {
          categories: ['No city selected'],
          labels: {
            style: {
              colors: '#bdc3c7',
              fontSize: '11px'
            }
          }
        },
        yaxis: {
          labels: {
            style: {
              colors: '#bdc3c7',
              fontSize: '11px'
            }
          }
        },
        colors: ['#808080'],
        plotOptions: {
          bar: {
            borderRadius: 4
          }
        },
        legend: {
          show: false
        },
        title: {
          text: 'Click on a city to see detailed demographics',
          align: 'left',
          style: {
            color: '#ecf0f1',
            fontSize: '14px',
            fontWeight: 600
          }
        },
        grid: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          strokeDashArray: 3
        }
      };

      if (currentChart) {
        currentChart.destroy();
      }
      currentChart = new ApexCharts(document.querySelector("#chart-container"), options);
      currentChart.render();
      return;
    }

    const demoData = prepareDemographicsData(selectedCity, calculateStateAverages(chartData));
    if (!demoData) return;

    // Create 5 separate charts
    const chartContainer = document.querySelector("#chart-container");
    if (!chartContainer) {
      console.error('Chart container not found');
      return;
    }

    // Destroy existing chart if it exists
    if (currentChart) {
      try {
        currentChart.destroy();
      } catch (error) {
        console.warn('Error destroying previous chart:', error);
      }
      currentChart = null;
    }

    // Clear the container and insert new HTML
    chartContainer.innerHTML = '';
    
    // Insert the demographics grid HTML
    chartContainer.innerHTML = `
      <div class="demographics-grid">
        <div class="chart-item">
          <h4>Population Density</h4>
          <div id="chart-population"></div>
        </div>
        <div class="chart-item">
          <h4>Median Income</h4>
          <div id="chart-income"></div>
        </div>
        <div class="chart-item">
          <h4>Median Rent</h4>
          <div id="chart-rent"></div>
        </div>
        <div class="chart-item">
          <h4>Median Home Value</h4>
          <div id="chart-home"></div>
        </div>
        <div class="chart-item">
          <h4>Poverty Rate</h4>
          <div id="chart-poverty"></div>
        </div>
      </div>
    `;

    // Force a reflow to ensure DOM is updated
    chartContainer.offsetHeight;

    // Create individual charts
    const createIndividualChart = (containerId, title, cityValue, stateValue, formatType, cityColor) => {
      const container = document.querySelector(containerId);
      if (!container) {
        console.error(`Container not found: ${containerId}`);
        return null;
      }

      const options = {
        chart: {
          type: 'bar',
          height: 160,
          background: 'transparent',
          toolbar: { show: false },
          sparkline: { enabled: false }
        },
        series: [
          {
            name: selectedCity.NAME,
            data: [cityValue]
          },
          {
            name: 'State Avg',
            data: [stateValue]
          }
        ],
        xaxis: {
          categories: [''],
          labels: {
            style: {
              colors: '#bdc3c7',
              fontSize: '9px'
            },
            formatter: function(val) {
              // Handle non-numeric values and negative values
              if (val === null || val === undefined || isNaN(val) || val === -666666666 || val < 0) {
                return 'N/A';
              }
              if (formatType === 'density') return val.toString();
              if (formatType === 'population') return val >= 1000 ? (val/1000).toFixed(1) + 'K' : val.toString();
              if (formatType === 'percentage') return val.toFixed(1) + '%';
              return '$' + (val >= 1000 ? (val/1000).toFixed(1) + 'K' : val.toString());
            }
          }
        },
        yaxis: {
          labels: {
            style: {
              colors: '#bdc3c7',
              fontSize: '9px'
            }
          }
        },
        colors: [cityColor, '#3498db'],
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 2,
            dataLabels: {
              position: 'center'
            }
          }
        },
        legend: {
          show: false
        },
        dataLabels: {
          enabled: true,
          formatter: function(val) {
            // Handle non-numeric values and negative values
            if (val === null || val === undefined || isNaN(val) || val === -666666666 || val < 0) {
              return 'N/A';
            }
            if (formatType === 'density') return val.toString();
            if (formatType === 'population') return val >= 1000 ? (val/1000).toFixed(1) + 'K' : val.toString();
            if (formatType === 'percentage') return val.toFixed(1) + '%';
            return '$' + (val >= 1000 ? (val/1000).toFixed(1) + 'K' : val.toString());
          },
          style: {
            fontSize: '9px',
            colors: ['#ffffff'],
            fontWeight: 600
          },
          offsetX: 0
        },
        grid: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          strokeDashArray: 2
        }
      };

      try {
        return new ApexCharts(container, options);
      } catch (error) {
        console.error(`Error creating chart for ${containerId}:`, error);
        return null;
      }
    };

    // Create all 5 charts with a small delay to ensure DOM is ready
    const chartIds = ['#chart-population', '#chart-income', '#chart-rent', '#chart-home', '#chart-poverty'];
    
    setTimeout(() => {
      try {
        // Verify all chart containers exist before creating charts
        const missingElements = chartIds.filter(id => !document.querySelector(id));
        
        if (missingElements.length > 0) {
          console.error('Missing chart containers:', missingElements);
          // Try to recreate the HTML if it's missing
          if (chartContainer.innerHTML.trim() === '') {
            chartContainer.innerHTML = `
              <div class="demographics-grid">
                <div class="chart-item">
                  <h4>Population Density</h4>
                  <div id="chart-population"></div>
                </div>
                <div class="chart-item">
                  <h4>Median Income</h4>
                  <div id="chart-income"></div>
                </div>
                <div class="chart-item">
                  <h4>Median Rent</h4>
                  <div id="chart-rent"></div>
                </div>
                <div class="chart-item">
                  <h4>Median Home Value</h4>
                  <div id="chart-home"></div>
                </div>
                <div class="chart-item">
                  <h4>Poverty Rate</h4>
                  <div id="chart-poverty"></div>
                </div>
              </div>
            `;
          }
          
          // Try again with a longer delay
          setTimeout(() => {
            const retryMissingElements = chartIds.filter(id => !document.querySelector(id));
            if (retryMissingElements.length > 0) {
              console.error('Still missing chart containers after retry:', retryMissingElements);
              return;
            }
            createDemographicsCharts();
          }, 200);
          return;
        }

        // Additional verification that containers are empty and ready
        const containersReady = chartIds.every(id => {
          const container = document.querySelector(id);
          return container && container.children.length === 0;
        });

        if (!containersReady) {
          console.warn('Some chart containers are not ready, retrying...');
          setTimeout(createDemographicsCharts, 100);
          return;
        }

        createDemographicsCharts();
      } catch (error) {
        console.error('Error creating demographics charts:', error);
      }
    }, 100);

    // Function to create the actual charts
    function createDemographicsCharts() {
      // Get the city's color from the map
      const cityColor = getCityColor(selectedCity, 'population'); // Use population colors for consistency
      
      const charts = [
        createIndividualChart('#chart-population', 'Population Density', demoData.cityValues[0], demoData.stateValues[0], 'density', cityColor),
        createIndividualChart('#chart-income', 'Median Income', demoData.cityValues[1], demoData.stateValues[1], 'currency', cityColor),
        createIndividualChart('#chart-rent', 'Median Rent', demoData.cityValues[2], demoData.stateValues[2], 'currency', cityColor),
        createIndividualChart('#chart-home', 'Median Home Value', demoData.cityValues[3], demoData.stateValues[3], 'currency', cityColor),
        createIndividualChart('#chart-poverty', 'Poverty Rate', demoData.cityValues[4], demoData.stateValues[4], 'percentage', cityColor)
      ];

      // Render all charts
      charts.forEach((chart, index) => {
        try {
          if (chart === null) {
            console.warn(`Chart ${chartIds[index]} was not created`);
            return;
          }
          
          const container = document.querySelector(chartIds[index]);
          if (container && container.children.length === 0) {
            chart.render();
          } else {
            console.warn(`Chart container ${chartIds[index]} is not ready`);
          }
        } catch (error) {
          console.warn('Failed to render chart:', error);
        }
      });

      // Store reference to the first valid chart for cleanup
      const validCharts = charts.filter(chart => chart !== null);
      currentChart = validCharts.length > 0 ? validCharts[0] : null;
    }
    return;
  }

  const data = prepareChartData(chartData, type);
  const title = type === 'population' ? 'Top 15 Cities by Population' : 'Top 15 Cities by Population Density';
  const yAxisTitle = type === 'population' ? 'Population' : 'Population Density (per sq mile)';

  const options = {
    chart: {
      type: 'bar',
      height: 380,
      background: 'transparent',
      toolbar: {
        show: false
      }
    },
    series: [{
      name: yAxisTitle,
      data: data.values
    }],
    xaxis: {
      categories: data.labels,
      labels: {
        style: {
          colors: '#bdc3c7',
          fontSize: '9px'
        },
        rotate: -45,
        rotateAlways: true,
        maxHeight: 80,
        formatter: function(value) {
          if (Array.isArray(value)) {
            return value.join('\n');
          }
          return value;
        }
      }
    },
    yaxis: {
      title: {
        text: yAxisTitle,
        style: {
          color: '#ecf0f1',
          fontSize: '12px'
        }
      },
      labels: {
        style: {
          colors: '#bdc3c7',
          fontSize: '11px'
        }
      }
    },
    colors: data.colors,
    plotOptions: {
      bar: {
        borderRadius: 4,
        dataLabels: {
          position: 'top'
        },
        distributed: true
      }
    },
    legend: {
      show: false
    },
    dataLabels: {
      enabled: true,
      formatter: function(val) {
        return type === 'population' ? 
          (val >= 1000 ? (val/1000).toFixed(1) + 'K' : val.toString()) :
          val.toString();
      },
      style: {
        fontSize: '10px',
        colors: ['#ffffff'],
        fontWeight: 600
      },
      offsetY: -15
    },
    title: {
      text: title,
      align: 'left',
      style: {
        color: '#ecf0f1',
        fontSize: '14px',
        fontWeight: 600
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      strokeDashArray: 3
    }
  };

  if (currentChart) {
    currentChart.destroy();
  }

  currentChart = new ApexCharts(document.querySelector("#chart-container"), options);
  currentChart.render();
}

// Function to fix popup accessibility issues
function fixPopupAccessibility() {
  setTimeout(() => {
    const closeButton = document.querySelector('.mapboxgl-popup-close-button');
    if (closeButton) {
      closeButton.removeAttribute('aria-hidden');
    }
  }, 10);
}

  // Add city layers before the map fully loads to place them below base layers
  map.on('style.load', async () => {
    const response = await fetch('../data/colorado-cities-enriched-detailed-app.geojson');
    const geojson = await response.json();
    chartData = geojson;

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

    // Variables for key highlighting
    let clickedKeyItem = null;
    let highlightedFeatures = [];

    // Function to highlight cities by range
    function highlightCitiesByRange(range, type, highlight) {
      if (!range) return; // Safety check for undefined/null range
      
      const data = chartData || geojson;
      if (!data) return;
      
      const features = data.features;
      const highlightedFeatures = [];
      
      features.forEach(feature => {
        if (!feature.properties) return; // skip if properties is missing
        let shouldHighlight = false;
        const properties = feature.properties;
        
        if (range === 'cdp') {
          shouldHighlight = properties.NAMELSAD && properties.NAMELSAD.includes('CDP');
        } else {
          const value = type === 'population' ? properties.Total_Pop : properties.Pop_Density;
          
          if (range.includes('+')) {
            // Handle ranges like "600000+" or "5000+"
            const minValue = parseInt(range.replace('+', ''));
            shouldHighlight = value >= minValue;
          } else {
            // Handle ranges like "0-5000" or "100-500"
            const [min, max] = range.split('-').map(v => parseInt(v));
            shouldHighlight = value >= min && value < max;
          }
        }
        
        if (shouldHighlight) {
          map.setFeatureState(
            { source: 'colorado-cities', id: feature.id },
            { keyHighlight: highlight }
          );
          if (highlight) {
            highlightedFeatures.push(feature.id);
          }
        }
      });
    }

    // Function to clear all highlights
    function clearAllHighlights() {
      const data = chartData || geojson;
      if (!data) return;
      
      data.features.forEach(feature => {
        map.setFeatureState(
          { source: 'colorado-cities', id: feature.id },
          { keyHighlight: false }
        );
      });
    }

    // Function to add event listeners to key items
    function addKeyItemEventListeners(layerControl) {
      const keyItems = layerControl.querySelectorAll('.key-item');
      keyItems.forEach(item => {
        item.addEventListener('mouseenter', (event) => {
          const range = event.currentTarget.dataset.range;
          highlightCitiesByRange(range, currentKeyType, true);
        });
        item.addEventListener('mouseleave', (event) => {
          // Only remove highlight if this item is not clicked
          if (clickedKeyItem !== event.currentTarget) {
            const range = event.currentTarget.dataset.range;
            highlightCitiesByRange(range, currentKeyType, false);
          }
        });
        item.addEventListener('click', (event) => {
          const clickedItem = event.currentTarget;
          if (clickedKeyItem === clickedItem) {
            clickedKeyItem = null;
            clearAllHighlights();
            clickedItem.classList.remove('clicked');
          } else {
            if (clickedKeyItem) clickedKeyItem.classList.remove('clicked');
            clickedKeyItem = clickedItem;
            clickedItem.classList.add('clicked');
            const range = clickedItem.dataset.range;
            highlightCitiesByRange(range, currentKeyType, true);
          }
        });
      });
    }

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
        COLORS.CDP, // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Total_Pop'],
          0, COLORS.VERY_LIGHT,      // Very light blue for small cities
          5000, COLORS.LIGHT,        // Light blue
          25000, COLORS.MEDIUM,      // Medium blue
          100000, COLORS.LIGHT_PURPLE, // Light purple
          300000, COLORS.MEDIUM_PURPLE, // Medium purple
          600000, COLORS.DARK_PURPLE  // Dark purple
        ]
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1,
        ['case',
          ['boolean', ['feature-state', 'keyHighlight'], false], 0.8, 0.5
        ]
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
        COLORS.CDP, // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Pop_Density'],
          0, COLORS.VERY_LIGHT,      // Very light blue for low density
          100, COLORS.LIGHT,         // Light blue
          500, COLORS.MEDIUM,        // Medium blue
          1000, COLORS.LIGHT_PURPLE, // Light purple
          2000, COLORS.MEDIUM_PURPLE, // Medium purple
          5000, COLORS.DARK_PURPLE   // Dark purple
        ]
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1,
        ['case',
          ['boolean', ['feature-state', 'keyHighlight'], false], 0.8, 0.5
        ]
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
        COLORS.CDP, // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Total_Pop'],
          0, COLORS.VERY_LIGHT,      // Very light blue for small cities
          5000, COLORS.LIGHT,        // Light blue
          25000, COLORS.MEDIUM,      // Medium light blue
          100000, COLORS.LIGHT_PURPLE, // Light purple
          300000, COLORS.MEDIUM_PURPLE, // Medium purple
          600000, COLORS.DARK_PURPLE  // Dark purple
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
    
    // Store selected city for demographics chart
    selectedCity = properties;
    
    // Format the popup content
    const popupContent = formatPopupContent(properties);
    
    popup
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
    
    // Fix accessibility issues
    fixPopupAccessibility();
    
    // Update demographics chart if it's active
    if (document.getElementById('chart-demographics-btn').classList.contains('active')) {
      updateChart('demographics');
    }
  });

  map.on('click', 'city-fills-density', (e) => {
    const coordinates = e.lngLat;
    const properties = e.features[0].properties;
    
    // Store selected city for demographics chart
    selectedCity = properties;
    
    // Format the popup content
    const popupContent = formatPopupContent(properties);
    
    popup
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
    
    // Fix accessibility issues
    fixPopupAccessibility();
    
    // Update demographics chart if it's active
    if (document.getElementById('chart-demographics-btn').classList.contains('active')) {
      updateChart('demographics');
    }
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
          <div class="key-item" data-range="0-5000">
            <div class="key-color" style="background: #53D6FC;"></div>
            <div class="key-label">0 - 5K</div>
          </div>
          <div class="key-item" data-range="5000-25000">
            <div class="key-color" style="background: #02C7FC;"></div>
            <div class="key-label">5K - 25K</div>
          </div>
          <div class="key-item" data-range="25000-100000">
            <div class="key-color" style="background: #018CB5;"></div>
            <div class="key-label">25K - 100K</div>
          </div>
          <div class="key-item" data-range="100000-300000">
            <div class="key-color" style="background: #d79ff7;"></div>
            <div class="key-label">100K - 300K</div>
          </div>
          <div class="key-item" data-range="300000-600000">
            <div class="key-color" style="background: #a654db;"></div>
            <div class="key-label">300K - 600K</div>
          </div>
          <div class="key-item" data-range="600000+">
            <div class="key-color" style="background: #7123a8;"></div>
            <div class="key-label">600K+</div>
          </div>
          <div class="key-item" data-range="cdp">
            <div class="key-color" style="background: #808080;"></div>
            <div class="key-label">CDP</div>
          </div>
        </div>
      </div>
    `;
    
    // Add to the map container
    const mapContainer = map.getContainer();
    mapContainer.appendChild(layerControl);
    
    // Add event listeners to initial key items
    addKeyItemEventListeners(layerControl);

    // Add chart toggle button
    const chartToggle = document.createElement('button');
    chartToggle.className = 'chart-toggle';
    chartToggle.textContent = '📊 Show Charts';
    mapContainer.appendChild(chartToggle);

    // Chart toggle functionality
    chartToggle.addEventListener('click', function() {
      const chartPane = document.getElementById('chart-pane');
      const isExpanded = chartPane.classList.contains('expanded');
      
      if (isExpanded) {
        chartPane.classList.remove('expanded');
        chartToggle.textContent = '📊 Show Charts';
      } else {
        chartPane.classList.add('expanded');
        chartToggle.textContent = '📊 Hide Charts';
        // Always ensure chartData is set and show population chart
        if (!chartData) {
          chartData = geojson;
        }
        updateChart('population');
      }
    });

    // Chart control functionality
    document.getElementById('chart-population-btn').addEventListener('click', function() {
      document.getElementById('chart-population-btn').classList.add('active');
      document.getElementById('chart-density-btn').classList.remove('active');
      document.getElementById('chart-demographics-btn').classList.remove('active');
      updateChart('population');
    });

    document.getElementById('chart-density-btn').addEventListener('click', function() {
      document.getElementById('chart-density-btn').classList.add('active');
      document.getElementById('chart-population-btn').classList.remove('active');
      document.getElementById('chart-demographics-btn').classList.remove('active');
      updateChart('density');
    });

    document.getElementById('chart-demographics-btn').addEventListener('click', function() {
      document.getElementById('chart-demographics-btn').classList.add('active');
      document.getElementById('chart-population-btn').classList.remove('active');
      document.getElementById('chart-density-btn').classList.remove('active');
      updateChart('demographics');
    });

    // Function to update color key
    function updateColorKey(type, layerControl) {
      currentKeyType = type;
      const keyHeader = layerControl.querySelector('.key-header');
      const keyItems = layerControl.querySelector('.key-items');
      
      if (type === 'population') {
        keyHeader.textContent = 'Population';
        keyItems.innerHTML = `
          <div class="key-item" data-range="0-5000">
            <div class="key-color" style="background: ${COLORS.VERY_LIGHT};"></div>
            <div class="key-label">0 - 5K</div>
          </div>
          <div class="key-item" data-range="5000-25000">
            <div class="key-color" style="background: ${COLORS.LIGHT};"></div>
            <div class="key-label">5K - 25K</div>
          </div>
          <div class="key-item" data-range="25000-100000">
            <div class="key-color" style="background: ${COLORS.MEDIUM};"></div>
            <div class="key-label">25K - 100K</div>
          </div>
          <div class="key-item" data-range="100000-300000">
            <div class="key-color" style="background: ${COLORS.LIGHT_PURPLE};"></div>
            <div class="key-label">100K - 300K</div>
          </div>
          <div class="key-item" data-range="300000-600000">
            <div class="key-color" style="background: ${COLORS.MEDIUM_PURPLE};"></div>
            <div class="key-label">300K - 600K</div>
          </div>
          <div class="key-item" data-range="600000+">
            <div class="key-color" style="background: ${COLORS.DARK_PURPLE};"></div>
            <div class="key-label">600K+</div>
          </div>
          <div class="key-item" data-range="cdp">
            <div class="key-color" style="background: ${COLORS.CDP};"></div>
            <div class="key-label">CDP</div>
          </div>
        `;
      } else {
        keyHeader.textContent = 'Density (per sq mile)';
        keyItems.innerHTML = `
          <div class="key-item" data-range="0-100">
            <div class="key-color" style="background: ${COLORS.VERY_LIGHT};"></div>
            <div class="key-label">0 - 100</div>
          </div>
          <div class="key-item" data-range="100-500">
            <div class="key-color" style="background: ${COLORS.LIGHT};"></div>
            <div class="key-label">100 - 500</div>
          </div>
          <div class="key-item" data-range="500-1000">
            <div class="key-color" style="background: ${COLORS.MEDIUM};"></div>
            <div class="key-label">500 - 1K</div>
          </div>
          <div class="key-item" data-range="1000-2000">
            <div class="key-color" style="background: ${COLORS.LIGHT_PURPLE};"></div>
            <div class="key-label">1K - 2K</div>
          </div>
          <div class="key-item" data-range="2000-5000">
            <div class="key-color" style="background: ${COLORS.MEDIUM_PURPLE};"></div>
            <div class="key-label">2K - 5K</div>
          </div>
          <div class="key-item" data-range="5000+">
            <div class="key-color" style="background: ${COLORS.DARK_PURPLE};"></div>
            <div class="key-label">5K+</div>
          </div>
          <div class="key-item" data-range="cdp">
            <div class="key-color" style="background: ${COLORS.CDP};"></div>
            <div class="key-label">CDP</div>
          </div>
        `;
      }
      
      // Add event listeners to key items
      addKeyItemEventListeners(layerControl);
    }

    // Layer switching functionality
    document.getElementById('population-btn').addEventListener('click', function() {
      clearAllHighlights();
      clickedKeyItem = null; // Clear clicked item when switching tabs
      updateColorKey('population', layerControl);
      map.setLayoutProperty('city-fills-population', 'visibility', 'visible');
      map.setLayoutProperty('city-fills-density', 'visibility', 'none');
      
      // Update border colors to match population layer
      map.setPaintProperty('city-borders', 'line-color', [
        'case',
        ['any', ['in', 'CDP', ['get', 'NAMELSAD']]],
        COLORS.CDP, // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Total_Pop'],
          0, COLORS.VERY_LIGHT,      // Very light blue for small cities
          5000, COLORS.LIGHT,        // Light blue
          25000, COLORS.MEDIUM,      // Medium light blue
          100000, COLORS.LIGHT_PURPLE, // Light purple
          300000, COLORS.MEDIUM_PURPLE, // Medium purple
          600000, COLORS.DARK_PURPLE  // Dark purple
        ]
      ]);
      
      document.getElementById('population-btn').classList.add('active');
      document.getElementById('density-btn').classList.remove('active');
    });

    document.getElementById('density-btn').addEventListener('click', function() {
      clearAllHighlights();
      clickedKeyItem = null; // Clear clicked item when switching tabs
      updateColorKey('density', layerControl);
      map.setLayoutProperty('city-fills-population', 'visibility', 'none');
      map.setLayoutProperty('city-fills-density', 'visibility', 'visible');
      
      // Update border colors to match density layer
      map.setPaintProperty('city-borders', 'line-color', [
        'case',
        ['any', ['in', 'CDP', ['get', 'NAMELSAD']]],
        COLORS.CDP, // Gray for CDPs
        [
          'interpolate',
          ['linear'],
          ['get', 'Pop_Density'],
          0, COLORS.VERY_LIGHT,      // Very light blue for low density
          100, COLORS.LIGHT,         // Light blue
          500, COLORS.MEDIUM,        // Medium light blue
          1000, COLORS.LIGHT_PURPLE, // Light purple
          2000, COLORS.MEDIUM_PURPLE, // Medium purple
          5000, COLORS.DARK_PURPLE   // Dark purple
        ]
      ]);
      
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


