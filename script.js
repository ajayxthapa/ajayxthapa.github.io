// ====== MAP INITIALIZATION ======
// Initialize the map and set its view to a global perspective
const map = L.map('map').setView([20, 10], 3);

// ====== BASEMAPS ======
// OpenStreetMap layer
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map); // Add to map by default

// Satellite layer
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});


// ====== DATA LAYERS & CONTROLS SETUP ======

// --- Create Layer Groups ---
// We create empty layers first and will add data to them later.
const pointsLayer = L.geoJSON(null);
const heatLayer = L.heatLayer([], { radius: 25, blur: 15 });
const choroplethLayer = L.geoJSON(null);


// --- 1. Fetch Points of Interest Data (for markers and heatmap) ---
// Make sure the path 'data/points-of-interest.geojson' is correct!
fetch('data/points-of-interest.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok for points data');
        }
        return response.json();
    })
    .then(data => {
        // Define a custom icon for markers
        const customIcon = L.icon({
            iconUrl: 'icons/location-pin.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        // Add point data to the pointsLayer with custom icons and popups
        pointsLayer.addData(data);
        pointsLayer.eachLayer(layer => {
            layer.setIcon(customIcon);
            if (layer.feature.properties && layer.feature.properties.name) {
                layer.bindPopup(`<strong>${layer.feature.properties.name}</strong>`);
            }
        });
        
        // Prepare data for the heatmap
        const heatData = data.features.map(feature => {
            return [feature.geometry.coordinates[1], feature.geometry.coordinates[0], 1.0]; // lat, lng, intensity
        });
        heatLayer.setLatLngs(heatData);
    })
    .catch(error => console.error('Error loading Points of Interest data:', error));


// --- 2. Fetch World Population Data (for choropleth) ---
// Make sure the path 'data/world-population.geojson' is correct!
fetch('data/world-population.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok for population data');
        }
        return response.json();
    })
    .then(data => {
        function getColor(d) {
            return d > 1000000000 ? '#800026' : d > 500000000 ? '#BD0026' : d > 200000000 ? '#E31A1C' : d > 100000000 ? '#FC4E2A' : d > 50000000  ? '#FD8D3C' : d > 20000000  ? '#FEB24C' : d > 10000000  ? '#FED976' : '#FFEDA0';
        }
        function style(feature) {
            return {
                fillColor: getColor(feature.properties.pop_est),
                weight: 1,
                opacity: 1,
                color: 'white',
                dashArray: '3',
                fillOpacity: 0.7
            };
        }
        // Add population data to the choropleth layer
        choroplethLayer.addData(data);
        choroplethLayer.setStyle(style);
    })
    .catch(error => console.error('Error loading World Population data:', error));


// --- 3. Create Legend ---
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [0, 10000000, 50000000, 100000000, 200000000, 500000000, 1000000000];
    div.innerHTML += '<strong>Population</strong><br>';
    for (let i = 0; i < grades.length; i++) {
        div.innerHTML += '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' + (grades[i] / 1000000) + (grades[i + 1] ? 'M &ndash; ' + (grades[i + 1] / 1000000) + 'M<br>' : 'M+');
    }
    return div;
};
legend.addTo(map);


// ====== LAYER CONTROL ======
// Add all the layers to the layer control.
const baseMaps = {
    "OpenStreetMap": osm,
    "Satellite": satellite
};

const overlayMaps = {
    "Population": choroplethLayer,
    "Points of Interest": pointsLayer,
    "Heatmap": heatLayer
};

// Add default layers to map
choroplethLayer.addTo(map);

L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);