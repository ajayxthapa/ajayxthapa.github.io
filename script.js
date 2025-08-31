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

// ====== GEOJSON DATA LAYERS ======

// --- 1. Custom Markers Layer ---
// Define a custom icon
const customIcon = L.icon({
    iconUrl: 'icons/location-pin.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Create a layer for the points of interest using the custom icon
const pointsLayer = L.geoJSON(null, {
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: customIcon });
    },
    onEachFeature: function (feature, layer) {
        if (feature.properties && feature.properties.name) {
            layer.bindPopup(`<strong>${feature.properties.name}</strong>`);
        }
    }
});

// --- 2. Heatmap Layer ---
const heatLayer = L.heatLayer([], { radius: 25, blur: 15 });

// --- Fetch data for points and heatmap (they use the same data source) ---
fetch('data/points-of-interest.geojson')
    .then(response => response.json())
    .then(data => {
        // Add GeoJSON data to the points layer
        pointsLayer.addData(data);
        
        // Prepare data for the heatmap
        const heatData = data.features.map(feature => {
            // Heatmap needs [latitude, longitude, intensity]
            return [feature.geometry.coordinates[1], feature.geometry.coordinates[0], 1.0]; 
        });
        heatLayer.setLatLngs(heatData);
    })
    .catch(error => console.error('Error loading points of interest data:', error));

// --- 3. Choropleth Layer ---
// An empty layer group to hold the choropleth, added to map by default
const choroplethLayer = L.layerGroup().addTo(map);

// Color function based on population
function getColor(d) {
    return d > 1000000000 ? '#800026' :
           d > 500000000  ? '#BD0026' :
           d > 200000000  ? '#E31A1C' :
           d > 100000000  ? '#FC4E2A' :
           d > 50000000   ? '#FD8D3C' :
           d > 20000000   ? '#FEB24C' :
           d > 10000000   ? '#FED976' :
                              '#FFEDA0';
}

// Style function for country polygons
function style(feature) {
    return {
        fillColor: getColor(feature.properties.pop_est),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// Fetch world population data and add to the choropleth layer
fetch('data/world-population.geojson')
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, { style: style }).addTo(choroplethLayer);
    })
    .catch(error => console.error('Error loading world population data:', error));

// --- 4. Choropleth Legend ---
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [0, 10000000, 20000000, 50000000, 100000000, 200000000, 500000000, 1000000000];
    div.innerHTML += '<strong>Population</strong><br>';
    for (let i = 0; i < grades.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
            (grades[i] / 1000000) + (grades[i + 1] ? 'M &ndash; ' + (grades[i + 1] / 1000000) + 'M<br>' : 'M+');
    }
    return div;
};
legend.addTo(map);

// ====== LAYER CONTROL ======
const baseMaps = {
    "OpenStreetMap": osm,
    "Satellite": satellite
};

const overlayMaps = {
    "Population": choroplethLayer,
    "Points of Interest": pointsLayer,
    "Heatmap": heatLayer
};

L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);