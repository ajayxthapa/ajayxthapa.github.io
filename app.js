// ------------------------------------------------------------------
// PASTE YOUR CESIUM ION ACCESS TOKEN HERE
// ------------------------------------------------------------------
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1NTllYmQ4ZS1kM2M4LTRiNTYtOGQ3MC1hZTE3OTE2NmUzOWQiLCJpZCI6MzM2ODM1LCJpYXQiOjE3NTY2MDExNDd9.qsQLDODpYfoBI5YicdogyShfjJZpNdxEGFm8yv5D7K4';

// Initialize the Cesium Viewer in the 'cesiumContainer' div.
const viewer = new Cesium.Viewer('cesiumContainer', {
    shouldAnimate: true, // Keep the simulation clock running
    selectionIndicator: false,
    baseLayerPicker: false,
    infoBox: true,
});

// Hide the default Cesium UI elements for a cleaner look
viewer.bottomContainer.style.display = "none";
viewer.animation.container.style.display = "none";
viewer.timeline.container.style.display = "none";

// URL for the TLE data for Earth Resources satellites from CelesTrak
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle';

// An array to store our satellite data (satrec object and Cesium entity)
const satellites = [];
const loadingOverlay = document.getElementById('loadingOverlay');

// Asynchronous function to load and initialize satellites
async function loadSatellites() {
    try {
        // Fetch the TLE data from CelesTrak
        const response = await fetch(TLE_URL);
        const tleData = await response.text();
        const tleLines = tleData.split('\n');

        // Process the TLE data
        for (let i = 0; i < tleLines.length - 2; i += 3) {
            const name = tleLines[i].trim();
            const tleLine1 = tleLines[i + 1];
            const tleLine2 = tleLines[i + 2];

            if (!name || !tleLine1 || !tleLine2) continue;

            // Create a satellite record using satellite.js
            const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

            // Add a corresponding entity to the Cesium viewer
            const entity = viewer.entities.add({
                id: name,
                position: new Cesium.Cartesian3(), // Initial position, will be updated
                point: {
                    pixelSize: 6,
                    color: Cesium.Color.AQUA,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 1
                },
                label: {
                    text: name,
                    font: '12pt monospace',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -12)
                },
                description: `<h3>${name}</h3><p>Real-time orbital data.</p>`
            });

            satellites.push({ satrec, entity });
        }
    } catch (error) {
        console.error("Error loading satellite data:", error);
        loadingOverlay.innerText = "Failed to load satellite data.";
    } finally {
        // Hide the loading overlay once done
        loadingOverlay.style.display = 'none';
    }
}

// Function to update satellite positions
function updateSatellitePositions() {
    const now = new Date(); // Get current time

    satellites.forEach(sat => {
        // Propagate satellite position using satellite.js
        const positionAndVelocity = satellite.propagate(sat.satrec, now);
        const positionEci = positionAndVelocity.position;

        if (!positionEci) return;

        // Convert Earth-Centered Inertial (ECI) coordinates to Earth-Centered Fixed (ECF)
        const gmst = satellite.gstime(now);
        const positionEcf = satellite.eciToEcf(positionEci, gmst);

        // Convert ECF to a Cesium Cartesian3 coordinate
        // satellite.js provides coordinates in kilometers, Cesium needs meters
        const cesiumPosition = new Cesium.Cartesian3(
            positionEcf.x * 1000,
            positionEcf.y * 1000,
            positionEcf.z * 1000
        );

        // Update the Cesium entity's position
        sat.entity.position = cesiumPosition;
    });
}

// Start loading the satellites
loadSatellites();

// Set up the animation loop to update positions on each frame
viewer.clock.onTick.addEventListener(updateSatellitePositions);