import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, pointCloud;
let currentData = [];
let currentMaxZPercent = 100;
let currentPerspective = 'human';

// Game entities - predator vs prey
let humanCharacter, owlCharacter, mouseCharacter;
let gameState = {
    score: 0,
    humanCaught: 0,
    owlCaught: 0,
    mouseCaught: 0,
    gameActive: true
};

// Perspective settings for different animals
// Data represents 150,000 sq ft area (~13,935 sq meters)
// Scene is normalized to ~2000 units, so 1 unit ≈ 6.97 sq ft
// Human: 145-160cm (avg ~152.5cm) - medium height
// Bird (flying): 3-10m above ground - highest viewpoint
// Mouse: 2.5-5cm above ground - ground level
const perspectiveSettings = {
    human: {
        eyeLevel: 152.5,      // Average human eye level in cm (standing)
        cursorSize: 40,       // Cursor size in pixels
        moveSpeed: 2.0,       // Medium walking speed (scaled to area)
        scrollSpeed: 2.0,     // Scroll/zoom speed
        rotateSpeed: 1.0,     // Rotation speed multiplier
        description: 'Adult human standing eye level (152.5cm)'
    },
    bird: {
        eyeLevel: 300,        // Bird flying height (~3m above ground) - HIGHEST
        cursorSize: 20,       // Medium cursor for bird
        moveSpeed: 4.0,       // Fastest movement (birds fly quickly)
        scrollSpeed: 4.0,     // Fastest scroll speed
        rotateSpeed: 1.2,     // Birds can turn slightly faster
        description: 'Small bird flying eye level (~3m high)'
    },
    mouse: {
        eyeLevel: 3.75,       // Mouse eye level in cm (very low, 2.5-5cm avg) - GROUND LEVEL
        cursorSize: 15,       // Small cursor for mouse
        moveSpeed: 1.0,       // Slowest movement (small animals)
        scrollSpeed: 1.0,     // Slowest scroll speed
        rotateSpeed: 0.9,     // Mice turn slightly slower
        description: 'Mouse eye level (3.75cm from ground)'
    }
};

// iNaturalist data - Brooklyn area observations
const iNaturalistData = [
    { species: 'American Robin', taxon: 'Turdus migratorius', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=6892' },
    { species: 'House Mouse', taxon: 'Mus musculus', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=43115' },
    { species: 'Eastern Gray Squirrel', taxon: 'Sciurus carolinensis', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=46017' },
    { species: 'Red-tailed Hawk', taxon: 'Buteo jamaicensis', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=5212' },
    { species: 'Common Dandelion', taxon: 'Taraxacum officinale', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=47602' },
    { species: 'Northern Cardinal', taxon: 'Cardinalis cardinalis', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=9083' },
    { species: 'Mourning Dove', taxon: 'Zenaida macroura', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=5279' },
    { species: 'Blue Jay', taxon: 'Cyanocitta cristata', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=8229' },
    { species: 'White Clover', taxon: 'Trifolium repens', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=50618' },
    { species: 'Red Maple', taxon: 'Acer rubrum', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=51806' },
    { species: 'Norway Rat', taxon: 'Rattus norvegicus', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=42998' },
    { species: 'Raccoon', taxon: 'Procyon lotor', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=41630' },
    { species: 'House Sparrow', taxon: 'Passer domesticus', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=13765' },
    { species: 'Plantain', taxon: 'Plantago major', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=54756' },
    { species: 'Rock Pigeon', taxon: 'Columba livia', url: 'https://www.inaturalist.org/observations?nelat=40.71121129740224&nelng=-73.97796882726138&subview=map&swlat=40.676069500562605&swlng=-74.02088417149966&taxon_id=4960' }
];

let raycaster, mouse, linkedPoints = [];
let linkedPointMarkers = [];
let keys = { forward: false, backward: false, left: false, right: false, zoomIn: false, zoomOut: false };

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    // Camera
    const container = document.getElementById('container');
    camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        1,
        100000
    );
    // Start with a good view of the data - positioned outside and looking at it
    // Y starts from 0 and goes up, X and Z are centered around origin
    // Position camera back and slightly elevated to see the full cloud
    camera.position.set(0, 800, 1500); // Positioned to get a good overview of the data

    // Set initial camera direction to look toward the center
    camera.lookAt(0, 500, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Controls - disabled for first-person keyboard navigation
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = false; // Disable orbit controls for first-person experience

    // Raycaster for hover detection
    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 10; // Detection threshold for points
    raycaster.params.Sprite = {}; // Enable sprite detection
    mouse = new THREE.Vector2();

    // Note: Don't call updatePerspective here - it will be called after data loads

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Radio button listeners
    const radios = document.querySelectorAll('input[name="dataset"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            loadData(e.target.value);
        });
    });

    // Max Z slider listener
    const maxZSlider = document.getElementById('maxZSlider');
    const maxZValue = document.getElementById('maxZValue');
    maxZSlider.addEventListener('input', (e) => {
        currentMaxZPercent = parseFloat(e.target.value);
        maxZValue.textContent = currentMaxZPercent + '%';
        if (currentData.length > 0) {
            visualizeData(currentData);
        }
    });

    // Perspective radio button listeners
    const perspectiveRadios = document.querySelectorAll('input[name="perspective"]');
    perspectiveRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updatePerspective(e.target.value);
        });
    });

    // Custom cursor tracking with color detection
    const cursor = document.getElementById('cursor');
    document.addEventListener('mousemove', (e) => {
        const size = perspectiveSettings[currentPerspective].cursorSize;
        cursor.style.left = (e.clientX - size / 2) + 'px';
        cursor.style.top = (e.clientY - size / 2) + 'px';
        cursor.style.width = size + 'px';
        cursor.style.height = size + 'px';

        // Update mouse position for raycasting
        const container = document.getElementById('container');
        mouse.x = (e.clientX / container.clientWidth) * 2 - 1;
        mouse.y = -(e.clientY / container.clientHeight) * 2 + 1;
    });

    // Click handler for iNaturalist links
    document.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
            checkPointClick();
        }
    });

    // Mouse wheel/scroll handler for forward/backward movement
    document.addEventListener('wheel', (e) => {
        e.preventDefault();
        const settings = perspectiveSettings[currentPerspective];
        const scrollAmount = settings.scrollSpeed;

        // Get camera's forward direction
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; // Keep movement horizontal
        forward.normalize();

        // Scroll down = move forward, scroll up = move backward
        if (e.deltaY > 0) {
            camera.position.addScaledVector(forward, scrollAmount);
        } else {
            camera.position.addScaledVector(forward, -scrollAmount);
        }
    }, { passive: false });

    // Keyboard controls for first-person navigation
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                keys.forward = true;
                e.preventDefault();
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                keys.backward = true;
                e.preventDefault();
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                keys.left = true;
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                keys.right = true;
                e.preventDefault();
                break;
            case 'z':
            case 'Z':
                keys.zoomIn = true;
                e.preventDefault();
                break;
            case 'x':
            case 'X':
                keys.zoomOut = true;
                e.preventDefault();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                keys.forward = false;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                keys.backward = false;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                keys.left = false;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                keys.right = false;
                break;
            case 'z':
            case 'Z':
                keys.zoomIn = false;
                break;
            case 'x':
            case 'X':
                keys.zoomOut = false;
                break;
        }
    });

    // Start animation loop
    animate();

    // Load initial data
    loadData('02.12_Pointcloud.csv.csv');
}

function onWindowResize() {
    const container = document.getElementById('container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function createCircleTexture() {
    // Create a canvas to draw a circle
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Draw a circle with gradient for smooth edges
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function updatePerspective(perspective) {
    currentPerspective = perspective;
    const settings = perspectiveSettings[perspective];

    // Calculate eye level in scene coordinates
    // The point cloud height axis (Y) needs proper scaling
    // Based on the data normalization, we calculate the proper scale
    // The height should be proportional to the actual eye level differences
    const sceneHeightScale = 10; // Adjusted scale factor for better visibility
    const eyeLevelHeight = settings.eyeLevel * sceneHeightScale;

    // Store current position
    const currentX = camera.position.x;
    const currentZ = camera.position.z;

    // Set camera position for first-person view
    // Keep current X and Z position, only update Y (height)
    camera.position.set(currentX, eyeLevelHeight, currentZ);

    // Lock the camera to look straight ahead (horizontal view)
    // Calculate a point in front of the camera at the same eye level
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep direction horizontal
    forward.normalize();

    const lookAtPoint = new THREE.Vector3();
    lookAtPoint.copy(camera.position);
    lookAtPoint.addScaledVector(forward, 1000);
    lookAtPoint.y = eyeLevelHeight; // Same height as camera for locked horizontal view
    camera.lookAt(lookAtPoint);

    // Update cursor size
    const cursor = document.getElementById('cursor');
    cursor.style.width = settings.cursorSize + 'px';
    cursor.style.height = settings.cursorSize + 'px';

    console.log(`Switched to ${perspective} perspective:`, settings.description);
    console.log(`Eye level height in scene: ${eyeLevelHeight.toFixed(2)} units`);
    console.log(`Camera position: (${currentX.toFixed(2)}, ${eyeLevelHeight.toFixed(2)}, ${currentZ.toFixed(2)})`);
}

function animate() {
    requestAnimationFrame(animate);

    // Handle keyboard movement
    handleMovement();

    // Update AI characters
    updateAICharacters();

    // Update cursor color based on hovered point
    updateCursorColor();

    // Animate linked point markers (pulsing effect)
    animateLinkedMarkers();

    renderer.render(scene, camera);
}

function handleMovement() {
    const settings = perspectiveSettings[currentPerspective];
    const eyeLevelHeight = settings.eyeLevel * 10; // Same scale as updatePerspective
    const currentMoveSpeed = settings.moveSpeed; // Use animal-specific speed
    const zoomSpeed = settings.scrollSpeed * 1.5; // Zoom is faster than regular movement

    // Get camera's current forward and right directions
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();

    // Apply movement based on key states with animal-specific speed
    if (keys.forward) {
        camera.position.addScaledVector(forward, currentMoveSpeed);
    }
    if (keys.backward) {
        camera.position.addScaledVector(forward, -currentMoveSpeed);
    }
    if (keys.left) {
        camera.position.addScaledVector(right, -currentMoveSpeed);
    }
    if (keys.right) {
        camera.position.addScaledVector(right, currentMoveSpeed);
    }

    // Zoom in/out with Z and X keys
    if (keys.zoomIn) {
        camera.position.addScaledVector(forward, zoomSpeed);
    }
    if (keys.zoomOut) {
        camera.position.addScaledVector(forward, -zoomSpeed);
    }

    // Lock the Y position to eye level (no vertical movement)
    camera.position.y = eyeLevelHeight;

    // Keep camera looking straight ahead at eye level (first-person view)
    const lookAtPoint = new THREE.Vector3();
    lookAtPoint.copy(camera.position);
    lookAtPoint.addScaledVector(forward, 1000);
    lookAtPoint.y = eyeLevelHeight; // Lock vertical looking angle
    camera.lookAt(lookAtPoint);
}

function animateLinkedMarkers() {
    const time = Date.now() * 0.003;
    linkedPointMarkers.forEach((marker, index) => {
        // Pulsing scale effect
        const scale = 1 + Math.sin(time + index) * 0.3;
        marker.scale.set(scale, scale, 1);
    });
}

function updateCursorColor() {
    if (!pointCloud) return;

    // Cast ray from camera through mouse position
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(pointCloud);

    const cursor = document.getElementById('cursor');
    const info = document.getElementById('info');

    if (intersects.length > 0) {
        // Get the color of the intersected point
        const intersect = intersects[0];
        const index = intersect.index;
        const colors = pointCloud.geometry.attributes.color;

        if (colors && index < colors.count) {
            const r = Math.floor(colors.getX(index) * 255);
            const g = Math.floor(colors.getY(index) * 255);
            const b = Math.floor(colors.getZ(index) * 255);

            cursor.style.borderColor = `rgb(${r}, ${g}, ${b})`;
            cursor.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.3)`;

            // Check if this point is linked to iNaturalist
            const linkedPoint = linkedPoints.find(p => p.index === index);
            if (linkedPoint) {
                cursor.style.borderWidth = '3px';
                cursor.style.boxShadow = `0 0 15px rgba(${r}, ${g}, ${b}, 0.8)`;
                info.innerHTML = `<strong>${linkedPoint.species}</strong><br>
                                  <em>${linkedPoint.taxon}</em><br>
                                  <small>Click to view on iNaturalist</small>`;
            } else {
                cursor.style.borderWidth = '2px';
                cursor.style.boxShadow = `0 0 10px rgba(${r}, ${g}, ${b}, 0.3)`;
                info.innerHTML = '<strong>Navigation:</strong> Arrow keys (↑↓←→) or Mouse Wheel to move<br><strong>Zoom:</strong> Z (in) / X (out) | <strong>Area:</strong> 150,000 sq ft<br><strong>iNaturalist:</strong> Click yellow markers';
            }
        }
    } else {
        // Reset to default white cursor
        cursor.style.borderColor = 'rgba(255, 255, 255, 0.8)';
        cursor.style.backgroundColor = 'transparent';
        cursor.style.borderWidth = '2px';
        cursor.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3)';
        info.innerHTML = '<strong>Navigation:</strong> Arrow keys (↑↓←→) or Mouse Wheel to move<br><strong>Zoom:</strong> Z (in) / X (out) | <strong>Area:</strong> 150,000 sq ft<br><strong>iNaturalist:</strong> Click yellow markers';
    }
}

function checkPointClick() {
    if (!pointCloud) return;

    raycaster.setFromCamera(mouse, camera);

    // Check if clicking on a marker sprite first
    const markerIntersects = raycaster.intersectObjects(linkedPointMarkers);
    if (markerIntersects.length > 0) {
        const marker = markerIntersects[0].object;
        const linkedPoint = linkedPoints.find(p => p.marker === marker);
        if (linkedPoint) {
            console.log(`Opening iNaturalist link for ${linkedPoint.species}`);
            window.open(linkedPoint.url, '_blank');
            return;
        }
    }

    // Fall back to checking point cloud
    const intersects = raycaster.intersectObject(pointCloud);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const index = intersect.index;

        // Check if this point is linked to iNaturalist data
        const linkedPoint = linkedPoints.find(p => p.index === index);

        if (linkedPoint) {
            console.log(`Opening iNaturalist link for ${linkedPoint.species}`);
            window.open(linkedPoint.url, '_blank');
        } else {
            console.log(`Clicked point ${index} (not linked to iNaturalist data)`);
        }
    }
}

async function loadData(filename) {
    console.log('Loading data...');

    try {
        const response = await fetch(filename);
        const text = await response.text();

        // Parse CSV
        const lines = text.trim().split('\n');
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            data.push({
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2])
            });
        }

        console.log(`Loaded ${data.length.toLocaleString()} points`);
        visualizeData(data);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function visualizeData(data) {
    // Remove existing point cloud if any
    if (pointCloud) {
        scene.remove(pointCloud);
        pointCloud.geometry.dispose();
        pointCloud.material.dispose();
    }

    // Find bounds - iterate instead of spread to avoid stack overflow
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    data.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
    });

    console.log(`Bounds: X(${minX}-${maxX}), Y(${minY}-${maxY}), Z(${minZ}-${maxZ})`);

    // Center the data
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Calculate scale to normalize all dimensions
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const rangeZ = maxZ - minZ;
    const maxRange = Math.max(rangeX, rangeY, rangeZ);
    const scale = 2000 / maxRange; // Scale to fit in a 2000 unit cube

    console.log(`Ranges: X=${rangeX}, Y=${rangeY}, Z=${rangeZ}`);
    console.log(`Scale factor: ${scale}`);

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(data.length * 3);
    const colors = new Float32Array(data.length * 3);

    // Calculate effective max Z based on slider percentage
    const effectiveMaxZ = minZ + (maxZ - minZ) * (currentMaxZPercent / 100);

    // Color interpolation from red (low Z) to blue (high Z)
    function getColor(z) {
        const normalized = Math.min(1, (z - minZ) / (effectiveMaxZ - minZ));
        return {
            r: 1 - normalized,
            g: 0,
            b: normalized
        };
    }

    // Fill position and color arrays
    data.forEach((point, i) => {
        const idx = i * 3;
        positions[idx] = (point.x - centerX) * scale;
        positions[idx + 1] = (point.z - minZ) * scale; // Use Z as height, starting from 0
        positions[idx + 2] = (point.y - centerY) * scale; // Use Y as depth (Z in 3D)

        const color = getColor(point.z);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create material - smaller points for larger datasets
    let pointSize = 8;
    if (data.length > 1000000) pointSize = 1;
    else if (data.length > 200000) pointSize = 1.5;
    else if (data.length > 50000) pointSize = 3;

    const material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
        map: createCircleTexture(),  // Add circular texture for spherical points
        alphaTest: 0.5,
        depthWrite: true
    });

    // Create point cloud
    pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);

    // Adjust camera to look at center
    controls.target.set(0, 0, 0);
    controls.update();

    console.log(`Rendered ${data.length} points`);
    console.log('Point cloud added to scene:', pointCloud);
    console.log('Geometry vertices:', geometry.attributes.position.count);
    console.log('Material:', material);

    // Log the actual Y bounds of the rendered point cloud for debugging
    const positionsArray = geometry.attributes.position;
    let minYBound = Infinity, maxYBound = -Infinity;
    for (let i = 0; i < positionsArray.count; i++) {
        const yVal = positionsArray.getY(i);
        if (yVal < minYBound) minYBound = yVal;
        if (yVal > maxYBound) maxYBound = yVal;
    }
    console.log(`Point cloud Y range: ${minYBound.toFixed(2)} to ${maxYBound.toFixed(2)} units`);

    // Link random points to iNaturalist data
    linkRandomPointsToiNaturalist(data.length);
}

function linkRandomPointsToiNaturalist(totalPoints) {
    linkedPoints = []; // Clear previous links

    // Remove old markers
    linkedPointMarkers.forEach(marker => {
        scene.remove(marker);
        if (marker.material) marker.material.dispose();
        if (marker.geometry) marker.geometry.dispose();
    });
    linkedPointMarkers = [];

    // Link 15-25 random points to iNaturalist observations (more points now)
    const numLinks = Math.min(Math.floor(Math.random() * 11) + 15, totalPoints, iNaturalistData.length * 2);

    for (let i = 0; i < numLinks; i++) {
        const randomIndex = Math.floor(Math.random() * totalPoints);
        const randomSpecies = iNaturalistData[Math.floor(Math.random() * iNaturalistData.length)];

        // Get the position of this point from the point cloud
        const positions = pointCloud.geometry.attributes.position;
        const x = positions.getX(randomIndex);
        const y = positions.getY(randomIndex);
        const z = positions.getZ(randomIndex);

        // Create a visible marker sprite at this position
        const marker = createMarkerSprite();
        marker.position.set(x, y, z);
        scene.add(marker);
        linkedPointMarkers.push(marker);

        linkedPoints.push({
            index: randomIndex,
            species: randomSpecies.species,
            taxon: randomSpecies.taxon,
            url: randomSpecies.url,
            marker: marker
        });
    }

    console.log(`Linked ${linkedPoints.length} points to iNaturalist observations:`);
    linkedPoints.forEach(p => {
        console.log(`  - Point ${p.index}: ${p.species} (${p.taxon})`);
    });

    // Position camera near the first linked point for a good initial view
    if (linkedPoints.length > 0) {
        const firstLinkedPoint = linkedPoints[0];
        const positions = pointCloud.geometry.attributes.position;
        const x = positions.getX(firstLinkedPoint.index);
        const y = positions.getY(firstLinkedPoint.index);
        const z = positions.getZ(firstLinkedPoint.index);

        // Position camera behind the point at human eye level
        const settings = perspectiveSettings['human']; // Start with human perspective
        const eyeLevelHeight = settings.eyeLevel * 10;

        // Position camera 300 units back from the linked point
        camera.position.set(x, eyeLevelHeight, z + 300);

        // Look at a point straight ahead (not at the marker itself for first-person view)
        camera.lookAt(x, eyeLevelHeight, z - 500);

        console.log(`Camera positioned near ${firstLinkedPoint.species} at (${x.toFixed(2)}, ${eyeLevelHeight.toFixed(2)}, ${(z + 300).toFixed(2)})`);
    }

    // Create game characters after data is loaded
    createGameCharacters();
}

// Create game character entities
function createGameCharacters() {
    // Human: 6 feet = ~183cm = 1830 units in our scale
    // White blob at human eye level
    const humanGeometry = new THREE.SphereGeometry(90, 32, 32); // 6ft diameter
    const humanMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.8
    });
    humanCharacter = new THREE.Mesh(humanGeometry, humanMaterial);
    humanCharacter.position.set(
        Math.random() * 1000 - 500,
        1525, // Human eye level
        Math.random() * 1000 - 500
    );
    humanCharacter.userData = {
        type: 'human',
        speed: 3.0,
        detectionRange: 200,
        direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        target: null,
        eyeLevel: 1525
    };
    scene.add(humanCharacter);

    // Owl: 1 foot = ~30cm = 300 units
    // Flying bird
    const owlGeometry = new THREE.SphereGeometry(15, 32, 32); // 1ft diameter
    const owlMaterial = new THREE.MeshPhongMaterial({
        color: 0x8B4513,
        emissive: 0xff6600,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.9
    });
    owlCharacter = new THREE.Mesh(owlGeometry, owlMaterial);
    owlCharacter.position.set(
        Math.random() * 1000 - 500,
        3000, // Flying height (3m)
        Math.random() * 1000 - 500
    );
    owlCharacter.userData = {
        type: 'owl',
        speed: 5.0,
        detectionRange: 300,
        direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        target: null,
        eyeLevel: 3000
    };
    scene.add(owlCharacter);

    // Mouse: 3 inches = ~7.5cm = 75 units
    // Ground level rodent
    const mouseGeometry = new THREE.SphereGeometry(4, 32, 32); // 3 inch diameter
    const mouseMaterial = new THREE.MeshPhongMaterial({
        color: 0x808080,
        emissive: 0x404040,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9
    });
    mouseCharacter = new THREE.Mesh(mouseGeometry, mouseMaterial);
    mouseCharacter.position.set(
        Math.random() * 1000 - 500,
        37.5, // Ground level (3.75cm)
        Math.random() * 1000 - 500
    );
    mouseCharacter.userData = {
        type: 'mouse',
        speed: 1.5,
        detectionRange: 100,
        direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        target: null,
        eyeLevel: 37.5
    };
    scene.add(mouseCharacter);

    console.log('Game characters created: Human, Owl, Mouse');
}

// Update AI characters
function updateAICharacters() {
    if (!humanCharacter || !owlCharacter || !mouseCharacter) return;

    const characters = [humanCharacter, owlCharacter, mouseCharacter];

    characters.forEach(character => {
        const data = character.userData;

        // Check if being controlled by player (bird perspective controls owl)
        const isPlayer = (currentPerspective === 'human' && character === humanCharacter) ||
                        (currentPerspective === 'bird' && character === owlCharacter) ||
                        (currentPerspective === 'mouse' && character === mouseCharacter);

        if (isPlayer) {
            // Player controls this character - sync with camera position
            character.position.x = camera.position.x;
            character.position.z = camera.position.z;
            character.position.y = data.eyeLevel;
        } else {
            // AI controlled - roam and hunt

            // Look for prey/threats
            let closestTarget = null;
            let closestDistance = Infinity;

            characters.forEach(other => {
                if (other === character) return;

                const distance = character.position.distanceTo(other.position);

                // Predator-prey logic
                const canHunt = (
                    (data.type === 'human' && other.userData.type === 'mouse') || // Human catches mouse
                    (data.type === 'owl' && other.userData.type === 'mouse') ||   // Owl catches mouse
                    (data.type === 'mouse' && other.userData.type === 'human')    // Mouse runs from human
                );

                if (canHunt && distance < data.detectionRange && distance < closestDistance) {
                    closestTarget = other;
                    closestDistance = distance;
                }
            });

            // Move towards target or roam
            if (closestTarget) {
                // Chase/flee behavior
                const direction = new THREE.Vector3().subVectors(closestTarget.position, character.position);
                direction.y = 0; // Keep on horizontal plane
                direction.normalize();

                // Flee if mouse
                if (data.type === 'mouse') {
                    direction.multiplyScalar(-1);
                }

                data.direction.copy(direction);
            } else {
                // Random roaming - occasionally change direction
                if (Math.random() < 0.02) {
                    data.direction.set(
                        Math.random() - 0.5,
                        0,
                        Math.random() - 0.5
                    ).normalize();
                }
            }

            // Move character
            character.position.x += data.direction.x * data.speed;
            character.position.z += data.direction.z * data.speed;

            // Keep within bounds (-1000 to 1000)
            character.position.x = Math.max(-1000, Math.min(1000, character.position.x));
            character.position.z = Math.max(-1000, Math.min(1000, character.position.z));

            // Check for catches
            characters.forEach(other => {
                if (other === character) return;

                const distance = character.position.distanceTo(other.position);

                if (distance < 50) { // Catch range
                    const canCatch = (
                        (data.type === 'human' && other.userData.type === 'mouse') ||
                        (data.type === 'owl' && other.userData.type === 'mouse')
                    );

                    if (canCatch) {
                        handleCatch(character, other);
                    }
                }
            });
        }
    });
}

// Handle catch event
function handleCatch(predator, prey) {
    if (!gameState.gameActive) return;

    console.log(`${predator.userData.type} caught ${prey.userData.type}!`);

    // Update score
    gameState.score += 10;
    if (predator.userData.type === 'human') gameState.humanCaught++;
    if (predator.userData.type === 'owl') gameState.owlCaught++;

    // Update UI
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('caught').textContent = gameState.humanCaught + gameState.owlCaught + gameState.mouseCaught;

    // Respawn prey at random location
    prey.position.set(
        Math.random() * 1600 - 800,
        prey.userData.eyeLevel,
        Math.random() * 1600 - 800
    );

    // Show notification
    showGameMessage(`${predator.userData.type.toUpperCase()} caught ${prey.userData.type}!`, 2000);
}

// Show game message
function showGameMessage(message, duration = 2000) {
    const statusDiv = document.getElementById('gameStatus');
    const messageDiv = document.getElementById('statusMessage');
    messageDiv.textContent = message;
    statusDiv.style.display = 'block';

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, duration);
}

function createMarkerSprite() {
    // Create a canvas for the sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw a glowing circular marker
    const gradient = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 100, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    // Draw a ring for emphasis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, Math.PI * 2);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(50, 50, 1); // Make it visible

    return sprite;
}

// Initialize on load
init();
