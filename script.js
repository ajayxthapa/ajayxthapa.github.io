// --- MINIMAL DEBUGGING SCRIPT ---

// 1. Initialize map
const map = L.map('map').setView([20, 10], 3);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// 2. Try to fetch ONE data file
console.log("Attempting to fetch GeoJSON data...");

fetch('data/points-of-interest.geojson')
    .then(response => {
        // Check if the server responded with an error (like 404 Not Found)
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // If the data was fetched and parsed correctly, this will run
        console.log("GeoJSON data loaded successfully!");
        L.geoJSON(data).addTo(map);
        alert("SUCCESS! The data file was loaded and markers should be visible.");
    })
    .catch(error => {
        // If ANY part of the above process fails, this will run
        console.error('CRITICAL ERROR:', error);
        alert(`ERROR: Could not load the GeoJSON data file.\n\nCheck the console (F12) for a '404 Not Found' error.\n\nDetails: ${error}`);
    });