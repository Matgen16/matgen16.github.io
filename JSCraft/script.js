const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.rotation.order = 'YXZ';

const cameraRotation = { x: 0, y: 0 };
const cameraPosition = new THREE.Vector3(0, 5, 10);
const moveSpeed = 0.1;
const sensitivity = 0.002;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

//ui canvas
const uiCanvas = document.getElementById('ui');
const uiCtx = uiCanvas.getContext('2d');


//Blocks
const blockList = [
    { name: 'null', texture: '' },
    { name: 'dirt', texture: './textures/Dirt.webp' },
    { name: 'stone', texture: './textures/Stone.webp' },
    { name: 'oak_planks', texture: './textures/Oak_Planks.webp' },
]


//Selected block type
let hotbar = [blockList[1], blockList[2], blockList[3], blockList[0], blockList[0], blockList[0], blockList[0], blockList[0], blockList[0]];
let selectedHotbarIndex = 0;

//Initilize hotbar textures
hotbar.forEach(block => {
    if (block.texture && !block.img) {
        block.img = new Image();
        block.img.src = block.texture;
    }
});

// Preload Three textures for hotbar entries
const textureLoader = new THREE.TextureLoader();
hotbar.forEach(b => {
    if (b.texture && !b.threeTexture) {
        b.threeTexture = textureLoader.load(
            b.texture,
            (tex) => {
                // prefer crisp pixel look for block textures (optional)
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestMipMapNearestFilter;
            },
            undefined,
            (err) => { console.warn('Texture load failed:', b.texture, err); }
        );
    }
});



// Ensure UI canvas is positioned as an overlay and sized to match the renderer
function resizeUICanvas() {
    const dpr = window.devicePixelRatio || 1;
    // set the drawing buffer size for crisp rendering
    uiCanvas.width = Math.floor(window.innerWidth * dpr);
    uiCanvas.height = Math.floor(window.innerHeight * dpr);
    // set the element size to match CSS/layout (keeps it full-window)
    uiCanvas.style.width = window.innerWidth + 'px';
    uiCanvas.style.height = window.innerHeight + 'px';
    // scale the 2D context so drawing calls can use CSS pixels
    uiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ensure overlay positioning and that it doesn't capture pointer events
    uiCanvas.style.position = 'absolute';
    uiCanvas.style.left = '0';
    uiCanvas.style.top = '0';
    uiCanvas.style.zIndex = '10';
    uiCanvas.style.pointerEvents = 'none';
}

// initialize immediately
resizeUICanvas();
window.addEventListener('resize', () => {
    // keep renderer and UI canvas in sync
    resizeUICanvas();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Voxel system
const CHUNK_SIZE = 16;
const VOXEL_SIZE = 1;
const chunks = new Map();

// Interaction / preview settings
const MAX_REACH = 6; // maximum distance (in world units) the player can reach
let previewMesh = null;
let previewOutline = null;
const previewMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true, depthTest: true });
const previewOutlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });

const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
const materials = [
    new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    new THREE.MeshLambertMaterial({ color: 0x228B22 }),
    new THREE.MeshLambertMaterial({ color: 0x808080 }),
];

class Chunk {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.voxels = new Map();
        this.mesh = null;
    }
    
    getKey(x, y, z) {
        return `${x},${y},${z}`;
    }
    
    setVoxel(x, y, z, type) {
        this.voxels.set(this.getKey(x, y, z), type);
        this.updateMesh();
    }
    
    removeVoxel(x, y, z) {
        this.voxels.delete(this.getKey(x, y, z));
        this.updateMesh();
    }
    
    updateMesh() {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }
        
        if (this.voxels.size === 0) return;
        
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const colors = [];
        const indices = [];
        let vertexCount = 0;
        
        this.voxels.forEach((type, key) => {
            const [x, y, z] = key.split(',').map(Number);
            const worldX = this.x * CHUNK_SIZE + x;
            const worldY = this.y * CHUNK_SIZE + y;
            const worldZ = this.z * CHUNK_SIZE + z;
            
            const color = materials[type % materials.length].color;
            
            const faces = [
                { dir: [1,0,0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
                { dir: [-1,0,0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
                { dir: [0,1,0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
                { dir: [0,-1,0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
                { dir: [0,0,1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
                { dir: [0,0,-1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
            ];
            
            faces.forEach(({ dir, corners }) => {
                const startVertex = vertexCount;
                
                corners.forEach(([cx, cy, cz]) => {
                    positions.push(
                        worldX + cx * VOXEL_SIZE - VOXEL_SIZE/2,
                        worldY + cy * VOXEL_SIZE - VOXEL_SIZE/2,
                        worldZ + cz * VOXEL_SIZE - VOXEL_SIZE/2
                    );
                    normals.push(...dir);
                    colors.push(color.r, color.g, color.b);
                });
                
                indices.push(
                    startVertex, startVertex + 1, startVertex + 2,
                    startVertex, startVertex + 2, startVertex + 3
                );
                
                vertexCount += 4;
            });
        });
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        
		const textureLoader = new THREE.TextureLoader();
		const texture = textureLoader.load(hotbar[selectedHotbarIndex].texture);
		
        const material = new THREE.MeshBasicMaterial({map: texture});
        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);
    }
}

function getChunk(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cy},${cz}`;
    
    if (!chunks.has(key)) {
        chunks.set(key, new Chunk(cx, cy, cz));
    }
    return chunks.get(key);
}

function setVoxel(x, y, z, type) {
    const chunk = getChunk(x, y, z);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setVoxel(lx, ly, lz, type);
}

function removeVoxel(x, y, z) {
    const chunk = getChunk(x, y, z);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.removeVoxel(lx, ly, lz);
}

// Initial ground
for (let x = -3; x < 3; x++) {
    for (let z = -3; z < 3; z++) {
        setVoxel(x, 0, z, 0);
    }
}

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    // Support pointer-lock center aiming: if pointer locked, use screen center
    if (isPointerLocked) {
        mouse.x = 0;
        mouse.y = 0;
    } else {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    raycaster.setFromCamera(mouse, camera);

    const meshes = Array.from(chunks.values())
        .map(c => c.mesh)
        .filter(m => m !== null);

    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const point = intersect.point.clone();

        // Convert face normal to world space (important for transformed objects)
        const normal = intersect.face.normal.clone();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
        normal.applyMatrix3(normalMatrix).normalize();

        // Determine target voxel position (add for placement, sub for removal)
        if (event.button==2) {
            const voxelPos = point.clone().sub(normal.clone().multiplyScalar(0.5));
            const x = Math.round(voxelPos.x);
            const y = Math.round(voxelPos.y);
            const z = Math.round(voxelPos.z);
            const target = new THREE.Vector3(x, y, z);
            if (camera.position.distanceTo(target) <= MAX_REACH) {
                removeVoxel(x, y, z);
                updateStats();
            }
        } else if (event.button==0) {
            const voxelPos = point.clone().add(normal.clone().multiplyScalar(0.5));
            const x = Math.round(voxelPos.x);
            const y = Math.round(voxelPos.y);
            const z = Math.round(voxelPos.z);
            const target = new THREE.Vector3(x, y, z);
            if (camera.position.distanceTo(target) <= MAX_REACH) {
                const type = Math.floor(Math.random() * materials.length);
                setVoxel(x, y, z, type);
                updateStats();
            }
        }
    }
}

function onMouseScroll(e) {
    if (e.deltaY > 0) {
        selectedHotbarIndex = (selectedHotbarIndex + 1) % 9;
    } else {
        selectedHotbarIndex = (selectedHotbarIndex + 8) % 9;
    }
}

renderer.domElement.addEventListener('click', onMouseClick);
renderer.domElement.addEventListener('wheel', onMouseScroll);

// Create preview mesh and outline lazily
function createPreview() {
    if (previewMesh) return;
    const geom = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    previewMesh = new THREE.Mesh(geom, previewMaterial);
    previewMesh.visible = false;
    scene.add(previewMesh);

    const edges = new THREE.EdgesGeometry(geom);
    previewOutline = new THREE.LineSegments(edges, previewOutlineMaterial);
    previewOutline.visible = false;
    // Slightly scale outline so it sits on top without z-fighting
    previewOutline.renderOrder = 999;
    previewOutline.scale.set(1.01, 1.01, 1.01);
    scene.add(previewOutline);
}

// Update preview based on mouse or center (when pointer locked)
function updatePreview(event) {
    // lazy create
    createPreview();

    if (isPointerLocked && !event) {
        // use center of screen when pointer locked
        mouse.x = 0;
        mouse.y = 0;
    } else if (event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    raycaster.setFromCamera(mouse, camera);

    const meshes = Array.from(chunks.values())
        .map(c => c.mesh)
        .filter(m => m !== null);

    const intersects = raycaster.intersectObjects(meshes);

    let targetPos = null;
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const normal = intersects[0].face.normal;
        if (keys['ShiftLeft'] || keys['ShiftRight']) {
            // removal preview - voxel under cursor
            const voxelPos = point.clone().sub(normal.clone().multiplyScalar(0.5));
            targetPos = new THREE.Vector3(
                Math.round(voxelPos.x),
                Math.round(voxelPos.y),
                Math.round(voxelPos.z)
            );
            previewMaterial.color.set(0xff6666);
            previewMaterial.opacity = 0.45;
        } else {
            // placement preview - adjacent
            const voxelPos = point.clone().add(normal.clone().multiplyScalar(0.5));
            targetPos = new THREE.Vector3(
                Math.round(voxelPos.x),
                Math.round(voxelPos.y),
                Math.round(voxelPos.z)
            );
            previewMaterial.color.set(0xffffff);
            previewMaterial.opacity = 0.45;
        }
    } else {
        // No intersection: show at max reach along view direction
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const point = raycaster.ray.origin.clone().add(dir.multiplyScalar(MAX_REACH));
        targetPos = new THREE.Vector3(
            Math.round(point.x),
            Math.round(point.y),
            Math.round(point.z)
        );
        previewMaterial.color.set(0xffffff);
        previewMaterial.opacity = 0.25;
    }

    if (targetPos) {
        const distance = camera.position.distanceTo(targetPos);
        if (distance <= MAX_REACH) {
            previewMesh.position.set(targetPos.x, targetPos.y, targetPos.z);
            previewMesh.visible = true;
            previewOutline.position.copy(previewMesh.position);
            previewOutline.visible = true;
        } else {
            // out of reach - hide preview
            previewMesh.visible = false;
            previewOutline.visible = false;
        }
    } else {
        previewMesh.visible = false;
        previewOutline.visible = false;
    }
}

renderer.domElement.addEventListener('mousemove', updatePreview);

// Pointer lock controls
const prompt = document.getElementById('pointer-lock-prompt');
let isPointerLocked = false;

const keys = {};

prompt.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
    prompt.classList.toggle('hidden', isPointerLocked);
});

document.addEventListener('mousemove', (event) => {
    if (!isPointerLocked) return;
    
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    
    cameraRotation.y -= movementX * sensitivity;
    cameraRotation.x -= movementY * sensitivity;
    
    cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));
    
    camera.rotation.y = cameraRotation.y;
    camera.rotation.x = cameraRotation.x;
});

document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

function updateMovement() {
    if (!isPointerLocked) return;
    
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    
    if (keys['KeyW'] || keys['ArrowUp']) {
        cameraPosition.add(forward.multiplyScalar(moveSpeed));
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        cameraPosition.sub(forward.multiplyScalar(moveSpeed));
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
        cameraPosition.sub(right.multiplyScalar(moveSpeed));
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        cameraPosition.add(right.multiplyScalar(moveSpeed));
    }
    if (keys['Space']) {
        cameraPosition.y += moveSpeed;
    }
    if (keys['ShiftLeft'] || keys['ShiftRight']) {
        cameraPosition.y -= moveSpeed;
    }
    
    camera.position.copy(cameraPosition);
}

// Stats
function updateStats() {
    let totalVoxels = 0;
    chunks.forEach(chunk => {
        totalVoxels += chunk.voxels.size;
    });
    document.getElementById('chunk-count').textContent = chunks.size;
    document.getElementById('voxel-count').textContent = totalVoxels;
}

// FPS counter
let lastTime = performance.now();
let frames = 0;

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


// Crosshair
function drawCrosshair() {
    const size = 20;
    const thickness = 2;
    // compute CSS pixel dimensions (account for DPR scaling)
    const cssWidth = uiCanvas.width / (window.devicePixelRatio || 1);
    const cssHeight = uiCanvas.height / (window.devicePixelRatio || 1);
    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2;
    uiCtx.clearRect(0, 0, cssWidth, cssHeight);
    uiCtx.fillStyle = 'white';
    uiCtx.fillRect(centerX - thickness / 2, centerY - size / 2, thickness, size);
    uiCtx.fillRect(centerX - size / 2, centerY - thickness / 2, size, thickness);
}

//Hotbar update
function updateHotbar() {
    const slots = 9;
    const slotSize = 80;
    const padding = 10;
    const cssWidth = uiCanvas.width / (window.devicePixelRatio || 1);
    const cssHeight = uiCanvas.height / (window.devicePixelRatio || 1);
    const totalWidth = slots * (slotSize + padding) - padding;
    const startX = (cssWidth - totalWidth) / 2;
    const y = cssHeight - slotSize - 20;
    for (let j = 1; j >= 0; j--) {
        for (let i = 0; i < slots; i++) {
            if (i == selectedHotbarIndex && j == 1) {
                uiCtx.fillStyle = `rgba(255, 215, 0, 0.8)`; // Highlight selected slot
            } else {
                uiCtx.fillStyle = `rgba(${j * 60}, ${j * 60}, ${j * 60}, ${j * 0.25 + 0.5})`;
            }
            const x = startX + i * (slotSize + padding);
            uiCtx.fillRect(x - (j * 5), y - (j * 5), (slotSize+(j * 10)), (slotSize+(j * 10)));
            if (j == 0 && hotbar[i].img?.complete) {
                uiCtx.drawImage(hotbar[i].img, x + 10, y + 10, slotSize - 20, slotSize - 20);
            }
        }
    }
}

function updateUI(){
    drawCrosshair();
    updateHotbar();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    updateMovement();
    // keep preview updated for pointer-lock center aiming
    updatePreview();
    updateUI();

    frames++;
    const now = performance.now();
    if (now >= lastTime + 1000) {
        document.getElementById('fps').textContent = frames;
        frames = 0;
        lastTime = now;
    }
    
    renderer.render(scene, camera);
}

updateStats();
animate();