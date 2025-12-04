import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, pointCloud;
let currentData = [];
let currentMaxZPercent = 100;
let currentPerspective = 'human';
let currentEyeLevel = 0;
let targetCameraHeight = 0; // For smooth height transitions
let originalPositions = null; // Store original point positions for displacement effect
let originalColors = null; // Store original point colors
let touchedByAnimal = null; // Track which animal touched each point (0=none, 1=mouse, 2=owl)

// Game entities - predator vs prey
let falconCharacter = null;
let barnOwlCharacters = []; // Random number of barn owls
let miceCharacters = []; // Exactly 3 mice (moving, for human/owl to catch)
let cheeseItems = []; // Exactly 10 cheese pieces (stationary, for mouse to collect)
let gameState = {
    miceCaught: 0,
    cheeseCollected: 0,
    falconChasing: false,
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
        moveSpeed: 1,       // Medium walking speed (scaled to area)
        scrollSpeed: 0.5,     // Scroll/zoom speed
        rotateSpeed: 0.5,     // Rotation speed multiplier
        fov: 75,              // Field of view
        terrainFollow: true,  // Follows terrain contours like mouse
        terrainOffset: 30,   // 5.75 feet = 5.75 * 30.48cm / 10 * 10 scale = .26 units above nearest point
        sphereRadius: 20,      // Radius for point pushing - creates tunnel effect
        worldScale: 1.0,      // Normal scale (baseline)
        description: 'Adult human standing eye level (5.75 feet above ground)'
    },
    bird: {
        eyeLevel: 30,         // Barn Owl flying height (~3m above ground) / 10 - HIGHEST
        cursorSize: 60,       // Larger cursor for barn owl (wide field of view)
        moveSpeed: 0.2,       // Fast movement (barn owls fly quickly)
        scrollSpeed: 2.0,     // Fast scroll speed
        rotateSpeed: 0.5,     // Barn owls can turn faster
        fov: 110,             // Wide field of view for flying
        terrainFollow: false, // Maintains fixed altitude
        sphereRadius: 5,    // Radius for point pushing
        worldScale: 15.0,     // 15x scale (barn owl ~30cm tall, world appears much larger)
        description: 'Barn owl flying eye level (~3m high)'
    },
    mouse: {
        eyeLevel: 0.375,      // Mouse eye level in cm (very low, 2.5-5cm avg) / 10 - GROUND LEVEL
        cursorSize: 25,       // Smaller cursor for mouse
        moveSpeed: 1.2,       // Quick, scurrying movement
        scrollSpeed: 0.1,     // Slower scroll speed
        rotateSpeed: 0.4,     // Mice turn more carefully
        fov: 70,              // Wide field of view (prey animal)
        terrainFollow: true,  // Follows terrain contours
        terrainOffset: 30,    // 1 foot = 30cm / 10 = 3 units * 10 scale = 30 units above nearest point
        sphereRadius: 1,    // Radius for point pushing
        worldScale: 100.0,    // 100x scale (mouse ~7cm tall, world appears massive)
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
let keys = { forward: false, backward: false, rotateLeft: false, rotateRight: false, rotateUp: false, rotateDown: false };
let mouseX = 0.5; // Normalized mouse X position (0 to 1)
let mouseY = 0.5; // Normalized mouse Y position (0 to 1)
let cameraRotationY = 0; // Horizontal rotation (yaw)
let cameraRotationX = 0; // Vertical rotation (pitch)
let barnOwlMoving = true; // Toggle for barn owl automatic movement

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
                keys.rotateUp = true;
                e.preventDefault();
                break;
            case 'ArrowDown':
                keys.rotateDown = true;
                e.preventDefault();
                break;
            case 'ArrowLeft':
                keys.rotateLeft = true;
                e.preventDefault();
                break;
            case 'ArrowRight':
                keys.rotateRight = true;
                e.preventDefault();
                break;
            case 'w':
            case 'W':
                keys.forward = true;
                e.preventDefault();
                break;
            case 's':
            case 'S':
                keys.backward = true;
                e.preventDefault();
                break;
            case ' ':
                // Spacebar - toggle barn owl movement
                if (currentPerspective === 'bird') {
                    barnOwlMoving = !barnOwlMoving;
                    console.log(`Barn owl movement: ${barnOwlMoving ? 'ON' : 'OFF'}`);
                }
                e.preventDefault();
                break;
            case 'Enter':
                // Enter - toggle perspective
                togglePerspective();
                e.preventDefault();
                break;
            case 'c':
            case 'C':
                // C key - collect cheese (mouse only)
                if (currentPerspective === 'mouse') {
                    tryCollectCheese();
                }
                e.preventDefault();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.key) {
            case 'ArrowUp':
                keys.rotateUp = false;
                break;
            case 'ArrowDown':
                keys.rotateDown = false;
                break;
            case 'ArrowLeft':
                keys.rotateLeft = false;
                break;
            case 'ArrowRight':
                keys.rotateRight = false;
                break;
            case 'w':
            case 'W':
                keys.forward = false;
                break;
            case 's':
            case 'S':
                keys.backward = false;
                break;
        }
    });

    // Start animation loop
    animate();
    
    // Set initial navigation instructions
    updateNavigationInstructions();

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

    // Update cursor size and crosshair visibility
    const cursor = document.getElementById('cursor');
    const crosshair = document.getElementById('crosshair');
    const videoContainer = document.getElementById('videoContainer');
    const barnOwlVideo = document.getElementById('barnOwlVideo');
    const mouseVideo = document.getElementById('mouseVideo');
    cursor.style.width = settings.cursorSize + 'px';
    cursor.style.height = settings.cursorSize + 'px';
    
    // Show crosshair and owl video for barn owl, show mouse video for mouse, hide for human
    if (currentPerspective === 'bird') {
        crosshair.style.display = 'block';
        cursor.style.display = 'none';
        videoContainer.style.display = 'block';
        barnOwlVideo.style.display = 'block';
        mouseVideo.style.display = 'none';
    } else if (currentPerspective === 'mouse') {
        crosshair.style.display = 'none';
        cursor.style.display = 'block';
        videoContainer.style.display = 'block';
        barnOwlVideo.style.display = 'none';
        mouseVideo.style.display = 'block';
    } else {
        crosshair.style.display = 'none';
        cursor.style.display = 'block';
        videoContainer.style.display = 'none';
        barnOwlVideo.style.display = 'none';
        mouseVideo.style.display = 'none';
    }

    // Update navigation instructions and score display
    updateNavigationInstructions();
    updateScoreDisplay();

    console.log(`Switched to ${perspective} perspective:`, settings.description);
    console.log(`FOV: ${settings.fov}°, Cursor: ${settings.cursorSize}px, Speed: ${settings.moveSpeed}`);
}

function updateNavigationInstructions() {
    const navInstructions = document.getElementById('navInstructions');
    const counterLabel = document.getElementById('counterLabel');
    if (!navInstructions) return;
    
    let instructions = '';
    
    if (currentPerspective === 'human') {
        instructions = '• Move cursor to screen edges to rotate view<br>' +
                      '• Scroll to move forward/backward<br>' +
                      '• Enter: toggle between animals<br>';
        if (counterLabel) counterLabel.textContent = 'Mice Caught:';
    } else if (currentPerspective === 'bird') {
        instructions = '• Auto-flies toward crosshair at center<br>' +
                      '• Move cursor to screen edges to rotate view<br>' +
                      '• Spacebar: stop/resume movement<br>' +
                      '• Enter: toggle between animals<br>';
        if (counterLabel) counterLabel.textContent = 'Mice Caught:';
    } else if (currentPerspective === 'mouse') {
        instructions = '• Move cursor to screen edges to rotate view<br>' +
                      '• Scroll to move forward/backward<br>' +
                      '• C key: collect cheese (within 30 units)<br>' +
                      '• Enter: toggle between animals<br>';
        if (counterLabel) counterLabel.textContent = 'Cheese Collected:';
    }
    
    navInstructions.innerHTML = instructions;
    updateMiceCounter();
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
    if (!pointCloud || !pointCloud.geometry || !originalPositions) return null;
    
    // Use original positions for terrain detection to avoid conflict with point pushing
    const searchRadius = 100; // Search within this radius
    let nearestHeight = null;
    let minDistance = Infinity;
    
    // Search for nearest point within radius using ORIGINAL positions
    for (let i = 0; i < originalPositions.length / 3; i++) {
        const idx = i * 3;
        const px = originalPositions[idx];
        const py = originalPositions[idx + 1]; // Y is height in our coordinate system
        const pz = originalPositions[idx + 2];
        
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
    
    // Push points away from camera sphere
    pushPointsAway();

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
    
    // For barn owl: keep full 3D direction (including Y for vertical movement)
    // For others: keep movement horizontal only
    if (currentPerspective !== 'bird') {
        forward.y = 0; // Keep movement horizontal
    }
    forward.normalize();

    // Edge-based rotation: cursor near screen edges rotates camera
    const edgeThreshold = 0.15; // 15% from edge triggers rotation
    const rotationSpeed = settings.rotateSpeed * 0.015; // Rotation speed (reduced from 0.03)
    
    // Horizontal rotation (left/right) - cursor edges
    if (mouseX < edgeThreshold) {
        // Near left edge - rotate left
        const intensity = (edgeThreshold - mouseX) / edgeThreshold;
        cameraRotationY += rotationSpeed * intensity;
    } else if (mouseX > (1 - edgeThreshold)) {
        // Near right edge - rotate right
        const intensity = (mouseX - (1 - edgeThreshold)) / edgeThreshold;
        cameraRotationY -= rotationSpeed * intensity;
    }
    
    // Vertical rotation (up/down) - cursor edges
    if (mouseY < edgeThreshold) {
        // Near top edge - look up
        const intensity = (edgeThreshold - mouseY) / edgeThreshold;
        cameraRotationX += rotationSpeed * intensity * 0.5; // Half speed for vertical
    } else if (mouseY > (1 - edgeThreshold)) {
        // Near bottom edge - look down
        const intensity = (mouseY - (1 - edgeThreshold)) / edgeThreshold;
        cameraRotationX -= rotationSpeed * intensity * 0.5;
    }
    
    // Arrow key rotation controls
    const keyRotationSpeed = settings.rotateSpeed * 0.025; // Arrow key rotation (reduced from 0.05)
    if (keys.rotateLeft) {
        cameraRotationY += keyRotationSpeed;
    }
    if (keys.rotateRight) {
        cameraRotationY -= keyRotationSpeed;
    }
    if (keys.rotateUp) {
        cameraRotationX += keyRotationSpeed * 0.5; // Half speed for vertical
    }
    if (keys.rotateDown) {
        cameraRotationX -= keyRotationSpeed * 0.5;
    }
    
    // Clamp vertical rotation to prevent over-rotation
    cameraRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraRotationX));
    
    // Apply rotation using Euler angles
    camera.rotation.order = 'YXZ';
    camera.rotation.y = cameraRotationY;
    camera.rotation.x = cameraRotationX;

    // Barn owl: continuously moves forward (default state, unless stopped)
    if (currentPerspective === 'bird' && barnOwlMoving) {
        camera.position.addScaledVector(forward, currentMoveSpeed);
    }

    // Forward/backward movement with arrow keys (for human and mouse manual control)
    if (keys.forward) {
        camera.position.addScaledVector(forward, currentMoveSpeed);
    }
    if (keys.backward) {
        camera.position.addScaledVector(forward, -currentMoveSpeed);
    }

    // Handle terrain following for mouse and human perspectives
    if (settings.terrainFollow && pointCloud) {
        const terrainHeight = getTerrainHeightAtPosition(camera.position.x, camera.position.z);
        if (terrainHeight !== null) {
            targetCameraHeight = terrainHeight + settings.terrainOffset;
        } else {
            targetCameraHeight = eyeLevelHeight;
        }
        // Smooth interpolation (lerp) for Y-axis - 0.01 = smoothing factor (lower = smoother)
        camera.position.y += (targetCameraHeight - camera.position.y) * 0.05;
    } else if (currentPerspective !== 'bird') {
        // Lock the Y position to eye level (no vertical movement) - but NOT for bird
        camera.position.y = eyeLevelHeight;
        targetCameraHeight = eyeLevelHeight;
    } else if (currentPerspective === 'bird' && pointCloud) {
        // Bird perspective: enforce lower limit based on terrain height
        const terrainHeight = getTerrainHeightAtPosition(camera.position.x, camera.position.z);
        if (terrainHeight !== null) {
            // Don't allow barn owl to go below the lowest point in the area
            const minHeight = terrainHeight;
            if (camera.position.y < minHeight) {
                camera.position.y = minHeight;
            }
        }
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

function pushPointsAway() {
    if (!pointCloud || !originalPositions || !originalColors || !touchedByAnimal) return;
    
    const settings = perspectiveSettings[currentPerspective];
    const sphereRadius = settings.sphereRadius;
    
    // Skip point pushing if sphereRadius is 0 or undefined
    if (!sphereRadius || sphereRadius === 0) return;
    
    const positions = pointCloud.geometry.attributes.position;
    const colors = pointCloud.geometry.attributes.color;
    const cameraPos = camera.position;
    
    // Define tint colors
    const mouseTint = { r: 1.0, g: 1.0, b: 0.0 }; // Yellow for mouse
    const owlTint = { r: 0.6, g: 0.4, b: 0.2 }; // Brown for barn owl
    const tintStrength = 0.5; // How much to blend with original color
    
    // Iterate through all points
    for (let i = 0; i < positions.count; i++) {
        const idx = i * 3;
        
        // Get original position
        const origX = originalPositions[idx];
        const origY = originalPositions[idx + 1];
        const origZ = originalPositions[idx + 2];
        
        // Calculate distance from camera to original point position
        const dx = origX - cameraPos.x;
        const dy = origY - cameraPos.y;
        const dz = origZ - cameraPos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // If point is inside sphere, push it away and mark it as touched
        if (distance < sphereRadius) {
            // Mark point as touched by current animal
            if (currentPerspective === 'mouse' && touchedByAnimal[i] === 0) {
                touchedByAnimal[i] = 1; // Mouse touched
            } else if (currentPerspective === 'bird' && touchedByAnimal[i] === 0) {
                touchedByAnimal[i] = 2; // Owl touched
            } else if (currentPerspective === 'human' && touchedByAnimal[i] === 0) {
                touchedByAnimal[i] = 3; // Human touched
            }
            
            if (distance > 0.001) { // Avoid division by zero
                // Calculate push direction (normalized)
                const pushX = dx / distance;
                const pushY = dy / distance;
                const pushZ = dz / distance;
                
                // Push point to sphere surface
                const pushAmount = sphereRadius - distance;
                positions.setXYZ(
                    i,
                    origX + pushX * pushAmount,
                    origY + pushY * pushAmount,
                    origZ + pushZ * pushAmount
                );
            }
        } else {
            // Point is outside sphere, restore to original position
            positions.setXYZ(i, origX, origY, origZ);
        }
        
        // Apply color tint based on which animal touched it
        const origR = originalColors[idx];
        const origG = originalColors[idx + 1];
        const origB = originalColors[idx + 2];
        
        if (touchedByAnimal[i] === 1) {
            // Mouse touched - tint yellow
            colors.setXYZ(
                i,
                origR * (1 - tintStrength) + mouseTint.r * tintStrength,
                origG * (1 - tintStrength) + mouseTint.g * tintStrength,
                origB * (1 - tintStrength) + mouseTint.b * tintStrength
            );
        } else if (touchedByAnimal[i] === 2) {
            // Owl touched - tint brown
            colors.setXYZ(
                i,
                origR * (1 - tintStrength) + owlTint.r * tintStrength,
                origG * (1 - tintStrength) + owlTint.g * tintStrength,
                origB * (1 - tintStrength) + owlTint.b * tintStrength
            );
        } else if (touchedByAnimal[i] === 3) {
            // Human touched - turn black
            colors.setXYZ(i, 0.0, 0.0, 0.0);
        } else {
            // Not touched - keep original color
            colors.setXYZ(i, origR, origG, origB);
        }
    }
    
    // Mark colors as needing update
    colors.needsUpdate = true;
    
    // Mark positions as needing update
    positions.needsUpdate = true;
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
    
    // Apply perspective-based world scale (smaller animals see a larger world)
    const worldScale = perspectiveSettings[currentPerspective].worldScale;
    scale *= worldScale;

    console.log(`Ranges: X=${rangeX}, Y=${rangeY}, Z=${rangeZ}`);
    console.log(`Scale factor: ${scale} (worldScale: ${worldScale}x for ${currentPerspective})`);

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
        positions[idx] = -(point.x - centerX) * scale; // Mirror on X-axis to match Rhino
        positions[idx + 1] = (point.z - minZ) * scale; // Use Z as height, starting from 0
        positions[idx + 2] = (point.y - centerY) * scale; // Use Y as depth (Z in 3D)

        const color = getColor(point.z);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Store original positions and colors for displacement effect and tinting
    originalPositions = new Float32Array(positions);
    originalColors = new Float32Array(colors);
    touchedByAnimal = new Uint8Array(data.length); // 0=none, 1=mouse, 2=owl

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
    // Falcon and barn owls removed - no longer displayed
    // Create Peregrine Falcon (red dot) - DISABLED
    // const falconGeometry = new THREE.SphereGeometry(20, 32, 32);
    // const falconMaterial = new THREE.MeshPhongMaterial({
    //     color: 0xff0000,
    //     emissive: 0xff0000,
    //     emissiveIntensity: 0.5,
    //     transparent: true,
    //     opacity: 0.9
    // });
    // falconCharacter = new THREE.Mesh(falconGeometry, falconMaterial);
    // falconCharacter.position.set(
    //     Math.random() * 1000 - 500,
    //     4000, // Higher flying height
    //     Math.random() * 1000 - 500
    // );
    // falconCharacter.userData = {
    //     type: 'falcon',
    //     speed: 8.0,
    //     detectionRange: 500,
    //     direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
    //     target: null,
    //     chaseTimer: 0,
    //     chaseInterval: Math.random() * 300 + 200 // Random interval between chases
    // };
    // scene.add(falconCharacter);

    // Create random number of Barn Owls (black dots) - DISABLED
    // const numOwls = Math.floor(Math.random() * 5) + 3; // 3-7 barn owls
    // for (let i = 0; i < numOwls; i++) {
    //     const owlGeometry = new THREE.SphereGeometry(15, 32, 32);
    //     const owlMaterial = new THREE.MeshPhongMaterial({
    //         color: 0x000000,
    //         emissive: 0x333333,
    //         emissiveIntensity: 0.3,
    //         transparent: true,
    //         opacity: 0.9
    //     });
    //     const owl = new THREE.Mesh(owlGeometry, owlMaterial);
    //     owl.position.set(
    //         Math.random() * 1000 - 500,
    //         3000,
    //         Math.random() * 1000 - 500
    //     );
    //     owl.userData = {
    //         type: 'barnowl',
    //         speed: 5.0,
    //         direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
    //     };
    //     owl.visible = false; // Only visible in barn owl mode
    //     barnOwlCharacters.push(owl);
    //     scene.add(owl);
    // }

    // Create exactly 3 Mice (yellow dots)
    for (let i = 0; i < 3; i++) {
        const mouseGeometry = new THREE.SphereGeometry(4, 32, 32);
        const mouseMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        });
        const mouse = new THREE.Mesh(mouseGeometry, mouseMaterial);
        mouse.position.set(
            Math.random() * 1000 - 500,
            37.5,
            Math.random() * 1000 - 500
        );
        mouse.userData = {
            type: 'mouse',
            direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
            alive: true
        };
        miceCharacters.push(mouse);
        scene.add(mouse);
    }

    // Create exactly 10 Cheese pieces (yellow dots, stationary, for mouse perspective)
    for (let i = 0; i < 10; i++) {
        const cheeseGeometry = new THREE.SphereGeometry(5, 32, 32);
        const cheeseMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.95
        });
        const cheese = new THREE.Mesh(cheeseGeometry, cheeseMaterial);
        cheese.position.set(
            Math.random() * 1000 - 500,
            37.5, // Ground level
            Math.random() * 1000 - 500
        );
        cheese.userData = {
            type: 'cheese',
            collected: false
        };
        cheese.visible = false; // Only visible in mouse mode
        cheeseItems.push(cheese);
        scene.add(cheese);
    }

    console.log(`Game characters created: Falcon, ${numOwls} Barn Owls, 3 Mice, 10 Cheese`);
}

// Update AI characters
function updateAICharacters() {
    if (miceCharacters.length === 0) return;

    // Get mouse speed from perspective settings
    const mouseSpeed = perspectiveSettings.mouse.moveSpeed;

    // Falcon and barn owls no longer displayed
    // Update barn owl visibility based on current perspective
    // barnOwlCharacters.forEach(owl => {
    //     owl.visible = (currentPerspective === 'bird');
    // });
    
    // Update mice visibility - only visible in human and barn owl perspectives
    miceCharacters.forEach(mouse => {
        mouse.visible = (currentPerspective === 'human' || currentPerspective === 'bird');
    });
    
    // Update cheese visibility - only visible in mouse perspective
    cheeseItems.forEach(cheese => {
        cheese.visible = (currentPerspective === 'mouse' && !cheese.userData.collected);
    });

    // Falcon and barn owl behavior disabled - characters removed
    // Update Falcon behavior
    // const falconData = falconCharacter.userData;
    // falconData.chaseTimer++;
    // 
    // // Periodically chase a random barn owl
    // if (falconData.chaseTimer > falconData.chaseInterval) {
    //     if (!gameState.falconChasing) {
    //         // Start chasing
    //         gameState.falconChasing = true;
    //         falconData.target = barnOwlCharacters[Math.floor(Math.random() * barnOwlCharacters.length)];
    //         falconData.chaseTimer = 0;
    //         falconData.chaseDuration = Math.random() * 200 + 100; // Chase for 100-300 frames
    //         showFalconAlert();
    //     }
    // }
    // 
    // if (gameState.falconChasing && falconData.target) {
    //     // Chase the barn owl
    //     const direction = new THREE.Vector3().subVectors(falconData.target.position, falconCharacter.position);
    //     direction.y = 0;
    //     direction.normalize();
    //     falconData.direction.copy(direction);
    //     
    //     // Stop chasing after duration
    //     if (falconData.chaseTimer > falconData.chaseDuration) {
    //         gameState.falconChasing = false;
    //         falconData.target = null;
    //         falconData.chaseTimer = 0;
    //         falconData.chaseInterval = Math.random() * 300 + 200;
    //         hideFalconAlert();
    //     }
    // } else {
    //     // Random roaming
    //     if (Math.random() < 0.02) {
    //         falconData.direction.set(
    //             Math.random() - 0.5,
    //             0,
    //             Math.random() - 0.5
    //         ).normalize();
    //     }
    // }
    // 
    // falconCharacter.position.x += falconData.direction.x * falconData.speed;
    // falconCharacter.position.z += falconData.direction.z * falconData.speed;
    // falconCharacter.position.x = Math.max(-1000, Math.min(1000, falconCharacter.position.x));
    // falconCharacter.position.z = Math.max(-1000, Math.min(1000, falconCharacter.position.z));

    // Update Barn Owls (random roaming) - DISABLED
    // barnOwlCharacters.forEach(owl => {
    //     const owlData = owl.userData;
    //     
    //     if (Math.random() < 0.02) {
    //         owlData.direction.set(
    //             Math.random() - 0.5,
    //             0,
    //             Math.random() - 0.5
    //         ).normalize();
    //     }
    //     
    //     owl.position.x += owlData.direction.x * owlData.speed;
    //     owl.position.z += owlData.direction.z * owlData.speed;
    //     owl.position.x = Math.max(-1000, Math.min(1000, owl.position.x));
    //     owl.position.z = Math.max(-1000, Math.min(1000, owl.position.z));
    // });

    // Update Mice (use exact mouse perspective movement rules)
    miceCharacters.forEach(mouse => {
        if (!mouse.userData.alive) return;
        
        const mouseData = mouse.userData;
        const mouseSettings = perspectiveSettings.mouse;
        
        // Random direction changes (same behavior as AI mouse)
        if (Math.random() < 0.03) {
            mouseData.direction.set(
                Math.random() - 0.5,
                0,
                Math.random() - 0.5
            ).normalize();
        }
        
        // Use the exact same moveSpeed as mouse perspective (not scrollSpeed)
        // This matches the handleMovement() function for mouse perspective
        mouse.position.x += mouseData.direction.x * mouseSettings.moveSpeed;
        mouse.position.z += mouseData.direction.z * mouseSettings.moveSpeed;
        mouse.position.x = Math.max(-1000, Math.min(1000, mouse.position.x));
        mouse.position.z = Math.max(-1000, Math.min(1000, mouse.position.z));
        
        // Check if player is within 10 units of mouse (collectible)
        const distance = camera.position.distanceTo(mouse.position);
        if (distance < 10) {
            catchMouse(mouse);
        }
    });
    
    // Update mice caught counter
    updateMiceCounter();
}

// Handle mouse catch
function catchMouse(mouse) {
    if (!mouse.userData.alive) return;
    
    mouse.userData.alive = false;
    mouse.visible = false;
    gameState.miceCaught++;
    
    console.log(`Barn owl caught a mouse! Total: ${gameState.miceCaught}`);
    updateMiceCounter();
}

// Update mice counter display
function updateMiceCounter() {
    const caughtElement = document.getElementById('caught');
    if (caughtElement) {
        if (currentPerspective === 'mouse') {
            caughtElement.textContent = `${gameState.cheeseCollected}/10`;
        } else {
            caughtElement.textContent = `${gameState.miceCaught}/3`;
        }
    }
}

// Collect cheese (for mouse perspective)
function tryCollectCheese() {
    // Try to collect cheese within 30 units
    let collected = false;
    cheeseItems.forEach(cheese => {
        if (cheese.userData.collected) return;
        
        const distance = camera.position.distanceTo(cheese.position);
        if (distance < 30) {
            collectCheese(cheese);
            collected = true;
        }
    });
    
    if (!collected) {
        console.log('No cheese within reach (30 units)');
    }
}

function collectCheese(cheese) {
    if (cheese.userData.collected) return;
    
    cheese.userData.collected = true;
    cheese.visible = false; // Hide the yellow marker
    scene.remove(cheese); // Remove from scene entirely
    gameState.cheeseCollected++;
    
    // Update score display
    updateScoreDisplay();
    
    // Play eating sound effect
    playCheeseEatingSound();
    
    console.log(`Mouse collected cheese! Score: ${gameState.cheeseCollected}`);
    updateMiceCounter();
}

function updateScoreDisplay() {
    const scoreDisplay = document.getElementById('scoreDisplay');
    const scoreValue = document.getElementById('scoreValue');
    
    if (currentPerspective === 'mouse') {
        scoreDisplay.style.display = 'block';
        scoreValue.textContent = gameState.cheeseCollected;
    } else {
        scoreDisplay.style.display = 'none';
    }
}

// Play cheese eating sound effect
function playCheeseEatingSound() {
    // Create an audio context and play a simple eating sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create a "crunch" sound effect
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
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
