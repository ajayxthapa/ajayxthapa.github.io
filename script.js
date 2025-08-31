// 1. Initialize the map and set its view to a chosen geographical coordinates and a zoom level
const map = L.map('map').setView([20, 0], 2); // Centered roughly to see the world, zoom level 2

// 2. Add a tile layer (the basemap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// 3. Fetch your GeoJSON data and add it to the map
fetch('data/locations.geojson')
    .then(response => response.json())
    .then(data => {
        // For each feature in the GeoJSON, add a popup
        L.geoJSON(data, {
            onEachFeature: function (feature, layer) {
                // Check if the feature has properties and a name
                if (feature.properties && feature.properties.name) {
                    // Create the popup content with HTML
                    const popupContent = `
                        <strong>${feature.properties.name}</strong><br>
                        ${feature.properties.description}
                    `;
                    layer.bindPopup(popupContent);
                }
            }
        }).addTo(map);
    })
    .catch(error => console.error('Error loading GeoJSON data:', error));