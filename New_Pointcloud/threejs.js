import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, pointCloud;
let currentData = [];
let currentMaxZPercent = 100;
let currentPerspective = 'human';
let currentEyeLevel = 0;
let targetCameraHeight = 0; // For smooth height transitions

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
// Barn Owl (flying): 3-10m above ground - highest viewpoint
// Mouse: 2.5-5cm above ground - ground level
const perspectiveSettings = {
    human: {
        eyeLevel: 15.25,      // Average human eye level in cm (standing) / 10
        cursorSize: 40,       // Cursor size in pixels
        moveSpeed: 2.0,       // Medium walking speed (scaled to area)
        scrollSpeed: 0.5,     // Scroll/zoom speed
        rotateSpeed: 1.0,     // Rotation speed multiplier
        fov: 75,              // Field of view
        terrainFollow: false, // Does not follow terrain
        description: 'Adult human standing eye level (152.5cm)'
    },
    bird: {
        eyeLevel: 30,         // Barn Owl flying height (~3m above ground) / 10 - HIGHEST
        cursorSize: 60,       // Larger cursor for barn owl (wide field of view)
        moveSpeed: 5.0,       // Fast movement (barn owls fly quickly)
        scrollSpeed: 1.2,     // Fast scroll speed
        rotateSpeed: 1.5,     // Barn owls can turn faster
        fov: 110,             // Wide field of view for flying
        terrainFollow: false, // Maintains fixed altitude
        description: 'Barn owl flying eye level (~3m high)'
    },
    mouse: {
        eyeLevel: 0.375,      // Mouse eye level in cm (very low, 2.5-5cm avg) / 10 - GROUND LEVEL
        cursorSize: 25,       // Smaller cursor for mouse
        moveSpeed: 1.2,       // Quick, scurrying movement
        scrollSpeed: 0.1,     // Slower scroll speed
        rotateSpeed: 0.8,     // Mice turn more carefully
        fov: 70,              // Wide field of view (prey animal)
        terrainFollow: true,  // Follows terrain contours
        terrainOffset: 30,    // 1 foot = 30cm / 10 = 3 units * 10 scale = 30 units above nearest point
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
let keys = { forward: false, backward: false, zoomIn: false, zoomOut: false };
let mouseX = 0.5; // Normalized mouse X position (0 to 1)
let mouseY = 0.5; // Normalized mouse Y position (0 to 1)
let cameraRotationY = 0; // Horizontal rotation (yaw)
let cameraRotationX = 0; // Vertical rotation (pitch)

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

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

    // Initialize eye level to human default
    currentEyeLevel = perspectiveSettings['human'].eyeLevel;

    // Note: Don't call updatePerspective here - it will be called after data loads

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

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

    // Eye level slider listener
    const eyeLevelSlider = document.getElementById('eyeLevelSlider');
    const eyeLevelValue = document.getElementById('eyeLevelValue');
    eyeLevelSlider.addEventListener('input', (e) => {
        currentEyeLevel = parseFloat(e.target.value);
        eyeLevelValue.textContent = currentEyeLevel.toFixed(2);
        updateCameraHeight();
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
        
        // Track normalized mouse position for edge-based rotation
        mouseX = e.clientX / container.clientWidth; // 0 (left) to 1 (right)
        mouseY = e.clientY / container.clientHeight; // 0 (top) to 1 (bottom)
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
            case ' ':
                // Spacebar - toggle perspective
                togglePerspective();
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

function togglePerspective() {
    // Cycle through perspectives: human -> bird -> mouse -> human
    const perspectives = ['human', 'bird', 'mouse'];
    const currentIndex = perspectives.indexOf(currentPerspective);
    const nextIndex = (currentIndex + 1) % perspectives.length;
    const nextPerspective = perspectives[nextIndex];
    
    // Store current X and Z position
    const currentX = camera.position.x;
    const currentZ = camera.position.z;
    
    // Update perspective
    updatePerspective(nextPerspective);
    
    // Restore X and Z position (Y will be updated by updatePerspective)
    camera.position.x = currentX;
    camera.position.z = currentZ;
    
    // Update radio button to reflect change
    const radio = document.querySelector(`input[name="perspective"][value="${nextPerspective}"]`);
    if (radio) {
        radio.checked = true;
    }
    
    console.log(`Toggled to ${nextPerspective} at position (${currentX.toFixed(2)}, ${currentZ.toFixed(2)})`);
}

function updatePerspective(perspective) {
    currentPerspective = perspective;
    const settings = perspectiveSettings[perspective];

    // Set eye level to the animal's default
    currentEyeLevel = settings.eyeLevel;
    const eyeLevelSlider = document.getElementById('eyeLevelSlider');
    const eyeLevelValue = document.getElementById('eyeLevelValue');
    if (eyeLevelSlider) {
        eyeLevelSlider.value = currentEyeLevel;
        eyeLevelValue.textContent = currentEyeLevel.toFixed(2);
    }

    // Update camera field of view
    if (camera && settings.fov) {
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
    }

    updateCameraHeight();

    // Update cursor size
    const cursor = document.getElementById('cursor');
    cursor.style.width = settings.cursorSize + 'px';
    cursor.style.height = settings.cursorSize + 'px';

    console.log(`Switched to ${perspective} perspective:`, settings.description);
    console.log(`FOV: ${settings.fov}°, Cursor: ${settings.cursorSize}px, Speed: ${settings.moveSpeed}`);
}

function updateCameraHeight() {
    // Calculate eye level in scene coordinates
    const sceneHeightScale = 10; // Scale factor for better visibility
    const eyeLevelHeight = currentEyeLevel * sceneHeightScale;

    // Only update Y (height), keep current X and Z position
    camera.position.y = eyeLevelHeight;

    console.log(`Eye level: ${currentEyeLevel.toFixed(2)} | Scene height: ${eyeLevelHeight.toFixed(2)} units`);
    console.log(`Camera position: (${camera.position.x.toFixed(2)}, ${eyeLevelHeight.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
}

function getTerrainHeightAtPosition(x, z) {
    if (!pointCloud || !pointCloud.geometry) return null;
    
    const positions = pointCloud.geometry.attributes.position;
    const searchRadius = 100; // Search within this radius
    let nearestHeight = null;
    let minDistance = Infinity;
    
    // Search for nearest point within radius
    for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i);
        const py = positions.getY(i); // Y is height in our coordinate system
        const pz = positions.getZ(i);
        
        // Calculate horizontal distance only
        const dx = px - x;
        const dz = pz - z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < searchRadius && distance < minDistance) {
            minDistance = distance;
            nearestHeight = py;
        }
    }
    
    return nearestHeight;
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
    
    // Update fog for mouse perspective
    updateMouseVisibility();

    renderer.render(scene, camera);
}

function updateMouseVisibility() {
    // Only apply fog effect for mouse perspective
    if (currentPerspective === 'mouse') {
        // 45 feet = 45 * 30.48cm = 1371.6cm / 10 = 137.16 units * 10 scale = 1371.6 units
        // Convert to scene scale: 45 feet ≈ 300 units in our normalized space
        const visibilityRadius = 180; // 45 feet in scene coordinates
        const fogStart = visibilityRadius * 0.6; // Fog starts at 60% of max distance
        const fogEnd = visibilityRadius;
        
        if (!scene.fog) {
            scene.fog = new THREE.Fog(0xffffff, fogStart, fogEnd);
        } else {
            scene.fog.near = fogStart;
            scene.fog.far = fogEnd;
        }
    } else {
        // Remove fog for other perspectives
        scene.fog = null;
    }
}

function handleMovement() {
    const settings = perspectiveSettings[currentPerspective];
    const eyeLevelHeight = currentEyeLevel * 10; // Same scale as updateCameraHeight
    const currentMoveSpeed = settings.moveSpeed; // Use animal-specific speed

    // Get camera's current forward direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();

    // Edge-based rotation: cursor near screen edges rotates camera
    const edgeThreshold = 0.15; // 15% from edge triggers rotation
    const rotationSpeed = settings.rotateSpeed * 0.03; // Rotation speed
    
    // Horizontal rotation (left/right)
    if (mouseX < edgeThreshold) {
        // Near left edge - rotate left
        const intensity = (edgeThreshold - mouseX) / edgeThreshold;
        cameraRotationY += rotationSpeed * intensity;
    } else if (mouseX > (1 - edgeThreshold)) {
        // Near right edge - rotate right
        const intensity = (mouseX - (1 - edgeThreshold)) / edgeThreshold;
        cameraRotationY -= rotationSpeed * intensity;
    }
    
    // Vertical rotation (up/down)
    if (mouseY < edgeThreshold) {
        // Near top edge - look up
        const intensity = (edgeThreshold - mouseY) / edgeThreshold;
        cameraRotationX += rotationSpeed * intensity * 0.5; // Half speed for vertical
    } else if (mouseY > (1 - edgeThreshold)) {
        // Near bottom edge - look down
        const intensity = (mouseY - (1 - edgeThreshold)) / edgeThreshold;
        cameraRotationX -= rotationSpeed * intensity * 0.5;
    }
    
    // Clamp vertical rotation to prevent over-rotation
    cameraRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraRotationX));
    
    // Apply rotation using Euler angles
    camera.rotation.order = 'YXZ';
    camera.rotation.y = cameraRotationY;
    camera.rotation.x = cameraRotationX;

    // Forward/backward movement with arrow keys (now only for manual control)
    if (keys.forward) {
        camera.position.addScaledVector(forward, currentMoveSpeed);
    }
    if (keys.backward) {
        camera.position.addScaledVector(forward, -currentMoveSpeed);
    }

    // Handle terrain following for mouse perspective
    if (settings.terrainFollow && pointCloud) {
        const terrainHeight = getTerrainHeightAtPosition(camera.position.x, camera.position.z);
        if (terrainHeight !== null) {
            targetCameraHeight = terrainHeight + settings.terrainOffset;
        } else {
            targetCameraHeight = eyeLevelHeight;
        }
        // Smooth interpolation (lerp) for Y-axis - 0.05 = smoothing factor (lower = smoother)
        camera.position.y += (targetCameraHeight - camera.position.y) * 0.05;
    } else {
        // Lock the Y position to eye level (no vertical movement)
        camera.position.y = eyeLevelHeight;
        targetCameraHeight = eyeLevelHeight;
    }
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
    let scale = 2000 / maxRange; // Scale to fit in a 2000 unit cube
    
    // Scale up by 10x for mouse perspective (makes world appear larger relative to small mouse)
    if (currentPerspective === 'mouse') {
        scale *= 10;
    }

    console.log(`Ranges: X=${rangeX}, Y=${rangeY}, Z=${rangeZ}`);
    console.log(`Scale factor: ${scale} (${currentPerspective} perspective)`);

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(data.length * 3);
    const colors = new Float32Array(data.length * 3);

    // Calculate effective max Z based on slider percentage
    const effectiveMaxZ = minZ + (maxZ - minZ) * (currentMaxZPercent / 100);

    // Color interpolation from red (low Z) to blue (high Z)
    function getColor(z) {
        // Use solid color #063a3d
        return {
            r: 0x06 / 255,
            g: 0x3a / 255,
            b: 0x3d / 255
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
    let pointSize = 12;
    if (data.length > 1000000) pointSize = 3;
    else if (data.length > 200000) pointSize = 4;
    else if (data.length > 50000) pointSize = 6;

    const material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
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
    // Flying barn owl
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

        // Check if being controlled by player (barn owl perspective controls owl)
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
