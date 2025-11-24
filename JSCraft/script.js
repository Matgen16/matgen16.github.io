const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 0);
camera.rotation.order = 'YXZ';

const cameraRotation = { x: 0, y: 0 };
const cameraPosition = new THREE.Vector3(0, 5, 0);
const moveSpeed = 0.1;
const sensitivity = 0.002;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const uiCanvas = document.getElementById('ui');
const uiCtx = uiCanvas.getContext('2d');

let velocity = new THREE.Vector3(0, 0, 0);
const gravity = -0.02;
const jumpStrength = 0.35;
let onGround = false;

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 2;
const EYE_HEIGHT = 1;

const blockList = [
    { name: 'null', texture: '', color: 0x000000, transparent: false },
    { name: 'dirt', texture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/dirt.png', color: 0x8B4513, transparent: false },
    { name: 'stone', texture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/stone.png', color: 0x808080, transparent: false },
    { name: 'oak_planks', texture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/oak_planks.png', color: 0xDEB887, transparent: false },
    { 
        name: 'oak_log', 
        texture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/oak_log.png',
        topTexture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/oak_log_top.png',
        color: 0x8B4513, 
        transparent: false
    },
        { 
        name: 'grass', 
        texture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/grass_block_side.png',
        topTexture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/grass_block_top.png',
        bottomTexture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/dirt.png',
        color: 0x8B4513, 
        transparent: false
    },
    { name: 'glass', texture: 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/glass.png', color: 0xDEB887, transparent: true },
];	

let hotbar = [blockList[0],blockList[1], blockList[2], blockList[3], blockList[4], blockList[5], blockList[6], blockList[0], blockList[0]];
let selectedHotbarIndex = 0;

hotbar.forEach(block => {
    if (block.texture && !block.img) {
        block.img = new Image();
        block.img.src = block.texture;
    } else if (block.color) {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + block.color.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 16, 16);
        block.img = new Image();
        block.img.src = canvas.toDataURL();
    }
});

const textureLoader = new THREE.TextureLoader();
hotbar.forEach(b => {
    if (b.texture && !b.threeTexture) {
        b.threeTexture = textureLoader.load(
            b.texture,
            (tex) => {
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestMipMapNearestFilter;
            },
            undefined,
            (err) => { console.warn('Texture load failed:', b.texture, err); }
        );
    }
    if (b.topTexture && !b.threeTopTexture) {
        b.threeTopTexture = textureLoader.load(
            b.topTexture,
            (tex) => {
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestMipMapNearestFilter;
            },
            undefined,
            (err) => { console.warn('Top texture load failed:', b.topTexture, err); }
        );
    }
	if (b.bottomTexture && !b.threeBottomTexture) {
        b.threeBottomTexture = textureLoader.load(
            b.bottomTexture,
            (tex) => {
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestMipMapNearestFilter;
            },
            undefined,
            (err) => { console.warn('Top texture load failed:', b.bottomTexture, err); }
        );
    }
    if (b.color && !b.threeTexture) {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + b.color.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 16, 16);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipMapNearestFilter;
        b.threeTexture = texture;
    }
});

function resizeUICanvas() {
    const dpr = window.devicePixelRatio || 1;
    uiCanvas.width = Math.floor(window.innerWidth * dpr);
    uiCanvas.height = Math.floor(window.innerHeight * dpr);
    uiCanvas.style.width = window.innerWidth + 'px';
    uiCanvas.style.height = window.innerHeight + 'px';
    uiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    uiCanvas.style.position = 'absolute';
    uiCanvas.style.left = '0';
    uiCanvas.style.top = '0';
    uiCanvas.style.zIndex = '10';
    uiCanvas.style.pointerEvents = 'none';
}

resizeUICanvas();
window.addEventListener('resize', () => {
    resizeUICanvas();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const CHUNK_SIZE = 16;
const VOXEL_SIZE = 1;
const chunks = new Map();

const MAX_REACH = 6;
let previewMesh = null;
let previewOutline = null;
const previewMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true, depthTest: true });
const previewOutlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });

const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);

// Perlin Noise Generator
class PerlinNoise {
    constructor() {
        this.permutation = [];
        this.grad3 = [
            [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0],
            [1,0,1], [-1,0,1], [1,0,-1], [-1,0,-1],
            [0,1,1], [0,-1,1], [0,1,-1], [0,-1,-1]
        ];
        this.init();
    }

    init() {
        // Create permutation table
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = i;
        }
        
        // Shuffle the permutation table
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
        }
        
        // Duplicate the permutation table
        for (let i = 0; i < 256; i++) {
            this.permutation[256 + i] = this.permutation[i];
        }
    }

    dot(g, x, y, z) {
        return g[0] * x + g[1] * y + g[2] * z;
    }

    mix(a, b, t) {
        return (1 - t) * a + t * b;
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    noise(x, y, z) {
        // Find unit cube that contains point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        
        // Find relative x,y,z of point in cube
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        
        // Compute fade curves for each of x,y,z
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        
        // Hash coordinates of the 8 cube corners
        const A = this.permutation[X] + Y;
        const AA = this.permutation[A] + Z;
        const AB = this.permutation[A + 1] + Z;
        const B = this.permutation[X + 1] + Y;
        const BA = this.permutation[B] + Z;
        const BB = this.permutation[B + 1] + Z;
        
        // Add blended results from 8 corners of cube
        const gradAA = this.grad3[this.permutation[AA] % 12];
        const gradBA = this.grad3[this.permutation[BA] % 12];
        const gradAB = this.grad3[this.permutation[AB] % 12];
        const gradBB = this.grad3[this.permutation[BB] % 12];
        const gradAA1 = this.grad3[this.permutation[AA + 1] % 12];
        const gradBA1 = this.grad3[this.permutation[BA + 1] % 12];
        const gradAB1 = this.grad3[this.permutation[AB + 1] % 12];
        const gradBB1 = this.grad3[this.permutation[BB + 1] % 12];
        
        const n000 = this.dot(gradAA, x, y, z);
        const n100 = this.dot(gradBA, x - 1, y, z);
        const n010 = this.dot(gradAB, x, y - 1, z);
        const n110 = this.dot(gradBB, x - 1, y - 1, z);
        const n001 = this.dot(gradAA1, x, y, z - 1);
        const n101 = this.dot(gradBA1, x - 1, y, z - 1);
        const n011 = this.dot(gradAB1, x, y - 1, z - 1);
        const n111 = this.dot(gradBB1, x - 1, y - 1, z - 1);
        
        // Interpolate
        const n00 = this.mix(n000, n100, u);
        const n01 = this.mix(n001, n101, u);
        const n10 = this.mix(n010, n110, u);
        const n11 = this.mix(n011, n111, u);
        
        const n0 = this.mix(n00, n10, v);
        const n1 = this.mix(n01, n11, v);
        
        return this.mix(n0, n1, w);
    }
    
    octaveNoise(x, y, z, octaves, persistence) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        
        return total / maxValue;
    }
}

const perlin = new PerlinNoise();

// Local Storage Management
class ChunkStorage {
    static getChunkKey(x, y, z) {
        return `chunk_${x}_${y}_${z}`;
    }

    static saveChunk(chunk) {
        try {
            const chunkData = {
                x: chunk.x,
                y: chunk.y,
                z: chunk.z,
                voxels: Array.from(chunk.voxels.entries())
            };
            localStorage.setItem(this.getChunkKey(chunk.x, chunk.y, chunk.z), JSON.stringify(chunkData));
        } catch (e) {
            console.warn('Failed to save chunk to localStorage:', e);
        }
    }

    static loadChunk(x, y, z) {
        try {
            const data = localStorage.getItem(this.getChunkKey(x, y, z));
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn('Failed to load chunk from localStorage:', e);
        }
        return null;
    }

    static deleteChunk(x, y, z) {
        try {
            localStorage.removeItem(this.getChunkKey(x, y, z));
        } catch (e) {
            console.warn('Failed to delete chunk from localStorage:', e);
        }
    }
}

class Chunk {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.voxels = new Map();
        this.mesh = null;
        this.modified = false;
    }
    
    getKey(x, y, z) {
        return `${x},${y},${z}`;
    }
    
    setVoxel(x, y, z, type) {
        this.voxels.set(this.getKey(x, y, z), { type, blockData: blockList[type] });
        this.modified = true;
        this.updateMesh();
        // Auto-save when modified
        this.saveToStorage();
    }
    
    removeVoxel(x, y, z) {
        this.voxels.delete(this.getKey(x, y, z));
        this.modified = true;
        this.updateMesh();
        // Auto-save when modified
        this.saveToStorage();
    }

    saveToStorage() {
        ChunkStorage.saveChunk(this);
    }

    loadFromStorage() {
        const data = ChunkStorage.loadChunk(this.x, this.y, this.z);
        if (data) {
            this.voxels = new Map(data.voxels);
            return true;
        }
        return false;
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
        const uvs = [];
        const indices = [];
        const groups = [];
        let vertexCount = 0;
        
        const voxelsByTypeFace = new Map();
        this.voxels.forEach((voxelData, key) => {
            const type = voxelData.type;
            const blockData = voxelData.blockData;
            const hasTopTexture = blockData.topTexture && blockData.threeTopTexture;
            const hasBottomTexture = blockData.bottomTexture && blockData.threeBottomTexture;
             if (hasBottomTexture || hasTopTexture) {
                ['top', 'bottom', 'side'].forEach(faceType => {
                    const materialKey = `${type}_${faceType}`;
                    if (!voxelsByTypeFace.has(materialKey)) {
                        voxelsByTypeFace.set(materialKey, []);
                    }
                    voxelsByTypeFace.get(materialKey).push({ key, faceType });
                });
            } else {
                const materialKey = `${type}_all`;
                if (!voxelsByTypeFace.has(materialKey)) {
                    voxelsByTypeFace.set(materialKey, []);
                }
                voxelsByTypeFace.get(materialKey).push({ key, faceType: 'all' });
            }
        });
        
        const meshMaterials = [];
        let groupIndex = 0;
        
        voxelsByTypeFace.forEach((items, materialKey) => {
            const [typeStr, faceType] = materialKey.split('_');
            const type = parseInt(typeStr);
            const startIndex = indices.length;
            
            items.forEach(({ key }) => {
                const [x, y, z] = key.split(',').map(Number);
                const worldX = this.x * CHUNK_SIZE + x;
                const worldY = this.y * CHUNK_SIZE + y;
                const worldZ = this.z * CHUNK_SIZE + z;
                
                const faces = [
                    { dir: [1,0,0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], uvs: [[0,0],[0,1],[1,1],[1,0]], type: 'side' },
                    { dir: [-1,0,0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], uvs: [[0,0],[0,1],[1,1],[1,0]], type: 'side' },
                    { dir: [0,1,0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], uvs: [[0,0],[0,1],[1,1],[1,0]], type: 'top' },
                    { dir: [0,-1,0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], uvs: [[0,0],[1,0],[1,1],[0,1]], type: 'bottom' },
                    { dir: [0,0,1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], uvs: [[0,0],[1,0],[1,1],[0,1]], type: 'side' },
                    { dir: [0,0,-1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], uvs: [[0,0],[1,0],[1,1],[0,1]], type: 'side' },
                ];
                
                faces.forEach(({ dir, corners, uvs: faceUvs, type: fType }) => {
                    if (faceType === 'all' || faceType === fType) {
                        const startVertex = vertexCount;
                        
                        corners.forEach(([cx, cy, cz], i) => {
                            positions.push(
                                worldX + cx * VOXEL_SIZE - VOXEL_SIZE/2,
                                worldY + cy * VOXEL_SIZE - VOXEL_SIZE/2,
                                worldZ + cz * VOXEL_SIZE - VOXEL_SIZE/2
                            );
                            normals.push(...dir);
                            uvs.push(...faceUvs[i]);
                        });
                        
                        indices.push(
                            startVertex, startVertex + 1, startVertex + 2,
                            startVertex, startVertex + 2, startVertex + 3
                        );
                        
                        vertexCount += 4;
                    }
                });
            });
            
            const count = indices.length - startIndex;
            if (count > 0) {
                groups.push({ start: startIndex, count, materialIndex: groupIndex });
                
                const block = blockList[type];
                let material;
                if (faceType === 'top' && block.threeTopTexture) {
                    material = new THREE.MeshLambertMaterial({ map: block.threeTopTexture });
                } else if (faceType === 'bottom' && block.threeBottomTexture) {
                    material = new THREE.MeshLambertMaterial({ map: block.threeBottomTexture });
                } else if (block.threeTexture) {
                    material = new THREE.MeshLambertMaterial({ map: block.threeTexture });
                } else if (block.color) {
                    material = new THREE.MeshLambertMaterial({ color: block.color });
                } else {
                    material = new THREE.MeshLambertMaterial({ color: 0x808080 });
                }
                
                meshMaterials.push(material);
                groupIndex++;
            }
        });
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        
        groups.forEach(g => {
            geometry.addGroup(g.start, g.count, g.materialIndex);
        });
        
        this.mesh = new THREE.Mesh(geometry, meshMaterials);
        scene.add(this.mesh);
    }
}

function getChunk(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cy},${cz}`;
    
    if (!chunks.has(key)) {
        const chunk = new Chunk(cx, cy, cz);
        
        // Try to load from storage first - FIXED: Check storage BEFORE generating
        const loaded = chunk.loadFromStorage();
        
        // If not in storage, generate new terrain
        if (!loaded) {
            generateTerrain(chunk);
        } else {
            chunk.updateMesh();
        }
        
        chunks.set(key, chunk);
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

function isOnFloor() {
    const halfWidth = PLAYER_WIDTH / 2;
    const footPos = cameraPosition.clone();
    footPos.y -= PLAYER_HEIGHT / 2 + 0.01;
    return checkAABBCollisionAtPosition(footPos, halfWidth, 0.01);
}

// Replace your old isPositionInsidePlayer with this:
function isPositionInsidePlayer(pos) {
    const halfWidth = PLAYER_WIDTH / 2;
    const halfHeight = PLAYER_HEIGHT / 2;
    const aMin = { x: cameraPosition.x - halfWidth, y: cameraPosition.y - halfHeight, z: cameraPosition.z - halfWidth };
    const aMax = { x: cameraPosition.x + halfWidth, y: cameraPosition.y + halfHeight, z: cameraPosition.z + halfWidth };
    // Only block placement if the voxel is strictly inside the player's box
    return pos.x > aMin.x && pos.x < aMax.x &&
           pos.y > aMin.y && pos.y < aMax.y &&
           pos.z > aMin.z && pos.z < aMax.z;
}

// Generate terrain for a chunk
function generateTerrain(chunk) {
    const worldX = chunk.x * CHUNK_SIZE;
    const worldZ = chunk.z * CHUNK_SIZE;
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            // Calculate global coordinates
            const globalX = worldX + x;
            const globalZ = worldZ + z;
            
            // Generate height using Perlin noise
            const scale = 0.05;
            const heightScale = 10;
            const baseHeight = 0;
            
            // Use octave noise for more natural terrain
            let height = perlin.octaveNoise(globalX * scale, globalZ * scale, 0, 4, 0.5);
            height = baseHeight + Math.floor(height * heightScale);
            
            // Ensure minimum height of 1 to prevent holes
            const terrainHeight = Math.max(1, height);
            
            // Set blocks from bedrock (y=0) up to the terrain height
            for (let y = 0; y <= terrainHeight; y++) {
                let blockType;
                
                if (y === terrainHeight) {
                    // Top layer - grass
                    blockType = 5; // grass block
                } else if (y >= terrainHeight - 3) {
                    // Upper layers - dirt
                    blockType = 1; // dirt
                } else if (y <= 3) {
                    // Bottom layers - stone (you can change this to a "bedrock" block if you add one)
                    blockType = 2; // stone
                } else {
                    // Middle layers - stone
                    blockType = 2; // stone
                }
                
                chunk.setVoxel(x, y, z, blockType);
            }
            
            // Generate some trees randomly (only on grass blocks)
            if (Math.random() < 0.02 && terrainHeight > 0) {
                generateTree(chunk, x, terrainHeight + 1, z);
            }
        }
    }
    chunk.modified = false; // Reset modified flag after generation
}

// Generate a simple tree in a chunk
function generateTree(chunk, x, y, z) {
    const trunkHeight = 3 + Math.floor(Math.random() * 2);
    
    // Generate trunk
    for (let i = 0; i < trunkHeight; i++) {
        if (y + i < CHUNK_SIZE) {
            chunk.setVoxel(x, y + i, z, 4); // oak_log
        }
    }
    
    // Generate leaves
    const leafRadius = 2;
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
        for (let dz = -leafRadius; dz <= leafRadius; dz++) {
            for (let dy = 0; dy <= leafRadius; dy++) {
                // Simple sphere-like leaf pattern
                const distance = Math.sqrt(dx*dx + dz*dz + dy*dy);
                if (distance <= leafRadius && Math.random() > 0.3) {
                    const leafX = x + dx;
                    const leafY = y + trunkHeight + dy - 1;
                    const leafZ = z + dz;
                    
                    // Check bounds
                    if (leafX >= 0 && leafX < CHUNK_SIZE && 
                        leafY >= 0 && leafY < CHUNK_SIZE && 
                        leafZ >= 0 && leafZ < CHUNK_SIZE) {
                        chunk.setVoxel(leafX, leafY, leafZ, 3); // oak_planks as leaves
                    }
                }
            }
        }
    }
}

// Initialize terrain around player - FIXED: Only 2 chunks in each direction
function initializeTerrain() {
    const playerChunkX = Math.floor(cameraPosition.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(cameraPosition.z / CHUNK_SIZE);
    
    // Only generate 2 chunks in each direction
    for (let x = playerChunkX - 2; x <= playerChunkX + 2; x++) {
        for (let z = playerChunkZ - 2; z <= playerChunkZ + 2; z++) {
            getChunk(x * CHUNK_SIZE, 0, z * CHUNK_SIZE);
        }
    }
}

// Call this to generate initial terrain
initializeTerrain();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
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

        const normal = intersect.face.normal.clone();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
        normal.applyMatrix3(normalMatrix).normalize();

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
                if (!isPositionInsidePlayer(target)) {
                    setVoxel(x, y, z, selectedHotbarIndex);
                    updateStats();
                }
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

function createPreview() {
    if (previewMesh) return;
    const geom = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    previewMesh = new THREE.Mesh(geom, previewMaterial);
    previewMesh.visible = false;
    scene.add(previewMesh);

    const edges = new THREE.EdgesGeometry(geom);
    previewOutline = new THREE.LineSegments(edges, previewOutlineMaterial);
    previewOutline.visible = false;
    previewOutline.renderOrder = 999;
    previewOutline.scale.set(1.01, 1.01, 1.01);
    scene.add(previewOutline);
}

function updatePreview(event) {
    createPreview();

    if (isPointerLocked && !event) {
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

        const voxelPos = point.clone().add(normal.clone().multiplyScalar(0.5));
        targetPos = new THREE.Vector3(
            Math.round(voxelPos.x),
            Math.round(voxelPos.y),
            Math.round(voxelPos.z)
        );
        previewMaterial.color.set(0xffffff);
        previewMaterial.opacity = 0.45;

    } else {
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
            previewMesh.visible = false;
            previewOutline.visible = false;
        }
    } else {
        previewMesh.visible = false;
        previewOutline.visible = false;
    }
}

renderer.domElement.addEventListener('mousemove', updatePreview);

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

function isVoxelAt(x, y, z) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const cx = Math.floor(xi / CHUNK_SIZE);
    const cy = Math.floor(yi / CHUNK_SIZE);
    const cz = Math.floor(zi / CHUNK_SIZE);
    const key = `${cx},${cy},${cz}`;
    if (!chunks.has(key)) return false;
    const chunk = chunks.get(key);
    const lx = ((xi % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((yi % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((zi % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.voxels.has(`${lx},${ly},${lz}`);
}

function aabbIntersectsVoxel(aMin, aMax, vx, vy, vz) {
    const bMin = { x: vx - 0.5, y: vy - 0.5, z: vz - 0.5 };
    const bMax = { x: vx + 0.5, y: vy + 0.5, z: vz + 0.5 };
    if (aMax.x <= bMin.x || aMin.x >= bMax.x) return false;
    if (aMax.y <= bMin.y || aMin.y >= bMax.y) return false;
    if (aMax.z <= bMin.z || aMin.z >= bMax.z) return false;
    return true;
}

function checkAABBCollisionAtPosition(pos, halfWidth, halfHeight) {
    const aMin = { x: pos.x - halfWidth, y: pos.y - halfHeight, z: pos.z - halfWidth };
    const aMax = { x: pos.x + halfWidth, y: pos.y + halfHeight, z: pos.z + halfWidth };
    const x0 = Math.floor(aMin.x - 1);
    const x1 = Math.ceil(aMax.x + 1);
    const y0 = Math.floor(aMin.y - 1);
    const y1 = Math.ceil(aMax.y + 1);
    const z0 = Math.floor(aMin.z - 1);
    const z1 = Math.ceil(aMax.z + 1);
    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            for (let z = z0; z <= z1; z++) {
                if (isVoxelAt(x, y, z)) {
                    if (aabbIntersectsVoxel(aMin, aMax, x, y, z)) return true;
                }
            }
        }
    }
    return false;
}

function moveWithCollision(delta) {
    const halfWidth = PLAYER_WIDTH / 2;
    const halfHeight = PLAYER_HEIGHT / 2;

    // X-axis
    let attempted = cameraPosition.clone();
    attempted.x += delta.x;
    if (!checkAABBCollisionAtPosition(attempted, halfWidth, halfHeight)) cameraPosition.x = attempted.x;

    // Z-axis
    attempted = cameraPosition.clone();
    attempted.z += delta.z;
    if (!checkAABBCollisionAtPosition(attempted, halfWidth, halfHeight)) cameraPosition.z = attempted.z;

    // Y-axis
    attempted = cameraPosition.clone();
    attempted.y += delta.y;
    if (!checkAABBCollisionAtPosition(attempted, halfWidth, halfHeight)) {
        cameraPosition.y = attempted.y;
    } else if (delta.y < 0) {
        velocity.y = 0;
    } else {
        velocity.y = 0;
    }
    cameraPosition.y
}

function updateMovement() {
    if (!isPointerLocked) {
        camera.position.copy(cameraPosition);
        return;
    }

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const delta = new THREE.Vector3(0, 0, 0);

    const onGround = isOnFloor();

    // Gravity only if not on the ground
    if (!onGround) {
        velocity.y += gravity;
    } else if (velocity.y < 0) {
        velocity.y = 0;
    }

    // Jump
    if (keys['Space'] && onGround) {
        velocity.y = jumpStrength;
    }

    delta.y = velocity.y;

    // Horizontal movement
    if (keys['KeyW'] || keys['ArrowUp']) delta.add(forward.clone().multiplyScalar(moveSpeed));
    if (keys['KeyS'] || keys['ArrowDown']) delta.sub(forward.clone().multiplyScalar(moveSpeed));
    if (keys['KeyA'] || keys['ArrowLeft']) delta.sub(right.clone().multiplyScalar(moveSpeed));
    if (keys['KeyD'] || keys['ArrowRight']) delta.add(right.clone().multiplyScalar(moveSpeed));

    moveWithCollision(delta);

    // Keep camera at eye height
    camera.position.set(
        cameraPosition.x,
        cameraPosition.y - PLAYER_HEIGHT / 2 + EYE_HEIGHT,
        cameraPosition.z
    );
}

function updateStats() {
    let totalVoxels = 0;
    chunks.forEach(chunk => {
        totalVoxels += chunk.voxels.size;
    });
    document.getElementById('chunk-count').textContent = chunks.size;
    document.getElementById('voxel-count').textContent = totalVoxels;
}

let lastTime = performance.now();
let frames = 0;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function drawCrosshair() {
    const size = 20;
    const thickness = 2;
    const cssWidth = uiCanvas.width / (window.devicePixelRatio || 1);
    const cssHeight = uiCanvas.height / (window.devicePixelRatio || 1);
    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2;
    uiCtx.clearRect(0, 0, cssWidth, cssHeight);
    uiCtx.fillStyle = 'white';
    uiCtx.fillRect(centerX - thickness / 2, centerY - size / 2, thickness, size);
    uiCtx.fillRect(centerX - size / 2, centerY - thickness / 2, size, thickness);
}

function updateHotbar() {
    const slots = 9;
    const slotSize = 80;
    const padding = 10;
    const cssWidth = uiCanvas.width / (window.devicePixelRatio || 1);
    const cssHeight = uiCanvas.height / (window.devicePixelRatio || 1);
    const totalWidth = slots * (slotSize + padding) - padding;
    const startX = (cssWidth - totalWidth) / 2;
    const y = cssHeight - slotSize - 20;
    uiCtx.imageSmoothingEnabled = false;
    for (let j = 1; j >= 0; j--) {
        for (let i = 0; i < slots; i++) {
            if (i == selectedHotbarIndex && j == 1) {
                uiCtx.fillStyle = `rgba(255, 215, 0, 0.8)`;
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

function animate() {
    requestAnimationFrame(animate);
    
    updateMovement();
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
