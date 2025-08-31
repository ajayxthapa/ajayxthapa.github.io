// ====== MAP INITIALIZATION ======
const map = L.map('map').setView([20, 10], 3);

// ====== BASEMAPS ======
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map); // Default basemap

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// ====== GEOJSON DATA LAYERS ======
// An empty layer group to hold our choropleth layer
const choroplethLayer = L.layerGroup().addTo(map);

// --- Custom Markers Layer ---
const customIcon = L.icon({
    iconUrl: 'icons/location-pin.png',
    iconSize: [32, 32], // size of the icon
    iconAnchor: [16, 32], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -32] // point from which the popup should open relative to the iconAnchor
});

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

// --- Heatmap Layer ---
const heatLayer = L.heatLayer([], { radius: 25, blur: 15 });

// --- Fetch data for points and heatmap ---
fetch('data/points-of-interest.geojson')
    .then(response => response.json())
    .then(data => {
        pointsLayer.addData(data);
        const heatData = data.features.map(feature => {
            // Heatmap needs [lat, lng, intensity]
            return [feature.geometry.coordinates[1], feature.geometry.coordinates[0], 1]; 
        });
        heatLayer.setLatLngs(heatData);
    });

// --- Choropleth Layer ---
// Color function
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

// Style function
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

// Fetch world population data
fetch('data/world-population.geojson')
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, { style: style }).addTo(choroplethLayer);
    });

// --- Choropleth Legend ---
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [0, 10000000, 20000000, 50000000, 100000000, 200000000, 500000000, 1000000000];
    div.innerHTML += '<strong>Population</strong><br>';
    // loop through our density intervals and generate a label with a colored square for each interval
    for (let i = 0; i < grades.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
            grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
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
    "Points of Interest": pointsLayer,
    "Population Density": choroplethLayer,
    "Heatmap": heatLayer
};

L.control.layers(baseMaps, overlayMaps).addTo(map);