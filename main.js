// Initialize map
const map = L.map('map', {
    center: [39.647567816409705, -76.1723829821835],
    zoom: 17,
    minZoom: 15,
    maxZoom: 23
});

// Base layers
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 15,
    maxNativeZoom: 19,
    maxZoom: 23,
});

const googlemaps = L.tileLayer('http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', {
    attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
    minZoom: 15,
    maxNativeZoom: 19,
    maxZoom: 23,
});

// Custom XYZ layers - using TMS option for tile scheme compatibility
const orthoLayer = L.tileLayer('./orthowebp/{z}/{x}/{y}.webp', {
    tms: true,
    minZoom: 15,
    maxNativeZoom: 19,
    maxZoom: 23,
    attribution: 'Ortho Imagery',
    thumbnail: './public/OrthoThumb.png',
    bounds: L.latLngBounds(
        L.latLng(39.64, -76.18),
        L.latLng(39.66, -76.16)
    )
});

const topoLayer = L.tileLayer('./topowebp/{z}/{x}/{y}.webp', {
    tms: true,
    minZoom: 15,
    maxNativeZoom: 18,
    maxZoom: 23,
    attribution: 'Topo Map',
    thumbnail: './public/TopoThumb.png',
    bounds: L.latLngBounds(
        L.latLng(39.64, -76.18),
        L.latLng(39.66, -76.16)
    )
});

// Add canopy layer
const canopyLayer = L.tileLayer('./canopywebp/{z}/{x}/{y}.webp', {
    tms: true,
    minZoom: 15,
    maxNativeZoom: 17,
    maxZoom: 23,
    attribution: 'Canopy Map',
    thumbnail: './public/CanopyThumb.png',
    bounds: L.latLngBounds(
        L.latLng(39.64, -76.18),
        L.latLng(39.66, -76.16)
    )
});

// Property boundary layer - create empty layer first
const boundaryLayer = L.geoJSON(null, {
    style: {
        color: "#ec00ff",
        weight: 3,
        opacity: 1.0,
        fillColor: "#ff7800",
        fillOpacity: 0
    }
});

// Load GeoJSON property boundary
const loadGeoJSON = () => {
    // Use XMLHttpRequest which works better with local files
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'RamblewoodBoundary.geojson', true);
    
    xhr.onload = function() {
        if (xhr.status === 200) {
            let data;
            try {
                data = JSON.parse(xhr.responseText);
                console.log("GeoJSON data loaded:", data);
                
                // The GeoJSON is in EPSG:3857 (Web Mercator) and needs to be converted to WGS84 (EPSG:4326)
                // Create a function to convert coordinates
                function projectToWGS84(x, y) {
                    // Simple conversion from Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)
                    const lng = (x * 180) / 20037508.34;
                    const lat = (Math.atan(Math.exp(y * Math.PI / 20037508.34)) * 360 / Math.PI) - 90;
                    return [lng, lat];
                }
                
                // Clone the GeoJSON data to avoid modifying the original
                const convertedData = JSON.parse(JSON.stringify(data));
                
                // Transform coordinates if the CRS is EPSG:3857
                if (data.crs && data.crs.properties && data.crs.properties.name === "urn:ogc:def:crs:EPSG::3857") {
                    console.log("Converting EPSG:3857 to WGS84");
                    
                    convertedData.features.forEach(feature => {
                        if (feature.geometry.type === "MultiPolygon") {
                            feature.geometry.coordinates.forEach(polygon => {
                                polygon.forEach(ring => {
                                    for (let i = 0; i < ring.length; i++) {
                                        const [x, y] = ring[i];
                                        ring[i] = projectToWGS84(x, y);
                                    }
                                });
                            });
                        }
                    });
                    
                    // Remove CRS property since we've converted to WGS84
                    delete convertedData.crs;
                }
                
                // Add the converted data to the layer
                boundaryLayer.addData(convertedData);
                
                // Add the boundary layer after all map layers
                boundaryLayer.addTo(map);
                
                // Fit map to boundary
                try {
                    const bounds = boundaryLayer.getBounds();
                    console.log("Boundary bounds:", bounds);
                    map.fitBounds(bounds);
                } catch (e) {
                    console.error('Error fitting to bounds:', e);
                    // Fallback to default center and zoom if we can't fit bounds
                }
            } catch (e) {
                console.error('Error parsing GeoJSON:', e);
                showError('Error parsing GeoJSON: ' + e.message);
            }
        } else {
            console.error('Error loading GeoJSON. Status:', xhr.status);
            showError('Error loading GeoJSON. Status: ' + xhr.status);
        }
    };
    
    xhr.onerror = function() {
        console.error('Error loading GeoJSON. Network error.');
        showError('Network error when loading GeoJSON. Try running on a local server.');
        
        // Show help message for local development
        const helpInfo = L.control({position: 'bottomleft'});
        helpInfo.onAdd = function() {
            const div = L.DomUtil.create('div', 'info');
            div.innerHTML = '<strong>Tip:</strong> For local development, try starting a simple HTTP server:<br>' +
                           'Run: <code>python -m http.server</code> in the project directory<br>' +
                           'Then open: <a href="http://localhost:8000" target="_blank">http://localhost:8000</a>';
            return div;
        };
        helpInfo.addTo(map);
    };
    
    xhr.send();
};

// Helper function to show errors on the map
const showError = (message) => {
    const errorInfo = L.control({position: 'bottomleft'});
    errorInfo.onAdd = function() {
        const div = L.DomUtil.create('div', 'info');
        div.innerHTML = '<strong>Error loading boundary:</strong> ' + message;
        return div;
    };
    errorInfo.addTo(map);
};

// Load the GeoJSON data
loadGeoJSON();

// Set up layers objects
const baseMaps = {
    "OpenStreetMap": osm,
    "Google Maps": googlemaps
};

const overlayMaps = {
    "Canopy Map": canopyLayer,
    "Topographic Map": topoLayer,
    "Orthographic Imagery": orthoLayer
};

// Add OSM as default base layer
osm.addTo(map);

// Add topo layer by default instead of ortho with 80% opacity
topoLayer.setOpacity(0.8);
topoLayer.addTo(map);

// Add title
const titleControl = L.control({position: 'topright'});
titleControl.onAdd = function() {
    const div = L.DomUtil.create('div', 'title-control');
    div.innerHTML = '<div class="title-text">VibeForest Viewer</div>';
    return div;
};
titleControl.addTo(map);

// Sidebar functionality
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const osmButton = document.getElementById('osm-button');
const cartoButton = document.getElementById('carto-button');
const overlayLayerList = document.getElementById('overlay-layer-list');

// Function to manage layer ordering
function reorderLayers() {
    // First remove all layers
    for (const [name, layer] of Object.entries(overlayMaps)) {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    }
    map.removeLayer(boundaryLayer);
    
    // Get current base layer
    const currentBaseLayer = map.hasLayer(osm) ? osm : googlemaps;
    
    // Add layers in correct order
    // 1. Base layer (always at bottom)
    currentBaseLayer.addTo(map);
    
    // 2. Overlay layers in order from GUI
    const layerItems = overlayLayerList.querySelectorAll('.layer-item');
    for (let i = layerItems.length - 1; i >= 0; i--) {
        const layerName = layerItems[i].dataset.layerId;
        const layer = overlayMaps[layerName];
        const toggleSwitch = layerItems[i].querySelector('.toggle-switch');
        
        if (toggleSwitch.classList.contains('active')) {
            map.addLayer(layer);
        }
    }
    
    // 3. Boundary layer (always on top)
    map.addLayer(boundaryLayer);
}

// Base layer buttons functionality
osmButton.addEventListener('click', () => {
    // Switch to OSM
    googlemaps.remove();
    osm.addTo(map);
    
    // Update button states
    osmButton.classList.add('active');
    cartoButton.classList.remove('active');
    
    // Reorder layers to maintain proper z-index
    reorderLayers();
});

cartoButton.addEventListener('click', () => {
    // Switch to Google Maps
    osm.remove();
    googlemaps.addTo(map);
    
    // Update button states
    cartoButton.classList.add('active');
    osmButton.classList.remove('active');
    
    // Reorder layers to maintain proper z-index
    reorderLayers();
});

// Toggle sidebar and hide/show burger button
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.add('expanded');
    sidebarToggle.classList.add('hidden');
    
    // Position sidebar properly
    positionSidebar();
    
    // Adjust content height to prevent scrolling if possible
    adjustSidebarContentHeight();
});

sidebarClose.addEventListener('click', () => {
    sidebar.classList.remove('expanded');
    
    // Wait for the transition to complete before showing the toggle button
    setTimeout(() => {
        sidebarToggle.classList.remove('hidden');
    }, 300);
});

// Function to dynamically adjust sidebar height based on content
function adjustSidebarContentHeight() {
    if (window.innerWidth <= 600) {
        // On mobile, use viewport height units for better iOS compatibility
        const maxHeight = window.innerHeight * 0.8; // 80% of viewport height
        sidebar.style.height = 'auto';
        sidebar.style.maxHeight = `${maxHeight}px`;
        sidebar.style.overflowY = 'auto';
        
        // Force iOS to recalculate height
        sidebar.style.display = 'none';
        sidebar.offsetHeight; // Force reflow
        sidebar.style.display = 'block';
    } else {
        // On desktop, ensure the sidebar shows all content
        sidebar.style.height = 'auto';
        sidebar.style.maxHeight = 'none';
        sidebar.style.overflowY = 'visible';
    }
}

// Function to position the sidebar optimally
function positionSidebar() {
    // For desktop, ensure proper position in bottom right
    if (window.innerWidth > 600) {
        // Keep sidebar in bottom right but adjust to content size
        sidebar.style.bottom = '90px';
        sidebar.style.right = '30px';
        sidebar.style.left = 'auto';
        sidebar.style.width = '350px';
    } else {
        // For mobile, ensure it sticks to the bottom
        sidebar.style.bottom = '0';
        sidebar.style.right = '0';
        sidebar.style.left = '0';
        sidebar.style.width = '100%';
    }
}

// Create layer items for the overlay layers
function createLayerItem(name, layer) {
    const item = document.createElement('li');
    item.className = 'layer-item';
    item.dataset.layerId = name;

    // Top row: drag, thumbnail, name, toggle
    const rowDiv = document.createElement('div');
    rowDiv.className = 'layer-row';

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'sort-handle';
    handle.innerHTML = '<i class="fa fa-grip-lines"></i>';
    rowDiv.appendChild(handle);

    // Thumbnail
    if (layer.options && layer.options.thumbnail) {
        const thumbnail = document.createElement('img');
        thumbnail.src = layer.options.thumbnail;
        thumbnail.className = 'layer-thumbnail';
        thumbnail.alt = name;
        rowDiv.appendChild(thumbnail);
    } else if (layer.options && layer.options.iconClass) {
        const icon = document.createElement('i');
        icon.className = `fa ${layer.options.iconClass} layer-icon`;
        rowDiv.appendChild(icon);
    }

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = name;
    rowDiv.appendChild(nameSpan);

    // Toggle
    const visibleIcon = document.createElement('span');
    visibleIcon.className = 'layer-visible';
    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'toggle-switch';
    // Set initial state based on layer type
    if (map.hasLayer(layer) || (layer === topoLayer)) {
        toggleSwitch.classList.add('active');
    }
    visibleIcon.appendChild(toggleSwitch);
    visibleIcon.addEventListener('click', () => {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
            toggleSwitch.classList.remove('active');
        } else {
            map.addLayer(layer);
            toggleSwitch.classList.add('active');
        }
        // Reorder layers to maintain proper z-index
        reorderLayers();
    });
    rowDiv.appendChild(visibleIcon);

    item.appendChild(rowDiv);

    // Opacity slider row (no label, no percent)
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'layer-controls';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    // Set initial value based on layer type
    slider.value = layer === topoLayer ? '80' : '100';
    slider.className = 'opacity-slider';
    controlsDiv.appendChild(slider);
    slider.addEventListener('input', () => {
        const opacity = parseInt(slider.value) / 100;
        if (layer instanceof L.TileLayer) {
            layer.setOpacity(opacity);
        }
    });
    item.appendChild(controlsDiv);
    return item;
}

// Populate overlay layers in the defined order
for (const [name, layer] of Object.entries(overlayMaps)) {
    const item = createLayerItem(name, layer);
    // Set initial state for canopy layer
    if (name === "Canopy Map") {
        const toggleSwitch = item.querySelector('.toggle-switch');
        toggleSwitch.classList.remove('active');
    }
    overlayLayerList.appendChild(item);
}

// Initialize Sortable for overlay layers
const sortable = new Sortable(overlayLayerList, {
    animation: 150,
    handle: '.sort-handle',
    ghostClass: 'sortable-ghost',
    onEnd: function(evt) {
        // Reorder layers to maintain proper z-index
        reorderLayers();
    }
});

// Adjust sidebar on window resize
window.addEventListener('resize', function() {
    adjustSidebarContentHeight();
    
    // Also reposition sidebar if it's open
    if (sidebar.classList.contains('expanded')) {
        positionSidebar();
    }
});

// Initial sidebar height adjustment
setTimeout(adjustSidebarContentHeight, 100); 