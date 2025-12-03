let currentData = [];

// Load and visualize data
async function loadData(filename) {
    console.log('Loading data...');

    try {
        const response = await fetch(filename);
        const text = await response.text();

        // Parse CSV
        const lines = text.trim().split('\n');
        const header = lines[0];
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            data.push({
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2])
            });
        }

        currentData = data;
        console.log(`Loaded ${data.length.toLocaleString()} points`);
        visualizeData(data);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function visualizeData(data) {
    const svg = document.getElementById('pointcloud');
    svg.innerHTML = ''; // Clear previous content

    // Find bounds
    const xValues = data.map(p => p.x);
    const yValues = data.map(p => p.y);
    const zValues = data.map(p => p.z);

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);

    // SVG dimensions
    const svgRect = svg.getBoundingClientRect();
    const width = svgRect.width;
    const height = svgRect.height;
    const padding = 50;

    // Calculate scale factors
    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;
    const scaleX = (width - 2 * padding) / dataWidth;
    const scaleY = (height - 2 * padding) / dataHeight;
    const scale = Math.min(scaleX, scaleY);

    // Center the visualization
    const offsetX = (width - dataWidth * scale) / 2;
    const offsetY = (height - dataHeight * scale) / 2;

    // Color interpolation from red (low Z) to blue (high Z)
    function getColor(z) {
        const normalized = (z - minZ) / (maxZ - minZ);
        const r = Math.round(255 * (1 - normalized));
        const g = 0;
        const b = Math.round(255 * normalized);
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Determine circle radius based on number of points
    const radius = data.length > 50000 ? 1 : 2;

    // Draw points
    data.forEach(point => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const cx = (point.x - minX) * scale + offsetX;
        const cy = height - ((point.y - minY) * scale + offsetY); // Flip Y axis

        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', getColor(point.z));
        circle.setAttribute('opacity', 0.6);

        svg.appendChild(circle);
    });

    console.log(`Rendered ${data.length} points`);
    console.log(`Bounds: X(${minX}-${maxX}), Y(${minY}-${maxY}), Z(${minZ}-${maxZ})`);
}

// Auto-load 10k sample on page load
window.addEventListener('load', () => {
    loadData('New_Pointcloud\\02.12_Pointcloud.csv.csv');

    // Add event listeners to radio buttons
    const radios = document.querySelectorAll('input[name="dataset"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            loadData(e.target.value);
        });
    });
});
