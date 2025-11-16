import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, pointCloud;
let currentData = [];
let currentMaxZPercent = 100;

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
    camera.position.set(2000, 2000, 2000);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 10000;

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

    // Start animation loop
    animate();

    // Load initial data
    loadData('BMT_Pointcloud_sample_10k.csv');
}

function onWindowResize() {
    const container = document.getElementById('container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
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
        opacity: 0.8
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
}

// Initialize on load
init();
