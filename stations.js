
document.addEventListener('DOMContentLoaded', () => {
    const findStationsBtn = document.getElementById("findStationsBtn");
    if (findStationsBtn) {
        findStationsBtn.addEventListener("click", handleFindStationsClick);
    }
    
    const infoContainer = document.getElementById("station-info-container");
    if (infoContainer) {
        infoContainer.addEventListener('click', handleInfoContainerClick);
    }
});

const OCM_API_KEY = "9e6571b0-cf6b-42db-a355-8228b1092ea9";

let map = null;
let stationMarkers = {};
let userLocation = null;
let routingControl = null;
let selectedMarker = null;
let currentStations = []; 

// --- Custom Marker Icons ---
const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const destinationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [35, 50], iconAnchor: [17, 50], popupAnchor: [1, -42], shadowSize: [50, 50]
});


function handleInfoContainerClick(event) {
    const clickedElement = event.target;
    const backButton = clickedElement.closest('#back-to-list');
    if (backButton) {
        displayStationList(currentStations);
        return;
    }
    const stationItem = clickedElement.closest('[data-station-id]');
    if (stationItem) {
        const stationId = parseInt(stationItem.dataset.stationId, 10);
        const station = currentStations.find(s => s.ID === stationId);
        if (station) {
            showStationDetailsAndRoute(station);
        }
    }
}

function handleFindStationsClick() {
    const findStationsBtn = document.getElementById("findStationsBtn");
    const statusMessageDiv = document.getElementById("status-message");
    findStationsBtn.disabled = true;
    findStationsBtn.textContent = "LOCATING...";
    
    statusMessageDiv.innerHTML = `<p class="text-gray-400">Getting your location...</p>`;
    if (!navigator.geolocation) {
        statusMessageDiv.innerHTML = `<p class="text-red-400">Geolocation is not supported by your browser.</p>`;
        findStationsBtn.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            userLocation = L.latLng(latitude, longitude); 
            if (!map) { 
                initializeMap(latitude, longitude);
            }
            fetchAndDisplayStations(latitude, longitude);
            findStationsBtn.disabled = false;
            findStationsBtn.textContent = "Find Stations";
        },
        () => {
            statusMessageDiv.innerHTML = `<p class="text-red-400">Unable to retrieve your location. Please enable location services.</p>`;
            findStationsBtn.disabled = false;
            findStationsBtn.textContent = "Find Stations";
        }
    );
}

function initializeMap(lat, lon) {
    if (map) map.remove();
    map = L.map("map").setView([lat, lon], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.marker([lat, lon], { icon: blueIcon }).addTo(map).bindPopup("<b>Your Location</b>");
}

async function fetchAndDisplayStations(lat, lon) {
    const statusMessageDiv = document.getElementById("status-message");
    const selectedChargerTypes = Array.from(document.querySelectorAll('input[name="charger-type"]:checked')).map(cb => cb.value);
    
    statusMessageDiv.innerHTML = `<div class="flex justify-center items-center space-x-3"><div class="css-loader !w-5 !h-5"></div><span class="text-gray-300">Finding the nearest stations...</span></div>`;
    
    clearMapAndList();

    const apiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&maxresults=500&countrycode=IN&key=${OCM_API_KEY}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API responded with status: ${response.status}`);
        const allStations = await response.json();
        
        const operationalStations = allStations.filter(station => station.StatusType?.IsOperational === true);

        let filteredStations = operationalStations;

        if (selectedChargerTypes.length > 0) {
            filteredStations = operationalStations.filter(station => {
                return station.Connections.some(connection => 
                    selectedChargerTypes.includes(String(connection.ConnectionTypeID))
                );
            });
        }

        if (filteredStations.length === 0) {
            statusMessageDiv.innerHTML = `<p class="text-yellow-400">No operational stations found with the selected filters. Please try different charger types.</p>`;
            return;
        }
        
        filteredStations.sort((a, b) => a.AddressInfo.Distance - b.AddressInfo.Distance);
        currentStations = filteredStations.slice(0, 10);

        statusMessageDiv.innerHTML = `<p class="text-green-400">✓ Displaying the ${currentStations.length} nearest operational stations.</p>`;
        
        addStationMarkers(currentStations);
        displayStationList(currentStations);

        if (currentStations.length > 0) {
            const stationBounds = L.latLngBounds(currentStations.map(s => [s.AddressInfo.Latitude, s.AddressInfo.Longitude]));
            map.fitBounds(stationBounds.pad(0.2));
        }

    } catch (error) {
        console.error("Error fetching charging stations:", error);
        statusMessageDiv.innerHTML = `<p class="text-red-400">Could not fetch charging station data. Please try again.</p>`;
    }
}

function clearMapAndList() {
    Object.values(stationMarkers).forEach(marker => map.removeLayer(marker));
    stationMarkers = {};
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    document.getElementById('station-info-container').innerHTML = '';
    if (selectedMarker) selectedMarker = null;
}

function addStationMarkers(stations) {
    stations.forEach((station) => {
        const { ID, AddressInfo } = station;
        if (!AddressInfo.Latitude || !AddressInfo.Longitude) return;

        const marker = L.marker([AddressInfo.Latitude, AddressInfo.Longitude], { icon: greenIcon })
            .addTo(map)
            .on('click', () => {
                showStationDetailsAndRoute(station);
            });
            
        stationMarkers[ID] = marker;
    });
}

function displayStationList(stations) {
    const container = document.getElementById('station-info-container');
    const listHtml = stations.map(station => {
        const { ID, AddressInfo } = station;
        return `
            <div data-station-id="${ID}" class="p-4 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors border-l-4 border-green-500 mb-4">
                <h4 class="font-bold text-white">${AddressInfo.Title}</h4>
                <p class="text-sm text-gray-400">${AddressInfo.AddressLine1 || 'Address not available'}</p>
                <p class="text-sm font-semibold mt-1">${AddressInfo.Distance.toFixed(2)} km away</p>
            </div>`;
    }).join('');
    
    container.innerHTML = `<div class="space-y-4">${listHtml}</div>`;
}

function showStationDetailsAndRoute(station) {
    const { ID } = station;
    
    document.querySelectorAll('[data-station-id]').forEach(item => item.classList.remove('bg-green-900/50', 'border-green-400'));
    const listItem = document.querySelector(`[data-station-id="${ID}"]`);
    if(listItem) listItem.classList.add('bg-green-900/50', 'border-green-400');
    
    displayStationDetails(station);
    showRoute(station);
}

function displayStationDetails(station) {
    const container = document.getElementById('station-info-container');
    const { AddressInfo, Connections, StatusType } = station;

    const connectionsHtml = Connections.map(conn => `
        <div class="p-3 bg-gray-700 rounded-lg">
            <p class="font-bold text-white">${conn.ConnectionType.Title}</p>
            <p class="text-sm text-gray-400">${conn.Level?.Title || ''} - ${conn.PowerKW || 'N/A'} kW</p>
        </div>`).join('');

    container.innerHTML = `
        <div class="animate-fade-in">
            <button id="back-to-list" class="mb-4 text-sm text-green-400 hover:underline">&larr; Back to List</button>
            <h3 class="text-2xl font-bold text-white">${AddressInfo.Title}</h3>
            <p class="text-md text-gray-400 mt-1">${AddressInfo.AddressLine1}, ${AddressInfo.Town}, ${AddressInfo.StateOrProvince}</p>
            <div class="mt-4 p-4 bg-gray-900 rounded-lg">
                <p><strong>Distance:</strong> ${AddressInfo.Distance.toFixed(2)} km</p>
                <p><strong>Status:</strong> <span class="font-semibold text-green-400">${StatusType?.Title}</span></p>
            </div>
            <h4 class="text-lg font-bold mt-6 mb-3">Available Connectors</h4>
            <div class="space-y-3">${connectionsHtml}</div>
        </div>
    `;
}

function showRoute(station) {
    if (!userLocation || !map) return;
    const destination = L.latLng(station.AddressInfo.Latitude, station.AddressInfo.Longitude);
    const marker = stationMarkers[station.ID];
    
    if (selectedMarker) selectedMarker.setIcon(greenIcon);
    if (marker) {
        marker.setIcon(destinationIcon);
        selectedMarker = marker;
    }
    
    if (routingControl) map.removeControl(routingControl);

    routingControl = L.Routing.control({
        waypoints: [ userLocation, destination ],
        routeWhileDragging: false,
        show: false, 
        addWaypoints: false,
        lineOptions: { styles: [{ color: '#FF0000', opacity: 0.8, weight: 6 }] },
        createMarker: () => null
    }).addTo(map);

    if (marker) {
        map.panTo(marker.getLatLng());
        marker.openPopup();
    }
}