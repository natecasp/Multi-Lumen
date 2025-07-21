
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { TransformControls } from 'three/addons/controls/TransformControls.js';


const sandbox = document.getElementById('sandbox');
let journey;
var user = "";
function updateJourney(step) {
  journey += step + ', \n';
  var message = {
  "customer_journey": journey
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
}

        // Global rendering resources
        let globalRenderer, globalScene, globalCamera, globalControls;
let globalOrthographicCamera, globalPerspectiveCamera, globalCurrentCamera;
let isPerspectiveView = true;
let isPrintMode = false;
let css2dRenderer; // For dimension labels in print mode

let isInteracting = false;
let interactionTimeout = null;
const INTERACTION_TIMEOUT = 100; // 100ms after interaction stops
const LOW_QUALITY_SEGMENTS = 32;
const HIGH_QUALITY_SEGMENTS = 128;

// Debounce function for high-quality updates
function debounceHighQuality(callback, delay) {
    clearTimeout(interactionTimeout);
    interactionTimeout = setTimeout(callback, delay);
}

// Start interaction mode (low quality)
function startInteraction() {
    if (!isInteracting) {
        isInteracting = true;
        
    }
    
    // Reset the timeout
    clearTimeout(interactionTimeout);
}

// End interaction mode (high quality after delay)
function endInteraction() {
    debounceHighQuality(() => {
        if (isInteracting) {
            isInteracting = false;
            
            
            // Update all systems to high quality
            if (window.profileManager && window.profileManager.currentSystem) {
                window.profileManager.currentSystem.updateToHighQuality();
            }
        }
    }, INTERACTION_TIMEOUT);
}

// Get current curve segments based on interaction state
function getCurrentCurveSegments() {
    return isInteracting ? LOW_QUALITY_SEGMENTS : HIGH_QUALITY_SEGMENTS;
}
        function setupGlobalResources() {
    
    
    // Clear any existing elements
    
    while (sandbox.firstChild) {
        sandbox.removeChild(sandbox.firstChild);
    }
    
    // Create renderer
   globalRenderer = new THREE.WebGLRenderer({ antialias: true });
globalRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
globalRenderer.shadowMap.enabled = true;
globalRenderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
globalRenderer.outputColorSpace = THREE.SRGBColorSpace; // Better color reproduction
globalRenderer.toneMapping = THREE.ACESFilmicToneMapping; // Film-like tone mapping
globalRenderer.toneMappingExposure = 1.0;
sandbox.appendChild(globalRenderer.domElement);
    
    // Create CSS2D renderer for print mode
    css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0px';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    css2dRenderer.domElement.style.display = 'none'; // Hidden by default
    sandbox.appendChild(css2dRenderer.domElement);
    
    // Create scene
    globalScene = new THREE.Scene();
    globalScene.background = new THREE.Color(0xf5f5f5);
   
   // Reduced ambient light (the environment will provide most lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    globalScene.add(ambientLight);
    
    // Main directional light (simulates sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 2);
    sunLight.position.set(10, 10, 5);
    //sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    globalScene.add(sunLight);
    
    // Create environment-style lighting with multiple light sources
    const envLight1 = new THREE.DirectionalLight(0x8ac1c3, 2); // Cool blue
    envLight1.position.set(-5, 8, -2);
    globalScene.add(envLight1);
    
    const envLight2 = new THREE.DirectionalLight(0xff8040, 0.4); // Warm orange
    envLight2.position.set(5, -2, 8);
    globalScene.add(envLight2);
    
    const envLight3 = new THREE.DirectionalLight(0xffffff, 2); // Soft green
    envLight3.position.set(-8, 2, 3);
    globalScene.add(envLight3);
    
    // Add some point lights for local illumination
    const pointLight1 = new THREE.PointLight(0xffffff, 0.8, 8);
    pointLight1.position.set(2, 3, 4);
    globalScene.add(pointLight1);
    
          // Point light from below option
const bottomPointLight = new THREE.PointLight(0xffffff, 0.7, 4);
bottomPointLight.position.set(0, -1.5, 0.5); // Below and slightly forward
globalScene.add(bottomPointLight);
    const pointLight2 = new THREE.PointLight(0x8ac1c3, 0.5, 8);
    pointLight2.position.set(-3, -2, 2);
    globalScene.add(pointLight2);
    const backRightLight = new THREE.DirectionalLight(0xffffff, 0.3);
backRightLight.position.set(1, 0.5, -2); // Behind and to the right
globalScene.add(backRightLight);
    // Create BOTH cameras
    const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
    
    // Perspective camera (3D view)
    globalPerspectiveCamera = new THREE.PerspectiveCamera(50, aspect, 0.01, 100);
    globalPerspectiveCamera.position.set(0.3, 0.3, 0.3);
    globalPerspectiveCamera.lookAt(0, 0, 0);
    
    // Orthographic camera (top view)
    const frustumSize = 0.4;
    globalOrthographicCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2, frustumSize * aspect / 2,
        frustumSize / 2, -frustumSize / 2,
        0.001, 2
    );
    globalOrthographicCamera.position.set(0, 0, 0.3);
    globalOrthographicCamera.lookAt(0, 0, 0);
    
    // Set initial camera
    globalCurrentCamera = globalPerspectiveCamera;
    globalCamera = globalCurrentCamera; // Keep backward compatibility
    
    // Create controls with current camera
    globalControls = new OrbitControls(globalCurrentCamera, globalRenderer.domElement);
    setupCameraControls();
    
    
    
    // Setup camera switch functionality
    setupCameraSwitching();
    
    // Start render loop
    function animate() {
        requestAnimationFrame(animate);
        globalControls.update();
        globalRenderer.render(globalScene, globalCurrentCamera);
        
        // Render CSS2D if visible (for print mode)
        if (css2dRenderer.domElement.style.display !== 'none') {
            css2dRenderer.render(globalScene, globalCurrentCamera);
        }
    }
    animate();
}
function setupCameraControls() {
    globalControls.enableDamping = true;
    globalControls.dampingFactor = 0.05;
    globalControls.enableZoom = true;
    globalControls.enablePan = true;
    globalControls.target.set(0, 0, 0);
    
    if (isPerspectiveView) {
        // Perspective camera settings (3D view)
        globalControls.enableRotate = true;
        globalControls.minDistance = 0.05;
        globalControls.maxDistance = 1;
    } else {
        // Orthographic camera settings (top view)
        globalControls.enableRotate = false;
        globalControls.minZoom = 0.5;
        globalControls.maxZoom = 5;
    }
}

// Main camera switching function
function switchCamera() {
    
    
    isPerspectiveView = !isPerspectiveView;
    
    if (isPerspectiveView) {
        globalCurrentCamera = globalPerspectiveCamera;
        
    } else {
        globalCurrentCamera = globalOrthographicCamera;
        
        // Reset orthographic camera to perfect top view
        globalOrthographicCamera.position.set(0, 0, 0.3);
        globalOrthographicCamera.lookAt(0, 0, 0);
        globalOrthographicCamera.up.set(0, 1, 0); // Ensure Y is up
        globalOrthographicCamera.zoom = 1; // Reset zoom
        globalOrthographicCamera.updateProjectionMatrix();
        
        
    }
    
    // Update backward compatibility reference
    globalCamera = globalCurrentCamera;
    
    // Update orbit controls to use new camera
    globalControls.object = globalCurrentCamera;
    setupCameraControls();
    
    // Update button visual state
    const cameraButton = document.getElementById('camera-switch-btn');
    if (cameraButton) {
        cameraButton.style.color = isPerspectiveView ? '#767676' : '#ffffff';
        cameraButton.textContent = isPerspectiveView ? 'SWITCH CAMERA (C)' : 'TOP VIEW (C)';
    }
    
    // Force a render
    globalRenderer.render(globalScene, globalCurrentCamera);
    if (css2dRenderer.domElement.style.display !== 'none') {
        css2dRenderer.render(globalScene, globalCurrentCamera);
    }
}

// Setup camera switching event listeners
function setupCameraSwitching() {
    // Button click
    const cameraButton = document.getElementById('camera-switch-btn');
    if (cameraButton) {
        cameraButton.addEventListener('click', switchCamera);
    }
  
    
    // Keyboard shortcut (C key)
    document.addEventListener('keydown', (event) => {
        if (event.key === 'c' || event.key === 'C') {
            if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
                event.preventDefault();
                switchCamera();
            }
        }
    });
    
    
}

        // Circular Holes Implementation
        class CircularHolesSystem {
            constructor() {
    
    this.cylinderMesh = null;
    this.holeMarkers = [];
    this.transformControls = [];
    this.cylinderRadius = 0.1; // Default: 0.200m diameter
    this.cylinderHeight = 0.15;
    this.minimumSeptum = 0.005;
    this.includeCentralLumen = false; // Default: no central lumen
    this.centralLumenRadius = 0.0125; // Default: 0.025m diameter
   
    // Position history for constraint validation
    this.positionHistory = [];
    this.maxHistoryLength = 2;
    this.printModeElements = [];
    this.dimensionLines = [];
    this.dimensionLabels = [];
    
    // Hole colors
    this.holeColors = [
        0x00ff00, 0x0088ff, 0xff4444, 0xffaa00, 0xff00ff, 
        0x00ffff, 0xffff00, 0x8844ff, 0x44ff88
    ];
    
    this.holes = [];
    this.generateInitialHoles(3); // Default: 3 holes
    
    this.create();
    this.setupInteractiveControls();
}
async captureModelImage(width = 400, height = 400) {
    return await captureCurrentSystemThumbnail();
}   
          updateToHighQuality() {
    
    this.createCylinder();
}
  updateHoleDiameterLimits() {
    const maxHoleDiameter = this.cylinderRadius * 2;
    
    this.holes.forEach((hole, index) => {
        const diameterSlider = document.getElementById(`hole-${index}-diameter-range`);
        const diameterInput = document.getElementById(`hole-${index}-diameter`);
        
        if (diameterSlider) {
            diameterSlider.max = maxHoleDiameter.toFixed(3);
        }
        
        if (diameterInput) {
            diameterInput.max = maxHoleDiameter.toFixed(3);
        }
    });
    
    
}          
            initializePositionHistory() {
                this.positionHistory = this.holes.map(hole => [
                    { x: hole.x, y: hole.y, angle: hole.angle, distance: hole.distance, radius: hole.radius }
                ]);
            }
            //Get minimum cylinder radius to prevent intersections
            calculateMinimumCylinderRadius() {
    if (this.holes.length === 0) return 0.02;
    
    let maxRequiredRadius = 0;
    
    this.holes.forEach(hole => {
        const distanceFromCenter = Math.sqrt(hole.x * hole.x + hole.y * hole.y);
        const requiredRadius = distanceFromCenter + hole.radius + this.minimumSeptum;
        maxRequiredRadius = Math.max(maxRequiredRadius, requiredRadius);
    });
    
    return Math.max(maxRequiredRadius, 0.025);
}
          
          updateCylinderDiameterConstraints() {
    const minRadius = this.calculateMinimumCylinderRadius();
    const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
    const cylinderDiameterInput = document.getElementById('cylinder-diameter-input');
    
    if (cylinderDiameterSlider && cylinderDiameterInput) {
        const minDiameter = minRadius * 2;
        cylinderDiameterSlider.min = minDiameter.toFixed(3);
        cylinderDiameterInput.min = minDiameter.toFixed(3);
        
        // If current diameter is below minimum, update it
        if (this.cylinderRadius < minRadius) {
            this.cylinderRadius = minRadius;
            cylinderDiameterSlider.value = minDiameter.toFixed(3);
            cylinderDiameterInput.value = minDiameter.toFixed(3);
        }
    }
}
          
            // NEW METHOD: Update central lumen
            updateCentralLumen() {
    
    
    if (!this.includeCentralLumen) {
        
        return;
    }
    
    // Find the central lumen hole (distance = 0)
    const centralHoleIndex = this.holes.findIndex(hole => hole.distance === 0);
    
    if (centralHoleIndex >= 0) {
        // NEW: Validate the new radius against other holes
        const constrainedRadius = this.findClosestValidRadius(0, 0, this.centralLumenRadius, centralHoleIndex);
        
        if (constrainedRadius !== this.centralLumenRadius) {
            // Radius was constrained, update the stored value and UI
            this.centralLumenRadius = constrainedRadius;
            
            // Update the UI controls to reflect the constrained value
            const innerDiameterSlider = document.getElementById('inner-diameter');
            const innerDiameterInput = document.getElementById('inner-diameter-input');
            const constrainedDiameter = constrainedRadius * 2;
            
            if (innerDiameterSlider) innerDiameterSlider.value = constrainedDiameter.toFixed(3);
            if (innerDiameterInput) innerDiameterInput.value = constrainedDiameter.toFixed(3);
            
           
        }
        
        // Update existing central lumen with validated radius
        this.holes[centralHoleIndex].radius = this.centralLumenRadius;
        
        
        // Update the geometry and UI
        this.updateSingleHole(centralHoleIndex);
    } else {
        
        // If no central lumen exists, regenerate with current hole count + 1
        const peripheralHoleCount = this.holes.length;
        this.regenerateHoles(peripheralHoleCount + 1);
    }
}
            
            // Constraint validation
            isValidPosition(x, y, radius, holeIndex) {
                // For central lumen, only check if it fits within cylinder
                const distanceFromCenter = Math.sqrt(x * x + y * y);
                
                if (distanceFromCenter < 0.001) {
                    // This is the central lumen - only check if radius fits
                    return radius < this.cylinderRadius - this.minimumSeptum;
                }
                
                // Check cylinder boundary constraint for peripheral holes
                const maxDistance = this.cylinderRadius - radius - this.minimumSeptum;
                
                if (distanceFromCenter > maxDistance) {
                    return false;
                }
                
                // Check separation from other holes
                for (let i = 0; i < this.holes.length; i++) {
                    if (i === holeIndex) continue;
                    
                    const otherHole = this.holes[i];
                    const dx = x - otherHole.x;
                    const dy = y - otherHole.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minRequiredDistance = radius + otherHole.radius + this.minimumSeptum;
                    
                    if (distance < minRequiredDistance) {
                        return false;
                    }
                }
                
                return true;
            }
            
            // Record valid positions for history
            recordValidPosition(holeIndex) {
                const hole = this.holes[holeIndex];
                const history = this.positionHistory[holeIndex];
                
                history.push({ 
                    x: hole.x, 
                    y: hole.y, 
                    angle: hole.angle, 
                    distance: hole.distance, 
                    radius: hole.radius 
                });
                
                if (history.length > this.maxHistoryLength) {
                    history.shift();
                }
            }
            
            // Polar coordinate conversion
            polarToCartesian(angle, distance) {
                const angleRad = angle * Math.PI / 180;
                const x = Math.cos(angleRad) * distance;
                const y = Math.sin(angleRad) * distance;
                return { x, y };
            }
            
            cartesianToPolar(x, y) {
                const distance = Math.sqrt(x * x + y * y);
                let angle = Math.atan2(y, x);
                angle = (angle * 180 / Math.PI + 360) % 360;
                return { angle, distance };
            }
            
 generateInitialHoles(count) {
    
    
    const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
    this.holes = [];
    
    let peripheralHoles = count;
    let colorIndex = 0;
    
    // Add central lumen if enabled
    if (this.includeCentralLumen) {
        // NEW: Central lumen radius = half of cylinder radius
        const centralLumenRadius = this.cylinderRadius / 2;
        this.centralLumenRadius = centralLumenRadius;
        
        this.holes.push({
            x: 0,
            y: 0,
            angle: 0,
            distance: 0,
            radius: centralLumenRadius,
            color: this.holeColors[0],
            name: 'Central Lumen'
        });
        peripheralHoles = count - 1;
        colorIndex = 1;
       
        
        // Update the UI controls to reflect the new central lumen size
        const innerDiameterSlider = document.getElementById('inner-diameter');
        const innerDiameterInput = document.getElementById('inner-diameter-input');
        const centralLumenDiameter = centralLumenRadius * 2;
        
        if (innerDiameterSlider) innerDiameterSlider.value = centralLumenDiameter.toFixed(3);
        if (innerDiameterInput) innerDiameterInput.value = centralLumenDiameter.toFixed(3);
    }
    
    // Add peripheral holes
    if (peripheralHoles > 0) {
        let placementDistance;
        let holeRadius;
        
        if (this.includeCentralLumen) {
            // NEW: Calculate placement and size based on central lumen
            const centralLumenRadius = this.centralLumenRadius;
            const innerBoundary = centralLumenRadius; // Edge of central lumen
            const outerBoundary = this.cylinderRadius; // Edge of cylinder
            const availableSpace = outerBoundary - innerBoundary;
            
            // Position holes exactly halfway between inner and outer boundaries
            placementDistance = innerBoundary + (availableSpace / 2);
            
            // Hole radius = half the distance between inner and outer boundaries
            holeRadius = availableSpace / 4; // Divide by 4 because we want radius, and it should be half the available space
            
           
            
        } else {
            // NEW: Without central lumen, place holes at half cylinder radius with proportional size
            placementDistance = this.cylinderRadius / 2;
            holeRadius = this.cylinderRadius / 8; // Proportional size
            
           
        }
        
        // Ensure minimum hole size
        holeRadius = Math.max(holeRadius, 0.005); // 5mm minimum
        
        // Create peripheral holes in a circle
        for (let i = 0; i < peripheralHoles; i++) {
            const angle = (i / peripheralHoles) * 360;
            const { x, y } = this.polarToCartesian(angle, placementDistance);

            this.holes.push({
                x: x,
                y: y,
                angle: angle,
                distance: placementDistance,
                radius: holeRadius,
                color: this.holeColors[colorIndex + i],
                name: `${colors[colorIndex + i]} Lumen`
            });
        }
        
        
    }
    
    this.initializePositionHistory();
}
            
            calculateOptimalRadius(holeCount) {
                if (holeCount <= 2) return 0.02; // Default radius
                
                const availableRadius = this.cylinderRadius - this.minimumSeptum;
                const circumference = 2 * Math.PI * (availableRadius * 0.6);
                const minSpacingPerHole = circumference / holeCount;
                const maxRadiusFromSpacing = (minSpacingPerHole - this.minimumSeptum) / 2;
                const maxRadiusFromBoundary = availableRadius * 0.15;
                
                const optimalRadius = Math.min(
                    maxRadiusFromSpacing,
                    maxRadiusFromBoundary,
                    0.025 // Maximum hole radius
                );
                
                return Math.max(0.005, Math.min(optimalRadius, 0.025));
            }
            
   regenerateHoles(count) {
    
    this.generateInitialHoles(count);
    this.createCylinder();
    this.createHoleMarkers();
    this.createHoleUI();
    this.updateCylinderDiameterConstraints();
    
    // NEW: Update inner diameter controls if central lumen is present
    if (this.includeCentralLumen) {
        const centralHole = this.holes.find(hole => hole.distance === 0);
        if (centralHole) {
            this.centralLumenRadius = centralHole.radius;
            
            const innerDiameterSlider = document.getElementById('inner-diameter');
            const innerDiameterInput = document.getElementById('inner-diameter-input');
            const centralLumenDiameter = this.centralLumenRadius * 2;
            
            if (innerDiameterSlider) innerDiameterSlider.value = centralLumenDiameter.toFixed(3);
            if (innerDiameterInput) innerDiameterInput.value = centralLumenDiameter.toFixed(3);
        }
    }
}
            
  findClosestValidRadius(x, y, targetRadius, holeIndex) {
    // UPDATED: Use dynamic limits based on cylinder size
    const maxRadius = this.cylinderRadius; // Use cylinder radius as max
    const minRadius = 0.0075; // Keep general min
    
    // Special handling for central lumen (at origin)
    const isCentralHole = (Math.abs(x) < 0.001 && Math.abs(y) < 0.001);
    
    if (isCentralHole) {
        // For central lumen, only limit by minimum and intersections with other holes
        let testRadius = Math.max(minRadius, targetRadius);
        
        // Check separation from other holes
        for (let i = 0; i < this.holes.length; i++) {
            if (i === holeIndex) continue;
            
            const otherHole = this.holes[i];
            const dx = x - otherHole.x;
            const dy = y - otherHole.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxAllowedByHole = distance - otherHole.radius - this.minimumSeptum;
            
            if (maxAllowedByHole > 0) {
                testRadius = Math.min(testRadius, maxAllowedByHole);
            }
        }
        
        // For central lumen, also check cylinder boundary
        const maxAllowedByBoundary = this.cylinderRadius - this.minimumSeptum;
        testRadius = Math.min(testRadius, maxAllowedByBoundary);
        
        return Math.max(minRadius, testRadius);
        
    } else {
        // Original logic for peripheral holes but with updated max
        let testRadius = Math.max(minRadius, Math.min(targetRadius, maxRadius));
        
        // Check cylinder boundary constraint
        const distanceFromCenter = Math.sqrt(x * x + y * y);
        const maxAllowedByBoundary = this.cylinderRadius - distanceFromCenter - this.minimumSeptum;
        testRadius = Math.min(testRadius, maxAllowedByBoundary);
        
        // Check hole separation constraints
        for (let i = 0; i < this.holes.length; i++) {
            if (i === holeIndex) continue;
            
            const otherHole = this.holes[i];
            const dx = x - otherHole.x;
            const dy = y - otherHole.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxAllowedByHole = distance - otherHole.radius - this.minimumSeptum;
            
            if (maxAllowedByHole > 0) {
                testRadius = Math.min(testRadius, maxAllowedByHole);
            }
        }
        
        return Math.max(minRadius, testRadius);
    }
}
            
            setupInteractiveControls() {
             
                let isDragging = false;
                let activeHoleIndex = -1;
                let isShiftPressed = false;
                let isControlPressed = false;
                let isAltPressed = false;
                
                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2();
                
                // Keyboard state tracking
                window.addEventListener('keydown', (event) => {
                    if (event.key === 'Shift') isShiftPressed = true;
                    else if (event.key === 'Control') isControlPressed = true;
                    else if (event.key === 'Alt') {
                        isAltPressed = true;
                        event.preventDefault();
                    }
                });
                function onWindowResize() {
    const sandbox = document.getElementById('sandbox');
    const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
    
    // Update perspective camera
    globalPerspectiveCamera.aspect = aspect;
    globalPerspectiveCamera.updateProjectionMatrix();
    
    // Update orthographic camera
    const frustumSize = 0.4;
    globalOrthographicCamera.left = -frustumSize * aspect / 2;
    globalOrthographicCamera.right = frustumSize * aspect / 2;
    globalOrthographicCamera.top = frustumSize / 2;
    globalOrthographicCamera.bottom = -frustumSize / 2;
    globalOrthographicCamera.updateProjectionMatrix();
    
    // Update renderers
    globalRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    css2dRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    
    // Force render
    globalRenderer.render(globalScene, globalCurrentCamera);
}
              window.addEventListener('resize', onWindowResize);

// Optional: Add print mode toggle functionality (placeholder for later)
// Global print mode state
let isPrintMode = false;

// Main print mode toggle function
function togglePrintMode() {
   
    
    isPrintMode = !isPrintMode;
    
    if (isPrintMode) {
        enterPrintMode();
    } else {
        exitPrintMode();
    }
    
    // Update button visual state
    const printButton = document.getElementById('print-mode-btn');
    if (printButton) {
        printButton.style.color = isPrintMode ? '#ffffff' : '#767676';
        printButton.textContent = isPrintMode ? 'EXIT PRINT (TAB)' : 'PRINT MODE (TAB)';
    }
    
   
}
// Enter print mode
function enterPrintMode() {
   
    
    // Force switch to orthographic camera if not already
    if (isPerspectiveView) {
        switchCamera();
    }
    
    // Change background to white for printing
    globalScene.background = new THREE.Color(0xffffff);
    
    // Show CSS2D renderer for labels/dimensions
    css2dRenderer.domElement.style.display = 'block';
    
    // Delegate to current system's print mode logic
    if (window.profileManager && window.profileManager.currentSystem) {
        if (typeof window.profileManager.currentSystem.enterPrintMode === 'function') {
            window.profileManager.currentSystem.enterPrintMode();
        } else {
            console.warn('Current system does not have enterPrintMode method');
            // Fallback: just hide interactive controls
            
        }
    }
    
   
  
}

// Exit print mode
function exitPrintMode() {
   
    
    // Restore normal background
    globalScene.background = new THREE.Color(0xfcfcfc);
    
    // Hide CSS2D renderer
    css2dRenderer.domElement.style.display = 'none';
    
    // Delegate to current system's print mode logic
    if (window.profileManager && window.profileManager.currentSystem) {
        if (typeof window.profileManager.currentSystem.exitPrintMode === 'function') {
            window.profileManager.currentSystem.exitPrintMode();
        } else {
            console.warn('Current system does not have exitPrintMode method');
            // Fallback: just show interactive controls
            
        }
    }
    
   
}

// Fallback functions for systems without print mode

// Setup print mode event listeners
document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
        if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
            event.preventDefault();
            togglePrintMode();
        }
    }
});

// Add print mode button listener
document.addEventListener('DOMContentLoaded', () => {
    const printButton = document.getElementById('print-mode-btn');
    if (printButton) {
        printButton.addEventListener('click', togglePrintMode);
    }
});
                window.addEventListener('keyup', (event) => {
                    if (event.key === 'Shift') isShiftPressed = false;
                    else if (event.key === 'Control') isControlPressed = false;
                    else if (event.key === 'Alt') isAltPressed = false;
                });
                
                // Mouse interaction - target the control spheres, not hole markers
                globalRenderer.domElement.addEventListener('mousedown', (event) => {
                    const rect = globalRenderer.domElement.getBoundingClientRect();
                    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                    
                    raycaster.setFromCamera(mouse, globalCamera);
                    const intersects = raycaster.intersectObjects(this.transformControls);
                    
                    if (intersects.length > 0) {
                        startInteraction();
                        isDragging = true;
                        activeHoleIndex = intersects[0].object.userData.holeIndex;
                        globalControls.enabled = false;
                        
                        // Highlight the active control sphere
                        this.transformControls[activeHoleIndex].material.opacity = 1.0;
                        
                        
                    }
                });
                
                globalRenderer.domElement.addEventListener('mousemove', (event) => {
    if (!isDragging || activeHoleIndex === -1) return;
    // Auto-exit print mode on first interaction
    autoExitPrintMode();
    const rect = globalRenderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, globalCamera);
    
    // Project to working plane - THIS SHOULD BE DONE ONCE AT THE TOP
    const workingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.cylinderHeight / 2);
    const intersectPoint = new THREE.Vector3(); // Use local variable, not this.intersectPoint
    raycaster.ray.intersectPlane(workingPlane, intersectPoint);
    
    const hole = this.holes[activeHoleIndex];
    
    if (isAltPressed && isControlPressed) {
        // Alt + Control: Set ALL holes to the same size
    const currentMouseDistance = Math.sqrt(intersectPoint.x * intersectPoint.x + intersectPoint.y * intersectPoint.y);
    
    // NEW: Use a reasonable target radius based on mouse distance but allow larger sizes
     const maxAllowedRadius = this.cylinderRadius; // Use full cylinder radius as max
        const targetRadius = Math.max(0.0075, Math.min(currentMouseDistance * 0.5, maxAllowedRadius));
    
    this.holes.forEach((h, index) => {
        const constrainedRadius = this.findClosestValidRadius(h.x, h.y, targetRadius, index);
        
        if (constrainedRadius !== h.radius) {
            h.radius = constrainedRadius;
            
            // If this is the central lumen, update the stored central lumen radius
            const isCentralHole = (Math.abs(h.x) < 0.001 && Math.abs(h.y) < 0.001);
            if (isCentralHole) {
                this.centralLumenRadius = constrainedRadius;
                
                // Update the global inner diameter controls
                const innerDiameterSlider = document.getElementById('inner-diameter');
                const innerDiameterInput = document.getElementById('inner-diameter-input');
                const constrainedDiameter = constrainedRadius * 2;
                
                if (innerDiameterSlider) innerDiameterSlider.value = constrainedDiameter.toFixed(3);
                if (innerDiameterInput) innerDiameterInput.value = constrainedDiameter.toFixed(3);
            }
        }
        
        this.updateHoleUI(index);
    });
    
    this.updateAllGeometry();
        
    } else if (isShiftPressed && isAltPressed) {
        // Shift + Alt: Set ALL holes to the same distance
        const targetDistance = Math.sqrt(intersectPoint.x * intersectPoint.x + intersectPoint.y * intersectPoint.y);
        
        this.holes.forEach((h, index) => {
            if (h.distance === 0) return; // Skip central lumen
            
            const { x, y } = this.polarToCartesian(h.angle, targetDistance);
            if (this.isValidPosition(x, y, h.radius, index)) {
                h.distance = targetDistance;
                h.x = x;
                h.y = y;
            }
        });
        
        this.updateAllGeometry();
        
    } else if (isControlPressed) {
       // Control: Change hole diameter
    const distanceFromHole = Math.sqrt(
        (intersectPoint.x - hole.x) * (intersectPoint.x - hole.x) + 
        (intersectPoint.y - hole.y) * (intersectPoint.y - hole.y)
    );
    
    // NEW: Check if this is the central lumen
    const isCentralHole = (Math.abs(hole.x) < 0.001 && Math.abs(hole.y) < 0.001);
    
    // NEW: Different limits for central vs peripheral holes
    let newRadius;
    if (isCentralHole) {
        // For central lumen, allow much larger sizes with minimal constraints
       newRadius = Math.max(0.0075, Math.min(distanceFromHole, this.cylinderRadius));
    } else {
        newRadius = Math.max(0.0075, Math.min(distanceFromHole, this.cylinderRadius));
    }
    
    const constrainedRadius = this.findClosestValidRadius(hole.x, hole.y, newRadius, activeHoleIndex);
    
    if (constrainedRadius !== hole.radius) {
        hole.radius = constrainedRadius;
        
        // If this is the central lumen, update the stored central lumen radius
        if (isCentralHole) {
            this.centralLumenRadius = constrainedRadius;
            
            // Update the global inner diameter controls
            const innerDiameterSlider = document.getElementById('inner-diameter');
            const innerDiameterInput = document.getElementById('inner-diameter-input');
            const constrainedDiameter = constrainedRadius * 2;
            
            if (innerDiameterSlider) innerDiameterSlider.value = constrainedDiameter.toFixed(3);
            if (innerDiameterInput) innerDiameterInput.value = constrainedDiameter.toFixed(3);
        }
        
        this.updateSingleHole(activeHoleIndex);
    }
        
    } else if (isShiftPressed) {
        // Shift: Change distance from center
        const isCentralHole = (Math.abs(hole.x) < 0.001 && Math.abs(hole.y) < 0.001);
        
        if (!isCentralHole) {
            const newDistance = Math.sqrt(intersectPoint.x * intersectPoint.x + intersectPoint.y * intersectPoint.y);
            const { x, y } = this.polarToCartesian(hole.angle, newDistance);
            
            if (this.isValidPosition(x, y, hole.radius, activeHoleIndex)) {
                hole.distance = newDistance;
                hole.x = x;
                hole.y = y;
                this.updateSingleHole(activeHoleIndex);
            }
        }
        
    } else {
        // Normal drag: Change angle around center
        const isCentralHole = (Math.abs(hole.x) < 0.001 && Math.abs(hole.y) < 0.001);
        
        if (!isCentralHole) {
            const { angle, distance } = this.cartesianToPolar(intersectPoint.x, intersectPoint.y);
            
            // Snap angle to 1-degree increments
            const snappedAngle = Math.round(angle);
            
            const { x, y } = this.polarToCartesian(snappedAngle, hole.distance);
            
            if (this.isValidPosition(x, y, hole.radius, activeHoleIndex)) {
                hole.angle = snappedAngle;
                hole.x = x;
                hole.y = y;
                this.updateSingleHole(activeHoleIndex);
            }
        }
    }
});
                
                globalRenderer.domElement.addEventListener('mouseup', () => {
                    if (isDragging && activeHoleIndex !== -1) {
                      endInteraction();
                        // Reset control sphere opacity
                        this.transformControls[activeHoleIndex].material.opacity = 0.8;
                        this.recordValidPosition(activeHoleIndex);
                    }
                    
                    isDragging = false;
                    activeHoleIndex = -1;
                    globalControls.enabled = true;
                });
            }
            
            updateSingleHole(holeIndex) {
               
                const hole = this.holes[holeIndex];
                
                // Update hole marker
                const marker = this.holeMarkers[holeIndex];
                if (marker) {
                    marker.geometry.dispose();
                    marker.geometry = new THREE.CircleGeometry(hole.radius, 32);
                    marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
                }
                
                // Update control sphere position
                const controlSphere = this.transformControls[holeIndex];
                if (controlSphere) {
                    controlSphere.position.set(hole.x, hole.y, this.cylinderHeight / 2 );
                }
                
                // IMPORTANT: Update the actual cylinder geometry with holes
                this.createCylinder();
                
                // Update UI
                this.updateHoleUI(holeIndex);
            }
            
            updateAllGeometry() {
               
                
                // Update all hole markers
                this.holeMarkers.forEach((marker, index) => {
                    const hole = this.holes[index];
                    if (marker) {
                        marker.geometry.dispose();
                        marker.geometry = new THREE.CircleGeometry(hole.radius, 32);
                        marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
                    }
                });
                
                // Update all control spheres
                this.transformControls.forEach((sphere, index) => {
                    const hole = this.holes[index];
                    if (sphere) {
                        sphere.position.set(hole.x, hole.y, this.cylinderHeight / 2);
                    }
                });
                
                // IMPORTANT: Update the actual cylinder geometry with holes
                this.createCylinder();
                
                // Update all UI
                this.holes.forEach((hole, index) => {
                    this.updateHoleUI(index);
                });
            }
            
           updateHoleUI(holeIndex) {
    const hole = this.holes[holeIndex];
    
    // Update diameter controls (both slider and input)
    const diameterSlider = document.querySelector(`#hole-${holeIndex}-diameter-range`);
    const diameterInput = document.querySelector(`#hole-${holeIndex}-diameter`);
    if (diameterSlider) diameterSlider.value = (hole.radius * 2).toFixed(4);
    if (diameterInput) diameterInput.value = (hole.radius * 2).toFixed(4);
    
    // Update angle controls (both slider and input)
    const angleSlider = document.querySelector(`#hole-${holeIndex}-angle-range`);
    const angleInput = document.querySelector(`#hole-${holeIndex}-angle`);
    if (angleSlider) angleSlider.value = Math.round(hole.angle);
    if (angleInput) angleInput.value = Math.round(hole.angle);
    
    // Update distance controls (both slider and input)
    const distanceSlider = document.querySelector(`#hole-${holeIndex}-distance-range`);
    const distanceInput = document.querySelector(`#hole-${holeIndex}-distance`);
    if (distanceSlider) distanceSlider.value = hole.distance.toFixed(4);
    if (distanceInput) distanceInput.value = hole.distance.toFixed(4);
}
            
            create() {
               
                this.createCylinder();
                this.createHoleMarkers();
                this.createHoleUI(); // Changed from this.createUI() to this.createHoleUI()
            }
            
            createCylinder() {
               
                
                // PROPER CLEANUP: Remove existing cylinder completely
                if (this.cylinderMesh) {
                  
                    globalScene.remove(this.cylinderMesh);
                    
                    if (this.cylinderMesh.geometry) {
                        this.cylinderMesh.geometry.dispose();
                        
                    }
                    
                    if (this.cylinderMesh.material) {
                        if (Array.isArray(this.cylinderMesh.material)) {
                            this.cylinderMesh.material.forEach(mat => mat.dispose());
                        } else {
                            this.cylinderMesh.material.dispose();
                        }
                       
                      
                    }
                    
                    this.cylinderMesh = null;
                }
                
                // Double-check: Remove any orphaned cylinder meshes from scene
                const existingCylinders = globalScene.children.filter(child => 
                    child.isMesh && 
                    child !== this.cylinderMesh && 
                    !this.holeMarkers.includes(child) && 
                    !this.transformControls.includes(child) &&
                    child.material.color &&
                    child.material.color.getHex() === 0x8ac1c3 // Our cylinder color
                );
                
                if (existingCylinders.length > 0) {
                    console.warn(`Found ${existingCylinders.length} orphaned cylinder(s), removing them`);
                    existingCylinders.forEach(mesh => {
                        globalScene.remove(mesh);
                        if (mesh.geometry) mesh.geometry.dispose();
                        if (mesh.material) mesh.material.dispose();
                    });
                }
                
               
                
                // Create main cylinder shape
                const shape = new THREE.Shape();
                shape.absarc(0, 0, this.cylinderRadius, 0, Math.PI * 2, false);
                
                // Add holes using CURRENT hole positions and sizes
                this.holes.forEach((hole, index) => {
                  
                    
                    const holePath = new THREE.Path();
                    holePath.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
                    shape.holes.push(holePath);
                });
                
                const extrudeSettings = {
                    depth: this.cylinderHeight,
                    bevelEnabled: false,
                    steps: 1,
                    curveSegments: getCurrentCurveSegments()
                };
                
                try {
                    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                    geometry.center();
                   
const material = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    metalness: 0.1,      // Same as the example
    roughness: 0.4,      // Low roughness for shiny appearance
    transparent: false,
    opacity: 1
});
                  
                    
                    this.cylinderMesh = new THREE.Mesh(geometry, material);
                    this.cylinderMesh.castShadow = true;
                    this.cylinderMesh.receiveShadow = true;
                    
                    // Add identifier for easier cleanup
                    this.cylinderMesh.userData = { type: 'circularHolesCylinder' };
                    
                    globalScene.add(this.cylinderMesh);
                    
                   
                    
                } catch (error) {
                    console.error('Error creating cylinder geometry:', error);
                    
                    // Fallback: create simple cylinder without holes
                    const fallbackGeometry = new THREE.CylinderGeometry(this.cylinderRadius, this.cylinderRadius, this.cylinderHeight, 32);
                    const fallbackMaterial = new THREE.MeshLambertMaterial({ color: 0xff6666 });
                    this.cylinderMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
                    this.cylinderMesh.userData = { type: 'circularHolesCylinder', fallback: true };
                    globalScene.add(this.cylinderMesh);
                   
                }
            }
            
            createHoleMarkers() {
               
                
                // Clean up existing markers and controls
                this.holeMarkers.forEach(marker => {
                    globalScene.remove(marker);
                    if (marker.geometry) marker.geometry.dispose();
                    if (marker.material) marker.material.dispose();
                });
                this.holeMarkers = [];
                
                if (this.transformControls) {
                    this.transformControls.forEach(control => {
                        globalScene.remove(control);
                        if (control.geometry) control.geometry.dispose();
                        if (control.material) control.material.dispose();
                    });
                }
                this.transformControls = [];
                
                this.holes.forEach((hole, index) => {
                    // Create hole marker (visual representation)
                    const markerGeometry = new THREE.CircleGeometry(hole.radius, 32);
                    const markerMaterial = new THREE.MeshBasicMaterial({ 
                        color: hole.color,
                        transparent: true,
                        opacity: 0.3,
                        side: THREE.DoubleSide
                    });
                    
                    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                    marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
                    marker.userData = { holeIndex: index };
                    
                    this.holeMarkers.push(marker);
                    globalScene.add(marker);
                    
                    // Create control sphere (for interaction)
                    const controlGeometry = new THREE.SphereGeometry(0.008, 16, 16);
                    const controlMaterial = new THREE.MeshBasicMaterial({ 
                        color: hole.color,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const controlSphere = new THREE.Mesh(controlGeometry, controlMaterial);
                    controlSphere.position.set(hole.x, hole.y, this.cylinderHeight / 2 ); // Slightly above marker
                    controlSphere.userData = { 
                        holeIndex: index, 
                        type: 'holeControl'
                    };
                    
                    this.transformControls.push(controlSphere);
                    globalScene.add(controlSphere);
                });
                
               
            }
            
     createHoleUI() {
    const container = document.getElementById('hole-controls');
    container.innerHTML = '';
    
    this.holes.forEach((hole, index) => {
        const div = document.createElement('div');
        div.className = 'hole-control-item';
        
        const isCentralLumen = hole.distance === 0;
        
        // NEW: Set max diameter based on outer diameter
        const maxHoleDiameter = this.cylinderRadius * 2; // Use full outer diameter
        
        let controlsHTML = `
    <p class="hole-title">${hole.name}</p>
    <div class="input-group">
        <label>Distance:</label>
        <input class="range-slider" type="range" min="0.015" max="${maxHoleDiameter.toFixed(3)}" value="${(hole.radius * 2).toFixed(4)}" step="0.001" id="hole-${index}-diameter-range" >
        <input type="number" id="hole-${index}-diameter" value="${(hole.radius * 2).toFixed(4)}" min="0.015" max="${maxHoleDiameter.toFixed(3)}" step="0.001">
        
    </div>
    `;
        
        if (!isCentralLumen) {
            controlsHTML += `
        <div class="input-group">
            <label>Distance:</label>
            <input type="range" class="range-slider" min="0" max="${(this.cylinderRadius * 0.8).toFixed(3)}" value="${hole.distance.toFixed(4)}" step="0.001" id="hole-${index}-distance-range">
            <input type="number" id="hole-${index}-distance" min="0" max="${(this.cylinderRadius * 0.8).toFixed(3)}" value="${hole.distance.toFixed(4)}" step="0.001">
        </div>
        
        <div class="input-group">
            <label>Angle:</label>
            <input type="range" class="range-slider" min="0" max="360" value="${Math.round(hole.angle)}" step="1" id="hole-${index}-angle-range">
            <input type="number" id="hole-${index}-angle" min="0" max="360" value="${Math.round(hole.angle)}" step="1">
        </div>
    `;
        }
        
        div.innerHTML = controlsHTML;
        container.appendChild(div);
        
        // Setup event listeners
        this.setupHoleControlListeners(index);
    });
    
    
}
            
            setupHoleControlListeners(index) {
    const hole = this.holes[index];
    const isCentralLumen = hole.distance === 0;
    
    // Diameter controls
    const diameterSlider = document.getElementById(`hole-${index}-diameter-range`);
    const diameterInput = document.getElementById(`hole-${index}-diameter`);
    diameterSlider.addEventListener('mousedown', startInteraction);
    diameterSlider.addEventListener('mouseup', endInteraction);
    diameterSlider.addEventListener('change', endInteraction);          
    diameterSlider.addEventListener('input', (e) => {
      startInteraction();
      autoExitPrintMode();
        const newDiameter = parseFloat(e.target.value);
        const newRadius = newDiameter / 2;
        const constrainedRadius = this.findClosestValidRadius(hole.x, hole.y, newRadius, index);
        const constrainedDiameter = constrainedRadius * 2;
        
        // NEW: Update both slider and input to constrained value
        diameterSlider.value = constrainedDiameter.toFixed(4);
        diameterInput.value = constrainedDiameter.toFixed(4);
        
        hole.radius = constrainedRadius;
        this.updateSingleHole(index);
        this.recordValidPosition(index);
        
        // NEW: If this is the central lumen, update the stored central lumen radius
        if (isCentralLumen) {
            this.centralLumenRadius = constrainedRadius;
        }
    });
    
    diameterInput.addEventListener('input', (e) => {
      autoExitPrintMode();
        const newDiameter = parseFloat(e.target.value);
        if (!isNaN(newDiameter)) {
            const newRadius = newDiameter / 2;
            const constrainedRadius = this.findClosestValidRadius(hole.x, hole.y, newRadius, index);
            const constrainedDiameter = constrainedRadius * 2;
            
            // NEW: Update both slider and input to constrained value
            diameterSlider.value = constrainedDiameter.toFixed(4);
            diameterInput.value = constrainedDiameter.toFixed(4);
            
            hole.radius = constrainedRadius;
            this.updateSingleHole(index);
            this.recordValidPosition(index);
            
            // NEW: If this is the central lumen, update the stored central lumen radius
            if (isCentralLumen) {
                this.centralLumenRadius = constrainedRadius;
            }
        }
    });
    
    if (!isCentralLumen) {
        // Angle controls
        const angleSlider = document.getElementById(`hole-${index}-angle-range`);
        const angleInput = document.getElementById(`hole-${index}-angle`);
 angleSlider.addEventListener('mousedown', startInteraction);   
 angleSlider.addEventListener('mouseup', endInteraction);
        angleSlider.addEventListener('change', endInteraction);
        angleSlider.addEventListener('input', (e) => {
           startInteraction();
           autoExitPrintMode();
            const newAngle = Math.round(parseFloat(e.target.value)); // Round to integer
            const { x, y } = this.polarToCartesian(newAngle, hole.distance);
            
            if (this.isValidPosition(x, y, hole.radius, index)) {
                hole.angle = newAngle;
                hole.x = x;
                hole.y = y;
                angleInput.value = newAngle; // Update input to match
                this.updateSingleHole(index);
                this.recordValidPosition(index);
            } else {
                // NEW: Revert slider to current valid value if invalid position
                angleSlider.value = Math.round(hole.angle);
            }
        });
        
        angleInput.addEventListener('input', (e) => {
           autoExitPrintMode();
            const newAngle = Math.round(parseFloat(e.target.value)); // Round to integer
            if (!isNaN(newAngle)) {
                const { x, y } = this.polarToCartesian(newAngle, hole.distance);
                
                if (this.isValidPosition(x, y, hole.radius, index)) {
                    hole.angle = newAngle;
                    hole.x = x;
                    hole.y = y;
                    angleSlider.value = newAngle; // Update slider to match
                    this.updateSingleHole(index);
                    this.recordValidPosition(index);
                } else {
                    // NEW: Revert input to current valid value if invalid position
                    e.target.value = Math.round(hole.angle);
                }
            }
        });
        
        // Distance controls
        const distanceSlider = document.getElementById(`hole-${index}-distance-range`);
        const distanceInput = document.getElementById(`hole-${index}-distance`);
        distanceSlider.addEventListener('mousedown', startInteraction);
      distanceSlider.addEventListener('mouseup', endInteraction);
        distanceSlider.addEventListener('change', endInteraction);
        distanceSlider.addEventListener('input', (e) => {
           startInteraction();
           autoExitPrintMode();
            const newDistance = parseFloat(e.target.value);
            const { x, y } = this.polarToCartesian(hole.angle, newDistance);
            
            if (this.isValidPosition(x, y, hole.radius, index)) {
                hole.distance = newDistance;
                hole.x = x;
                hole.y = y;
                distanceInput.value = newDistance.toFixed(4); // Update input to match
                this.updateSingleHole(index);
                this.recordValidPosition(index);
            } else {
                // NEW: Revert slider to current valid value if invalid position
                distanceSlider.value = hole.distance.toFixed(4);
            }
        });
        
        distanceInput.addEventListener('input', (e) => {
          autoExitPrintMode();
            const newDistance = parseFloat(e.target.value);
            if (!isNaN(newDistance)) {
                const { x, y } = this.polarToCartesian(hole.angle, newDistance);
                
                if (this.isValidPosition(x, y, hole.radius, index)) {
                    hole.distance = newDistance;
                    hole.x = x;
                    hole.y = y;
                    distanceSlider.value = newDistance; // Update slider to match
                    this.updateSingleHole(index);
                    this.recordValidPosition(index);
                } else {
                    // NEW: Revert input to current valid value if invalid position
                    e.target.value = hole.distance.toFixed(4);
                }
            }
        });
    }
}
            
            cleanup() {
               
                
                // Clean up cylinder mesh
                if (this.cylinderMesh) {
                    globalScene.remove(this.cylinderMesh);
                    if (this.cylinderMesh.geometry) this.cylinderMesh.geometry.dispose();
                    if (this.cylinderMesh.material) {
                        if (Array.isArray(this.cylinderMesh.material)) {
                            this.cylinderMesh.material.forEach(mat => mat.dispose());
                        } else {
                            this.cylinderMesh.material.dispose();
                        }
                    }
                    this.cylinderMesh = null;
                }
                
                // Clean up hole markers
                this.holeMarkers.forEach(marker => {
                    globalScene.remove(marker);
                    if (marker.geometry) marker.geometry.dispose();
                    if (marker.material) marker.material.dispose();
                });
                this.holeMarkers = [];
                
                // Clean up transform controls (control spheres)
                this.transformControls.forEach(control => {
                    globalScene.remove(control);
                    if (control.geometry) control.geometry.dispose();
                    if (control.material) control.material.dispose();
                });
                this.transformControls = [];
                
                // Additional cleanup: Remove any orphaned circular cylinder objects
                const orphanedCylinders = globalScene.children.filter(child => 
                    child.userData && child.userData.type === 'circularHolesCylinder'
                );
                
                if (orphanedCylinders.length > 0) {
                    console.warn(`Cleaning up ${orphanedCylinders.length} orphaned circular cylinders`);
                    orphanedCylinders.forEach(mesh => {
                        globalScene.remove(mesh);
                        if (mesh.geometry) mesh.geometry.dispose();
                        if (mesh.material) mesh.material.dispose();
                    });
                }
                
                
            }
          // Print Mode Methods for Circular Holes
enterPrintMode() {
    
    
    // Hide interactive controls
    this.holeMarkers.forEach(marker => marker.visible = false);
    this.transformControls.forEach(control => control.visible = false);
    
    // Create print mode elements
    this.createCircularPrintElements();
  if (this.cylinderMesh) {
    this.cylinderMesh.visible = false;
}
}

exitPrintMode() {
    
    
    // Show interactive controls
    this.holeMarkers.forEach(marker => marker.visible = true);
    this.transformControls.forEach(control => control.visible = true);
    
    // Remove print mode elements
    this.clearCircularPrintElements();
  if (this.cylinderMesh) {
    this.cylinderMesh.visible = true;
}
  if (!isPerspectiveView) {
    switchCamera();
}
}

createCircularPrintElements() {
    const outerRadius = this.cylinderRadius;
    const z = this.cylinderHeight / 2 + 0.002;
    
    // Create outer cylinder outline
    this.createCircleOutline(0, 0, outerRadius, z);
    
    // Create central hole outline if present
    if (this.includeCentralLumen) {
        const centralHole = this.holes.find(hole => hole.distance === 0);
        if (centralHole) {
            this.createCircleOutline(0, 0, centralHole.radius, z);
            this.createCentralHoleLabel(centralHole);
        }
    }
    
    // Create hole outlines and dimensions
    this.holes.forEach((hole, index) => {
        if (hole.distance > 0) { // Skip central lumen
            this.createCircleOutline(hole.x, hole.y, hole.radius, z);
            this.createHoleDimensionLines(hole, index);
        }
    });
    
    // Create axis lines
    this.createAxisLines();
}

createCircleOutline(centerX, centerY, radius, z) {
    const points = [];
    const segments = 64;
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            z
        ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const circle = new THREE.Line(geometry, material);
    
    globalScene.add(circle);
    this.printModeElements.push(circle);
}

createHoleDimensionLines(hole, index) {
    const z = this.cylinderHeight / 2 + 0.002;
    const extensionLength = 0.03;
    const holeAngle = Math.atan2(hole.y, hole.x);
    
    // Create line from center to hole center (light gray)
    const centerToHoleGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, z),
        new THREE.Vector3(hole.x, hole.y, z)
    ]);
    const centerToHoleMaterial = new THREE.LineBasicMaterial({ 
        color: 0xd1d1d1, 
        linewidth: 2 
    });
    const centerToHoleLine = new THREE.Line(centerToHoleGeometry, centerToHoleMaterial);
    
    globalScene.add(centerToHoleLine);
    this.dimensionLines.push(centerToHoleLine);
    
    // Create extension line from hole to label
    const endRadius = this.cylinderRadius + extensionLength;
    const endX = Math.cos(holeAngle) * endRadius;
    const endY = Math.sin(holeAngle) * endRadius;
    
    const extensionGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(hole.x, hole.y, z),
        new THREE.Vector3(endX, endY, z)
    ]);
    const extensionMaterial = new THREE.LineBasicMaterial({ color: 0xd1d1d1 , linewidth: 1 });
    const extensionLine = new THREE.Line(extensionGeometry, extensionMaterial);
    
    globalScene.add(extensionLine);
    this.dimensionLines.push(extensionLine);
    
    // Create perpendicular cross line through hole center (black)
    const perpendicularAngle = holeAngle + Math.PI/2; // 90 degrees perpendicular
    const crossLength = hole.radius * 0.5; // Half the hole radius
    const crossStart = {
        x: hole.x + Math.cos(perpendicularAngle) * crossLength,
        y: hole.y + Math.sin(perpendicularAngle) * crossLength
    };
    const crossEnd = {
        x: hole.x - Math.cos(perpendicularAngle) * crossLength,
        y: hole.y - Math.sin(perpendicularAngle) * crossLength
    };
    
    const crossGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(crossStart.x, crossStart.y, z),
        new THREE.Vector3(crossEnd.x, crossEnd.y, z)
    ]);
    const crossMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const crossLine = new THREE.Line(crossGeometry, crossMaterial);
    
    globalScene.add(crossLine);
    this.dimensionLines.push(crossLine);
    
    // Create dimension label
    this.createHoleLabel(hole, endX, endY, z, index);
}

createHoleLabel(hole, x, y, z, index) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'dimension-label';
    labelDiv.style.cssText = `
        color: black; 
        font-size: 12px; 
        background: rgba(255,255,255,0.9); 
        padding: 3px 6px; 
        border: 1px solid black; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    
    const diameter = (hole.radius * 2).toFixed(3);
    const distance = hole.distance.toFixed(3);
    const angle = Math.round(hole.angle);
    
    labelDiv.innerHTML = `
        <div><strong>${hole.name}</strong></div>
        <div>⌀ ${diameter}m</div>
        <div>↔ ${distance}m</div>
        <div>∠ ${angle}°</div>
    `;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(x, y, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}

createCentralHoleLabel(hole) {
    const z = this.cylinderHeight / 2 + 0.002;
    const labelDiv = document.createElement('div');
    labelDiv.className = 'dimension-label';
    labelDiv.style.cssText = `
        color: black; 
        font-size: 12px; 
        background: rgba(255,255,255,0.9); 
        padding: 3px 6px; 
        border: 1px solid black; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    
    const diameter = (hole.radius * 2).toFixed(3);
    labelDiv.innerHTML = `
        <div><strong>Central Lumen</strong></div>
        <div>⌀ ${diameter}m</div>
    `;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(-this.cylinderRadius * 0.7, this.cylinderRadius * 0.7, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}

createAxisLines() {
    const z = this.cylinderHeight / 2 + 0.002;
    const axisLength = this.cylinderRadius * 0.25; // Much shorter axes
    
    // X-axis line
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-axisLength, 0, z),
        new THREE.Vector3(axisLength, 0, z)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 3 });
    const xLine = new THREE.Line(xGeometry, xMaterial);
    globalScene.add(xLine);
    this.printModeElements.push(xLine);
    
    // Y-axis line  
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -axisLength, z),
        new THREE.Vector3(0, axisLength, z)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 3 });
    const yLine = new THREE.Line(yGeometry, yMaterial);
    globalScene.add(yLine);
    this.printModeElements.push(yLine);
    
    
} 

createAxisLabel(text, x, y, z) {
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = `
        color: black; 
        font-size: 11px; 
        font-weight: bold;
        font-family: Arial, sans-serif;
    `;
    labelDiv.textContent = text;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(x, y, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}

clearCircularPrintElements() {
    // Remove line elements
    this.printModeElements.forEach(element => {
        globalScene.remove(element);
        if (element.geometry) element.geometry.dispose();
        if (element.material) element.material.dispose();
    });
    this.printModeElements = [];
    
    // Remove dimension lines
    this.dimensionLines.forEach(line => {
        globalScene.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
    });
    this.dimensionLines = [];
    
    // Remove CSS2D labels
    this.dimensionLabels.forEach(label => {
        globalScene.remove(label);
        if (label.element && label.element.parentNode) {
            label.element.parentNode.removeChild(label.element);
        }
    });
    this.dimensionLabels = [];
}
        }

        // Pie Slice Implementation
        class PieSliceSystem {
           constructor() {
    
    this.cylinderMesh = null;
    this.controlSpheres = [];
    this.cylinderRadius = 0.1; // Default: 0.200m diameter
    this.cylinderHeight = 0.15;
    this.septumThickness = 0.005; // NEW: Ensure minimum 0.005m (currently 0.01 so this doesn't change anything)
    this.cornerRadius = 0.01;
    this.sliceCount = 3; // Default: 3 slices
    this.sliceAngles = [];
    this.hasCentralHole = false; // Default: no central hole
    this.innerDiameter = 0.025; // Default: 0.025m diameter
    this.printModeElements = [];
    this.dimensionLines = [];
    this.dimensionLabels = [];
    // Add interaction state
    this.isDragging = false;
    this.draggedControlIndex = -1;
    
    this.initializeSliceAngles();
    this.create();
    this.setupInteraction();
}
          async captureModelImage(width = 400, height = 400) {
    return await captureCurrentSystemThumbnail();
}
          updateToHighQuality() {
    
    this.createPieSliceCylinder();
    this.createControlSpheres();
}
            
           initializeSliceAngles() {
    if (this.sliceCount <= 0) {
        console.warn('Invalid slice count, setting to 1');
        this.sliceCount = 1;
    }
    
    const equalAngle = (Math.PI * 2) / this.sliceCount;
    this.sliceAngles = new Array(this.sliceCount).fill(equalAngle);
    
}
            
            create() {
               
                this.createPieSliceCylinder();
                this.createControlSpheres();
                this.createSliceUI(); // Changed from this.createUI() to this.createSliceUI()
            }
            setupInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onMouseDown = (event) => {
        const rect = globalRenderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, globalCamera);
        const intersects = raycaster.intersectObjects(this.controlSpheres);
        
        if (intersects.length > 0) {
            startInteraction();
            this.isDragging = true;
            this.draggedControlIndex = intersects[0].object.userData.sliceIndex;
            intersects[0].object.material.color.setHex(0xff3333);
            
            // Disable OrbitControls when dragging pie slice controls
            globalControls.enabled = false;
            
            event.preventDefault();
            event.stopPropagation();
        }
    };
    
    const onMouseMove = (event) => {
        if (!this.isDragging) return;
        // Auto-exit print mode on first interaction
    autoExitPrintMode();
        const rect = globalRenderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, globalCamera);
        
        // Project mouse to world coordinates on the z=0 plane
        const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
        vector.unproject(globalCamera);
        const dir = vector.sub(globalCamera.position).normalize();
        const distance = -globalCamera.position.z / dir.z;
        const pos = globalCamera.position.clone().add(dir.multiplyScalar(distance));
        
        // Calculate angle from center
        let angle = Math.atan2(pos.y, pos.x);
        if (angle < 0) angle += Math.PI * 2;
        
        // Update slice angles based on drag
        this.updateSliceAngles(this.draggedControlIndex, angle);
        
        // Recreate geometry
        this.updateGeometry();
    };
    
    const onMouseUp = (event) => {
        if (this.isDragging && this.draggedControlIndex >= 0) {
            this.controlSpheres[this.draggedControlIndex].material.color.setHex(0xff6b6b);
        }
        endInteraction();
        this.isDragging = false;
        this.draggedControlIndex = -1;
        
        // Re-enable OrbitControls
        globalControls.enabled = true;
    };
    
    // Add event listeners to the renderer's DOM element
    globalRenderer.domElement.addEventListener('mousedown', onMouseDown);
    globalRenderer.domElement.addEventListener('mousemove', onMouseMove);
    globalRenderer.domElement.addEventListener('mouseup', onMouseUp);
    
    
}
updateSliceAngles(controlIndex, targetAngle) {
    // Save original state
    const originalAngles = [...this.sliceAngles];
    
    // Calculate current position of the septum
    let currentSeptumAngle = 0;
    for (let i = 0; i < controlIndex; i++) {
        currentSeptumAngle += this.sliceAngles[i];
    }
    currentSeptumAngle += this.sliceAngles[controlIndex] / 2;
    
    // Normalize angles
    if (targetAngle < 0) targetAngle += Math.PI * 2;
    if (currentSeptumAngle < 0) currentSeptumAngle += Math.PI * 2;
    
    // Calculate the difference
    let angleDiff = targetAngle - currentSeptumAngle;
    
    // Handle wraparound
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    const minSliceAngle = 45 * Math.PI / 180; // 45 degrees minimum
    
    // NEW: Handle last slice the same way as other slices, but with different "next slice"
    let affectedSliceIndex;
    if (controlIndex === this.sliceCount - 1) {
        // For last slice, the "next slice" is actually the previous slice
        affectedSliceIndex = controlIndex - 1;
        // But we need to reverse the angle diff because we're affecting the previous slice
        angleDiff = -angleDiff;
    } else {
        // Normal case - affect the next slice
        affectedSliceIndex = controlIndex + 1;
    }
    
    const currentSliceAngle = this.sliceAngles[controlIndex];
    const affectedSliceAngle = this.sliceAngles[affectedSliceIndex];
    
    const maxReduceCurrent = currentSliceAngle - minSliceAngle;
    const maxReduceAffected = affectedSliceAngle - minSliceAngle;
    
    const maxPositiveChange = Math.max(0, maxReduceAffected);
    const maxNegativeChange = -Math.max(0, maxReduceCurrent);
    
    // NEW: For last slice, also check 360° boundary
    if (controlIndex === this.sliceCount - 1) {
        // Calculate where the end of the last slice would be
        let totalAngle = 0;
        for (let i = 0; i < this.sliceCount - 1; i++) {
            totalAngle += this.sliceAngles[i];
        }
        const potentialNewLastSliceAngle = currentSliceAngle + angleDiff;
        const endAngle = totalAngle + potentialNewLastSliceAngle;
        
        // If would exceed 360°, limit the positive change
        if (endAngle > Math.PI * 2) {
            const excess = endAngle - (Math.PI * 2);
            const adjustedMaxPositive = Math.max(0, maxPositiveChange - excess);
            angleDiff = Math.max(maxNegativeChange, Math.min(adjustedMaxPositive, angleDiff));
        } else {
            angleDiff = Math.max(maxNegativeChange, Math.min(maxPositiveChange, angleDiff));
        }
    } else {
        angleDiff = Math.max(maxNegativeChange, Math.min(maxPositiveChange, angleDiff));
    }
    
    if (Math.abs(angleDiff) > 0.01) {
        // Apply the change
        this.sliceAngles[controlIndex] += angleDiff;
        this.sliceAngles[affectedSliceIndex] -= angleDiff;
        
        this.sliceAngles[controlIndex] = Math.max(minSliceAngle, this.sliceAngles[controlIndex]);
        this.sliceAngles[affectedSliceIndex] = Math.max(minSliceAngle, this.sliceAngles[affectedSliceIndex]);
        
        // Check for collapse after drag change
        const collapseCheck = this.detectSliceCollapse();
        
        if (collapseCheck.collapsed) {
            // Revert to original angles
            for (let i = 0; i < this.sliceCount; i++) {
                this.sliceAngles[i] = originalAngles[i];
            }
            
            this.updateAllSliceControls();
            console.warn(`Drag limited: ${collapseCheck.reason}`);
            return;
        }
        
        // Update HTML controls when dragging
        this.updateAllSliceControls();
    }
}
          updateSingleSliceControl(sliceIndex) {
    const degrees = Math.round(this.sliceAngles[sliceIndex] * 180 / Math.PI);
    const slider = document.getElementById(`slice-${sliceIndex}`);
    const numberInput = document.getElementById(`slice-${sliceIndex}-num`);
    
    if (slider) slider.value = degrees;
    if (numberInput) numberInput.value = degrees;
}
createPieSliceCylinder() {
    
    
    // Clean up existing cylinder
    if (this.cylinderMesh) {
        globalScene.remove(this.cylinderMesh);
        if (this.cylinderMesh.geometry) this.cylinderMesh.geometry.dispose();
        if (this.cylinderMesh.material) this.cylinderMesh.material.dispose();
    }
    
    // Create main cylinder shape
    const shape = new THREE.Shape();
    shape.absarc(0, 0, this.cylinderRadius, 0, Math.PI * 2, false);
    
    // Add central hole if enabled
    if (this.hasCentralHole) {
        const innerRadius = this.innerDiameter / 2;
        const centralHole = new THREE.Path();
        centralHole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
        shape.holes.push(centralHole);
    }
    
    // Calculate effective radii for pie slices
    const effectiveInnerRadius = this.hasCentralHole ? 
        (this.innerDiameter / 2 + this.septumThickness) : 
        this.septumThickness;
    const effectiveOuterRadius = this.cylinderRadius - this.septumThickness;
    
    // Calculate septum angles for inner and outer radii
    const septumAngleAtInner = this.hasCentralHole ? 
        this.septumThickness / (this.innerDiameter / 2 + this.septumThickness) : 
        this.septumThickness / this.septumThickness;
    const septumAngleAtOuter = this.septumThickness / effectiveOuterRadius;
    
    // Create pie slice holes
    let currentAngle = 0;
    
    for (let i = 0; i < this.sliceCount; i++) {
        const sliceAngle = this.sliceAngles[i];
        const holeShape = new THREE.Shape();
        
        if (this.hasCentralHole) {
            // 4-sided pie slice with dual-angle septums
            const septumBoundaries = this.calculateDualAngleSeptumBoundaries(
                currentAngle, 
                currentAngle + sliceAngle, 
                effectiveInnerRadius, 
                effectiveOuterRadius, 
                septumAngleAtInner,
                septumAngleAtOuter
            );
            
            this.createDualAngleFourSidedSlice(
                holeShape, 
                septumBoundaries,
                effectiveInnerRadius, 
                effectiveOuterRadius, 
                this.cornerRadius
            );
        } else {
            // 3-sided pie slice (existing logic)
            const septumAngleToUse = septumAngleAtOuter;
            const startAngle = currentAngle + septumAngleToUse / 2;
            const endAngle = startAngle + sliceAngle - septumAngleToUse;
            
            const convergencePoint = this.calculateUniformConvergencePoint(startAngle, endAngle, effectiveOuterRadius, this.septumThickness);
            const convergenceX = convergencePoint.x;
            const convergenceY = convergencePoint.y;
            
            const startOuterX = Math.cos(startAngle) * effectiveOuterRadius;
            const startOuterY = Math.sin(startAngle) * effectiveOuterRadius;
            const endOuterX = Math.cos(endAngle) * effectiveOuterRadius;
            const endOuterY = Math.sin(endAngle) * effectiveOuterRadius;
            
            if (this.cornerRadius > 0) {
                const filletData = this.calculateCircularFillets(
                    convergenceX, convergenceY, 
                    startOuterX, startOuterY, 
                    endOuterX, endOuterY, 
                    effectiveOuterRadius, this.cornerRadius, 
                    startAngle, endAngle
                );
                this.buildShapeWithCircularFillets(holeShape, filletData, sliceAngle);
            } else {
                holeShape.moveTo(convergenceX, convergenceY);
                holeShape.lineTo(startOuterX, startOuterY);
                holeShape.absarc(0, 0, effectiveOuterRadius, startAngle, endAngle, false);
                holeShape.lineTo(convergenceX, convergenceY);
            }
        }
        
        shape.holes.push(holeShape);
        currentAngle += sliceAngle;
    }
    
    const extrudeSettings = {
        depth: this.cylinderHeight,
        bevelEnabled: false,
        curveSegments: getCurrentCurveSegments()
    };
    
    try {
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    
    const material = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    metalness: 0.1,      // Same as the example
    roughness: 0.4,      // Low roughness for shiny appearance
    transparent: false,
    opacity: 1
});
    
    this.cylinderMesh = new THREE.Mesh(geometry, material);
    this.cylinderMesh.userData = { type: 'pieSliceCylinder' };
    globalScene.add(this.cylinderMesh);
    
    
} catch (error) {
    console.error('Error creating pie slice geometry:', error);
    this.createSimpleFallback();
}
}
createDualAngleFourSidedSlice(holeShape, boundaries, innerRadius, outerRadius, cornerRadius) {
    // Calculate the corner points using the dual-angle boundaries
    const startInnerX = Math.cos(boundaries.innerStartAngle) * innerRadius;
    const startInnerY = Math.sin(boundaries.innerStartAngle) * innerRadius;
    const endInnerX = Math.cos(boundaries.innerEndAngle) * innerRadius;
    const endInnerY = Math.sin(boundaries.innerEndAngle) * innerRadius;
    const startOuterX = Math.cos(boundaries.outerStartAngle) * outerRadius;
    const startOuterY = Math.sin(boundaries.outerStartAngle) * outerRadius;
    const endOuterX = Math.cos(boundaries.outerEndAngle) * outerRadius;
    const endOuterY = Math.sin(boundaries.outerEndAngle) * outerRadius;
    
    if (cornerRadius > 0) {
        // Build rounded shape with the dual-angle boundaries
        this.buildDualAngleRoundedShape(holeShape, 
            startInnerX, startInnerY, startOuterX, startOuterY,
            endOuterX, endOuterY, endInnerX, endInnerY,
            boundaries, cornerRadius);
    } else {
        // Sharp corners version
        holeShape.moveTo(startInnerX, startInnerY);
        holeShape.lineTo(startOuterX, startOuterY);
        holeShape.absarc(0, 0, outerRadius, boundaries.outerStartAngle, boundaries.outerEndAngle, false);
        holeShape.lineTo(endInnerX, endInnerY);
        holeShape.absarc(0, 0, innerRadius, boundaries.innerEndAngle, boundaries.innerStartAngle, true);
    }
}
calculateMaximumInnerDiameter() {
    if (!this.hasCentralHole) return 0;
    
    
    
    const outerRadius = this.cylinderRadius;
    const effectiveOuterRadius = outerRadius - this.septumThickness;
    
    // Start with a reasonable upper bound
    let maxInnerDiameter = Math.min(
        (outerRadius - this.septumThickness * 3) * 2, // Physical constraint
        outerRadius * 1.5 // Don't go crazy large
    );
    
    // Ensure we start with something reasonable
    if (maxInnerDiameter < 0.001) {
        console.warn('Outer diameter too small for any inner diameter');
        return 0.001;
    }
    
    // Save current state
    const originalInnerDiameter = this.innerDiameter;
    
    let minDiameter = 0.001; // 1mm minimum
    let testDiameter = maxInnerDiameter;
    let foundValidDiameter = false;
    
    
    
    // Binary search for the maximum valid inner diameter
    for (let i = 0; i < 25; i++) { // More iterations for better precision
        this.innerDiameter = testDiameter;
        const collapseCheck = this.detectSliceCollapse();
        
       
        
        if (collapseCheck.collapsed) {
            // Too large, reduce
            maxInnerDiameter = testDiameter;
            testDiameter = (minDiameter + maxInnerDiameter) / 2;
        } else {
            // This size works, try larger
            foundValidDiameter = true;
            minDiameter = testDiameter;
            testDiameter = (minDiameter + maxInnerDiameter) / 2;
        }
        
        // Stop if we've converged
        if (Math.abs(maxInnerDiameter - minDiameter) < 0.0005) {
            break;
        }
    }
    
    // Restore original state
    this.innerDiameter = originalInnerDiameter;
    
    if (!foundValidDiameter) {
        console.warn('No valid inner diameter found, returning minimum');
        return 0.001;
    }
    
    // Return the largest valid diameter with a small safety margin
    const result = Math.max(0.001, minDiameter - 0.001);
    
    return result;
}          
            createSimpleFallback() {
    
    const geometry = new THREE.CylinderGeometry(
        this.cylinderRadius * 0.8,
        this.cylinderRadius * 0.8,
        this.cylinderHeight,
        8
    );
    const material = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    metalness: 0.1,      // Same as the example
    roughness: 0.4,      // Low roughness for shiny appearance
    transparent: false,
    opacity: 1
});
    this.cylinderMesh = new THREE.Mesh(geometry, material);
    globalScene.add(this.cylinderMesh);
}
    setupSeptumControls() {
    const septumSlider = document.getElementById('septum-thickness');
    const septumInput = document.getElementById('septum-thickness-input');
    septumSlider.addEventListener('mousedown', startInteraction);
      septumSlider.addEventListener('mouseup', endInteraction);
    septumSlider.addEventListener('change', endInteraction);
    septumSlider.addEventListener('input', (e) => {
       startInteraction();
       autoExitPrintMode();
        const newSeptumThickness = parseFloat(e.target.value);
        
        // NEW: Enforce minimum septum thickness
        if (newSeptumThickness < 0.005) {
            septumSlider.value = '0.005';
            septumInput.value = '0.005';
            
            // Show brief feedback
            const info = document.createElement('div');
            info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:8px;border-radius:3px;z-index:1000;font-family:Arial;font-size:12px;';
            info.textContent = 'Minimum septum thickness is 0.005m (5mm)';
            document.body.appendChild(info);
            setTimeout(() => info.remove(), 2000);
            
            return; // Don't update with invalid value
        }
        
        septumInput.value = newSeptumThickness.toFixed(3);
        this.updateSeptumThickness(newSeptumThickness);
    });
    
    septumInput.addEventListener('input', (e) => {
       autoExitPrintMode();
        const newSeptumThickness = parseFloat(e.target.value);
        if (!isNaN(newSeptumThickness)) {
            // NEW: Enforce minimum septum thickness
            if (newSeptumThickness < 0.005) {
                septumSlider.value = '0.005';
                e.target.value = '0.005';
                
                // Show brief feedback
                const info = document.createElement('div');
                info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:8px;border-radius:3px;z-index:1000;font-family:Arial;font-size:12px;';
                info.textContent = 'Minimum septum thickness is 0.005m (5mm)';
                document.body.appendChild(info);
                setTimeout(() => info.remove(), 2000);
                
                return; // Don't update with invalid value
            }
            
            septumSlider.value = newSeptumThickness;
            this.updateSeptumThickness(newSeptumThickness);
        }
    });
}

calculateDualAngleSeptumBoundaries(startAngle, endAngle, innerRadius, outerRadius, septumAngleAtInner, septumAngleAtOuter) {
    const totalSliceAngle = endAngle - startAngle;
    
    // For inner radius: use inner septum angle
    const innerPieSliceAngle = totalSliceAngle - septumAngleAtInner;
    const innerStartAngle = startAngle + septumAngleAtInner / 2;
    const innerEndAngle = innerStartAngle + innerPieSliceAngle;
    
    // For outer radius: use outer septum angle  
    const outerPieSliceAngle = totalSliceAngle - septumAngleAtOuter;
    const outerStartAngle = startAngle + septumAngleAtOuter / 2;
    const outerEndAngle = outerStartAngle + outerPieSliceAngle;
    
    return {
        innerStartAngle,
        innerEndAngle,
        outerStartAngle,
        outerEndAngle,
        innerRadius,
        outerRadius
    };
}
buildDualAngleRoundedShape(holeShape, startInnerX, startInnerY, startOuterX, startOuterY, endOuterX, endOuterY, endInnerX, endInnerY, boundaries, cornerRadius) {
    
    // Calculate line lengths for reference
    const radialLine1Length = Math.sqrt((startOuterX - startInnerX)**2 + (startOuterY - startInnerY)**2);
    const radialLine2Length = Math.sqrt((endOuterX - endInnerX)**2 + (endOuterY - endInnerY)**2);
    const outerArcLength = Math.abs(boundaries.outerEndAngle - boundaries.outerStartAngle) * boundaries.outerRadius;
    const innerArcLength = Math.abs(boundaries.innerEndAngle - boundaries.innerStartAngle) * boundaries.innerRadius;
    
    // Use generous limits to prevent geometric impossibilities
    const maxCornerRadius = Math.min(
        cornerRadius,
        radialLine1Length * 0.9,
        radialLine2Length * 0.9,
        outerArcLength * 0.8,
        innerArcLength * 0.8
    );
    
    // Calculate fillet points
    const filletDistance = maxCornerRadius;
    
    const startInnerFilletX = startInnerX + (startOuterX - startInnerX) / radialLine1Length * filletDistance;
    const startInnerFilletY = startInnerY + (startOuterY - startInnerY) / radialLine1Length * filletDistance;
    
    const startOuterFilletX = startOuterX - (startOuterX - startInnerX) / radialLine1Length * filletDistance;
    const startOuterFilletY = startOuterY - (startOuterY - startInnerY) / radialLine1Length * filletDistance;
    
    const endOuterFilletX = endOuterX - (endOuterX - endInnerX) / radialLine2Length * filletDistance;
    const endOuterFilletY = endOuterY - (endOuterY - endInnerY) / radialLine2Length * filletDistance;
    
    const endInnerFilletX = endInnerX + (endOuterX - endInnerX) / radialLine2Length * filletDistance;
    const endInnerFilletY = endInnerY + (endOuterY - endInnerY) / radialLine2Length * filletDistance;
    
    // Arc adjustments
    const outerFilletAngle = maxCornerRadius / boundaries.outerRadius;
    const innerFilletAngle = maxCornerRadius / boundaries.innerRadius;
    
    const outerArcStart = boundaries.outerStartAngle + outerFilletAngle;
    const outerArcEnd = boundaries.outerEndAngle - outerFilletAngle;
    const innerArcStart = boundaries.innerEndAngle - innerFilletAngle;
    const innerArcEnd = boundaries.innerStartAngle + innerFilletAngle;
    
    const outerArcStartX = Math.cos(outerArcStart) * boundaries.outerRadius;
    const outerArcStartY = Math.sin(outerArcStart) * boundaries.outerRadius;
    const outerArcEndX = Math.cos(outerArcEnd) * boundaries.outerRadius;
    const outerArcEndY = Math.sin(outerArcEnd) * boundaries.outerRadius;
    
    const innerArcStartX = Math.cos(innerArcStart) * boundaries.innerRadius;
    const innerArcStartY = Math.sin(innerArcStart) * boundaries.innerRadius;
    const innerArcEndX = Math.cos(innerArcEnd) * boundaries.innerRadius;
    const innerArcEndY = Math.sin(innerArcEnd) * boundaries.innerRadius;
    
    // Build the shape
    holeShape.moveTo(innerArcEndX, innerArcEndY);
    
    // Inner arc
    holeShape.absarc(0, 0, boundaries.innerRadius, innerArcEnd, innerArcStart, false);
    
    // Corner 1: end inner
    holeShape.quadraticCurveTo(endInnerX, endInnerY, endInnerFilletX, endInnerFilletY);
    
    // Line to outer
    holeShape.lineTo(endOuterFilletX, endOuterFilletY);
    
    // Corner 2: end outer
    holeShape.quadraticCurveTo(endOuterX, endOuterY, outerArcEndX, outerArcEndY);
    
    // Outer arc
    holeShape.absarc(0, 0, boundaries.outerRadius, outerArcEnd, outerArcStart, true);
    
    // Corner 3: start outer
    holeShape.quadraticCurveTo(startOuterX, startOuterY, startOuterFilletX, startOuterFilletY);
    
    // Line to inner
    holeShape.lineTo(startInnerFilletX, startInnerFilletY);
    
    // Corner 4: start inner
    holeShape.quadraticCurveTo(startInnerX, startInnerY, innerArcEndX, innerArcEndY);
}
calculateMinimumOuterDiameter() {
    let minRadius = 0.079 / 2; // NEW: Use 0.079m minimum diameter instead of 0.05
    
    if (this.hasCentralHole) {
        // With central hole, need space for inner radius + septum + outer slices
        const innerRadius = this.innerDiameter / 2;
        minRadius = Math.max(minRadius, innerRadius + this.septumThickness * 3);
    }
    
    // Add space needed for current slice configuration
    const effectiveRadius = minRadius - this.septumThickness;
    const septumAngle = this.septumThickness / effectiveRadius;
    
    // Check if current slices fit
    let totalAngleNeeded = 0;
    for (let i = 0; i < this.sliceCount; i++) {
        totalAngleNeeded += Math.max(this.sliceAngles[i], 45 * Math.PI / 180); // 45° minimum
    }
    
    if (totalAngleNeeded > Math.PI * 2) {
        // Need larger radius to fit slices
        minRadius *= totalAngleNeeded / (Math.PI * 2);
    }
    
    return Math.max(0.079, minRadius * 2); // NEW: Ensure minimum 0.079m diameter
}
calculateMaximumInnerDiameterFromOuter() {
    if (!this.hasCentralHole) return 0;
    
    const outerRadius = this.cylinderRadius;
    
    // Your formula: outer radius - septum thickness * 2 - 0.02
    const maxInnerRadius = outerRadius - (this.septumThickness * 2) - 0.02;
    const maxInnerDiameter = maxInnerRadius * 2;
    
    // Ensure it's not negative and has a reasonable minimum
    return Math.max(0.001, maxInnerDiameter);
}
updateInnerDiameterLimits() {
    if (!this.hasCentralHole) return;
    
    const innerDiameterSlider = document.getElementById('inner-diameter');
    const innerDiameterInput = document.getElementById('inner-diameter-input');
    
    if (innerDiameterSlider && innerDiameterInput) {
        const maxInnerDiameter = this.calculateMaximumInnerDiameterFromOuter();
        
        // Update the max attribute of the controls
        innerDiameterSlider.max = maxInnerDiameter.toFixed(3);
        innerDiameterInput.max = maxInnerDiameter.toFixed(3);
        
        // If current value exceeds new maximum, clamp it
        if (this.innerDiameter > maxInnerDiameter) {
            this.innerDiameter = maxInnerDiameter;
            innerDiameterSlider.value = maxInnerDiameter.toFixed(3);
            innerDiameterInput.value = maxInnerDiameter.toFixed(3);
            
            // Update geometry with new inner diameter
            this.updateGeometry();
            
           
        }
        
      
    }
}
updateSeptumThickness(newSeptumThickness) {
    // NEW: Extra validation for minimum septum thickness
    if (newSeptumThickness < 0.005) {
        console.warn(`Septum thickness ${newSeptumThickness.toFixed(3)}m is below minimum 0.005m, using minimum`);
        newSeptumThickness = 0.005;
        
        // Update UI to reflect the corrected value
        const septumSlider = document.getElementById('septum-thickness');
        const septumInput = document.getElementById('septum-thickness-input');
        if (septumSlider) septumSlider.value = '0.005';
        if (septumInput) septumInput.value = '0.005';
    }
    
    const originalSeptumThickness = this.septumThickness;
    
    // For decreases, allow it (no collapse risk) but respect minimum
    if (newSeptumThickness <= originalSeptumThickness) {
        this.septumThickness = newSeptumThickness;
        this.updateGeometry();
        return;
    }
    
    // For increases, test if it would cause collapse
    this.septumThickness = newSeptumThickness;
    const collapseCheck = this.detectSliceCollapse();
    
    if (collapseCheck.collapsed) {
        // Revert to original septum thickness
        this.septumThickness = originalSeptumThickness;
        
        // Update UI to show reverted value
        const septumSlider = document.getElementById('septum-thickness');
        const septumInput = document.getElementById('septum-thickness-input');
        if (septumSlider) septumSlider.value = originalSeptumThickness.toFixed(3);
        if (septumInput) septumInput.value = originalSeptumThickness.toFixed(3);
        
        // Show warning
        console.warn(`Septum thickness limited to ${originalSeptumThickness.toFixed(3)}m: ${collapseCheck.reason}`);
        return;
    }
    
    // If valid, update geometry
    this.updateGeometry();
}

updateCornerRadius(newCornerRadius) {
    this.cornerRadius = newCornerRadius;
    this.updateGeometry();
}

// Basic collapse detection for pie slices
detectSliceCollapse() {
    const minimumLineLength = 0.015; // 15mm minimum line length
    const minimumLineLength4Sided = 0.001; // 1mm minimum for 4-sided
    const effectiveInnerRadius = this.hasCentralHole ? 
        (this.innerDiameter / 2 + this.septumThickness) : 
        this.septumThickness;
    const effectiveOuterRadius = this.cylinderRadius - this.septumThickness;
    
    // Check if effective radii are invalid
    if (effectiveOuterRadius <= effectiveInnerRadius) {
        return {
            collapsed: true,
            reason: "Outer radius too small - septum thickness exceeds available space"
        };
    }
    
    const septumAngleAtInner = this.hasCentralHole ? 
        this.septumThickness / (this.innerDiameter / 2 + this.septumThickness) : 
        this.septumThickness / this.septumThickness;
    const septumAngleAtOuter = this.septumThickness / effectiveOuterRadius;
    
    let currentAngle = 0;
    
    for (let i = 0; i < this.sliceCount; i++) {
        const sliceAngle = this.sliceAngles[i];
        
        if (this.hasCentralHole) {
            // 4-sided slice - use 4-sided minimum line length
            const minLineLength = minimumLineLength4Sided;
            
            const septumBoundaries = this.calculateDualAngleSeptumBoundaries(
                currentAngle, 
                currentAngle + sliceAngle, 
                effectiveInnerRadius, 
                effectiveOuterRadius, 
                septumAngleAtInner,
                septumAngleAtOuter
            );
            
            // NEW: Calculate the inner corner points and check distance between them
            const startInnerX = Math.cos(septumBoundaries.innerStartAngle) * effectiveInnerRadius;
            const startInnerY = Math.sin(septumBoundaries.innerStartAngle) * effectiveInnerRadius;
            const endInnerX = Math.cos(septumBoundaries.innerEndAngle) * effectiveInnerRadius;
            const endInnerY = Math.sin(septumBoundaries.innerEndAngle) * effectiveInnerRadius;
            
            // Check if inner corners are too close
            const innerCornerDistance = Math.sqrt((endInnerX - startInnerX)**2 + (endInnerY - startInnerY)**2);
            
            if (innerCornerDistance < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Inner corners too close (${innerCornerDistance.toFixed(4)}m apart, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "inner_corner_distance"
                };
            }
            
            // Check radial line lengths
            const startOuterX = Math.cos(septumBoundaries.outerStartAngle) * effectiveOuterRadius;
            const startOuterY = Math.sin(septumBoundaries.outerStartAngle) * effectiveOuterRadius;
            const endOuterX = Math.cos(septumBoundaries.outerEndAngle) * effectiveOuterRadius;
            const endOuterY = Math.sin(septumBoundaries.outerEndAngle) * effectiveOuterRadius;
            
            const radialLine1Length = Math.sqrt((startOuterX - startInnerX)**2 + (startOuterY - startInnerY)**2);
            const radialLine2Length = Math.sqrt((endOuterX - endInnerX)**2 + (endOuterY - endInnerY)**2);
            
            // Account for corner radius
            const effectiveRadialLine1 = radialLine1Length - (2 * this.cornerRadius);
            const effectiveRadialLine2 = radialLine2Length - (2 * this.cornerRadius);
            
            // Check radial line lengths
            if (effectiveRadialLine1 < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Start radial line too short (${effectiveRadialLine1.toFixed(4)}m, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "radial_line"
                };
            }
            if (effectiveRadialLine2 < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: End radial line too short (${effectiveRadialLine2.toFixed(4)}m, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "radial_line"
                };
            }
            
            // Check arc lengths
            const outerArcLength = Math.abs(septumBoundaries.outerEndAngle - septumBoundaries.outerStartAngle) * effectiveOuterRadius;
            const innerArcLength = Math.abs(septumBoundaries.innerEndAngle - septumBoundaries.innerStartAngle) * effectiveInnerRadius;
            const effectiveOuterArc = outerArcLength - (2 * this.cornerRadius);
            const effectiveInnerArc = innerArcLength - (2 * this.cornerRadius);
            
            if (effectiveOuterArc < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Outer arc too short (${effectiveOuterArc.toFixed(4)}m, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "outer_arc"
                };
            }
            if (effectiveInnerArc < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Inner arc too short (${effectiveInnerArc.toFixed(4)}m, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "inner_arc"
                };
            }
            
        } else {
            // 3-sided slice - use 3-sided minimum line length (existing logic)
            const minLineLength = minimumLineLength;
            
            const septumAngleToUse = septumAngleAtOuter;
            const startAngle = currentAngle + septumAngleToUse / 2;
            const endAngle = startAngle + sliceAngle - septumAngleToUse;
            
            const convergencePoint = this.calculateUniformConvergencePoint(startAngle, endAngle, effectiveOuterRadius, this.septumThickness);
            const convergenceX = convergencePoint.x;
            const convergenceY = convergencePoint.y;
            
            const startOuterX = Math.cos(startAngle) * effectiveOuterRadius;
            const startOuterY = Math.sin(startAngle) * effectiveOuterRadius;
            const endOuterX = Math.cos(endAngle) * effectiveOuterRadius;
            const endOuterY = Math.sin(endAngle) * effectiveOuterRadius;
            
            // Calculate line lengths from convergence to outer points
            const line1Length = Math.sqrt((startOuterX - convergenceX)**2 + (startOuterY - convergenceY)**2);
            const line2Length = Math.sqrt((endOuterX - convergenceX)**2 + (endOuterY - convergenceY)**2);
            
            // Calculate outer arc length
            const outerArcLength = Math.abs(endAngle - startAngle) * effectiveOuterRadius;
            
            // Account for corner radius
            const effectiveLine1 = line1Length - (2 * this.cornerRadius);
            const effectiveLine2 = line2Length - (2 * this.cornerRadius);
            const effectiveOuterArc = outerArcLength - (2 * this.cornerRadius);
            
            // Check if any line segment is too short
            if (effectiveLine1 < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Start line too short (${effectiveLine1.toFixed(4)}m, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "convergence_line"
                };
            }
            if (effectiveLine2 < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: End line too short (${effectiveLine2.toFixed(4)}m, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "convergence_line"
                };
            }
            if (effectiveOuterArc < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Outer arc too short (${effectiveOuterArc.toFixed(4)}m, min: ${minLineLength.toFixed(3)}m)`,
                    sliceIndex: i,
                    lineType: "outer_arc"
                };
            }
        }
        
        currentAngle += sliceAngle;
    }
    
    return { collapsed: false };
}
            calculateUniformConvergencePoint(startAngle, endAngle, effectiveOuterRadius, septumThickness) {
    const midAngle = (startAngle + endAngle) / 2;
    const sliceAngle = endAngle - startAngle;
    
    // Calculate the convergence point that maintains uniform septum thickness
    const halfSliceAngle = sliceAngle / 2;
    
    // Calculate convergence distance using trigonometry for uniform thickness
    const convergenceDistance = septumThickness / (2 * Math.sin(halfSliceAngle));
    
    // Clamp convergence distance to reasonable bounds
    const minConvergence = septumThickness * 0.1;
    const maxConvergence = effectiveOuterRadius * 0.3;
    const clampedDistance = Math.max(minConvergence, Math.min(maxConvergence, convergenceDistance));
    
    const convergenceX = Math.cos(midAngle) * clampedDistance;
    const convergenceY = Math.sin(midAngle) * clampedDistance;
    
    return { x: convergenceX, y: convergenceY, distance: clampedDistance };
}
calculateCircularFillets(convergenceX, convergenceY, startOuterX, startOuterY, endOuterX, endOuterY, outerArcRadius, filletRadius, startAngle, endAngle) {
    const line1X = startOuterX - convergenceX;
    const line1Y = startOuterY - convergenceY;
    const line1Length = Math.sqrt(line1X * line1X + line1Y * line1Y);
    
    const line2X = endOuterX - convergenceX;
    const line2Y = endOuterY - convergenceY;
    const line2Length = Math.sqrt(line2X * line2X + line2Y * line2Y);
    
    const line1UnitX = line1X / line1Length;
    const line1UnitY = line1Y / line1Length;
    const line2UnitX = line2X / line2Length;
    const line2UnitY = line2Y / line2Length;
    
    // Convergence fillet (keep working version)
    const halfAngle = Math.acos(Math.max(-1, Math.min(1, line1UnitX * line2UnitX + line1UnitY * line2UnitY))) / 2;
    const distanceToCenter = filletRadius / Math.sin(halfAngle);
    
    const bisectorX = (line1UnitX + line2UnitX) / 2;
    const bisectorY = (line1UnitY + line2UnitY) / 2;
    const bisectorLength = Math.sqrt(bisectorX * bisectorX + bisectorY * bisectorY);
    const bisectorUnitX = bisectorX / bisectorLength;
    const bisectorUnitY = bisectorY / bisectorLength;
    
    const fillet1CenterX = convergenceX + bisectorUnitX * distanceToCenter;
    const fillet1CenterY = convergenceY + bisectorUnitY * distanceToCenter;
    
    const fillet1Tangent1X = convergenceX + line1UnitX * (distanceToCenter * Math.cos(halfAngle));
    const fillet1Tangent1Y = convergenceY + line1UnitY * (distanceToCenter * Math.cos(halfAngle));
    const fillet1Tangent2X = convergenceX + line2UnitX * (distanceToCenter * Math.cos(halfAngle));
    const fillet1Tangent2Y = convergenceY + line2UnitY * (distanceToCenter * Math.cos(halfAngle));
    
    // CORRECT geometric calculation for outer corners
    const line1NormalX = -line1UnitY;
    const line1NormalY = line1UnitX;
    const line2NormalX = line2UnitY;
    const line2NormalY = -line2UnitX;
    
    // For fillet 2: Find center that is exactly filletRadius from line1 AND from outer circle
    // The center must be at distance (outerArcRadius - filletRadius) from origin
    
    // Point on line1 offset by filletRadius
    const line1OffsetX = startOuterX + line1NormalX * filletRadius;
    const line1OffsetY = startOuterY + line1NormalY * filletRadius;
    
    // This offset line has equation: (x,y) = line1Offset + t * line1Unit
    // We need: distance from (line1OffsetX + t*line1UnitX, line1OffsetY + t*line1UnitY) to origin = outerArcRadius - filletRadius
    
    const targetDistance = outerArcRadius - filletRadius;
    
    // Solve: (line1OffsetX + t*line1UnitX)² + (line1OffsetY + t*line1UnitY)² = targetDistance²
    const a = line1UnitX * line1UnitX + line1UnitY * line1UnitY; // = 1
    const b = 2 * (line1OffsetX * line1UnitX + line1OffsetY * line1UnitY);
    const c = line1OffsetX * line1OffsetX + line1OffsetY * line1OffsetY - targetDistance * targetDistance;
    
    const discriminant = b * b - 4 * a * c;
    
    let fillet2CenterX, fillet2CenterY;
    if (discriminant >= 0) {
        const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        
        // Choose the solution closer to the original corner
        const candidate1X = line1OffsetX + t1 * line1UnitX;
        const candidate1Y = line1OffsetY + t1 * line1UnitY;
        const candidate2X = line1OffsetX + t2 * line1UnitX;
        const candidate2Y = line1OffsetY + t2 * line1UnitY;
        
        const dist1 = Math.sqrt((candidate1X - startOuterX) ** 2 + (candidate1Y - startOuterY) ** 2);
        const dist2 = Math.sqrt((candidate2X - startOuterX) ** 2 + (candidate2Y - startOuterY) ** 2);
        
        if (dist1 < dist2) {
            fillet2CenterX = candidate1X;
            fillet2CenterY = candidate1Y;
        } else {
            fillet2CenterX = candidate2X;
            fillet2CenterY = candidate2Y;
        }
    } else {
        // Fallback - this shouldn't happen with correct geometry
        fillet2CenterX = startOuterX + line1NormalX * filletRadius;
        fillet2CenterY = startOuterY + line1NormalY * filletRadius;
    }
    
    // Same calculation for fillet 3
    const line2OffsetX = endOuterX + line2NormalX * filletRadius;
    const line2OffsetY = endOuterY + line2NormalY * filletRadius;
    
    const a3 = line2UnitX * line2UnitX + line2UnitY * line2UnitY; // = 1
    const b3 = 2 * (line2OffsetX * line2UnitX + line2OffsetY * line2UnitY);
    const c3 = line2OffsetX * line2OffsetX + line2OffsetY * line2OffsetY - targetDistance * targetDistance;
    
    const discriminant3 = b3 * b3 - 4 * a3 * c3;
    
    let fillet3CenterX, fillet3CenterY;
    if (discriminant3 >= 0) {
        const t1 = (-b3 + Math.sqrt(discriminant3)) / (2 * a3);
        const t2 = (-b3 - Math.sqrt(discriminant3)) / (2 * a3);
        
        const candidate1X = line2OffsetX + t1 * line2UnitX;
        const candidate1Y = line2OffsetY + t1 * line2UnitY;
        const candidate2X = line2OffsetX + t2 * line2UnitX;
        const candidate2Y = line2OffsetY + t2 * line2UnitY;
        
        const dist1 = Math.sqrt((candidate1X - endOuterX) ** 2 + (candidate1Y - endOuterY) ** 2);
        const dist2 = Math.sqrt((candidate2X - endOuterX) ** 2 + (candidate2Y - endOuterY) ** 2);
        
        if (dist1 < dist2) {
            fillet3CenterX = candidate1X;
            fillet3CenterY = candidate1Y;
        } else {
            fillet3CenterX = candidate2X;
            fillet3CenterY = candidate2Y;
        }
    } else {
        fillet3CenterX = endOuterX + line2NormalX * filletRadius;
        fillet3CenterY = endOuterY + line2NormalY * filletRadius;
    }
    
    // Calculate tangent points geometrically
    const fillet2Tangent1X = fillet2CenterX - line1NormalX * filletRadius;
    const fillet2Tangent1Y = fillet2CenterY - line1NormalY * filletRadius;
    
    // For tangent to outer arc: point on line from origin through center
    const fillet2ToOriginLength = Math.sqrt(fillet2CenterX ** 2 + fillet2CenterY ** 2);
    const fillet2Tangent2X = fillet2CenterX - (fillet2CenterX / fillet2ToOriginLength) * filletRadius;
    const fillet2Tangent2Y = fillet2CenterY - (fillet2CenterY / fillet2ToOriginLength) * filletRadius;
    
    const fillet3Tangent2X = fillet3CenterX - line2NormalX * filletRadius;
    const fillet3Tangent2Y = fillet3CenterY - line2NormalY * filletRadius;
    
    const fillet3ToOriginLength = Math.sqrt(fillet3CenterX ** 2 + fillet3CenterY ** 2);
    const fillet3Tangent1X = fillet3CenterX - (fillet3CenterX / fillet3ToOriginLength) * filletRadius;
    const fillet3Tangent1Y = fillet3CenterY - (fillet3CenterY / fillet3ToOriginLength) * filletRadius;
    
    const arcStartAngle = Math.atan2(fillet2Tangent2Y, fillet2Tangent2X);
    const arcEndAngle = Math.atan2(fillet3Tangent1Y, fillet3Tangent1X);
    
    return {
        fillet1: {
            centerX: fillet1CenterX, centerY: fillet1CenterY,
            tangent1X: fillet1Tangent1X, tangent1Y: fillet1Tangent1Y,
            tangent2X: fillet1Tangent2X, tangent2Y: fillet1Tangent2Y
        },
        fillet2: {
            centerX: fillet2CenterX, centerY: fillet2CenterY,
            tangent1X: fillet2Tangent1X, tangent1Y: fillet2Tangent1Y,
            tangent2X: fillet2Tangent2X, tangent2Y: fillet2Tangent2Y
        },
        fillet3: {
            centerX: fillet3CenterX, centerY: fillet3CenterY,
            tangent1X: fillet3Tangent1X, tangent1Y: fillet3Tangent1Y,
            tangent2X: fillet3Tangent2X, tangent2Y: fillet3Tangent2Y
        },
        arcStartAngle, arcEndAngle, outerArcRadius, filletRadius
    };
}

buildShapeWithCircularFillets(holeShape, filletData, sliceAngle) {
    const { fillet1, fillet2, fillet3, arcStartAngle, arcEndAngle, outerArcRadius, filletRadius } = filletData;
    
    // Start at convergence fillet tangent to line 1
    holeShape.moveTo(fillet1.tangent1X, fillet1.tangent1Y);
    
    // Line along line 1 to fillet 2
    holeShape.lineTo(fillet2.tangent1X, fillet2.tangent1Y);
    
    // Fillet 2 arc - FIXED: Remove the +Math.PI correction
    let fillet2StartAngle = Math.atan2(fillet2.tangent1Y - fillet2.centerY, fillet2.tangent1X - fillet2.centerX);
    let fillet2EndAngle = Math.atan2(fillet2.tangent2Y - fillet2.centerY, fillet2.tangent2X - fillet2.centerX);
    
    
    
    holeShape.absarc(fillet2.centerX, fillet2.centerY, filletRadius, fillet2StartAngle, (fillet2EndAngle-Math.PI), false);
    
    // Outer arc
    let adjustedArcStart = arcStartAngle;
    let adjustedArcEnd = arcEndAngle;
    
    // Normalize angles
    while (adjustedArcStart < 0) adjustedArcStart += 2 * Math.PI;
    while (adjustedArcEnd < 0) adjustedArcEnd += 2 * Math.PI;
    while (adjustedArcStart >= 2 * Math.PI) adjustedArcStart -= 2 * Math.PI;
    while (adjustedArcEnd >= 2 * Math.PI) adjustedArcEnd -= 2 * Math.PI;
    
    holeShape.absarc(0, 0, outerArcRadius, adjustedArcStart, adjustedArcEnd, false);
    
    // Fillet 3 arc - FIXED: Remove the -Math.PI correction
    let fillet3StartAngle = Math.atan2(fillet3.tangent1Y - fillet3.centerY, fillet3.tangent1X - fillet3.centerX);
    let fillet3EndAngle = Math.atan2(fillet3.tangent2Y - fillet3.centerY, fillet3.tangent2X - fillet3.centerX);
    
    
    
    holeShape.absarc(fillet3.centerX, fillet3.centerY, filletRadius, fillet3StartAngle+Math.PI, fillet3EndAngle, false);
    
    // Line along line 2 back to convergence fillet
    holeShape.lineTo(fillet1.tangent2X, fillet1.tangent2Y);
    
    // Convergence fillet - always use shorter arc
    let fillet1StartAngle = Math.atan2(fillet1.tangent2Y - fillet1.centerY, fillet1.tangent2X - fillet1.centerX);
    let fillet1EndAngle = Math.atan2(fillet1.tangent1Y - fillet1.centerY, fillet1.tangent1X - fillet1.centerX);
    
    // Calculate shorter arc direction
    let clockwiseAngleDiff = fillet1StartAngle - fillet1EndAngle;
    while (clockwiseAngleDiff <= 0) clockwiseAngleDiff += 2 * Math.PI;
    while (clockwiseAngleDiff > 2 * Math.PI) clockwiseAngleDiff -= 2 * Math.PI;
    
    let counterclockwiseAngleDiff = fillet1EndAngle - fillet1StartAngle;
    while (counterclockwiseAngleDiff <= 0) counterclockwiseAngleDiff += 2 * Math.PI;
    while (counterclockwiseAngleDiff > 2 * Math.PI) counterclockwiseAngleDiff -= 2 * Math.PI;
    
    const useClockwise = clockwiseAngleDiff < counterclockwiseAngleDiff;
    holeShape.absarc(fillet1.centerX, fillet1.centerY, filletRadius, fillet1StartAngle, fillet1EndAngle, useClockwise);
}
            createControlSpheres() {
                const controlRadius = 0.008;
                const controlDistance = this.cylinderRadius + 0.02;
                
                for (let i = 0; i < this.sliceCount; i++) {
                    // Calculate angle for middle of each slice
                    let totalAngle = 0;
                    for (let j = 0; j < i; j++) {
                        totalAngle += this.sliceAngles[j];
                    }
                    totalAngle += this.sliceAngles[i] / 2;
                    
                    const controlX = Math.cos(totalAngle) * controlDistance;
                    const controlY = Math.sin(totalAngle) * controlDistance;
                    
                    const geometry = new THREE.SphereGeometry(controlRadius, 16, 16);
                    const material = new THREE.MeshLambertMaterial({ 
                        color: 0xff6b6b,
                        emissive: 0x331111
                    });
                    
                    const sphere = new THREE.Mesh(geometry, material);
                    sphere.position.set(controlX, controlY, this.cylinderHeight / 2);
                    sphere.userData = { sliceIndex: i };
                    
                    this.controlSpheres.push(sphere);
                    globalScene.add(sphere);
                }
                
              
            }
regenerateSlices(totalCount) {
   
    
    // Calculate slice count based on central hole
    let sliceCount = totalCount;
    if (this.hasCentralHole) {
        sliceCount = totalCount - 1; // Central hole counts as one
       
    }
    
    // Ensure minimum slice count based on central hole status
    const minSlices = this.hasCentralHole ? 2 : 2; // 2 slices minimum in both cases
    if (sliceCount < minSlices) {
        sliceCount = minSlices;
        const adjustedTotal = this.hasCentralHole ? sliceCount + 1 : sliceCount;
        console.warn(`Minimum ${minSlices} slices required, adjusting total count to ${adjustedTotal}`);
        
        // Update the hole count input to reflect the adjustment
        const holeCountInput = document.getElementById('hole-count');
        if (holeCountInput) {
            holeCountInput.value = adjustedTotal;
        }
    }
    
    this.sliceCount = sliceCount;
    this.initializeSliceAngles();
    
    // If we have a central hole, try to auto-adjust inner diameter FIRST
    if (this.hasCentralHole) {
       
        
        // Try current configuration first
        let collapseCheck = this.detectSliceCollapse();
        
        if (collapseCheck.collapsed) {
           
            
            const maxSafeInnerDiameter = this.calculateMaximumInnerDiameter();
            
            
            if (maxSafeInnerDiameter > 0.001) {
                // Auto-adjust inner diameter
                const originalInnerDiameter = this.innerDiameter;
                this.innerDiameter = maxSafeInnerDiameter;
                
                // Update the UI controls
                const innerDiameterSlider = document.getElementById('inner-diameter');
                const innerDiameterInput = document.getElementById('inner-diameter-input');
                if (innerDiameterSlider && innerDiameterInput) {
                    innerDiameterSlider.value = maxSafeInnerDiameter.toFixed(3);
                    innerDiameterInput.value = maxSafeInnerDiameter.toFixed(3);
                }
                
                // Test again with adjusted inner diameter
                collapseCheck = this.detectSliceCollapse();
                
                if (!collapseCheck.collapsed) {
                    // Success with adjusted inner diameter
                    const info = document.createElement('div');
                    info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:10px;border-radius:5px;z-index:1000;font-family:Arial;font-size:14px;max-width:350px;';
                    info.innerHTML = `
                        <strong>Slice count changed to ${sliceCount}</strong><br>
                        Inner diameter adjusted from ${originalInnerDiameter.toFixed(3)}m to ${maxSafeInnerDiameter.toFixed(3)}m<br>
                        <small>Prevents inner corner collapse</small>
                    `;
                    document.body.appendChild(info);
                    setTimeout(() => info.remove(), 4000);
                    
                 
                    
                    this.updateGeometry();
                    this.createSliceUI();
                    return true;
                } 
            } 
        }
    }
    
    // Check if we still have collapse issues (or if no central hole)
    const finalCollapseCheck = this.detectSliceCollapse();
    
    if (finalCollapseCheck.collapsed) {
        console.warn(`Configuration still causes collapse: ${finalCollapseCheck.reason}`);
        
        // Try increasing outer diameter as fallback
        const minDiameter = this.findMinimumDiameterForSliceCount(sliceCount);
       
        if (minDiameter > 0 && minDiameter <= 2.0) { // Reasonable upper limit
            
            this.cylinderRadius = minDiameter / 2;
            
            // Update the diameter control
            const diameterSlider = document.getElementById('cylinder-diameter');
            const diameterInput = document.getElementById('cylinder-diameter-input');
            if (diameterSlider && diameterInput) {
                diameterSlider.value = minDiameter.toFixed(3);
                diameterInput.value = minDiameter.toFixed(3);
            }
            
            // Show user feedback
            const info = document.createElement('div');
            info.style.cssText = 'position:fixed;top:10px;right:10px;background:#4CAF50;color:white;padding:10px;border-radius:5px;z-index:1000;font-family:Arial;font-size:14px;max-width:350px;';
            info.innerHTML = `
                <strong>Slice count changed to ${sliceCount}</strong><br>
                Outer diameter increased to ${minDiameter.toFixed(3)}m<br>
                <small>Prevents geometry collapse</small>
            `;
            document.body.appendChild(info);
            setTimeout(() => info.remove(), 4000);
            
           
        } else {
            // Revert to previous configuration
            console.error('Cannot create valid configuration, reverting');
            
            const warning = document.createElement('div');
            warning.style.cssText = 'position:fixed;top:10px;right:10px;background:#ff4444;color:white;padding:10px;border-radius:5px;z-index:1000;font-family:Arial;font-size:14px;max-width:300px;';
            warning.innerHTML = `
                <strong>Cannot create ${sliceCount} slices</strong><br>
                Current parameters make this impossible<br>
                <small>Try reducing septum thickness or corner radius</small>
            `;
            document.body.appendChild(warning);
            setTimeout(() => warning.remove(), 4000);
            
            return false;
        }
    }
    
    this.updateGeometry();
    this.createSliceUI();
    return true;
}

findMinimumDiameterForSliceCount(sliceCount) {
    const originalSliceCount = this.sliceCount;
    const originalAngles = [...this.sliceAngles];
    const originalDiameter = this.cylinderRadius * 2;
    const originalInnerDiameter = this.innerDiameter;
    
    
    
    // Temporarily set the new slice count and equal angles
    this.sliceCount = sliceCount;
    const equalAngle = (Math.PI * 2) / sliceCount;
    this.sliceAngles = new Array(sliceCount).fill(equalAngle);
    
    // Start with a reasonable minimum based on geometry requirements
    let testDiameter = Math.max(0.05, originalDiameter); // Start with at least 5cm or current diameter
    
    // If we have a central hole, factor that into minimum diameter
    if (this.hasCentralHole) {
        const centralHoleSpace = this.innerDiameter + (this.septumThickness * 4); // Inner + space for septums
        testDiameter = Math.max(testDiameter, centralHoleSpace);
        
    }
    
    let stepSize = 0.005; // 5mm steps for faster search
    let maxIterations = 400; // Increased iterations
    let iterations = 0;
    let foundValidDiameter = false;
    
   
    
    // Search upward until we find a valid diameter
    while (iterations < maxIterations && testDiameter <= 2.0) {
        this.cylinderRadius = testDiameter / 2;
        const collapseCheck = this.detectSliceCollapse();
        
        
        
        if (!collapseCheck.collapsed) {
            foundValidDiameter = true;
            
            break;
        }
        
        testDiameter += stepSize;
        iterations++;
    }
    
    if (!foundValidDiameter) {
        console.error(`Could not find valid diameter after ${iterations} iterations, max tested: ${testDiameter.toFixed(3)}m`);
        
        // Restore original state
        this.sliceCount = originalSliceCount;
        this.sliceAngles = [...originalAngles];
        this.cylinderRadius = originalDiameter / 2;
        this.innerDiameter = originalInnerDiameter;
        
        return 0; // Signal failure
    }
    
    // Now do a more precise search to find the actual minimum
    let minValidDiameter = testDiameter;
    let maxInvalidDiameter = testDiameter - stepSize;
    
    // Binary search for precision (only if we found a valid diameter)
    for (let i = 0; i < 10; i++) {
        const midDiameter = (minValidDiameter + maxInvalidDiameter) / 2;
        this.cylinderRadius = midDiameter / 2;
        
        const collapseCheck = this.detectSliceCollapse();
        if (collapseCheck.collapsed) {
            maxInvalidDiameter = midDiameter;
        } else {
            minValidDiameter = midDiameter;
        }
        
        // Stop if we've converged enough
        if (Math.abs(minValidDiameter - maxInvalidDiameter) < 0.001) {
            break;
        }
    }
    
    // Add safety margin
    const finalDiameter = minValidDiameter + 0.005; // Add 5mm safety margin
    
   
    
    // Restore original state
    this.sliceCount = originalSliceCount;
    this.sliceAngles = [...originalAngles];
    this.cylinderRadius = originalDiameter / 2;
    this.innerDiameter = originalInnerDiameter;
    
    return finalDiameter;
}
            createSliceUI() {
     const container = document.getElementById('pie-slice-controls');
    container.innerHTML = `
        <h3>Pie Slice Controls</h3>
        
        <div class="input-group">
            <label>Septum:</label>
            <input type="range" class="range-slider" id="septum-thickness" min="0.005" max="0.050" value="${this.septumThickness.toFixed(3)}" step="0.001">
            <input type="number" id="septum-thickness-input" min="0.005" max="0.050" value="${this.septumThickness.toFixed(3)}" step="0.001">
        </div>
        
       
        
        <div id="slice-container" class="slice-controls"></div>
    `;
    
    // Setup septum thickness controls
    this.setupSeptumControls();
    
    
    // Create slice angle controls
    const sliceContainer = document.getElementById('slice-container');
    
    for (let i = 0; i < this.sliceCount; i++) {
    const div = document.createElement('div');
    div.className = 'slice-control-group';
    div.innerHTML = `
        <label class="lumen-label">Slice ${i + 1}:</label>
        <div class="input-group">
            <input type="range" class="range-slider" id="slice-${i}" min="45" max="315" value="${Math.round(this.sliceAngles[i] * 180 / Math.PI)}" step="1">
            <input type="number" id="slice-${i}-num" min="45" max="315" value="${Math.round(this.sliceAngles[i] * 180 / Math.PI)}" step="1">
            <span>°</span>
        </div>
    `;
    sliceContainer.appendChild(div);
        
        // Add event listeners for slice controls
        const slider = document.getElementById(`slice-${i}`);
        const numberInput = document.getElementById(`slice-${i}-num`);
        slider.addEventListener('mousedown', startInteraction);
      slider.addEventListener('mouseup', endInteraction);
    slider.addEventListener('change', endInteraction);
        slider.addEventListener('input', (e) => {
           startInteraction();
           autoExitPrintMode();
            const degrees = parseInt(e.target.value);
            numberInput.value = degrees;
            this.updateSliceAngle(i, degrees);
        });
        
        numberInput.addEventListener('input', (e) => {
           autoExitPrintMode();
            const degrees = parseInt(e.target.value);
            slider.value = degrees;
            this.updateSliceAngle(i, degrees);
        });
    }
}
            
      updateSliceAngle(sliceIndex, degrees) {
    
    
    const newAngleRadians = degrees * Math.PI / 180;
    const originalAngle = this.sliceAngles[sliceIndex];
    const originalAngles = [...this.sliceAngles];
    const angleDiff = newAngleRadians - originalAngle;
    
    const minSliceAngle = 45 * Math.PI / 180; // 45 degrees minimum
    
    // Basic bounds checking
    if (newAngleRadians < minSliceAngle) {
      
        const slider = document.getElementById(`slice-${sliceIndex}`);
        const numberInput = document.getElementById(`slice-${sliceIndex}-num`);
        if (slider) slider.value = 45;
        if (numberInput) numberInput.value = 45;
        return;
    }
    
    // Determine which slice to affect based on slice position (same logic as 3D controls)
    let affectedSliceIndex;
    let actualAngleDiff = angleDiff;
    
    if (sliceIndex === this.sliceCount - 1) {
        // For last slice, affect the previous slice and reverse the angle diff
        affectedSliceIndex = sliceIndex - 1;
        actualAngleDiff = -angleDiff;
    } else {
        // Normal case - affect the next slice
        affectedSliceIndex = sliceIndex + 1;
    }
    
    const currentSliceAngle = this.sliceAngles[sliceIndex];
    const affectedSliceAngle = this.sliceAngles[affectedSliceIndex];
    
    // Calculate maximum changes allowed (same logic as 3D controls)
    const maxReduceCurrent = currentSliceAngle - minSliceAngle;
    const maxReduceAffected = affectedSliceAngle - minSliceAngle;
    
    const maxPositiveChange = Math.max(0, maxReduceAffected);
    const maxNegativeChange = -Math.max(0, maxReduceCurrent);
    
    // For last slice, also check 360° boundary (same as 3D controls)
    if (sliceIndex === this.sliceCount - 1) {
        // Calculate where the end of the last slice would be
        let totalAngle = 0;
        for (let i = 0; i < this.sliceCount - 1; i++) {
            totalAngle += this.sliceAngles[i];
        }
        const potentialNewLastSliceAngle = currentSliceAngle + angleDiff;
        const endAngle = totalAngle + potentialNewLastSliceAngle;
        
        // If would exceed 360°, limit the positive change
        if (endAngle > Math.PI * 2) {
            const excess = endAngle - (Math.PI * 2);
            const adjustedMaxPositive = Math.max(0, maxPositiveChange - excess);
            actualAngleDiff = Math.max(maxNegativeChange, Math.min(adjustedMaxPositive, actualAngleDiff));
        } else {
            actualAngleDiff = Math.max(maxNegativeChange, Math.min(maxPositiveChange, actualAngleDiff));
        }
    } else {
        actualAngleDiff = Math.max(maxNegativeChange, Math.min(maxPositiveChange, actualAngleDiff));
    }
    
    // Apply the constrained change
    if (Math.abs(actualAngleDiff) > 0.01) {
        // Apply the change (same as 3D controls)
        this.sliceAngles[sliceIndex] += actualAngleDiff;
        this.sliceAngles[affectedSliceIndex] -= actualAngleDiff;
        
        this.sliceAngles[sliceIndex] = Math.max(minSliceAngle, this.sliceAngles[sliceIndex]);
        this.sliceAngles[affectedSliceIndex] = Math.max(minSliceAngle, this.sliceAngles[affectedSliceIndex]);
        
        // Check for collapse after change (same as 3D controls)
        const collapseCheck = this.detectSliceCollapse();
        
        if (collapseCheck.collapsed) {
            // Revert to original angles
            for (let i = 0; i < this.sliceCount; i++) {
                this.sliceAngles[i] = originalAngles[i];
            }
            
            this.updateAllSliceControls();
            console.warn(`Change limited: ${collapseCheck.reason}`);
            
            // Show user feedback
            this.showCollapseWarning(collapseCheck.reason);
            return;
        }
        
        // Update UI controls to reflect actual changes
        this.updateAllSliceControls();
    } else {
        // Change was too small or constrained to zero
        // Revert UI to current valid value
        const actualDegrees = Math.round(this.sliceAngles[sliceIndex] * 180 / Math.PI);
        const slider = document.getElementById(`slice-${sliceIndex}`);
        const numberInput = document.getElementById(`slice-${sliceIndex}-num`);
        if (slider) slider.value = actualDegrees;
        if (numberInput) numberInput.value = actualDegrees;
        
       
    }
    
    this.updateGeometry();
}
            
          
            
            updateAllSliceControls() {
                for (let i = 0; i < this.sliceCount; i++) {
                    const degrees = Math.round(this.sliceAngles[i] * 180 / Math.PI);
                    const slider = document.getElementById(`slice-${i}`);
                    const numberInput = document.getElementById(`slice-${i}-num`);
                    
                    if (slider) slider.value = degrees;
                    if (numberInput) numberInput.value = degrees;
                }
            }
            
            updateGeometry() {
              
                
                if (this.cylinderMesh) {
                    globalScene.remove(this.cylinderMesh);
                    this.cylinderMesh.geometry.dispose();
                    this.cylinderMesh.material.dispose();
                }
                
                if (this.controlSpheres.length > 0) {
                    this.controlSpheres.forEach(sphere => {
                        globalScene.remove(sphere);
                        sphere.geometry.dispose();
                        sphere.material.dispose();
                    });
                    this.controlSpheres = [];
                }
                
                this.createPieSliceCylinder();
                this.createControlSpheres();
            }
            
            cleanup() {
   
    
    // Remove event listeners
    if (globalRenderer && globalRenderer.domElement) {
        // Note: You might want to store references to the bound functions to properly remove them
        // For now, this is a basic cleanup
        globalRenderer.domElement.removeEventListener('mousedown', this.onMouseDown);
        globalRenderer.domElement.removeEventListener('mousemove', this.onMouseMove);
        globalRenderer.domElement.removeEventListener('mouseup', this.onMouseUp);
    }
    
    if (this.cylinderMesh) {
        globalScene.remove(this.cylinderMesh);
        this.cylinderMesh.geometry.dispose();
        this.cylinderMesh.material.dispose();
        this.cylinderMesh = null;
    }
    
    this.controlSpheres.forEach(sphere => {
        globalScene.remove(sphere);
        sphere.geometry.dispose();
        sphere.material.dispose();
    });
    this.controlSpheres = [];
    
   
}
          // Print Mode Methods for Pie Slice
  enterPrintMode() {
    
    
    // Hide interactive controls
    this.controlSpheres.forEach(sphere => sphere.visible = false);
    
    // Create print mode elements
    this.createPieSlicePrintElements();
  if (this.cylinderMesh) {
    this.cylinderMesh.visible = false;
}
}

exitPrintMode() {
    
    
    // Show interactive controls
    this.controlSpheres.forEach(sphere => sphere.visible = true);
    
    // Remove print mode elements
    this.clearPieSlicePrintElements();
  if (this.cylinderMesh) {
    this.cylinderMesh.visible = true;
}
  if (!isPerspectiveView) {
    switchCamera();
}
}

createPieSlicePrintElements() {
    const z = this.cylinderHeight / 2 + 0.002;
    const outerRadius = this.cylinderRadius;
    
    // Create outer cylinder outline
    this.createCircleOutline(0, 0, outerRadius, z);
    
    // Create central hole outline if present
    if (this.hasCentralHole) {
        const innerRadius = this.innerDiameter / 2;
        this.createCircleOutline(0, 0, innerRadius, z);
    }
    
    // Create pie slice hole outlines using the same logic as geometry creation
    this.createPieSliceOutlines();
    
    // Create slice dimension lines and labels
    this.createSliceDimensions();
    
    // Create title label
    this.createTitleLabel();
}
          createPieSliceOutlines() {
    const z = this.cylinderHeight / 2 + 0.001;
    const effectiveInnerRadius = this.hasCentralHole ? 
        (this.innerDiameter / 2 + this.septumThickness) : 
        this.septumThickness;
    const effectiveOuterRadius = this.cylinderRadius - this.septumThickness;
    
    // Calculate septum angles for inner and outer radii
    const septumAngleAtInner = this.hasCentralHole ? 
        this.septumThickness / (this.innerDiameter / 2 + this.septumThickness) : 
        this.septumThickness / this.septumThickness;
    const septumAngleAtOuter = this.septumThickness / effectiveOuterRadius;
    
    let currentAngle = 0;
    
    for (let i = 0; i < this.sliceCount; i++) {
        const sliceAngle = this.sliceAngles[i];
        
        if (this.hasCentralHole) {
            // 4-sided pie slice outline
            const septumBoundaries = this.calculateDualAngleSeptumBoundaries(
                currentAngle, 
                currentAngle + sliceAngle, 
                effectiveInnerRadius, 
                effectiveOuterRadius, 
                septumAngleAtInner,
                septumAngleAtOuter
            );
            
            this.createFourSidedPieSliceOutline(septumBoundaries, effectiveInnerRadius, effectiveOuterRadius, z);
            
        } else {
            // 3-sided pie slice outline
            const septumAngleToUse = septumAngleAtOuter;
            const startAngle = currentAngle + septumAngleToUse / 2;
            const endAngle = startAngle + sliceAngle - septumAngleToUse;
            
            this.createThreeSidedPieSliceOutline(startAngle, endAngle, effectiveOuterRadius, z, sliceAngle);
        }
        
        currentAngle += sliceAngle;
    }
}
     createFourSidedPieSliceOutline(boundaries, innerRadius, outerRadius, z) {
    const points = [];
    
    // Calculate the corner points using the dual-angle boundaries
    const startInnerX = Math.cos(boundaries.innerStartAngle) * innerRadius;
    const startInnerY = Math.sin(boundaries.innerStartAngle) * innerRadius;
    const endInnerX = Math.cos(boundaries.innerEndAngle) * innerRadius;
    const endInnerY = Math.sin(boundaries.innerEndAngle) * innerRadius;
    const startOuterX = Math.cos(boundaries.outerStartAngle) * outerRadius;
    const startOuterY = Math.sin(boundaries.outerStartAngle) * outerRadius;
    const endOuterX = Math.cos(boundaries.outerEndAngle) * outerRadius;
    const endOuterY = Math.sin(boundaries.outerEndAngle) * outerRadius;
    
    if (this.cornerRadius > 0) {
        // Create rounded outline matching the geometry exactly
        this.createRoundedFourSidedOutline(points, 
            startInnerX, startInnerY, startOuterX, startOuterY,
            endOuterX, endOuterY, endInnerX, endInnerY,
            boundaries);
    } else {
        // Sharp corners - create simple 4-sided outline
        points.push(new THREE.Vector3(startInnerX, startInnerY, z));
        points.push(new THREE.Vector3(startOuterX, startOuterY, z));
        
        // Outer arc points
        const outerArcSegments = 16;
        for (let i = 1; i <= outerArcSegments; i++) {
            const angle = boundaries.outerStartAngle + (boundaries.outerEndAngle - boundaries.outerStartAngle) * (i / outerArcSegments);
            points.push(new THREE.Vector3(
                Math.cos(angle) * outerRadius,
                Math.sin(angle) * outerRadius,
                z
            ));
        }
        
        points.push(new THREE.Vector3(endInnerX, endInnerY, z));
        
        // Inner arc points (reverse direction)
        const innerArcSegments = 16;
        for (let i = 1; i <= innerArcSegments; i++) {
            const angle = boundaries.innerEndAngle + (boundaries.innerStartAngle - boundaries.innerEndAngle) * (i / innerArcSegments);
            points.push(new THREE.Vector3(
                Math.cos(angle) * innerRadius,
                Math.sin(angle) * innerRadius,
                z
            ));
        }
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
        color: 0x000000, 
        linewidth: 2 
    });
    const outline = new THREE.Line(geometry, material);
    
    globalScene.add(outline);
    this.printModeElements.push(outline);
}
         createThreeSidedPieSliceOutline(startAngle, endAngle, outerArcRadius, z, sliceAngle) {
    const convergencePoint = this.calculateUniformConvergencePoint(startAngle, endAngle, outerArcRadius, this.septumThickness);
    const convergenceX = convergencePoint.x;
    const convergenceY = convergencePoint.y;
    
    // Calculate key points for the pie slice
    const startOuterX = Math.cos(startAngle) * outerArcRadius;
    const startOuterY = Math.sin(startAngle) * outerArcRadius;
    const endOuterX = Math.cos(endAngle) * outerArcRadius;
    const endOuterY = Math.sin(endAngle) * outerArcRadius;
    
    const points = [];
    
    if (this.cornerRadius > 0) {
        // Use the same fillet calculation as the geometry
        const filletData = this.calculateCircularFillets(
            convergenceX, convergenceY, 
            startOuterX, startOuterY, 
            endOuterX, endOuterY, 
            outerArcRadius, this.cornerRadius, 
            startAngle, endAngle
        );
        
        this.buildFilletedOutlinePoints(points, filletData, sliceAngle, z);
    } else {
        // No rounding - original sharp corners
        points.push(new THREE.Vector3(convergenceX, convergenceY, z));
        points.push(new THREE.Vector3(startOuterX, startOuterY, z));
        
        // Arc points
        const arcSegments = 16;
        for (let i = 1; i <= arcSegments; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / arcSegments);
            const x = Math.cos(angle) * outerArcRadius;
            const y = Math.sin(angle) * outerArcRadius;
            points.push(new THREE.Vector3(x, y, z));
        }
        
        points.push(new THREE.Vector3(convergenceX, convergenceY, z));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
        color: 0x000000, 
        linewidth: 2 
    });
    const outline = new THREE.Line(geometry, material);
    
    globalScene.add(outline);
    this.printModeElements.push(outline);
}
          createRoundedFourSidedOutline(points, startInnerX, startInnerY, startOuterX, startOuterY, endOuterX, endOuterY, endInnerX, endInnerY, boundaries) {
    // Simplified rounded outline for print mode
    // Add points for the rounded shape (basic approximation)
    const z = this.cylinderHeight / 2 + 0.001;
    
    points.push(new THREE.Vector3(startInnerX, startInnerY, z));
    points.push(new THREE.Vector3(startOuterX, startOuterY, z));
    
    // Outer arc
    const outerArcSegments = 16;
    for (let i = 1; i <= outerArcSegments; i++) {
        const angle = boundaries.outerStartAngle + (boundaries.outerEndAngle - boundaries.outerStartAngle) * (i / outerArcSegments);
        points.push(new THREE.Vector3(
            Math.cos(angle) * boundaries.outerRadius,
            Math.sin(angle) * boundaries.outerRadius,
            z
        ));
    }
    
    points.push(new THREE.Vector3(endInnerX, endInnerY, z));
    
    // Inner arc
    const innerArcSegments = 16;
    for (let i = 1; i <= innerArcSegments; i++) {
        const angle = boundaries.innerEndAngle + (boundaries.innerStartAngle - boundaries.innerEndAngle) * (i / innerArcSegments);
        points.push(new THREE.Vector3(
            Math.cos(angle) * boundaries.innerRadius,
            Math.sin(angle) * boundaries.innerRadius,
            z
        ));
    }
}

buildFilletedOutlinePoints(points, filletData, sliceAngle, z) {
    const { fillet1, fillet2, fillet3, arcStartAngle, arcEndAngle, outerArcRadius, filletRadius } = filletData;
    
    // Start at convergence fillet tangent to line 1
    points.push(new THREE.Vector3(fillet1.tangent1X, fillet1.tangent1Y, z));
    
    // Line along line 1 to fillet 2
    points.push(new THREE.Vector3(fillet2.tangent1X, fillet2.tangent1Y, z));
    
    // Fillet 2 arc - use the exact same logic as buildShapeWithCircularFillets
    let fillet2StartAngle = Math.atan2(fillet2.tangent1Y - fillet2.centerY, fillet2.tangent1X - fillet2.centerX);
    let fillet2EndAngle = Math.atan2(fillet2.tangent2Y - fillet2.centerY, fillet2.tangent2X - fillet2.centerX);
    
    // Apply the correction from the original code
    fillet2EndAngle += Math.PI;
    
    // Ensure we take the shorter arc
    let fillet2ArcLength = fillet2EndAngle - fillet2StartAngle;
    if (fillet2ArcLength > Math.PI) {
        fillet2EndAngle -= 2 * Math.PI;
    } else if (fillet2ArcLength < -Math.PI) {
        fillet2EndAngle += 2 * Math.PI;
    }
    
    this.addArcPoints(points, fillet2.centerX, fillet2.centerY, filletRadius, fillet2StartAngle, fillet2EndAngle, 8, z);
    
    // Outer arc
    let adjustedArcStart = arcStartAngle;
    let adjustedArcEnd = arcEndAngle;
    
    // Normalize angles to [0, 2π]
    while (adjustedArcStart < 0) adjustedArcStart += 2 * Math.PI;
    while (adjustedArcEnd < 0) adjustedArcEnd += 2 * Math.PI;
    while (adjustedArcStart >= 2 * Math.PI) adjustedArcStart -= 2 * Math.PI;
    while (adjustedArcEnd >= 2 * Math.PI) adjustedArcEnd -= 2 * Math.PI;
    
    // Create outer arc points
    const arcSegments = 16;
    for (let i = 1; i <= arcSegments; i++) {
        const angle = adjustedArcStart + (adjustedArcEnd - adjustedArcStart) * (i / arcSegments);
        points.push(new THREE.Vector3(
            Math.cos(angle) * outerArcRadius,
            Math.sin(angle) * outerArcRadius,
            z
        ));
    }
    
    // Fillet 3 arc - use the exact same logic as buildShapeWithCircularFillets
    let fillet3StartAngle = Math.atan2(fillet3.tangent1Y - fillet3.centerY, fillet3.tangent1X - fillet3.centerX);
    let fillet3EndAngle = Math.atan2(fillet3.tangent2Y - fillet3.centerY, fillet3.tangent2X - fillet3.centerX);
    
    // Apply the correction from the original code
    fillet3StartAngle -= Math.PI;
    
    // Ensure we take the shorter arc
    let fillet3ArcLength = fillet3EndAngle - fillet3StartAngle;
    if (fillet3ArcLength > Math.PI) {
        fillet3EndAngle -= 2 * Math.PI;
    } else if (fillet3ArcLength < -Math.PI) {
        fillet3EndAngle += 2 * Math.PI;
    }
    
    this.addArcPoints(points, fillet3.centerX, fillet3.centerY, filletRadius, fillet3StartAngle, fillet3EndAngle, 8, z);
    
    // Line along line 2 back to convergence fillet
    points.push(new THREE.Vector3(fillet1.tangent2X, fillet1.tangent2Y, z));
    
    // Convergence fillet - always use shorter arc (same logic as original)
    let fillet1StartAngle = Math.atan2(fillet1.tangent2Y - fillet1.centerY, fillet1.tangent2X - fillet1.centerX);
    let fillet1EndAngle = Math.atan2(fillet1.tangent1Y - fillet1.centerY, fillet1.tangent1X - fillet1.centerX);
    
    // Calculate shorter arc direction
    let clockwiseAngleDiff = fillet1StartAngle - fillet1EndAngle;
    while (clockwiseAngleDiff <= 0) clockwiseAngleDiff += 2 * Math.PI;
    while (clockwiseAngleDiff > 2 * Math.PI) clockwiseAngleDiff -= 2 * Math.PI;
    
    let counterclockwiseAngleDiff = fillet1EndAngle - fillet1StartAngle;
    while (counterclockwiseAngleDiff <= 0) counterclockwiseAngleDiff += 2 * Math.PI;
    while (counterclockwiseAngleDiff > 2 * Math.PI) counterclockwiseAngleDiff -= 2 * Math.PI;
    
    const useClockwise = clockwiseAngleDiff < counterclockwiseAngleDiff;
    this.addArcPointsWithDirection(points, fillet1.centerX, fillet1.centerY, filletRadius, fillet1StartAngle, fillet1EndAngle, 8, useClockwise, z);
}
          addArcPoints(points, centerX, centerY, radius, startAngle, endAngle, segments, z) {
    for (let i = 1; i <= segments; i++) {
        const angle = startAngle + (endAngle - startAngle) * (i / segments);
        points.push(new THREE.Vector3(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            z
        ));
    }
}

addArcPointsWithDirection(points, centerX, centerY, radius, startAngle, endAngle, segments, clockwise, z) {
    // Calculate the actual angular difference we want to traverse
    let angleDiff = endAngle - startAngle;
    
    if (clockwise) {
        // For clockwise, we want the shorter path in the clockwise direction
        while (angleDiff > 0) angleDiff -= 2 * Math.PI;
        while (angleDiff <= -2 * Math.PI) angleDiff += 2 * Math.PI;
        
        // If the clockwise path is still longer than π, take the shorter counterclockwise path instead
        if (Math.abs(angleDiff) > Math.PI) {
            angleDiff = 2 * Math.PI + angleDiff; // This makes it positive (counterclockwise)
        }
    } else {
        // For counterclockwise, we want the shorter path in the counterclockwise direction
        while (angleDiff < 0) angleDiff += 2 * Math.PI;
        while (angleDiff >= 2 * Math.PI) angleDiff -= 2 * Math.PI;
        
        // If the counterclockwise path is longer than π, take the shorter clockwise path instead
        if (angleDiff > Math.PI) {
            angleDiff = angleDiff - 2 * Math.PI; // This makes it negative (clockwise)
        }
    }
    
    // Generate the arc points
    for (let i = 1; i <= segments; i++) {
        const angle = startAngle + angleDiff * (i / segments);
        points.push(new THREE.Vector3(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            z
        ));
    }
}
createRoundedFourSidedOutline(points, startInnerX, startInnerY, startOuterX, startOuterY, endOuterX, endOuterY, endInnerX, endInnerY, boundaries) {
    const z = this.cylinderHeight / 2 + 0.001;
    
    // Use the EXACT same corner radius calculation as the geometry
    const radialLine1Length = Math.sqrt((startOuterX - startInnerX)**2 + (startOuterY - startInnerY)**2);
    const radialLine2Length = Math.sqrt((endOuterX - endInnerX)**2 + (endOuterY - endInnerY)**2);
    const outerArcLength = Math.abs(boundaries.outerEndAngle - boundaries.outerStartAngle) * boundaries.outerRadius;
    const innerArcLength = Math.abs(boundaries.innerEndAngle - boundaries.innerStartAngle) * boundaries.innerRadius;
    
    // Use the EXACT same limits as buildDualAngleRoundedShape
    const maxCornerRadius = Math.min(
        this.cornerRadius,
        radialLine1Length * 0.9,
        radialLine2Length * 0.9,
        outerArcLength * 0.8,
        innerArcLength * 0.8
    );
    
    // Calculate fillet points (same as geometry)
    const filletDistance = maxCornerRadius;
    
    const startInnerFilletX = startInnerX + (startOuterX - startInnerX) / radialLine1Length * filletDistance;
    const startInnerFilletY = startInnerY + (startOuterY - startInnerY) / radialLine1Length * filletDistance;
    
    const startOuterFilletX = startOuterX - (startOuterX - startInnerX) / radialLine1Length * filletDistance;
    const startOuterFilletY = startOuterY - (startOuterY - startInnerY) / radialLine1Length * filletDistance;
    
    const endOuterFilletX = endOuterX - (endOuterX - endInnerX) / radialLine2Length * filletDistance;
    const endOuterFilletY = endOuterY - (endOuterY - endInnerY) / radialLine2Length * filletDistance;
    
    const endInnerFilletX = endInnerX + (endOuterX - endInnerX) / radialLine2Length * filletDistance;
    const endInnerFilletY = endInnerY + (endOuterY - endInnerY) / radialLine2Length * filletDistance;
    
    // Arc adjustments (same calculation as geometry)
    const outerFilletAngle = maxCornerRadius / boundaries.outerRadius;
    const innerFilletAngle = maxCornerRadius / boundaries.innerRadius;
    
    const outerArcStart = boundaries.outerStartAngle + outerFilletAngle;
    const outerArcEnd = boundaries.outerEndAngle - outerFilletAngle;
    const innerArcStart = boundaries.innerEndAngle - innerFilletAngle;
    const innerArcEnd = boundaries.innerStartAngle + innerFilletAngle;
    
    // Start at inner arc end (same as geometry)
    const innerArcEndX = Math.cos(innerArcEnd) * boundaries.innerRadius;
    const innerArcEndY = Math.sin(innerArcEnd) * boundaries.innerRadius;
    points.push(new THREE.Vector3(innerArcEndX, innerArcEndY, z));
    
    // Inner arc (same path as geometry)
    const innerArcSegments = 16;
    for (let i = 1; i <= innerArcSegments; i++) {
        const angle = innerArcEnd + (innerArcStart - innerArcEnd) * (i / innerArcSegments);
        points.push(new THREE.Vector3(
            Math.cos(angle) * boundaries.innerRadius,
            Math.sin(angle) * boundaries.innerRadius,
            z
        ));
    }
    
    // Corner 1: end inner - use quadratic curve (same as geometry)
    this.addQuadraticCurvePoints(points, 
        Math.cos(innerArcStart) * boundaries.innerRadius,
        Math.sin(innerArcStart) * boundaries.innerRadius,
        endInnerX, endInnerY, 
        endInnerFilletX, endInnerFilletY, 8, z);
    
    // Line to outer (same as geometry)
    points.push(new THREE.Vector3(endOuterFilletX, endOuterFilletY, z));
    
    // Corner 2: end outer (same as geometry)
    const outerArcEndX = Math.cos(outerArcEnd) * boundaries.outerRadius;
    const outerArcEndY = Math.sin(outerArcEnd) * boundaries.outerRadius;
    this.addQuadraticCurvePoints(points, endOuterFilletX, endOuterFilletY, endOuterX, endOuterY, outerArcEndX, outerArcEndY, 8, z);
    
    // Outer arc (same as geometry)
    const outerArcSegments = 16;
    for (let i = 1; i <= outerArcSegments; i++) {
        const angle = outerArcEnd + (outerArcStart - outerArcEnd) * (i / outerArcSegments);
        points.push(new THREE.Vector3(
            Math.cos(angle) * boundaries.outerRadius,
            Math.sin(angle) * boundaries.outerRadius,
            z
        ));
    }
    
    // Corner 3: start outer (same as geometry)
    const outerArcStartX = Math.cos(outerArcStart) * boundaries.outerRadius;
    const outerArcStartY = Math.sin(outerArcStart) * boundaries.outerRadius;
    this.addQuadraticCurvePoints(points, outerArcStartX, outerArcStartY, startOuterX, startOuterY, startOuterFilletX, startOuterFilletY, 8, z);
    
    // Line to inner (same as geometry)
    points.push(new THREE.Vector3(startInnerFilletX, startInnerFilletY, z));
    
    // Corner 4: start inner (same as geometry)
    this.addQuadraticCurvePoints(points, startInnerFilletX, startInnerFilletY, startInnerX, startInnerY, innerArcEndX, innerArcEndY, 8, z);
}
          addQuadraticCurvePoints(points, startX, startY, controlX, controlY, endX, endY, segments, z) {
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
        const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
        points.push(new THREE.Vector3(x, y, z));
    }
}
createCircleOutline(centerX, centerY, radius, z) {
    const points = [];
    const segments = 64;
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            z
        ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const circle = new THREE.Line(geometry, material);
    
    globalScene.add(circle);
    this.printModeElements.push(circle);
}

createSliceDimensions() {
    const z = this.cylinderHeight / 2 + 0.002;
    const dimensionRadius = this.cylinderRadius + 0.04;
    
    let currentAngle = 0;
    
    for (let i = 0; i < this.sliceCount; i++) {
        const sliceAngle = this.sliceAngles[i];
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        const midAngle = (startAngle + endAngle) / 2;
        
        // Create radial lines
        this.createRadialLine(startAngle, this.cylinderRadius, dimensionRadius, z);
        this.createRadialLine(endAngle, this.cylinderRadius, dimensionRadius, z);
        
        // Create arc dimension
        this.createArcDimension(startAngle, endAngle, dimensionRadius, z);
        
        // Create angle label
        this.createAngleLabel(midAngle, dimensionRadius + 0.02, z, i, sliceAngle);
        
        currentAngle += sliceAngle;
    }
    
    // Create parameter labels
    this.createParameterLabels();
}

createRadialLine(angle, startRadius, endRadius, z) {
    const startX = Math.cos(angle) * startRadius;
    const startY = Math.sin(angle) * startRadius;
    const endX = Math.cos(angle) * endRadius;
    const endY = Math.sin(angle) * endRadius;
    
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(startX, startY, z),
        new THREE.Vector3(endX, endY, z)
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
    const line = new THREE.Line(geometry, material);
    
    globalScene.add(line);
    this.dimensionLines.push(line);
}

createArcDimension(startAngle, endAngle, radius, z) {
    const points = [];
    const segments = 16;
    
    for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (endAngle - startAngle) * (i / segments);
        points.push(new THREE.Vector3(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            z
        ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const arc = new THREE.Line(geometry, material);
    
    globalScene.add(arc);
    this.dimensionLines.push(arc);
}

createAngleLabel(angle, radius, z, sliceIndex, sliceAngleRad) {
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'angle-label';
    labelDiv.style.cssText = `
        color: black; 
        font-size: 12px; 
        font-weight: bold;
        background: rgba(255,255,255,0.9); 
        padding: 2px 4px; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        text-align: center;
    `;
    
    const degrees = Math.round(sliceAngleRad * 180 / Math.PI);
    labelDiv.textContent = `${degrees}°`;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(x, y, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}

createParameterLabels() {
    const z = this.cylinderHeight / 2 + 0.002;
    const labelX = -this.cylinderRadius * 1.3;
    const labelY = this.cylinderRadius * 0.8;
    
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = `
        color: black; 
        font-size: 11px; 
        background: rgba(255,255,255,0.9); 
        padding: 6px; 
        border: 1px solid black; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        line-height: 1.3;
    `;
    
    const outerDiameter = (this.cylinderRadius * 2).toFixed(3);
    const septumThickness = this.septumThickness.toFixed(3);
    const cornerRadius = this.cornerRadius.toFixed(3);
    
    let content = `
        <div><strong>Parameters:</strong></div>
        <div>Outer ⌀: ${outerDiameter}m</div>
        <div>Septum: ${septumThickness}m</div>
        <div>Corner R: ${cornerRadius}m</div>
        <div>Slices: ${this.sliceCount}</div>
    `;
    
    if (this.hasCentralHole) {
        const innerDiameter = this.innerDiameter.toFixed(3);
        content += `<div>Inner ⌀: ${innerDiameter}m</div>`;
    }
    
    labelDiv.innerHTML = content;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(labelX, labelY, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}

createTitleLabel() {
    const z = this.cylinderHeight / 2 + 0.002;
    const titleX = this.cylinderRadius * 1.3;
    const titleY = this.cylinderRadius * 0.8;
    
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
        color: black; 
        font-size: 14px; 
        font-weight: bold;
        background: rgba(255,255,255,0.9); 
        padding: 8px; 
        border: 2px solid black; 
        border-radius: 5px;
        font-family: Arial, sans-serif;
        text-align: center;
    `;
    
    const sliceType = this.hasCentralHole ? '4-sided' : '3-sided';
    titleDiv.innerHTML = `
        <div>Pie Slice Cylinder</div>
        <div style="font-size: 12px; margin-top: 4px;">${sliceType} slices</div>
    `;
    
    const css2dLabel = new CSS2DObject(titleDiv);
    css2dLabel.position.set(titleX, titleY, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}

clearPieSlicePrintElements() {
    // Remove line elements
    this.printModeElements.forEach(element => {
        globalScene.remove(element);
        if (element.geometry) element.geometry.dispose();
        if (element.material) element.material.dispose();
    });
    this.printModeElements = [];
    
    // Remove dimension lines
    this.dimensionLines.forEach(line => {
        globalScene.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
    });
    this.dimensionLines = [];
    
    // Remove CSS2D labels
    this.dimensionLabels.forEach(label => {
        globalScene.remove(label);
        if (label.element && label.element.parentNode) {
            label.element.parentNode.removeChild(label.element);
        }
    });
    this.dimensionLabels = [];
}
        }
// Crescent Implementation
class CrescentSystem {
    constructor() {
       
        this.cylinderMesh = null;
        this.holeMarker = null;
        this.polarControls = null;
        
        // Cylinder parameters
        this.cylinderRadius = 0.1;
        this.cylinderHeight = 0.15;
        this.septumThickness = 0.01;
         // Wall thickness mode
         this.evenWallThickness = true; // Default: checked
        // Circular lumen parameters
        this.circularDiameter = 0.05; // Now storing diameter instead of radius
       this.phantomCircularDiameter = 0.05; // NEW: Store the diameter used for crescent calculation
        
        // Crescent parameters
        this.crescentCornerRadius = 0.005;
        
        
        
        // Print mode elements
        this.printModeElements = [];
        this.dimensionLines = [];
        this.dimensionLabels = [];
        
        
        
        this.create();
        this.setupCrescentInteraction(); // Add this line
        setTimeout(() => {
        this.updateCircularDiameterLimits();
    }, 100); // Small delay to ensure UI elements exist
    }
  async captureModelImage(width = 400, height = 400) {
    return await captureCurrentSystemThumbnail();
}
    updateToHighQuality() {
    
    this.updateCylinderGeometry();
}
    create() {
        
        this.updateCylinderGeometry();
        this.createCrescentController(); // Add this line
        this.createCrescentUI();
    }
 
// Calculate geometry with independent wall thicknesses
calculateIndependentCrescentGeometry() {
    if (this.evenWallThickness) {
        // Use existing geometry calculation
        return this.calculateCrescentGeometry();
    }
    
    // Independent mode: use stored crescent data, calculate circular lumen position
    if (!this.storedCrescentData) {
        this.createDefaultCrescentData();
    }
    
    // Calculate crescent positioning using phantom diameter (ORIGINAL LOGIC)
    const crescentGeometry = this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
    const crescentInnerBottom = crescentGeometry.circularCenterY - crescentGeometry.crescentInnerRadius;
    
    // For circular lumen positioning, we need to account for minimum wall thickness (ORIGINAL LOGIC)
    const minSeptum = this.getMinimumSeptumThickness();
    const circularRadius = this.circularDiameter / 2;
    
    // Calculate the available space for circular lumen considering minimum wall thickness (ORIGINAL LOGIC)
    const topBoundary = this.cylinderRadius - minSeptum; // Top boundary with minimum wall thickness
    const bottomBoundary = crescentInnerBottom + minSeptum; // Bottom boundary with separation from crescent
    
    const availableSpace = topBoundary - bottomBoundary;
    const actualCircularCenterY = bottomBoundary + (availableSpace / 2);
    
   
    
    return {
        ...crescentGeometry,
        actualCircularCenterY: actualCircularCenterY,
        phantomCircularCenterY: crescentGeometry.circularCenterY,
        isIndependentMode: true
    };
}
 // Create default crescent data if none stored
createDefaultCrescentData() {
    // Create a reasonable default crescent at the bottom of the cylinder
    const defaultCrescentOuterRadius = this.cylinderRadius - this.septumThickness;
    const defaultCrescentInnerRadius = this.cylinderRadius * 0.25; // Smaller inner radius
    const defaultCrescentCenterY = -this.cylinderRadius * 0.6; // Position at bottom
    
    this.storedCrescentData = {
        crescentOuterRadius: defaultCrescentOuterRadius,
        crescentInnerRadius: defaultCrescentInnerRadius,
        crescentCenterY: defaultCrescentCenterY,
        outerLeftAngle: Math.PI,
        outerRightAngle: 0,
        innerLeftAngle: Math.PI,
        innerRightAngle: 0,
        intersectionX: defaultCrescentInnerRadius,
        intersectionY: defaultCrescentCenterY
    };
    
   
} calculateCrescentGeometryWithDiameter(circularDiameter) {
    // This is your existing calculateCrescentGeometry() but with a specific diameter parameter
    const circularRadius = circularDiameter / 2;
    
    // Calculate circular lumen position (from top)
    const circularCenterY = this.cylinderRadius - circularRadius - this.septumThickness;
    
    // Calculate crescent outer radius (fills remaining space)
    const crescentOuterRadius = this.cylinderRadius - this.septumThickness;
    
    // Calculate crescent inner radius (maintains septum from circular lumen)
    const crescentInnerRadius = circularRadius + this.septumThickness;
    
    // Calculate intersection points between the two circles
    const d = Math.abs(circularCenterY);
    const R = crescentOuterRadius;
    const r = crescentInnerRadius;
    
    // Calculate the x-coordinate of intersection points
    const a = (R * R - r * r + d * d) / (2 * d);
    const h = Math.sqrt(R * R - a * a);
    
    // Intersection points
    const intersectionX = h;
    const intersectionY = a;
    
    // Calculate angles from outer circle center (0, 0)
    const outerRightAngle = Math.atan2(intersectionY, intersectionX);
    const outerLeftAngle = Math.atan2(intersectionY, -intersectionX);
    
    // Calculate angles from inner circle center (0, circularCenterY)
    const innerRightAngle = Math.atan2(intersectionY - circularCenterY, intersectionX);
    const innerLeftAngle = Math.atan2(intersectionY - circularCenterY, -intersectionX);
    
    // Calculate corner radius positions and angles
    const cornerRadius = this.crescentCornerRadius;
    const cornerData = this.calculateCornerRadii(
        intersectionX, intersectionY, 
        R, r, d, circularCenterY, 
        outerRightAngle, outerLeftAngle, 
        innerRightAngle, innerLeftAngle, 
        cornerRadius
    );
    
    return {
        circularCenterY,
        crescentOuterRadius,
        crescentInnerRadius,
        outerLeftAngle,
        outerRightAngle,
        innerLeftAngle,
        innerRightAngle,
        intersectionX,
        intersectionY,
        ...cornerData
    };
}
findCrescentTopPoint(crescentGeometry) {
    // The crescent shape's topmost point is at the intersection points
    // because that's where the crescent "ends" vertically
    return crescentGeometry.intersectionY;
}
  calculateEvenWallCrescentGeometry(circularDiameter) {
    // This is basically your existing calculateCrescentGeometry() but with a specific circular diameter
    const circularRadius = circularDiameter / 2;
    
    // Calculate circular lumen position (from top)
    const circularCenterY = this.cylinderRadius - circularRadius - this.septumThickness;
    
    // Calculate crescent outer radius (fills remaining space)
    const crescentOuterRadius = this.cylinderRadius - this.septumThickness;
    
    // Calculate crescent inner radius (maintains septum from circular lumen)
    const crescentInnerRadius = circularRadius + this.septumThickness;
    
    // Calculate intersection points between the two circles
    const d = Math.abs(circularCenterY);
    const R = crescentOuterRadius;
    const r = crescentInnerRadius;
    
    // Calculate the x-coordinate of intersection points
    const a = (R * R - r * r + d * d) / (2 * d);
    const h = Math.sqrt(R * R - a * a);
    
    // Intersection points
    const intersectionX = h;
    const intersectionY = a;
    
    // Calculate angles from outer circle center (0, 0)
    const outerRightAngle = Math.atan2(intersectionY, intersectionX);
    const outerLeftAngle = Math.atan2(intersectionY, -intersectionX);
    
    // Calculate angles from inner circle center (0, circularCenterY)
    const innerRightAngle = Math.atan2(intersectionY - circularCenterY, intersectionX);
    const innerLeftAngle = Math.atan2(intersectionY - circularCenterY, -intersectionX);
    
    // Calculate corner radius positions and angles
    const cornerRadius = this.crescentCornerRadius;
    const cornerData = this.calculateCornerRadii(
        intersectionX, intersectionY, 
        R, r, d, circularCenterY, 
        outerRightAngle, outerLeftAngle, 
        innerRightAngle, innerLeftAngle, 
        cornerRadius
    );
    
    return {
        circularCenterY,
        crescentOuterRadius,
        crescentInnerRadius,
        crescentCenterY: 0, // Crescent is centered
        outerLeftAngle,
        outerRightAngle,
        innerLeftAngle,
        innerRightAngle,
        intersectionX,
        intersectionY,
        ...cornerData
    };
}




// Update stored crescent inner radius when even wall thickness is enabled

validateSeptumThicknessInIndependentMode(newSeptumThickness) {
    if (this.evenWallThickness) {
        // Even wall mode - use existing validation
        return this.validateSeptumThickness(newSeptumThickness);
    }
    
    // Independent mode - check if changing septum would affect circular lumen wall thickness
    const minSeptum = this.getMinimumSeptumThickness();
    
    // Basic minimum check
    if (newSeptumThickness < minSeptum) {
        return {
            valid: false,
            constrainedValue: minSeptum,
            reason: `Minimum septum thickness is ${minSeptum.toFixed(3)}m for this outer diameter`
        };
    }
    
    // Check if changing septum thickness would reduce circular lumen wall thickness below minimum
    // Calculate current circular lumen position with new septum thickness
    const crescentGeometry = this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
    
    // Simulate what would happen with new septum thickness
    const tempSeptumThickness = this.septumThickness;
    this.septumThickness = newSeptumThickness;
    
    // Recalculate crescent geometry with new septum
    const newCrescentGeometry = this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
    const newCrescentInnerBottom = newCrescentGeometry.circularCenterY - newCrescentGeometry.crescentInnerRadius;
    
    // Calculate new positioning boundaries
    const topBoundary = this.cylinderRadius - minSeptum;
    const bottomBoundary = newCrescentInnerBottom + minSeptum;
    const availableSpace = topBoundary - bottomBoundary;
    const newActualCircularCenterY = bottomBoundary + (availableSpace / 2);
    
    // Check if current circular lumen would still fit with minimum wall thickness
    const circularRadius = this.circularDiameter / 2;
    const circularLumenTop = newActualCircularCenterY + circularRadius;
    const actualWallThickness = this.cylinderRadius - circularLumenTop;
    
    // Restore original septum thickness
    this.septumThickness = tempSeptumThickness;
    
   
    
    if (actualWallThickness < minSeptum) {
        return {
            valid: false,
            constrainedValue: this.septumThickness, // Keep current value
            reason: `Would reduce circular lumen wall thickness below ${minSeptum.toFixed(3)}m minimum`
        };
    }
    
    // Also check for crescent collapse with new septum
    const collapseCheck = this.detectCrescentCollapse(null, this.phantomCircularDiameter, newSeptumThickness, null);
    if (collapseCheck.collapsed) {
        return {
            valid: false,
            constrainedValue: this.septumThickness,
            reason: collapseCheck.reason
        };
    }
    
    return { valid: true, constrainedValue: newSeptumThickness };
}
// Validate circular diameter for independent mode
validateIndependentCircularDiameter(newDiameter) {
    const newRadius = newDiameter / 2;
    
   
    
    // Check if the phantom crescent geometry is still valid
    const phantomCollapseCheck = this.detectCrescentCollapse(null, this.phantomCircularDiameter, null, null);
    if (phantomCollapseCheck.collapsed) {
        return {
            valid: false,
            constrainedValue: this.circularDiameter,
            reason: `Crescent geometry invalid: ${phantomCollapseCheck.reason}`
        };
    }
    
    // Use the ORIGINAL positioning logic to calculate where the circular lumen will be
    const crescentGeometry = this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
    const crescentInnerBottom = crescentGeometry.circularCenterY - crescentGeometry.crescentInnerRadius;
    
    const minSeptum = this.getMinimumSeptumThickness();
    const topBoundary = this.cylinderRadius - minSeptum;
    const bottomBoundary = crescentInnerBottom + minSeptum;
    const availableSpace = topBoundary - bottomBoundary;
    const actualCircularCenterY = bottomBoundary + (availableSpace / 2);
    
    // Calculate wall thickness with the new diameter
    const circularTop = actualCircularCenterY + newRadius;
    const wallThicknessToOuter = this.cylinderRadius - circularTop;
    
   
    
    // NEW: Check if wall thickness exceeds septum thickness setting
    if (wallThicknessToOuter > this.septumThickness) {
        // Calculate minimum diameter to achieve the wall thickness limit
        const maxAllowedTop = this.cylinderRadius - this.septumThickness;
        const minRequiredRadius = maxAllowedTop - actualCircularCenterY;
        const minRequiredDiameter = Math.max(0.010, minRequiredRadius * 2);
        
        
        
        return {
            valid: false,
            constrainedValue: minRequiredDiameter,
            reason: `Wall thickness would be ${wallThicknessToOuter.toFixed(3)}m, maximum allowed is ${this.septumThickness.toFixed(3)}m`
        };
    }
    
    // Basic bounds checking (original logic)
    if (circularTop > topBoundary) {
        const maxRadius = topBoundary - actualCircularCenterY;
        const maxDiameter = Math.max(0.010, maxRadius * 2);
        return {
            valid: false,
            constrainedValue: maxDiameter,
            reason: `Exceeds available space`
        };
    }
    
    const circularBottom = actualCircularCenterY - newRadius;
    if (circularBottom < bottomBoundary) {
        const maxRadius = actualCircularCenterY - bottomBoundary;
        const maxDiameter = Math.max(0.010, maxRadius * 2);
        return {
            valid: false,
            constrainedValue: maxDiameter,
            reason: `Too close to crescent`
        };
    }
    
    // Basic minimum
    if (newDiameter < 0.010) {
        return {
            valid: false,
            constrainedValue: 0.010,
            reason: `Minimum diameter is 0.010m`
        };
    }
    
   
    return { valid: true, constrainedValue: newDiameter };
}
  createCrescentController() {
    if (this.crescentController) {
        globalScene.remove(this.crescentController);
        if (this.crescentController.geometry) this.crescentController.geometry.dispose();
        if (this.crescentController.material) this.crescentController.material.dispose();
    }
    
    // Calculate circular lumen center position
    const geometry = this.calculateCrescentGeometry();
    const circularCenterY = geometry.circularCenterY;
    
    // Create control sphere at center of circular lumen
    const controlGeometry = new THREE.SphereGeometry(0.008, 16, 16);
    const controlMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, // Green color to distinguish from other controls
        transparent: true,
        opacity: 0.8
    });
    
    this.crescentController = new THREE.Mesh(controlGeometry, controlMaterial);
    this.crescentController.position.set(0, circularCenterY, this.cylinderHeight / 2);
    this.crescentController.userData = { 
        type: 'crescentController',
        controlType: 'circularDiameter'
    };
    
    globalScene.add(this.crescentController);
   
}

updateControllerPosition() {
    if (this.crescentController) {
        const geometry = this.calculateIndependentCrescentGeometry();
        const circularCenterY = geometry.isIndependentMode ? geometry.actualCircularCenterY : geometry.circularCenterY;
        this.crescentController.position.set(0, circularCenterY, this.cylinderHeight / 2);
    }
}

setupCrescentInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let initialMouseY = 0;
    let initialDiameter = 0;
    
    const onMouseDown = (event) => {
        const rect = globalRenderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, globalCamera);
        
        if (this.crescentController) {
            const intersects = raycaster.intersectObjects([this.crescentController]);
            
            if (intersects.length > 0) {
                startInteraction();
                isDragging = true;
                globalControls.enabled = false;
                
                // Store initial values
                initialMouseY = mouse.y;
                initialDiameter = this.circularDiameter;
                
                // Highlight the controller
                this.crescentController.material.opacity = 1.0;
                this.crescentController.material.color.setHex(0x44ff44); // Brighter green
                
                
                event.preventDefault();
                event.stopPropagation();
            }
        }
    };
    
    const onMouseMove = (event) => {
    if (!isDragging) return;
    autoExitPrintMode();
    const rect = globalRenderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const deltaY = mouse.y - initialMouseY;
    const sensitivity = 0.1;
    const diameterChange = -deltaY * sensitivity;
    const newDiameter = Math.max(0.010, initialDiameter + diameterChange);
    
   
    
    // Validate the new diameter based on current mode
    if (this.evenWallThickness) {
        // Even wall mode - check for crescent collapse
        const collapseCheck = this.detectCrescentCollapse(null, newDiameter, null, null);
        
        if (collapseCheck.collapsed) {
           
            return;
        }
    } else {
        // Independent mode - validate against septum requirements
        
        const validation = this.validateIndependentCircularDiameter(newDiameter);
        
       
        
        if (!validation.valid) {
            const constrainedDiameter = validation.constrainedValue;
           
            if (constrainedDiameter !== this.circularDiameter) {
                this.circularDiameter = constrainedDiameter;
                this.updateCylinderGeometry();
                this.updateControllerPosition();
                this.updateCircularDiameterUI();
            }
            return;
        }
    }
    
    // Apply the change if valid
    if (newDiameter !== this.circularDiameter) {
        this.circularDiameter = newDiameter;
        this.updateCylinderGeometry();
        this.updateControllerPosition();
        this.updateCircularDiameterUI();
    }
};
    
    const onMouseUp = () => {
        if (isDragging) {
            // Reset controller appearance
            if (this.crescentController) {
                this.crescentController.material.opacity = 0.8;
                this.crescentController.material.color.setHex(0x00ff00); // Normal green
            }
          
        }
        endInteraction();
        isDragging = false;
        globalControls.enabled = true;
    };
    
    // Add event listeners
    globalRenderer.domElement.addEventListener('mousedown', onMouseDown);
    globalRenderer.domElement.addEventListener('mousemove', onMouseMove);
    globalRenderer.domElement.addEventListener('mouseup', onMouseUp);
    
    // Store references to remove later
    this.controllerEvents = { onMouseDown, onMouseMove, onMouseUp };
}

updateCircularDiameterUI() {
    // Update the circular diameter controls to reflect the current value
    const circularRadiusSlider = document.getElementById('circular-radius');
    const circularRadiusInput = document.getElementById('circular-radius-input');
    
    if (circularRadiusSlider) circularRadiusSlider.value = this.circularDiameter.toFixed(3);
    if (circularRadiusInput) circularRadiusInput.value = this.circularDiameter.toFixed(3);
}
  // Update circular diameter control limits based on current outer diameter
updateCircularDiameterLimits() {
    const circularRadiusSlider = document.getElementById('circular-radius');
    const circularRadiusInput = document.getElementById('circular-radius-input');
    
    if (circularRadiusSlider && circularRadiusInput) {
        let maxCircularDiameter;
        let minCircularDiameter = 0.010; // Basic minimum
        
        if (this.evenWallThickness) {
            // Even wall mode - find maximum diameter that doesn't cause crescent collapse
            maxCircularDiameter = this.findMaxCircularDiameterForEvenWall();
        } else {
            // Independent mode - use original positioning logic to calculate limits
            const crescentGeometry = this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
            const crescentInnerBottom = crescentGeometry.circularCenterY - crescentGeometry.crescentInnerRadius;
            
            const minSeptum = this.getMinimumSeptumThickness();
            const topBoundary = this.cylinderRadius - minSeptum;
            const bottomBoundary = crescentInnerBottom + minSeptum;
            const availableSpace = topBoundary - bottomBoundary;
            const actualCircularCenterY = bottomBoundary + (availableSpace / 2);
            
            // Calculate max diameter based on available space
            const maxRadiusFromTop = topBoundary - actualCircularCenterY;
            const maxRadiusFromBottom = actualCircularCenterY - bottomBoundary;
            const maxRadiusFromSpace = Math.min(maxRadiusFromTop, maxRadiusFromBottom);
            
            // NEW: Also consider wall thickness constraint
            const maxAllowedTop = this.cylinderRadius - this.septumThickness;
            const maxRadiusFromWallThickness = maxAllowedTop - actualCircularCenterY;
            
            // Use the most restrictive constraint
            const maxRadius = Math.min(maxRadiusFromSpace, maxRadiusFromWallThickness);
            maxCircularDiameter = Math.max(0.010, maxRadius * 2);
            
           
        }
        
        // Update controls
        circularRadiusSlider.min = minCircularDiameter.toFixed(3);
        circularRadiusInput.min = minCircularDiameter.toFixed(3);
        circularRadiusSlider.max = maxCircularDiameter.toFixed(3);
        circularRadiusInput.max = maxCircularDiameter.toFixed(3);
        
        // Clamp current value if needed
        if (this.circularDiameter > maxCircularDiameter) {
            this.circularDiameter = maxCircularDiameter;
            circularRadiusSlider.value = maxCircularDiameter.toFixed(3);
            circularRadiusInput.value = maxCircularDiameter.toFixed(3);
            this.updateCylinderGeometry();
            
          
        }
    }
}
  findMaxCircularDiameterForEvenWall() {
    // Binary search to find the maximum circular diameter that doesn't cause crescent collapse
    let minDiameter = 0.010; // 10mm minimum
    let maxDiameter = this.cylinderRadius * 1.8; // Start with a reasonable upper bound
    let testDiameter = maxDiameter;
    let iterations = 0;
    const maxIterations = 25;
    
   
    
    // First, find an upper bound that causes collapse
    while (iterations < maxIterations && testDiameter <= this.cylinderRadius * 2) {
        const collapseCheck = this.detectCrescentCollapse(null, testDiameter, null, null);
        
        if (collapseCheck.collapsed) {
            maxDiameter = testDiameter;
            break;
        }
        
        testDiameter += 0.005; // Increment by 5mm
        iterations++;
    }
    
    // Binary search for the exact maximum
    for (let i = 0; i < 20; i++) {
        const midDiameter = (minDiameter + maxDiameter) / 2;
        const collapseCheck = this.detectCrescentCollapse(null, midDiameter, null, null);
        
        if (collapseCheck.collapsed) {
            maxDiameter = midDiameter;
        } else {
            minDiameter = midDiameter;
        }
        
        // Stop if we've converged
        if (Math.abs(maxDiameter - minDiameter) < 0.001) {
            break;
        }
    }
    
    // Return the largest valid diameter with a small safety margin
    const result = Math.max(0.010, minDiameter - 0.002);
   
    return result;
}
   detectCrescentCollapse(testCylinderRadius = null, testCircularDiameter = null, testSeptumThickness = null, testCornerRadius = null) {
    // Use test values or current values
    const cylinderRadius = testCylinderRadius !== null ? testCylinderRadius : this.cylinderRadius;
    const circularDiameter = testCircularDiameter !== null ? testCircularDiameter : this.circularDiameter;
    const septumThickness = testSeptumThickness !== null ? testSeptumThickness : this.septumThickness;
    const cornerRadius = testCornerRadius !== null ? testCornerRadius : this.crescentCornerRadius;
    
    const circularRadius = circularDiameter / 2;
    
    // Calculate crescent geometry with test parameters
    const circularCenterY = cylinderRadius - circularRadius - septumThickness;
    const crescentOuterRadius = cylinderRadius - septumThickness;
    const crescentInnerRadius = circularRadius + septumThickness;
    
    // Check basic geometric constraints
    if (crescentOuterRadius <= crescentInnerRadius) {
        return {
            collapsed: true,
            reason: "Crescent outer radius too small - septum thickness or circular diameter too large"
        };
    }
    
    // if (circularCenterY <= circularRadius) {
    //     return {
    //         collapsed: true,
    //         reason: "Circular lumen too large for cylinder - would extend outside"
    //     };
    // }
    
    // Calculate distance between centers for intersection
    const d = Math.abs(circularCenterY);
    const R = crescentOuterRadius;
    const r = crescentInnerRadius;
    
    // Check if circles can intersect properly
    if (d >= R + r) {
        return {
            collapsed: true,
            reason: "Circles too far apart - no valid crescent shape possible"
        };
    }
    
    if (d <= Math.abs(R - r)) {
        return {
            collapsed: true,
            reason: "One circle completely inside the other - no crescent shape possible"
        };
    }
    
    // Calculate intersection points
    const a = (R * R - r * r + d * d) / (2 * d);
    const h_squared = R * R - a * a;
    
    if (h_squared < 0) {
        return {
            collapsed: true,
            reason: "No valid intersection points for crescent shape"
        };
    }
    
    const h = Math.sqrt(h_squared);
    
    // Calculate corner centers using the same logic as calculateCornerRadii
    const R1 = R - cornerRadius;
    const R2 = r + cornerRadius;
    const d_centers = Math.abs(circularCenterY);
    
    const a_corner = (R1 * R1 - R2 * R2 + d_centers * d_centers) / (2 * d_centers);
    const h_corner_squared = R1 * R1 - a_corner * a_corner;
    
    if (h_corner_squared < 0) {
        return {
            collapsed: true,
            reason: "No valid corner positions for current parameters"
        };
    }
    
    const h_corner = Math.sqrt(h_corner_squared);
    
    // Corner centers
    const rightCornerCenterX = h_corner;
    const rightCornerCenterY = a_corner;
    const leftCornerCenterX = -h_corner;
    const leftCornerCenterY = a_corner;
    
    // NEW: Check distance between corner centers
    const distanceBetweenCorners = Math.sqrt(
        (rightCornerCenterX - leftCornerCenterX) * (rightCornerCenterX - leftCornerCenterX) +
        (rightCornerCenterY - leftCornerCenterY) * (rightCornerCenterY - leftCornerCenterY)
    );
    
    const minimumCornerDistance = 0.005; // 5mm minimum distance
    
    if (distanceBetweenCorners < minimumCornerDistance) {
        return {
            collapsed: true,
            reason: `Corner centers too close (${distanceBetweenCorners.toFixed(4)}m apart, minimum: ${minimumCornerDistance.toFixed(3)}m)`
        };
    }
    
    return { collapsed: false };
}
  // Get minimum septum thickness based on outer diameter
getMinimumSeptumThickness() {
    const outerDiameter = this.cylinderRadius * 2;
    return outerDiameter <= 0.200 ? 0.005 : 0.008;
}
  // Validate and constrain septum thickness
validateSeptumThickness(newSeptumThickness) {
    const minSeptum = this.getMinimumSeptumThickness();
    
    if (newSeptumThickness < minSeptum) {
        return {
            valid: false,
            constrainedValue: minSeptum,
            reason: `Minimum septum thickness is ${minSeptum.toFixed(3)}m for this outer diameter`
        };
    }
    
    // Check if this septum thickness would cause collapse
    const collapseCheck = this.detectCrescentCollapse(null, null, newSeptumThickness, null);
    
    if (collapseCheck.collapsed) {
        return {
            valid: false,
            constrainedValue: this.septumThickness, // Keep current value
            reason: collapseCheck.reason
        };
    }
    
    return { valid: true, constrainedValue: newSeptumThickness };
}

// Show warning message to user
showParameterWarning(message) {
    const warning = document.createElement('div');
    warning.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
        font-family: Arial;
        font-size: 12px;
        max-width: 300px;
    `;
    warning.textContent = message;
    document.body.appendChild(warning);
    setTimeout(() => warning.remove(), 3000);
}
    calculateCrescentGeometry() {
        // Calculate circular lumen position (from top)
        const circularCenterY = this.cylinderRadius - (this.circularDiameter / 2) - this.septumThickness;
        
        // Calculate crescent outer radius (fills remaining space)
        const crescentOuterRadius = this.cylinderRadius - this.septumThickness;
        
        // Calculate crescent inner radius (maintains septum from circular lumen)
        const crescentInnerRadius = (this.circularDiameter / 2) + this.septumThickness;
        
        // Calculate intersection points between the two circles
        const d = Math.abs(circularCenterY);
        const R = crescentOuterRadius;
        const r = crescentInnerRadius;
        
        // Calculate the x-coordinate of intersection points
        const a = (R * R - r * r + d * d) / (2 * d);
        const h = Math.sqrt(R * R - a * a);
        
        // Intersection points
        const intersectionX = h;
        const intersectionY = a;
        
        // Calculate angles from outer circle center (0, 0)
        const outerRightAngle = Math.atan2(intersectionY, intersectionX);
        const outerLeftAngle = Math.atan2(intersectionY, -intersectionX);
        
        // Calculate angles from inner circle center (0, circularCenterY)
        const innerRightAngle = Math.atan2(intersectionY - circularCenterY, intersectionX);
        const innerLeftAngle = Math.atan2(intersectionY - circularCenterY, -intersectionX);
        
        // Calculate corner radius positions and angles
        const cornerRadius = this.crescentCornerRadius;
        const cornerData = this.calculateCornerRadii(
            intersectionX, intersectionY, 
            R, r, d, circularCenterY, 
            outerRightAngle, outerLeftAngle, 
            innerRightAngle, innerLeftAngle, 
            cornerRadius
        );
        
        return {
            circularCenterY,
            crescentOuterRadius,
            crescentInnerRadius,
            outerLeftAngle,
            outerRightAngle,
            innerLeftAngle,
            innerRightAngle,
            intersectionX,
            intersectionY,
            ...cornerData
        };
    }
    
    calculateCornerRadii(intersectionX, intersectionY, R, r, d, circularCenterY, 
                        outerRightAngle, outerLeftAngle, innerRightAngle, innerLeftAngle, cornerRadius) {
        
        const R1 = R - cornerRadius;
        const R2 = r + cornerRadius;
        const d_centers = Math.abs(circularCenterY);
        
        const a = (R1 * R1 - R2 * R2 + d_centers * d_centers) / (2 * d_centers);
        const h_squared = R1 * R1 - a * a;
        
        if (h_squared < 0) {
            return {
                rightCornerCenterX: intersectionX * 0.8,
                rightCornerCenterY: intersectionY * 0.8,
                leftCornerCenterX: -intersectionX * 0.8,
                leftCornerCenterY: intersectionY * 0.8,
                rightOuterTangentAngle: outerRightAngle,
                rightInnerTangentAngle: innerRightAngle,
                leftOuterTangentAngle: outerLeftAngle,
                leftInnerTangentAngle: innerLeftAngle,
                rightCornerStartAngle: 0,
                rightCornerEndAngle: Math.PI,
                leftCornerStartAngle: Math.PI,
                leftCornerEndAngle: 0
            };
        }
        
        const h = Math.sqrt(h_squared);
        
        const rightCornerCenterX = h;
        const rightCornerCenterY = a;
        const leftCornerCenterX = -h;
        const leftCornerCenterY = a;
        
        const rightOuterTangentAngle = Math.atan2(rightCornerCenterY, rightCornerCenterX);
        const leftOuterTangentAngle = Math.atan2(leftCornerCenterY, leftCornerCenterX);
        
        const rightInnerTangentAngle = Math.atan2(rightCornerCenterY - circularCenterY, rightCornerCenterX);
        const leftInnerTangentAngle = Math.atan2(leftCornerCenterY - circularCenterY, leftCornerCenterX);
        
        // Calculate tangent points and angles...
        const rightOuterTangentX = R * Math.cos(rightOuterTangentAngle);
        const rightOuterTangentY = R * Math.sin(rightOuterTangentAngle);
        const rightCornerToOuterAngle = Math.atan2(rightOuterTangentY - rightCornerCenterY, rightOuterTangentX - rightCornerCenterX);
        
        const rightInnerTangentX = r * Math.cos(rightInnerTangentAngle);
        const rightInnerTangentY = circularCenterY + r * Math.sin(rightInnerTangentAngle);
        const rightCornerToInnerAngle = Math.atan2(rightInnerTangentY - rightCornerCenterY, rightInnerTangentX - rightCornerCenterX);
        
        const leftInnerTangentX = r * Math.cos(leftInnerTangentAngle);
        const leftInnerTangentY = circularCenterY + r * Math.sin(leftInnerTangentAngle);
        const leftCornerToInnerAngle = Math.atan2(leftInnerTangentY - leftCornerCenterY, leftInnerTangentX - leftCornerCenterX);
        
        const leftOuterTangentX = R * Math.cos(leftOuterTangentAngle);
        const leftOuterTangentY = R * Math.sin(leftOuterTangentAngle);
        const leftCornerToOuterAngle = Math.atan2(leftOuterTangentY - leftCornerCenterY, leftOuterTangentX - leftCornerCenterX);
        
        return {
            rightCornerCenterX,
            rightCornerCenterY,
            leftCornerCenterX,
            leftCornerCenterY,
            rightOuterTangentAngle,
            rightInnerTangentAngle,
            leftOuterTangentAngle,
            leftInnerTangentAngle,
            rightCornerStartAngle: rightCornerToOuterAngle,
            rightCornerEndAngle: rightCornerToInnerAngle,
            leftCornerStartAngle: leftCornerToInnerAngle,
            leftCornerEndAngle: leftCornerToOuterAngle
        };
    }
    createEvenWallCrescentShape(geometry) {
    const { 
        crescentOuterRadius, 
        crescentInnerRadius,
        rightCornerCenterX,
        rightCornerCenterY,
        leftCornerCenterX,
        leftCornerCenterY,
        rightOuterTangentAngle,
        rightInnerTangentAngle,
        leftOuterTangentAngle,
        leftInnerTangentAngle,
        rightCornerStartAngle,
        rightCornerEndAngle,
        leftCornerStartAngle,
        leftCornerEndAngle
    } = geometry;
    
    const shape = new THREE.Shape();
    const cornerRadius = this.crescentCornerRadius;
    
    // Use the geometry data to create the exact same crescent as even wall mode
    // This is your existing crescent creation logic
    const startX = crescentOuterRadius * Math.cos(rightOuterTangentAngle);
    const startY = crescentOuterRadius * Math.sin(rightOuterTangentAngle);
    shape.moveTo(startX, startY);
    
    shape.absarc(0, 0, crescentOuterRadius, rightOuterTangentAngle, leftOuterTangentAngle, true);
    shape.absarc(leftCornerCenterX, leftCornerCenterY, cornerRadius, leftCornerEndAngle, leftCornerStartAngle, true);
    
    // IMPORTANT: Use the original circular center from the even wall calculation, not the independent one
    const evenWallCircularCenterY = geometry.circularCenterY;
    shape.absarc(0, evenWallCircularCenterY, crescentInnerRadius, leftInnerTangentAngle, rightInnerTangentAngle, false);
    shape.absarc(rightCornerCenterX, rightCornerCenterY, cornerRadius, rightCornerEndAngle, rightCornerStartAngle, true);
    
    shape.closePath();
    return shape;
}
   createCrescentShape() {
    // Get the current geometry
    const geometry = this.evenWallThickness ? 
        this.calculateCrescentGeometry() : 
        this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
    
    const { 
        circularCenterY, 
        crescentOuterRadius, 
        crescentInnerRadius,
        outerLeftAngle,
        outerRightAngle,
        innerLeftAngle,
        innerRightAngle,
        rightCornerCenterX,
        rightCornerCenterY,
        leftCornerCenterX,
        leftCornerCenterY,
        rightOuterTangentAngle,
        rightInnerTangentAngle,
        leftOuterTangentAngle,
        leftInnerTangentAngle,
        rightCornerStartAngle,
        rightCornerEndAngle,
        leftCornerStartAngle,
        leftCornerEndAngle
    } = geometry;
    
    const shape = new THREE.Shape();
    const cornerRadius = this.crescentCornerRadius;
    
    // Start from the right tangent point on outer arc
    const startX = crescentOuterRadius * Math.cos(rightOuterTangentAngle);
    const startY = crescentOuterRadius * Math.sin(rightOuterTangentAngle);
    shape.moveTo(startX, startY);
    
    // Outer arc (clockwise from right tangent to left tangent)
    shape.absarc(0, 0, crescentOuterRadius, rightOuterTangentAngle, leftOuterTangentAngle, true);
    
    // Left corner arc
    shape.absarc(leftCornerCenterX, leftCornerCenterY, cornerRadius, leftCornerEndAngle, leftCornerStartAngle, true);
    
    // Inner arc (counterclockwise from left tangent to right tangent)
    shape.absarc(0, circularCenterY, crescentInnerRadius, leftInnerTangentAngle, rightInnerTangentAngle, false);
    
    // Right corner arc
    shape.absarc(rightCornerCenterX, rightCornerCenterY, cornerRadius, rightCornerEndAngle, rightCornerStartAngle, true);
    
    shape.closePath();
    
    return shape;
}
    
  updateCylinderGeometry() {
    if (this.cylinderMesh) {
        globalScene.remove(this.cylinderMesh);
        if (this.cylinderMesh.geometry) this.cylinderMesh.geometry.dispose();
        if (this.cylinderMesh.material) this.cylinderMesh.material.dispose();
    }
    
    // Create main cylinder shape
    const cylinderShape = new THREE.Shape();
    cylinderShape.absarc(0, 0, this.cylinderRadius, 0, Math.PI * 2, false);
    
    // Get geometry data
    const geometry = this.calculateIndependentCrescentGeometry();
    
    if (geometry.isIndependentMode) {
        // Independent mode: Add actual circular hole at calculated position
        const circularHole = new THREE.Path();
        circularHole.absarc(0, geometry.actualCircularCenterY, this.circularDiameter / 2, 0, Math.PI * 2, true);
        cylinderShape.holes.push(circularHole);
        
        // Add crescent hole calculated using phantom diameter (don't add phantom circular hole)
        const crescentHole = this.createCrescentShape();
        cylinderShape.holes.push(crescentHole);
    } else {
        // Even wall mode: Add both holes normally
        const circularHole = new THREE.Path();
        circularHole.absarc(0, geometry.circularCenterY, this.circularDiameter / 2, 0, Math.PI * 2, true);
        cylinderShape.holes.push(circularHole);
        
        const crescentHole = this.createCrescentShape();
        cylinderShape.holes.push(crescentHole);
    }
        
        
        
        const extrudeSettings = {
            depth: this.cylinderHeight,
            bevelEnabled: false,
            steps: 1,
            curveSegments: getCurrentCurveSegments()
        };
        
        try {
            const geometry3D = new THREE.ExtrudeGeometry(cylinderShape, extrudeSettings);
            geometry3D.center();
            geometry3D.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    metalness: 0.1,      // Same as the example
    roughness: 0.4,      // Low roughness for shiny appearance
    transparent: false,
    opacity: 1
});
            
            this.cylinderMesh = new THREE.Mesh(geometry3D, material);
            this.cylinderMesh.castShadow = true;
            this.cylinderMesh.receiveShadow = true;
            this.cylinderMesh.userData = { type: 'crescentCylinder' };
            globalScene.add(this.cylinderMesh);
            
            
        } catch (error) {
            console.error('Error creating crescent geometry:', error);
        }
        this.updateControllerPosition();
    }
   // Create crescent shape from specific geometry data
createCrescentShapeFromGeometry(geometry) {
    const shape = new THREE.Shape();
    const cornerRadius = this.crescentCornerRadius;
    
    if (!this.evenWallThickness && this.storedCrescentData) {
        // Independent mode - use stored crescent data, ignore current circular lumen
        const centerY = this.storedCrescentData.crescentCenterY;
        const outerR = this.storedCrescentData.crescentOuterRadius;
        const innerR = this.storedCrescentData.crescentInnerRadius;
        
        // Create simple bottom crescent using stored dimensions
        shape.moveTo(outerR, centerY);
        
        // Bottom arc of outer circle
        shape.absarc(0, centerY, outerR, 0, Math.PI, false);
        
        // Left corner (if corner radius exists)
        if (cornerRadius > 0 && cornerRadius < innerR * 0.9) {
            const leftCornerX = -innerR + cornerRadius;
            shape.absarc(leftCornerX, centerY, cornerRadius, Math.PI, Math.PI * 1.5, false);
        }
        
        // Top arc of inner circle (reverse direction)
        shape.absarc(0, centerY, innerR, Math.PI, 0, true);
        
        // Right corner (if corner radius exists)
        if (cornerRadius > 0 && cornerRadius < innerR * 0.9) {
            const rightCornerX = innerR - cornerRadius;
            shape.absarc(rightCornerX, centerY, cornerRadius, Math.PI * 1.5, 0, false);
        }
        
        shape.closePath();
        return shape;
    }
    
    // Even wall thickness mode - use the complex calculated geometry
    const { 
        crescentCenterY,
        crescentOuterRadius, 
        crescentInnerRadius,
        rightCornerCenterX,
        rightCornerCenterY,
        leftCornerCenterX,
        leftCornerCenterY,
        rightOuterTangentAngle,
        rightInnerTangentAngle,
        leftOuterTangentAngle,
        leftInnerTangentAngle,
        rightCornerStartAngle,
        rightCornerEndAngle,
        leftCornerStartAngle,
        leftCornerEndAngle
    } = geometry;
    
    // Complex geometry calculation (existing code)
    const startX = crescentOuterRadius * Math.cos(rightOuterTangentAngle);
    const startY = crescentOuterRadius * Math.sin(rightOuterTangentAngle);
    shape.moveTo(startX, startY);
    
    shape.absarc(0, 0, crescentOuterRadius, rightOuterTangentAngle, leftOuterTangentAngle, true);
    shape.absarc(leftCornerCenterX, leftCornerCenterY, cornerRadius, leftCornerEndAngle, leftCornerStartAngle, true);
    shape.absarc(0, geometry.circularCenterY, crescentInnerRadius, leftInnerTangentAngle, rightInnerTangentAngle, false);
    shape.absarc(rightCornerCenterX, rightCornerCenterY, cornerRadius, rightCornerEndAngle, rightCornerStartAngle, true);
    
    shape.closePath();
    return shape;
}
    
    
    createCrescentUI() {
        // This will be populated by the profile manager
      
    }
    
  
    
   
    
 
    
 
    
   
    
   cleanup() {
    
    
    // Remove event listeners
    if (this.controllerEvents && globalRenderer && globalRenderer.domElement) {
        globalRenderer.domElement.removeEventListener('mousedown', this.controllerEvents.onMouseDown);
        globalRenderer.domElement.removeEventListener('mousemove', this.controllerEvents.onMouseMove);
        globalRenderer.domElement.removeEventListener('mouseup', this.controllerEvents.onMouseUp);
    }
    
    if (this.cylinderMesh) {
        globalScene.remove(this.cylinderMesh);
        if (this.cylinderMesh.geometry) this.cylinderMesh.geometry.dispose();
        if (this.cylinderMesh.material) this.cylinderMesh.material.dispose();
        this.cylinderMesh = null;
    }
    
    // Clean up controller
    if (this.crescentController) {
        globalScene.remove(this.crescentController);
        if (this.crescentController.geometry) this.crescentController.geometry.dispose();
        if (this.crescentController.material) this.crescentController.material.dispose();
        this.crescentController = null;
    }
    
    
}
    
    // Print mode methods (basic implementation)
 enterPrintMode() {
    
    
    // Hide the main cylinder mesh
    if (this.cylinderMesh) this.cylinderMesh.visible = false;
     if (this.crescentController) this.crescentController.visible = false;
    // Create print mode elements
    this.createCrescentPrintElements();
}

exitPrintMode() {
   
    
    // Show the main cylinder mesh
    if (this.cylinderMesh) this.cylinderMesh.visible = true;
    if (this.crescentController) this.crescentController.visible = true;
    // Remove print mode elements
    this.clearCrescentPrintElements();
  if (!isPerspectiveView) {
    switchCamera();
}
}

createCrescentPrintElements() {
    const z = this.cylinderHeight / 2 + 0.002;
    
    // Create outer cylinder outline
    this.createCircleOutline(0, 0, this.cylinderRadius, z);
    
    // Create circular lumen outline at correct position for current mode
    let circularCenterY;
    if (this.evenWallThickness) {
        const geometry = this.calculateCrescentGeometry();
        circularCenterY = geometry.circularCenterY;
    } else {
        const independentGeometry = this.calculateIndependentCrescentGeometry();
        circularCenterY = independentGeometry.actualCircularCenterY;
    }
    
    
    
    this.createCircleOutline(0, circularCenterY, this.circularDiameter / 2, z);
    
    // Create crescent outline with rounded corners
    this.createCrescentOutline(z);
    
    // Create dimension lines and labels
    const geometry = this.calculateCrescentGeometry(); // Always use this for crescent dimensions
    this.createCrescentDimensions(z, geometry);
}

createCircleOutline(centerX, centerY, radius, z) {
    const points = [];
    const segments = 64;
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            z
        ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const circle = new THREE.Line(geometry, material);
    
    globalScene.add(circle);
    this.printModeElements.push(circle);
}

createCrescentOutline(z) {
    // Get the exact same shape used in the geometry
    const crescentShape = this.createCrescentShape();
    
    // Extract points from the shape's curves
    const points = [];
    
    // Get all the curves from the shape
    const curves = crescentShape.getSpacedPoints(300); // Get 200 points along the shape
    
    // Convert to 3D points at the correct Z level
    curves.forEach(point => {
        points.push(new THREE.Vector3(point.x, point.y, z));
    });
    
    // Close the shape
    if (points.length > 0) {
        points.push(points[0].clone());
    }
    
    const crescentOutlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const crescentOutline = new THREE.Line(crescentOutlineGeometry, material);
    
    globalScene.add(crescentOutline);
    this.printModeElements.push(crescentOutline);
}

createCrescentDimensions(z, geometry) {
    // Determine which geometry to use for positioning
    const actualGeometry = this.evenWallThickness ? geometry : this.calculateIndependentCrescentGeometry();
    const circularCenterY = actualGeometry.isIndependentMode ? actualGeometry.actualCircularCenterY : actualGeometry.circularCenterY;
    
    
    
    // 1. Circular lumen diameter dimension line (vertical from center, going up)
    const extensionDistance = this.cylinderRadius + 0.04;
    
    const circularDimLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, circularCenterY, z),
        new THREE.Vector3(0, extensionDistance, z)
    ]);
    const circularDimLineMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
    const circularDimLine = new THREE.Line(circularDimLineGeometry, circularDimLineMaterial);
    globalScene.add(circularDimLine);
    this.dimensionLines.push(circularDimLine);
    
    // Circular lumen diameter label
    const circularLabelDiv = document.createElement('div');
    circularLabelDiv.style.cssText = `
        color: black; 
        font-size: 12px; 
        background: rgba(255,255,255,0.9); 
        padding: 3px 6px; 
        border: 1px solid black; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    circularLabelDiv.innerHTML = `⌀ ${(this.circularDiameter).toFixed(3)}m`;
    
    const circularLabel = new CSS2DObject(circularLabelDiv);
    circularLabel.position.set(0.02, extensionDistance + 0.01, z);
    globalScene.add(circularLabel);
    this.dimensionLabels.push(circularLabel);
    
    // 2. If in independent mode, add dimension between circular and crescent lumens
    if (!this.evenWallThickness) {
    // Calculate crescent position using phantom diameter
    const crescentGeometry = this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
    const crescentInnerBottom = crescentGeometry.circularCenterY - crescentGeometry.crescentInnerRadius;
    const circularBottom = circularCenterY - (this.circularDiameter / 2);
    
    // Create horizontal dimension lines extending from left side to center of cylinder
    const lumenSeparationDimX = -this.cylinderRadius - 0.02;
    
    // Horizontal line at circular bottom level (extends to center)
    const circularBottomLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lumenSeparationDimX, circularBottom, z),
        new THREE.Vector3(0, circularBottom, z) // Extend to center (X=0)
    ]);
    const circularBottomLine = new THREE.Line(circularBottomLineGeometry, new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 }));
    globalScene.add(circularBottomLine);
    this.dimensionLines.push(circularBottomLine);
    
    // Horizontal line at crescent top level (extends to center)
    const crescentTopLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lumenSeparationDimX, crescentInnerBottom, z),
        new THREE.Vector3(0, crescentInnerBottom, z) // Extend to center (X=0)
    ]);
    const crescentTopLine = new THREE.Line(crescentTopLineGeometry, new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 }));
    globalScene.add(crescentTopLine);
    this.dimensionLines.push(crescentTopLine);
    
    // Vertical dimension line (connects the two horizontal lines)
    const verticalDimLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lumenSeparationDimX, circularBottom, z),
        new THREE.Vector3(lumenSeparationDimX, crescentInnerBottom, z)
    ]);
    const verticalDimLine = new THREE.Line(verticalDimLineGeometry, new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 }));
    globalScene.add(verticalDimLine);
    this.dimensionLines.push(verticalDimLine);
    
    // Add tick marks
    const tickLength = 0.005;
    
    // Circular bottom tick (vertical tick on horizontal line)
    const circularBottomTickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lumenSeparationDimX, circularBottom - tickLength, z),
        new THREE.Vector3(lumenSeparationDimX, circularBottom + tickLength, z)
    ]);
    const circularBottomTick = new THREE.Line(circularBottomTickGeometry, new THREE.LineBasicMaterial({ color: 0x666666 }));
    globalScene.add(circularBottomTick);
    this.dimensionLines.push(circularBottomTick);
    
    // Crescent top tick (vertical tick on horizontal line)
    const crescentTopTickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lumenSeparationDimX, crescentInnerBottom - tickLength, z),
        new THREE.Vector3(lumenSeparationDimX, crescentInnerBottom + tickLength, z)
    ]);
    const crescentTopTick = new THREE.Line(crescentTopTickGeometry, new THREE.LineBasicMaterial({ color: 0x666666 }));
    globalScene.add(crescentTopTick);
    this.dimensionLines.push(crescentTopTick);
    
    // Gap dimension (just the number, no label text)
    const lumenSeparation = Math.abs(circularBottom - crescentInnerBottom);
    const gapDimensionDiv = document.createElement('div');
    gapDimensionDiv.style.cssText = `
        color: black; 
        font-size: 12px; 
        background: rgba(255,255,255,0.9); 
        padding: 3px 6px; 
        border: 1px solid black; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    gapDimensionDiv.innerHTML = `${lumenSeparation.toFixed(3)}m`;
    
    const gapDimensionLabel = new CSS2DObject(gapDimensionDiv);
    gapDimensionLabel.position.set(lumenSeparationDimX - 0.01, (circularBottom + crescentInnerBottom) / 2, z);
    globalScene.add(gapDimensionLabel);
    this.dimensionLabels.push(gapDimensionLabel);
}
    
    // 3. Septum thickness dimension line (at bottom, unchanged)
    const bottomY = -this.cylinderRadius;
    const septumDimLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, bottomY, z),
        new THREE.Vector3(0, bottomY + this.septumThickness, z)
    ]);
    const septumDimLineMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
    const septumDimLine = new THREE.Line(septumDimLineGeometry, septumDimLineMaterial);
    globalScene.add(septumDimLine);
    this.dimensionLines.push(septumDimLine);
    
    // Septum thickness label
    const septumLabelDiv = document.createElement('div');
    septumLabelDiv.style.cssText = `
        color: black; 
        font-size: 12px; 
        background: rgba(255,255,255,0.9); 
        padding: 3px 6px; 
        border: 1px solid black; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    septumLabelDiv.innerHTML = `Septum: ${this.septumThickness.toFixed(3)}m`;
    
    const septumLabel = new CSS2DObject(septumLabelDiv);
    septumLabel.position.set(0.02, bottomY - 0.02, z);
    globalScene.add(septumLabel);
    this.dimensionLabels.push(septumLabel);
    
    // 4. Corner radius dimension line (unchanged)
    const rightCornerCenterX = geometry.rightCornerCenterX || 0;
    const rightCornerCenterY = geometry.rightCornerCenterY || 0;
    const cornerRadius = this.crescentCornerRadius;
    
    const rightCornerEdgeX = rightCornerCenterX + cornerRadius;
    const rightCornerEdgeY = rightCornerCenterY;
    const cornerExtensionDistance = this.cylinderRadius + 0.06;
    
    const cornerDimLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(rightCornerEdgeX, rightCornerEdgeY, z),
        new THREE.Vector3(cornerExtensionDistance, rightCornerEdgeY, z)
    ]);
    const cornerDimLineMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
    const cornerDimLine = new THREE.Line(cornerDimLineGeometry, cornerDimLineMaterial);
    globalScene.add(cornerDimLine);
    this.dimensionLines.push(cornerDimLine);
    
    // Corner radius label
    const cornerLabelDiv = document.createElement('div');
    cornerLabelDiv.style.cssText = `
        color: black; 
        font-size: 12px; 
        background: rgba(255,255,255,0.9); 
        padding: 3px 6px; 
        border: 1px solid black; 
        border-radius: 3px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    cornerLabelDiv.innerHTML = `Corner R: ${this.crescentCornerRadius.toFixed(3)}m`;
    
    const cornerLabel = new CSS2DObject(cornerLabelDiv);
    cornerLabel.position.set(cornerExtensionDistance + 0.01, rightCornerEdgeY, z);
    globalScene.add(cornerLabel);
    this.dimensionLabels.push(cornerLabel);
    
    // Add title label
    this.createCrescentTitleLabel(z);
}

createCrescentTitleLabel(z) {
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
        color: black; 
        font-size: 14px; 
        font-weight: bold;
        background: rgba(255,255,255,0.9); 
        padding: 8px; 
        border: 2px solid black; 
        border-radius: 5px;
        font-family: Arial, sans-serif;
        text-align: center;
    `;
    
    const modeText = this.evenWallThickness ? 'Even Wall' : 'Independent Wall';
    titleDiv.innerHTML = `
        <div>Crescent Lumen Cylinder</div>
        <div style="font-size: 12px; margin-top: 4px;">${modeText}</div>
    `;
    
    const titleLabel = new CSS2DObject(titleDiv);
    titleLabel.position.set(-this.cylinderRadius - 0.08, this.cylinderRadius * 0.8, z);
    globalScene.add(titleLabel);
    this.dimensionLabels.push(titleLabel);
}

clearCrescentPrintElements() {
    // Remove line elements
    this.printModeElements.forEach(element => {
        globalScene.remove(element);
        if (element.geometry) element.geometry.dispose();
        if (element.material) element.material.dispose();
    });
    this.printModeElements = [];
    
    // Remove dimension lines
    this.dimensionLines.forEach(line => {
        globalScene.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
    });
    this.dimensionLines = [];
    
    // Remove CSS2D labels
    this.dimensionLabels.forEach(label => {
        globalScene.remove(label);
        if (label.element && label.element.parentNode) {
            label.element.parentNode.removeChild(label.element);
        }
    });
    this.dimensionLabels = [];
}
}

// Smile System Implementation
class SmileSystem {
   constructor() {
   
    this.cylinderMesh = null;
    this.holeMarkers = [];
    this.polarControls = [];
    
    // Cylinder parameters
    this.cylinderRadius = 0.1; // Will be synced with global controls
    this.cylinderHeight = 0.15;
    this.minimumSeptum = 0.005;
    
    // Semi-circle lumen parameters
    this.semicircleRadius = 0.08; // Start smaller to ensure valid initial state
    this.cornerRadius = 0.01;
    
    // Print mode properties
    this.printModeElements = [];
    this.dimensionLines = [];
    this.dimensionLabels = [];
    
    // Hole parameters
    this.defaultHoleRadius = 0.015;
    this.holes = [];
    this.holeColors = [
    0x00ff00, 0x0088ff, 0xff4444, 0xffaa00, 0xff00ff, 
    0x00ffff, 0xffff00, 0x8844ff, 0x44ff88
];
    
    // Interaction state
    this.isDragging = false;
    this.activeHoleIndex = -1;
    this.dragMode = 'angle';
    
    this.generateInitialHoles(3);
    this.create();
    this.setupSmileInteraction();
    this.updateSemicircleRadiusLimits(); // Ensure proper limits on creation
}
  async captureModelImage(width = 400, height = 400) {
    return await captureCurrentSystemThumbnail();
}
  updateToHighQuality() {
   
    this.updateCylinderGeometry();
}
  // Update hole diameter limits when cylinder diameter changes
updateHoleDiameterLimits() {
    const maxHoleDiameter = this.cylinderRadius * 2;
    
    this.holes.forEach((hole, index) => {
        const diameterSlider = document.querySelector(`#smile-hole-${index}-diameter-range`);
        const diameterInput = document.querySelector(`#smile-hole-${index}-diameter`);
        
        if (diameterSlider) {
            diameterSlider.max = maxHoleDiameter.toFixed(3);
        }
        
        if (diameterInput) {
            diameterInput.max = maxHoleDiameter.toFixed(3);
        }
    });
    
   
}
  // Calculate angle limits for a hole to keep it completely within its quadrant
calculateQuadrantAngleLimits(holeIndex, holeRadius) {
    if (this.holes.length < 2) {
        // If only one hole, it can use the full upper range
        return { minAngle: 0, maxAngle: 180 };
    }
    
    // For two holes: Hole 0 gets 0-90°, Hole 1 gets 90-180°
    let baseMinAngle, baseMaxAngle;
    
    if (holeIndex === 0) {
        baseMinAngle = 0;   // First quadrant: 0-90°
        baseMaxAngle = 90;
    } else if (holeIndex === 1) {
        baseMinAngle = 90;  // Second quadrant: 90-180°
        baseMaxAngle = 180;
    } else {
        // Fallback for additional holes (shouldn't happen in smile profile)
        baseMinAngle = 0;
        baseMaxAngle = 180;
    }
    
    // Calculate how much angle the hole occupies at its current distance
    const distance = this.holes[holeIndex].distance;
    
    if (distance > 0) {
        // Calculate the angular width of the hole at this distance
        // This is the angle subtended by the hole radius at the given distance
        const halfAngleSpan = Math.asin(holeRadius / distance) * (180 / Math.PI);
        
        // Adjust the limits to ensure the ENTIRE hole stays within the quadrant
        const adjustedMinAngle = baseMinAngle + halfAngleSpan;
        const adjustedMaxAngle = baseMaxAngle - halfAngleSpan;
        
        
        
        // Ensure we have a valid range
        if (adjustedMinAngle >= adjustedMaxAngle) {
            console.warn(`Invalid angle range for hole ${holeIndex}, using base range`);
            return { minAngle: baseMinAngle, maxAngle: baseMaxAngle };
        }
        
        return { 
            minAngle: Math.max(baseMinAngle, adjustedMinAngle), 
            maxAngle: Math.min(baseMaxAngle, adjustedMaxAngle) 
        };
    }
    
    return { minAngle: baseMinAngle, maxAngle: baseMaxAngle };
}
  // Validate corner radius to prevent semicircle collapse
validateCornerRadius(newCornerRadius) {
    const R = this.semicircleRadius;
    
    // The corner radius cannot be larger than the semicircle radius
    if (newCornerRadius >= R) {
        return {
            valid: false,
            constrainedValue: Math.max(0.005, R * 0.9), // 90% of semicircle radius
            reason: `Corner radius cannot exceed ${(R * 0.9).toFixed(3)}m (90% of semicircle radius)`
        };
    }
    
    // Additional geometric constraint: ensure corners don't overlap
    // The x-coordinate where corners meet: x = sqrt(R² - 2*R*r)
    // This must be positive for valid geometry
    const discriminant = R * R - 2 * R * newCornerRadius;
    
    if (discriminant <= 0) {
        const maxValidCornerRadius = R / 2; // This ensures discriminant > 0
        return {
            valid: false,
            constrainedValue: Math.max(0.005, maxValidCornerRadius - 0.001), // Small safety margin
            reason: `Corner radius too large - would cause geometric collapse. Maximum: ${maxValidCornerRadius.toFixed(3)}m`
        };
    }
    
    // Minimum practical corner radius
    const minCornerRadius = 0.005; // 5mm minimum
    if (newCornerRadius < minCornerRadius) {
        return {
            valid: false,
            constrainedValue: minCornerRadius,
            reason: `Minimum corner radius is ${minCornerRadius.toFixed(3)}m`
        };
    }
    
    return { valid: true, constrainedValue: newCornerRadius };
}
  // Validate cylinder radius change to prevent hole intersections
validateCylinderRadius(newRadius) {
    const minSeptum = this.minimumSeptum;
    
    // Check if new radius would intersect with any existing holes
    for (let i = 0; i < this.holes.length; i++) {
        const hole = this.holes[i];
        const distanceFromCenter = Math.sqrt(hole.x * hole.x + hole.y * hole.y);
        const requiredRadius = distanceFromCenter + hole.radius + minSeptum;
        
        if (newRadius < requiredRadius) {
            return {
                valid: false,
                constrainedValue: this.cylinderRadius, // Keep current value
                reason: `Would intersect with ${hole.name} - minimum outer diameter: ${(requiredRadius * 2).toFixed(3)}m`
            };
        }
    }
    
    // Check if semicircle would intersect with new outer boundary
    const requiredRadiusForSemicircle = this.semicircleRadius + minSeptum;
    if (newRadius < requiredRadiusForSemicircle) {
        return {
            valid: false,
            constrainedValue: this.cylinderRadius, // Keep current value
            reason: `Would intersect with smile lumen - minimum outer diameter: ${(requiredRadiusForSemicircle * 2).toFixed(3)}m`
        };
    }
    
    // Additional check: ensure minimum practical cylinder size
    const absoluteMinRadius = 0.04; // 8cm minimum diameter
    if (newRadius < absoluteMinRadius) {
        return {
            valid: false,
            constrainedValue: absoluteMinRadius,
            reason: `Minimum outer diameter is ${(absoluteMinRadius * 2).toFixed(3)}m`
        };
    }
    
    return { valid: true, constrainedValue: newRadius };
}
  // Update hole position limits when semicircle or cylinder parameters change
// Update hole position limits in UI only (don't move holes automatically)
updateHolePositionLimitsUI() {
    this.holes.forEach((hole, index) => {
        // First update the limits, then check validity
        this.updateSingleHoleDistanceLimits(index);
        
        // Now check against the UPDATED limits
        const distanceSlider = document.querySelector(`#smile-hole-${index}-distance-range`);
        const distanceInput = document.querySelector(`#smile-hole-${index}-distance`);
        
        if (distanceSlider && distanceInput) {
            const minDistance = parseFloat(distanceSlider.min);
            const maxDistance = parseFloat(distanceSlider.max);
            
            // Check if hole is within the UPDATED valid range
            const isValid = hole.distance >= minDistance && hole.distance <= maxDistance;
            
            // Update background colors based on current validity
            if (isValid) {
                distanceSlider.style.backgroundColor = ''; // Reset to default
                distanceInput.style.backgroundColor = ''; // Reset to default
            } else {
                distanceSlider.style.backgroundColor = '#ffcccc'; // Light red
                distanceInput.style.backgroundColor = '#ffcccc'; // Light red
            }
        }
    });
}

// Add a separate method to check if holes are in valid positions
areAllHolesInValidPositions() {
    for (let i = 0; i < this.holes.length; i++) {
        const hole = this.holes[i];
        if (!this.isValidPosition(hole.x, hole.y, hole.radius, i)) {
            return false;
        }
    }
    return true;
}

// Method to get information about invalid hole positions
getInvalidHoleInfo() {
    const invalidHoles = [];
    
    this.holes.forEach((hole, index) => {
        if (!this.isValidPosition(hole.x, hole.y, hole.radius, index)) {
            const distanceFromCenter = Math.sqrt(hole.x * hole.x + hole.y * hole.y);
            const maxAllowedDistance = this.cylinderRadius - hole.radius - this.minimumSeptum;
            const minAllowedDistance = this.semicircleRadius + hole.radius + this.minimumSeptum;
            
            let reason = '';
            if (distanceFromCenter > maxAllowedDistance) {
                reason = 'too close to outer wall';
            } else if (distanceFromCenter < minAllowedDistance) {
                reason = 'too close to smile lumen';
            } else {
                reason = 'intersects with another hole';
            }
            
            invalidHoles.push({
                name: hole.name,
                index: index,
                reason: reason
            });
        }
    });
    
    return invalidHoles;
}
    // Calculate maximum semicircle radius to maintain minimum septum
calculateMaxSemicircleRadius() {
    return this.cylinderRadius - this.minimumSeptum;
}

// Calculate minimum semicircle radius based on current hole positions
calculateMinSemicircleRadius() {
    let minRequired = 0.02; // Absolute minimum (4cm radius)
    
    // Check each hole to see what semicircle radius they require
    this.holes.forEach(hole => {
        const holeBottomEdge = hole.y - hole.radius;
        
        // Only check holes whose bottom edge is at or below the semicircle area
        if (holeBottomEdge <= this.minimumSeptum) { // Allow some tolerance above y=0
            const requiredRadius = hole.distance - hole.radius - this.minimumSeptum;
            minRequired = Math.max(minRequired, Math.max(0, requiredRadius));
        }
    });
    
    return minRequired;
}

// Update semicircle radius limits in UI
updateSemicircleRadiusLimits() {
    const semicircleRadiusSlider = document.getElementById('semicircle-radius');
    const semicircleRadiusInput = document.getElementById('semicircle-radius-input');
    
    if (semicircleRadiusSlider && semicircleRadiusInput) {
        const maxRadius = this.calculateMaxSemicircleRadius();
        const minRadius = this.calculateMinSemicircleRadius();
        
        // Update max constraint
        semicircleRadiusSlider.max = maxRadius.toFixed(3);
        semicircleRadiusInput.max = maxRadius.toFixed(3);
        
        // Update min constraint
        semicircleRadiusSlider.min = minRadius.toFixed(3);
        semicircleRadiusInput.min = minRadius.toFixed(3);
        
        // If current radius exceeds new maximum, clamp it
        if (this.semicircleRadius > maxRadius) {
            this.semicircleRadius = maxRadius;
            semicircleRadiusSlider.value = maxRadius.toFixed(3);
            semicircleRadiusInput.value = maxRadius.toFixed(3);
            this.updateCylinderGeometry();
            
           
        }
        
        // If current radius is below new minimum, increase it
        if (this.semicircleRadius < minRadius) {
            this.semicircleRadius = minRadius;
            semicircleRadiusSlider.value = minRadius.toFixed(3);
            semicircleRadiusInput.value = minRadius.toFixed(3);
            this.updateCylinderGeometry();
            
            
        }
        
        
    }
}

// Validate semicircle radius change
// Validate semicircle radius change (updated to prevent hole intersections)
validateSemicircleRadius(newRadius) {
    const maxRadius = this.calculateMaxSemicircleRadius();
    
    if (newRadius > maxRadius) {
        return {
            valid: false,
            constrainedValue: this.semicircleRadius, // Keep current value
            reason: `Maximum radius is ${maxRadius.toFixed(3)}m (maintains ${this.minimumSeptum.toFixed(3)}m septum from outer wall)`
        };
    }
    
    // Only check holes that could actually interfere with the semicircle
    // The semicircle is in the bottom half (y <= 0), so only check holes that:
    // 1. Are in the bottom half, OR
    // 2. Are close enough to the bottom that their radius extends into the semicircle area
    for (let i = 0; i < this.holes.length; i++) {
        const hole = this.holes[i];
        const holeBottomEdge = hole.y - hole.radius;
        
        // Only check holes whose bottom edge is at or below y=0 (where semicircle exists)
        // AND whose distance from center could conflict with the semicircle
        if (holeBottomEdge <= this.minimumSeptum) { // Allow some tolerance above y=0
            const requiredMinDistance = newRadius + hole.radius + this.minimumSeptum;
            
            if (hole.distance < requiredMinDistance) {
                const maxAllowedRadius = hole.distance - hole.radius - this.minimumSeptum;
                return {
                    valid: false,
                    constrainedValue: this.semicircleRadius, // Keep current value
                    reason: `Would intersect with ${hole.name} (in lower area) - maximum radius: ${Math.max(0, maxAllowedRadius).toFixed(3)}m`
                };
            }
        }
    }
    
    // Additional check: ensure minimum practical semicircle size
    const absoluteMinRadius = 0.02; // 4cm minimum radius
    if (newRadius < absoluteMinRadius) {
        return {
            valid: false,
            constrainedValue: Math.max(absoluteMinRadius, this.semicircleRadius),
            reason: `Minimum semicircle radius is ${absoluteMinRadius.toFixed(3)}m`
        };
    }
    
    return { valid: true, constrainedValue: newRadius };
}

// Show warning message to user
showSmileWarning(message) {
    const warning = document.createElement('div');
    warning.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
        font-family: Arial;
        font-size: 12px;
        max-width: 300px;
    `;
    warning.textContent = message;
    document.body.appendChild(warning);
    setTimeout(() => warning.remove(), 3000);
}
    generateInitialHoles(totalCount) {
    this.holes = [];
    
    // For smile profile:
    // totalCount 2 = 1 semicircle + 1 circular hole
    // totalCount 3 = 1 semicircle + 2 circular holes
    const circularHoleCount = totalCount - 1; // Subtract 1 for the semicircle
    
    
    
const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
   let colorIndex = 0; // Start with the first color for circular holes
   
   for (let i = 0; i < circularHoleCount; i++) {
       let angle;
       if (circularHoleCount === 1) {
           angle = 90; // Single hole at top center
       } else if (circularHoleCount === 2) {
           // Two holes symmetrically placed
           angle = 60 + (i * 60); // 60° and 120° (upper area)
       }
       
       const distance = this.calculateOptimalDistance();
       const { x, y } = this.polarToCartesian(angle, distance);
       
       this.holes.push({
           x: x,
           y: y,
           angle: angle,
           distance: distance,
           radius: this.defaultHoleRadius,
           color: this.holeColors[colorIndex + i], // Use colorIndex methodology
           name: `${colors[colorIndex + i]} Lumen` // Use same naming convention
       });
   }
}
    
   calculateOptimalDistance() {
    const maxDistance = this.cylinderRadius - this.defaultHoleRadius - this.minimumSeptum;
    const minDistance = this.semicircleRadius + this.defaultHoleRadius + this.minimumSeptum;
    
    // FIXED: Ensure we return a valid distance
    if (minDistance >= maxDistance) {
        console.warn('Optimal distance calculation: min >= max, using safe fallback');
        return Math.max(0.030, this.cylinderRadius * 0.6);
    }
    
    return (minDistance + maxDistance) / 2;
}
    
    create() {
       
        this.updateCylinderGeometry();
        this.createHoleMarkers();
        this.createPolarControls();
        this.createSmileHoleUI();
    }
    
    createSemiCircleShape() {
        const shape = new THREE.Shape();
        const R = this.semicircleRadius;
        const r = this.cornerRadius;
        
        const x = Math.sqrt(R * R - 2 * R * r);
        const a = Math.atan2(r, x);
        
        shape.moveTo(-x, 0);
        shape.lineTo(x, 0);
        shape.absarc(x, -r, r, Math.PI/2, -a, true);
        shape.absarc(0, 0, R, -a, -(Math.PI - a), true);
        shape.absarc(-x, -r, r, -(Math.PI - a), Math.PI/2, true);
        
        return shape;
    }
    
    updateCylinderGeometry() {
        if (this.cylinderMesh) {
            globalScene.remove(this.cylinderMesh);
            if (this.cylinderMesh.geometry) this.cylinderMesh.geometry.dispose();
            if (this.cylinderMesh.material) this.cylinderMesh.material.dispose();
        }
        
        // Create main cylinder shape
        const cylinderShape = new THREE.Shape();
        cylinderShape.absarc(0, 0, this.cylinderRadius, 0, Math.PI * 2, false);
        
        // Add semi-circle hole at bottom
        const semicircleHole = this.createSemiCircleShape();
        cylinderShape.holes.push(semicircleHole);
        
        // Add circular holes at top
        this.holes.forEach(hole => {
            const holePath = new THREE.Path();
            holePath.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
            cylinderShape.holes.push(holePath);
        });
        
        const extrudeSettings = {
            depth: this.cylinderHeight,
            bevelEnabled: false,
            steps: 1,
            curveSegments: getCurrentCurveSegments()
        };
        
        try {
            const geometry = new THREE.ExtrudeGeometry(cylinderShape, extrudeSettings);
            geometry.center();
            
           const material = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    metalness: 0.1,      // Same as the example
    roughness: 0.4,      // Low roughness for shiny appearance
    transparent: false,
    opacity: 1
});
            
            this.cylinderMesh = new THREE.Mesh(geometry, material);
            this.cylinderMesh.castShadow = true;
            this.cylinderMesh.receiveShadow = true;
            this.cylinderMesh.userData = { type: 'smileCylinder' };
            globalScene.add(this.cylinderMesh);
            
            
        } catch (error) {
            console.error('Error creating smile geometry:', error);
        }
       this.updateAllHoleDistanceLimits();
    }
    
    createHoleMarkers() {
        // Clean up existing markers
        this.holeMarkers.forEach(marker => {
            globalScene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });
        this.holeMarkers = [];
        
        // Create new markers
        this.holes.forEach((hole, index) => {
            const geometry = new THREE.CircleGeometry(hole.radius, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: hole.color,
                transparent: true, 
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            marker.userData.holeIndex = index;
            
            this.holeMarkers.push(marker);
            globalScene.add(marker);
        });
    }
    
    createPolarControls() {
        // Clean up existing controls
        this.polarControls.forEach(control => {
            globalScene.remove(control);
            if (control.geometry) control.geometry.dispose();
            if (control.material) control.material.dispose();
        });
        this.polarControls = [];
        
        // Create new controls
        this.holes.forEach((hole, index) => {
            const controlGeometry = new THREE.SphereGeometry(0.008, 16, 16);
            const controlMaterial = new THREE.MeshBasicMaterial({ 
                color: hole.color,
                transparent: true,
                opacity: 0.8
            });
            
            const controlSphere = new THREE.Mesh(controlGeometry, controlMaterial);
            controlSphere.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            controlSphere.userData = { 
                holeIndex: index, 
                type: 'smileControl'
            };
            
            this.polarControls.push(controlSphere);
            globalScene.add(controlSphere);
        });
    }
    
   setupSmileInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isShiftPressed = false;
    let isControlPressed = false;
    let isAltPressed = false;
    let initialAngle = 0;
    let initialDistance = 0;
    let initialRadius = 0;
    let initialMousePosition = new THREE.Vector2();
    
    const onKeyDown = (event) => {
        if (event.key === 'Shift') isShiftPressed = true;
        else if (event.key === 'Control' || event.key === 'Meta') {
            isControlPressed = true;
            event.preventDefault();
        }
        else if (event.key === 'Alt') {
            isAltPressed = true;
            event.preventDefault();
        }
    };
    
    const onKeyUp = (event) => {
        if (event.key === 'Shift') isShiftPressed = false;
        else if (event.key === 'Control' || event.key === 'Meta') isControlPressed = false;
        else if (event.key === 'Alt') isAltPressed = false;
    };
    
    const onMouseDown = (event) => {
        const rect = globalRenderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, globalCamera);
        const intersects = raycaster.intersectObjects(this.polarControls);
        
        if (intersects.length > 0) {
          startInteraction();
            this.isDragging = true;
            this.activeHoleIndex = intersects[0].object.userData.holeIndex;
            globalControls.enabled = false;
            
            const hole = this.holes[this.activeHoleIndex];
            initialAngle = hole.angle;
            initialDistance = hole.distance;
            initialRadius = hole.radius;
            initialMousePosition.copy(mouse);
            
            // Determine drag mode based on keys
            if (isControlPressed) {
                this.dragMode = 'diameter';
            } else if (isShiftPressed) {
                this.dragMode = 'distance';
            } else {
                this.dragMode = 'angle';
            }
            
           
            
            // Highlight active control
            this.polarControls[this.activeHoleIndex].material.opacity = 1.0;
        }
    };
    
    const onMouseMove = (event) => {
        if (!this.isDragging || this.activeHoleIndex === -1) return;
        // Auto-exit print mode on first interaction
   autoExitPrintMode();
        // Update drag mode dynamically
        let currentDragMode;
        if (isControlPressed) {
            currentDragMode = 'diameter';
        } else if (isShiftPressed) {
            currentDragMode = 'distance';
        } else {
            currentDragMode = 'angle';
        }
        
        if (currentDragMode !== this.dragMode) {
            this.dragMode = currentDragMode;
           
        }
        
        const rect = globalRenderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, globalCamera);
        
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.cylinderHeight / 2);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);
        
        if (this.dragMode === 'diameter') {
            // Change hole diameter
            if (isAltPressed) {
                // Apply to all holes
                const mouseDelta = mouse.distanceTo(initialMousePosition);
                const radiusChange = mouseDelta * 0.05; // Sensitivity factor
                const newRadius = Math.max(0.005, initialRadius + radiusChange);
                
                this.holes.forEach((hole, index) => {
                    const constrainedRadius = Math.min(newRadius, this.cylinderRadius);
                    if (this.isValidPosition(hole.x, hole.y, constrainedRadius, index)) {
                        hole.radius = constrainedRadius;
                        this.updateSingleHole(index);
                    }
                });
            } else {
                // Apply to active hole only
                const hole = this.holes[this.activeHoleIndex];
                const distanceFromHole = Math.sqrt(
                    (intersectPoint.x - hole.x) * (intersectPoint.x - hole.x) + 
                    (intersectPoint.y - hole.y) * (intersectPoint.y - hole.y)
                );
                const newRadius = Math.max(0.005, Math.min(distanceFromHole, this.cylinderRadius));
                
                if (this.isValidPosition(hole.x, hole.y, newRadius, this.activeHoleIndex)) {
                    hole.radius = newRadius;
                    this.updateSingleHole(this.activeHoleIndex);
                }
            }
            
        } else if (this.dragMode === 'distance') {
            // Change distance from center
            const newDistance = Math.sqrt(intersectPoint.x * intersectPoint.x + intersectPoint.y * intersectPoint.y);
            
            if (isAltPressed) {
                // Apply to all holes
                this.holes.forEach((hole, index) => {
                    const { x, y } = this.polarToCartesian(hole.angle, newDistance);
                    if (this.isValidPosition(x, y, hole.radius, index)) {
                        hole.distance = newDistance;
                        hole.x = x;
                        hole.y = y;
                        this.updateSingleHole(index);
                    }
                });
            } else {
                // Apply to active hole only
                const hole = this.holes[this.activeHoleIndex];
                const { x, y } = this.polarToCartesian(hole.angle, newDistance);
                if (this.isValidPosition(x, y, hole.radius, this.activeHoleIndex)) {
                    hole.distance = newDistance;
                    hole.x = x;
                    hole.y = y;
                    this.updateSingleHole(this.activeHoleIndex);
                }
            }
            
        } else {
            // Change angle around center
            const hole = this.holes[this.activeHoleIndex];
            const { angle } = this.cartesianToPolar(intersectPoint.x, intersectPoint.y);
            const { x, y } = this.polarToCartesian(angle, hole.distance);
            
            if (this.isValidPosition(x, y, hole.radius, this.activeHoleIndex)) {
                hole.angle = angle;
                hole.x = x;
                hole.y = y;
                this.updateSingleHole(this.activeHoleIndex);
            }
        }
    };
    
    const onMouseUp = () => {
        if (this.isDragging && this.activeHoleIndex !== -1) {
          
            // Reset control opacity
            this.polarControls[this.activeHoleIndex].material.opacity = 0.8;
        }
        endInteraction();
        this.isDragging = false;
        this.activeHoleIndex = -1;
        globalControls.enabled = true;
    };
    
    // Add event listeners
    globalRenderer.domElement.addEventListener('mousedown', onMouseDown);
    globalRenderer.domElement.addEventListener('mousemove', onMouseMove);
    globalRenderer.domElement.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Store references for cleanup
    this.interactionEvents = { onMouseDown, onMouseMove, onMouseUp, onKeyDown, onKeyUp };
}
    
  updateSingleHole(holeIndex) {
    const hole = this.holes[holeIndex];
    
    // Update hole marker
    const marker = this.holeMarkers[holeIndex];
    if (marker) {
        marker.geometry.dispose();
        marker.geometry = new THREE.CircleGeometry(hole.radius, 32);
        marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
    }
    
    // Update control sphere
    const control = this.polarControls[holeIndex];
    if (control) {
        control.position.set(hole.x, hole.y, this.cylinderHeight / 2);
    }
    
    this.updateCylinderGeometry();
    this.updateHoleUI(holeIndex); // Make sure this line is here
}
    
 isValidPosition(x, y, radius, holeIndex) {
    const distanceFromCenter = Math.sqrt(x * x + y * y);
    const maxDistance = this.cylinderRadius - radius - this.minimumSeptum;
    
   
    
    // Check cylinder boundary
    if (distanceFromCenter > maxDistance) {
       
        return false;
    }
    
    // Check semicircle interference - only if hole's bottom edge would be in semicircle area
    const holeBottomEdge = y - radius;
    const minDistanceFromSemicircle = this.semicircleRadius + radius + this.minimumSeptum;
    
  
    
    if (holeBottomEdge <= this.minimumSeptum) {
        if (distanceFromCenter < minDistanceFromSemicircle) {
           
            return false;
        }
    }
    
    // NEW: Check quadrant constraints for multiple holes
    if (this.holes.length >= 2) {
        const angle = Math.atan2(y, x) * (180 / Math.PI);
        const normalizedAngle = angle < 0 ? angle + 360 : angle;
        
        const quadrantLimits = this.calculateQuadrantAngleLimits(holeIndex, radius);
        
      
        
        if (normalizedAngle < quadrantLimits.minAngle || normalizedAngle > quadrantLimits.maxAngle) {
            
            return false;
        }
    }
    
    // Check separation from other holes
    for (let i = 0; i < this.holes.length; i++) {
        if (i === holeIndex) continue;
        
        const otherHole = this.holes[i];
        const dx = x - otherHole.x;
        const dy = y - otherHole.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minRequiredDistance = radius + otherHole.radius + this.minimumSeptum;
        
        if (distance < minRequiredDistance) {
            
            return false;
        }
    }
    
   
    return true;
}
    
    calculateMinAllowedAngle(holeDistanceFromCenter, holeRadius) {
        const totalClearance = holeRadius + this.minimumSeptum;
        
        if (holeDistanceFromCenter > totalClearance) {
            const minAngleRad = Math.asin(totalClearance / holeDistanceFromCenter);
            return minAngleRad * 180 / Math.PI;
        } else {
            return 90;
        }
    }
    
    polarToCartesian(angle, distance) {
        const angleRad = angle * Math.PI / 180;
        const x = Math.cos(angleRad) * distance;
        const y = Math.sin(angleRad) * distance;
        return { x, y };
    }
    
    cartesianToPolar(x, y) {
        const distance = Math.sqrt(x * x + y * y);
        let angle = Math.atan2(y, x);
        angle = (angle * 180 / Math.PI + 360) % 360;
        return { angle, distance };
    }
    
 createSmileHoleUI() {
    const container = document.getElementById('smile-hole-controls');
    if (!container) {
        console.error('❌ smile-hole-controls container not found!');
        return;
    }
    
    
    container.innerHTML = '';
    
    this.holes.forEach((hole, index) => {
        const div = document.createElement('div');
        div.className = 'hole-control-item';
        
        // Calculate distance constraints
        const cylinderInnerEdge = this.cylinderRadius - this.minimumSeptum;
        const semicircleOuterEdge = this.semicircleRadius + this.minimumSeptum;
        const holeRadius = hole.radius;
        
        const maxDistance = cylinderInnerEdge - holeRadius;
        let minDistance = holeRadius + this.minimumSeptum;
        
        if (hole.y <= this.minimumSeptum) {
            minDistance = Math.max(minDistance, semicircleOuterEdge + holeRadius);
        }
        
        if (minDistance >= maxDistance) {
            console.error(`❌ Invalid range for hole ${index}: min=${minDistance.toFixed(3)} >= max=${maxDistance.toFixed(3)}`);
            minDistance = Math.max(0.020, maxDistance - 0.020);
        }
        
        let useDistance = Math.max(minDistance, Math.min(maxDistance, hole.distance));
        
        // Calculate angle constraints for quadrants
        const quadrantLimits = this.calculateQuadrantAngleLimits(index, holeRadius);
        const minAngle = quadrantLimits.minAngle;
        const maxAngle = quadrantLimits.maxAngle;
        
        // Clamp hole angle to quadrant if needed
        let useAngle = hole.angle;
        if (this.holes.length >= 2) {
            useAngle = Math.max(minAngle, Math.min(maxAngle, hole.angle));
            if (Math.abs(useAngle - hole.angle) > 0.1) {
               
            }
        }
        
        // NEW: Set max diameter based on outer diameter
        const maxHoleDiameter = this.cylinderRadius * 2; // Use full outer diameter
        
        div.innerHTML = `
            <p class="hole-title">${hole.name}</p>
            <div class="input-group">
                <label>Diameter:</label>
                <input type="range" class="range-slider" id="smile-hole-${index}-diameter-range" min="0.005" max="${maxHoleDiameter.toFixed(3)}" value="${(hole.radius * 2).toFixed(4)}" step="0.001">
                <input type="number" id="smile-hole-${index}-diameter" min="0.005" max="${maxHoleDiameter.toFixed(3)}" value="${(hole.radius * 2).toFixed(4)}" step="0.001">
            </div>
            <div class="input-group">
                <label>Angle:</label>
                <input type="range" class="range-slider" id="smile-hole-${index}-angle-range" min="${minAngle}" max="${maxAngle}" value="${Math.round(useAngle)}" step="1">
                <input type="number" id="smile-hole-${index}-angle" min="${minAngle}" max="${maxAngle}" value="${Math.round(useAngle)}" step="1">
            </div>
            <div class="input-group">
                <label>Distance:</label>
                <input type="range" class="range-slider" id="smile-hole-${index}-distance-range" min="${minDistance.toFixed(3)}" max="${maxDistance.toFixed(3)}" value="${useDistance.toFixed(4)}" step="0.001">
                <input type="number" id="smile-hole-${index}-distance" min="${minDistance.toFixed(3)}" max="${maxDistance.toFixed(3)}" value="${useDistance.toFixed(4)}" step="0.001">
            </div>
        `;
        
        container.appendChild(div);
        
        // Update hole position if we had to adjust angle or distance
        if (Math.abs(useDistance - hole.distance) > 0.001 || Math.abs(useAngle - hole.angle) > 0.1) {
            const { x, y } = this.polarToCartesian(useAngle, useDistance);
            hole.distance = useDistance;
            hole.angle = useAngle;
            hole.x = x;
            hole.y = y;
            this.updateSingleHole(index);
        }
        
        setTimeout(() => {
            this.setupSmileHoleControlListeners(index);
        }, 10);
    });
}
    
updateHoleUI(holeIndex) {
    const hole = this.holes[holeIndex];
    
    
    
    // Update diameter controls
    const diameterSlider = document.querySelector(`#smile-hole-${holeIndex}-diameter-range`);
    const diameterInput = document.querySelector(`#smile-hole-${holeIndex}-diameter`);
    if (diameterSlider) diameterSlider.value = (hole.radius * 2).toFixed(4);
    if (diameterInput) diameterInput.value = (hole.radius * 2).toFixed(4);
    
    // Update angle controls
    const angleSlider = document.querySelector(`#smile-hole-${holeIndex}-angle-range`);
    const angleInput = document.querySelector(`#smile-hole-${holeIndex}-angle`);
    if (angleSlider) angleSlider.value = Math.round(hole.angle);
    if (angleInput) angleInput.value = Math.round(hole.angle);
    
    // Update distance controls with validation
    const distanceSlider = document.querySelector(`#smile-hole-${holeIndex}-distance-range`);
    const distanceInput = document.querySelector(`#smile-hole-${holeIndex}-distance`);
    
    if (distanceSlider) {
        const sliderMin = parseFloat(distanceSlider.min);
        const sliderMax = parseFloat(distanceSlider.max);
        
        
        
        // Ensure the hole distance is within slider bounds
        if (hole.distance >= sliderMin && hole.distance <= sliderMax) {
            distanceSlider.value = hole.distance.toFixed(4);
           
        } else {
            
            this.updateSingleHoleDistanceLimits(holeIndex);
            distanceSlider.value = hole.distance.toFixed(4);
        }
    }
    
    if (distanceInput) distanceInput.value = hole.distance.toFixed(4);
}
    
    regenerateHoles(totalCount) {
   
    this.generateInitialHoles(totalCount);
    this.createHoleMarkers();
    this.createPolarControls();
    this.updateCylinderGeometry();
    this.createSmileHoleUI();
}
    // Update distance limits for a single hole
// Update distance limits for a single hole
updateSingleHoleDistanceLimits(holeIndex) {
    const hole = this.holes[holeIndex];
    
    // Use the same logic as createSmileHoleUI
    const cylinderInnerEdge = this.cylinderRadius - this.minimumSeptum;
    const semicircleOuterEdge = this.semicircleRadius + this.minimumSeptum;
    const holeRadius = hole.radius;
    
    const maxDistance = cylinderInnerEdge - holeRadius;
    
    let minDistance = holeRadius + this.minimumSeptum;
    if (hole.y <= this.minimumSeptum) {
        minDistance = Math.max(minDistance, semicircleOuterEdge + holeRadius);
    }
    
    // Ensure valid range
    if (minDistance >= maxDistance) {
        console.warn(`Invalid range for hole ${holeIndex}, adjusting`);
        minDistance = Math.max(0.020, maxDistance - 0.020);
    }
    
    const distanceSlider = document.querySelector(`#smile-hole-${holeIndex}-distance-range`);
    const distanceInput = document.querySelector(`#smile-hole-${holeIndex}-distance`);
    
    
    
    if (distanceSlider) {
        // IMPORTANT: Store the current value BEFORE changing min/max
        const currentSliderValue = parseFloat(distanceSlider.value);
        const currentHoleDistance = hole.distance;
        
        
        
        // Update min/max
        distanceSlider.min = minDistance.toFixed(3);
        distanceSlider.max = maxDistance.toFixed(3);
        
        // Determine what the slider value should be
        let targetValue = currentHoleDistance;
        
        // Only clamp if the hole distance is actually outside the valid range
        if (currentHoleDistance < minDistance || currentHoleDistance > maxDistance) {
            targetValue = Math.max(minDistance, Math.min(maxDistance, currentHoleDistance));
           
            
            // Update the hole position
            const { x, y } = this.polarToCartesian(hole.angle, targetValue);
            hole.distance = targetValue;
            hole.x = x;
            hole.y = y;
        }
        
        // EXPLICITLY set the slider value to match the hole distance
        distanceSlider.value = targetValue.toFixed(4);
        
        
    }
    
    if (distanceInput) {
        distanceInput.min = minDistance.toFixed(3);
        distanceInput.max = maxDistance.toFixed(3);
        // Also update the input value to match
        distanceInput.value = hole.distance.toFixed(4);
    }
}
  // Update distance limits for all holes when semicircle or cylinder parameters change
updateAllHoleDistanceLimits() {
    
    
    this.holes.forEach((hole, index) => {
        
        
        // This method now handles everything including value setting
        this.updateSingleHoleDistanceLimits(index);
        
        // Force a geometry update if the hole position changed
        const distanceSlider = document.querySelector(`#smile-hole-${index}-distance-range`);
        if (distanceSlider) {
            const sliderValue = parseFloat(distanceSlider.value);
            const holeDistance = hole.distance;
            
            if (Math.abs(sliderValue - holeDistance) > 0.001) {
                
                this.updateSingleHole(index);
            }
        }
    });
    
   
}
  // Update corner radius limits when semicircle radius changes
updateCornerRadiusLimits() {
    const smileCornerSlider = document.getElementById('smile-corner-radius');
    const smileCornerInput = document.getElementById('smile-corner-radius-input');
    
    if (smileCornerSlider && smileCornerInput) {
        const maxCornerRadius = this.semicircleRadius * 0.45; // Conservative limit
        
        smileCornerSlider.max = maxCornerRadius.toFixed(4);
        smileCornerInput.max = maxCornerRadius.toFixed(4);
        
        // If current corner radius exceeds new maximum, clamp it
        if (this.cornerRadius > maxCornerRadius) {
            this.cornerRadius = maxCornerRadius;
            smileCornerSlider.value = maxCornerRadius.toFixed(4);
            smileCornerInput.value = maxCornerRadius.toFixed(4);
            this.updateCylinderGeometry();
            
           
        }
    }
}
createSmileHoleUI() {
    const container = document.getElementById('smile-hole-controls');
    if (!container) {
        console.error('❌ smile-hole-controls container not found!');
        return;
    }
    
   
    container.innerHTML = '';
    
    this.holes.forEach((hole, index) => {
        const div = document.createElement('div');
        div.className = 'hole-control-item';
        
        // FIXED: Calculate constraints properly
        const cylinderInnerEdge = this.cylinderRadius - this.minimumSeptum; // Space from cylinder wall
        const semicircleOuterEdge = this.semicircleRadius + this.minimumSeptum; // Space from semicircle
        const holeRadius = hole.radius;
        
        // Maximum distance = how far from center before hole hits cylinder wall
        const maxDistance = cylinderInnerEdge - holeRadius;
        
        // Minimum distance = how far from center to avoid semicircle
        // Only apply this constraint if the hole is in the lower half (y < septum tolerance)
        let minDistance = holeRadius + this.minimumSeptum; // Basic minimum
        
        if (hole.y <= this.minimumSeptum) {
            // Hole is in lower area where semicircle exists
            minDistance = Math.max(minDistance, semicircleOuterEdge + holeRadius);
        }
        
       
        
        // Ensure we have a valid range
        if (minDistance >= maxDistance) {
            console.error(`❌ Invalid range for hole ${index}: min=${minDistance.toFixed(3)} >= max=${maxDistance.toFixed(3)}`);
            // Adjust semicircle or hole size to make it work
            minDistance = Math.max(0.020, maxDistance - 0.020);
        }
        
        // Clamp hole distance to valid range
        let useDistance = Math.max(minDistance, Math.min(maxDistance, hole.distance));
        
        div.innerHTML = `
            <p class="hole-title">${hole.name}</p>
            <div class="input-group">
                <label>Diameter:</label>
                <input type="range" class="range-slider" id="smile-hole-${index}-diameter-range" min="0.005" max="0.06" value="${(hole.radius * 2).toFixed(4)}" step="0.001">
                <input type="number" id="smile-hole-${index}-diameter" min="0.005" max="0.06" value="${(hole.radius * 2).toFixed(4)}" step="0.001">
            </div>
            <div class="input-group">
                <label>Angle:</label>
                <input type="range" class="range-slider" id="smile-hole-${index}-angle-range" min="0" max="360" value="${Math.round(hole.angle)}" step="1">
                <input type="number" id="smile-hole-${index}-angle" min="0" max="360" value="${Math.round(hole.angle)}" step="1">
            </div>
            <div class="input-group">
                <label>Distance:</label>
                <input type="range" class="range-slider" id="smile-hole-${index}-distance-range" min="${minDistance.toFixed(3)}" max="${maxDistance.toFixed(3)}" value="${useDistance.toFixed(4)}" step="0.001">
                <input type="number" id="smile-hole-${index}-distance" min="${minDistance.toFixed(3)}" max="${maxDistance.toFixed(3)}" value="${useDistance.toFixed(4)}" step="0.001">
            </div>
        `;
        
        container.appendChild(div);
        
        // Update hole position if we had to clamp it
        if (Math.abs(useDistance - hole.distance) > 0.001) {
            
            const { x, y } = this.polarToCartesian(hole.angle, useDistance);
            hole.distance = useDistance;
            hole.x = x;
            hole.y = y;
            this.updateSingleHole(index);
        }
        
        setTimeout(() => {
            this.setupSmileHoleControlListeners(index);
        }, 10);
    });
}
    
    setupSmileHoleControlListeners(index) {
        const hole = this.holes[index];
        
        // Diameter controls
        const diameterSlider = document.getElementById(`smile-hole-${index}-diameter-range`);
        const diameterInput = document.getElementById(`smile-hole-${index}-diameter`);
       diameterSlider?.addEventListener('mousedown', startInteraction); 
      diameterSlider?.addEventListener('mouseup', endInteraction);
    diameterSlider?.addEventListener('change', endInteraction);
        diameterSlider?.addEventListener('input', (e) => {
          startInteraction();
          autoExitPrintMode();
            const newDiameter = parseFloat(e.target.value);
            const newRadius = newDiameter / 2;
            if (this.isValidPosition(hole.x, hole.y, newRadius, index)) {
                hole.radius = newRadius;
                diameterInput.value = newDiameter.toFixed(4);
                this.updateSingleHole(index);
            }
        });
        
        diameterInput?.addEventListener('input', (e) => {
           autoExitPrintMode();
            const newDiameter = parseFloat(e.target.value);
            if (!isNaN(newDiameter)) {
                const newRadius = newDiameter / 2;
                if (this.isValidPosition(hole.x, hole.y, newRadius, index)) {
                    hole.radius = newRadius;
                    diameterSlider.value = newDiameter;
                    this.updateSingleHole(index);
                }
            }
        });
        
        // Angle controls
        const angleSlider = document.getElementById(`smile-hole-${index}-angle-range`);
        const angleInput = document.getElementById(`smile-hole-${index}-angle`);
        angleSlider?.addEventListener('mousedown', startInteraction);
      angleSlider?.addEventListener('mouseup', endInteraction);
    angleSlider?.addEventListener('change', endInteraction);
        angleSlider?.addEventListener('input', (e) => {
          startInteraction();
          autoExitPrintMode();
            const newAngle = parseFloat(e.target.value);
            const { x, y } = this.polarToCartesian(newAngle, hole.distance);
            if (this.isValidPosition(x, y, hole.radius, index)) {
                hole.angle = newAngle;
                hole.x = x;
                hole.y = y;
                angleInput.value = Math.round(newAngle);
                this.updateSingleHole(index);
            }
        });
        
        angleInput?.addEventListener('input', (e) => {
         autoExitPrintMode();
            const newAngle = parseFloat(e.target.value);
            if (!isNaN(newAngle)) {
                const { x, y } = this.polarToCartesian(newAngle, hole.distance);
                if (this.isValidPosition(x, y, hole.radius, index)) {
                    hole.angle = newAngle;
                    hole.x = x;
                    hole.y = y;
                    angleSlider.value = newAngle;
                    this.updateSingleHole(index);
                }
            }
        });
        
// Distance controls - DEBUG VERSION
const distanceSlider = document.getElementById(`smile-hole-${index}-distance-range`);
const distanceInput = document.getElementById(`smile-hole-${index}-distance`);

distanceSlider?.addEventListener('mousedown', startInteraction);
distanceSlider?.addEventListener('mouseup', endInteraction);
    distanceSlider?.addEventListener('change', endInteraction);      
if (distanceSlider) {
   
    
    distanceSlider.addEventListener('input', (e) => {
        startInteraction();
        autoExitPrintMode();
        const newDistance = parseFloat(e.target.value);
        
        const { x, y } = this.polarToCartesian(hole.angle, newDistance);
        
        if (this.isValidPosition(x, y, hole.radius, index)) {
            
            hole.distance = newDistance;
            hole.x = x;
            hole.y = y;
            if (distanceInput) distanceInput.value = newDistance.toFixed(4);
            this.updateSingleHole(index);
        } else {
            
            e.target.value = hole.distance.toFixed(4);
        }
    });
    
    // Also add a change event listener as backup
    distanceSlider.addEventListener('change', (e) => {
        
    });
    
    // Add a mousedown event to see if the slider is responding to clicks at all
    distanceSlider.addEventListener('mousedown', (e) => {
        
    });
    
} else {
    
}

if (distanceInput) {
    distanceInput.addEventListener('input', (e) => {
        
        autoExitPrintMode();
        const newDistance = parseFloat(e.target.value);
        
        if (!isNaN(newDistance)) {
            const { x, y } = this.polarToCartesian(hole.angle, newDistance);
            
            if (this.isValidPosition(x, y, hole.radius, index)) {
                
                hole.distance = newDistance;
                hole.x = x;
                hole.y = y;
                if (distanceSlider) distanceSlider.value = newDistance.toFixed(4);
                this.updateSingleHole(index);
            } else {
                
                e.target.value = hole.distance.toFixed(4);
            }
        }
    });
} else {
    
}
    }
    
    cleanup() {
        
        
        // Remove event listeners
        if (this.interactionEvents && globalRenderer && globalRenderer.domElement) {
            globalRenderer.domElement.removeEventListener('mousedown', this.interactionEvents.onMouseDown);
            globalRenderer.domElement.removeEventListener('mousemove', this.interactionEvents.onMouseMove);
            globalRenderer.domElement.removeEventListener('mouseup', this.interactionEvents.onMouseUp);
            window.removeEventListener('keydown', this.interactionEvents.onKeyDown);
            window.removeEventListener('keyup', this.interactionEvents.onKeyUp);
        }
        
        if (this.cylinderMesh) {
            globalScene.remove(this.cylinderMesh);
            if (this.cylinderMesh.geometry) this.cylinderMesh.geometry.dispose();
            if (this.cylinderMesh.material) this.cylinderMesh.material.dispose();
            this.cylinderMesh = null;
        }
        
        this.holeMarkers.forEach(marker => {
            globalScene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });
        this.holeMarkers = [];
        
        this.polarControls.forEach(control => {
            globalScene.remove(control);
            if (control.geometry) control.geometry.dispose();
            if (control.material) control.material.dispose();
        });
        this.polarControls = [];
        
       
    }
    
    // Print Mode Methods for Smile
    enterPrintMode() {
       
        
        // Hide interactive controls
        this.holeMarkers.forEach(marker => marker.visible = false);
        this.polarControls.forEach(control => control.visible = false);
        
        // Hide the main cylinder mesh
        if (this.cylinderMesh) this.cylinderMesh.visible = false;
        
        // Create print mode elements
        this.createSmilePrintElements();
    }

    exitPrintMode() {
        
        
        // Show interactive controls
        this.holeMarkers.forEach(marker => marker.visible = true);
        this.polarControls.forEach(control => control.visible = true);
        
        // Show the main cylinder mesh
        if (this.cylinderMesh) this.cylinderMesh.visible = true;
        
        // Remove print mode elements
        this.clearSmilePrintElements();
        
        if (!isPerspectiveView) {
            switchCamera();
        }
    }

    createSmilePrintElements() {
        const z = this.cylinderHeight / 2 + 0.002;
        
        // Create outer cylinder outline
        this.createCircleOutline(0, 0, this.cylinderRadius, z);
        
        // Create semicircle outline
        this.createSemicircleOutline(z);
        
        // Create hole outlines and dimensions
        this.holes.forEach((hole, index) => {
            this.createCircleOutline(hole.x, hole.y, hole.radius, z);
            this.createSmileHoleDimensionLines(hole, index);
        });
        
        // Create semicircle dimensions
        this.createSemicircleDimensions(z);
    }
    
    createCircleOutline(centerX, centerY, radius, z) {
        const points = [];
        const segments = 64;
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                centerX + Math.cos(angle) * radius,
                centerY + Math.sin(angle) * radius,
                z
            ));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const circle = new THREE.Line(geometry, material);
        
        globalScene.add(circle);
        this.printModeElements.push(circle);
    }
    
    createSemicircleOutline(z) {
        const R = this.semicircleRadius;
        const r = this.cornerRadius;
        const x = Math.sqrt(R * R - 2 * R * r);
        const a = Math.atan2(r, x);
        
        const points = [];
        
        // Top straight line
        points.push(new THREE.Vector3(-x, 0, z));
        points.push(new THREE.Vector3(x, 0, z));
        
        // Right corner arc
        for (let i = 0; i <= 16; i++) {
            const angle = Math.PI/2 + i * (-a - Math.PI/2) / 16;
            const px = x + r * Math.cos(angle);
            const py = -r + r * Math.sin(angle);
            points.push(new THREE.Vector3(px, py, z));
        }
        
        // Main arc
        const startAngle = -a;
        const endAngle = -(Math.PI - a);
        for (let i = 0; i <= 32; i++) {
            const angle = startAngle + i * (endAngle - startAngle) / 32;
            const px = R * Math.cos(angle);
            const py = R * Math.sin(angle);
            points.push(new THREE.Vector3(px, py, z));
        }
        
        // Left corner arc 
        for (let i = 0; i <= 16; i++) {
            const angle = -(Math.PI - a) + i * (-Math.PI/2-Math.PI - (-(Math.PI - a))) / 16;
            const px = -x + r * Math.cos(angle);
            const py = -r + r * Math.sin(angle);
            points.push(new THREE.Vector3(px, py, z));
        }
        
        points.push(new THREE.Vector3(-x, 0, z));
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const outline = new THREE.Line(geometry, material);
        
        globalScene.add(outline);
        this.printModeElements.push(outline);
    }
    
    createSmileHoleDimensionLines(hole, index) {
        const z = this.cylinderHeight / 2 + 0.002;
        const extensionDistance = this.cylinderRadius + 0.04;
        const holeAngle = Math.atan2(hole.y, hole.x);
        const endX = Math.cos(holeAngle) * extensionDistance;
        const endY = Math.sin(holeAngle) * extensionDistance;
        
        // Create dimension line from center to hole and beyond
        const dimLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, z),
            new THREE.Vector3(endX, endY, z)
        ]);
        const dimLineMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
      const dimLine = new THREE.Line(dimLineGeometry, dimLineMaterial);
       globalScene.add(dimLine);
       this.dimensionLines.push(dimLine);
       
       // Add perpendicular cross line at hole center
       const perpendicularAngle = holeAngle + Math.PI/2;
       const crossLength = hole.radius * 0.6;
       const crossStart = {
           x: hole.x + Math.cos(perpendicularAngle) * crossLength,
           y: hole.y + Math.sin(perpendicularAngle) * crossLength
       };
       const crossEnd = {
           x: hole.x - Math.cos(perpendicularAngle) * crossLength,
           y: hole.y - Math.sin(perpendicularAngle) * crossLength
       };
       
       const crossGeometry = new THREE.BufferGeometry().setFromPoints([
           new THREE.Vector3(crossStart.x, crossStart.y, z),
           new THREE.Vector3(crossEnd.x, crossEnd.y, z)
       ]);
       const crossMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
       const crossLine = new THREE.Line(crossGeometry, crossMaterial);
       
       globalScene.add(crossLine);
       this.dimensionLines.push(crossLine);
       
       // Create dimension label
       const labelDiv = document.createElement('div');
       labelDiv.className = 'dimension-label';
       labelDiv.style.cssText = `
           color: black; 
           font-size: 12px; 
           background: rgba(255,255,255,0.9); 
           padding: 3px 6px; 
           border: 1px solid black; 
           border-radius: 3px;
           font-family: Arial, sans-serif;
           white-space: nowrap;
       `;
       
       const diameter = (hole.radius * 2).toFixed(3);
       const distance = hole.distance.toFixed(3);
       const angle = Math.round(hole.angle);
       
       labelDiv.innerHTML = `
           <div><strong>${hole.name}</strong></div>
           <div>⌀ ${diameter}m</div>
           <div>↔ ${distance}m</div>
           <div>∠ ${angle}°</div>
       `;
       
       const css2dLabel = new CSS2DObject(labelDiv);
       css2dLabel.position.set(endX + 0.02, endY + 0.02, z);
       
       globalScene.add(css2dLabel);
       this.dimensionLabels.push(css2dLabel);
   }
   
   createSemicircleDimensions(z) {
       // Create 45-degree dimension line from semicircle edge
       const angle45 = -Math.PI / 4;
       const startX = this.semicircleRadius * Math.cos(angle45);
       const startY = this.semicircleRadius * Math.sin(angle45);
       
       const extensionDistance = this.cylinderRadius + 0.06;
       const endX = extensionDistance * Math.cos(angle45);
       const endY = extensionDistance * Math.sin(angle45);
       
       const dimLineGeometry = new THREE.BufferGeometry().setFromPoints([
           new THREE.Vector3(startX, startY, z),
           new THREE.Vector3(endX, endY, z)
       ]);
       const dimLineMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
       const dimLine = new THREE.Line(dimLineGeometry, dimLineMaterial);
       
       globalScene.add(dimLine);
       this.dimensionLines.push(dimLine);
       
       // Create semicircle label
       const labelDiv = document.createElement('div');
       labelDiv.style.cssText = `
           color: black; 
           font-size: 12px; 
           background: rgba(255,255,255,0.9); 
           padding: 5px; 
           border: 1px solid black; 
           border-radius: 3px;
           font-family: Arial, sans-serif;
           line-height: 1.2;
           text-align: center;
       `;
       labelDiv.innerHTML = `
           <div><strong>Smile Lumen</strong></div>
           <div>Radius: ${this.semicircleRadius.toFixed(3)}m</div>
           <div>Corner R: ${this.cornerRadius.toFixed(3)}m</div>
       `;
       
       const label = new CSS2DObject(labelDiv);
       label.position.set(endX + 0.02, endY + 0.02, z);
       
       globalScene.add(label);
       this.dimensionLabels.push(label);
   }
   
   clearSmilePrintElements() {
       // Remove line elements
       this.printModeElements.forEach(element => {
           globalScene.remove(element);
           if (element.geometry) element.geometry.dispose();
           if (element.material) element.material.dispose();
       });
       this.printModeElements = [];
       
       // Remove dimension lines
       this.dimensionLines.forEach(line => {
           globalScene.remove(line);
           if (line.geometry) line.geometry.dispose();
           if (line.material) line.material.dispose();
       });
       this.dimensionLines = [];
       
       // Remove CSS2D labels
       this.dimensionLabels.forEach(label => {
           globalScene.remove(label);
           if (label.element && label.element.parentNode) {
               label.element.parentNode.removeChild(label.element);
           }
       });
       this.dimensionLabels = [];
   }
}
      
      
      
      
      
      
      
        // Profile Manager
        class ProfileManagerV2 {
            constructor() {
                
                this.currentSystem = null;
               this.setupGlobalControls();
                this.showCircular();
            }
 



// Fallback functions for systems without print mode

          updateHoleCountConstraints() {
    const holeCountInput = document.getElementById('hole-count');
    if (!holeCountInput) return;
    
    if (this.currentSystem instanceof SmileSystem) {
        holeCountInput.min = 2;
        holeCountInput.max = 3;
        holeCountInput.title = "Smile profile: 2-3 holes (1 semicircle + 1-2 circular)";
    } else if (this.currentSystem instanceof CircularHolesSystem) {
        holeCountInput.min = 2;
        holeCountInput.max = 9;
        holeCountInput.title = "Circular profile: 2-9 holes";
    } else if (this.currentSystem instanceof PieSliceSystem) {
        holeCountInput.min = 2;
        holeCountInput.max = 9;
        holeCountInput.title = "Pie slice profile: 2-9 holes";
    } else if (this.currentSystem instanceof CrescentSystem) {
        holeCountInput.min = 2;
        holeCountInput.max = 2;
        holeCountInput.title = "Crescent profile: 2 holes (1 circular + 1 crescent)";
        // Set the value to 2 and make it readonly since there's only one option
        holeCountInput.value = 2;
        //holeCountInput.readOnly = true;
     } 
    //     // Default constraints
    //     holeCountInput.min = 2;
    //     holeCountInput.max = 9;
    //     holeCountInput.title = "2-9 holes";
    //     holeCountInput.readOnly = false;
    // }
}
       showSmile() {
    
    
    if (this.currentSystem) {
        this.currentSystem.cleanup();
    }
    
    this.currentSystem = new SmileSystem();
    
    // Update profile button states
    document.getElementById('circular-profile-btn').classList.remove('active');
    document.getElementById('pie-slice-profile-btn').classList.remove('active');
    document.getElementById('crescent-profile-btn').classList.remove('active');
    document.getElementById('smile-profile-btn').classList.add('active');
    document.getElementById('circular-hole-controls').style.display = 'none';
    document.getElementById('pie-slice-controls').style.display = 'none';
    document.getElementById('crescent-controls').style.display = 'none';
    document.getElementById('smile-controls').style.display = 'block';
    document.getElementById('smile-hole-controls').style.display = 'block';
    
    // Reset UI controls to defaults and sync with smile system
    this.resetUIControls();
    
    // Set correct hole count for smile profile (3 = 1 semicircle + 2 circular)
    const holeCountInput = document.getElementById('hole-count');
    if (holeCountInput) {
        holeCountInput.value = 3;
    }
    
    this.syncUIWithCurrentSystem();
    
    // Create smile-specific hole UI
    this.currentSystem.createSmileHoleUI();
    this.updateHoleCountConstraints();
    
}
     
          
          
          
         
          syncUIWithCurrentSystem() {
    if (!this.currentSystem) return;
    
    // Update hole count to match current system
    const holeCountInput = document.getElementById('hole-count');
    if (holeCountInput) {
        if (this.currentSystem instanceof CircularHolesSystem) {
            const totalHoles = this.currentSystem.holes.length;
            holeCountInput.value = totalHoles;
        } else if (this.currentSystem instanceof PieSliceSystem) {
            const totalCount = this.currentSystem.hasCentralHole ? 
                this.currentSystem.sliceCount + 1 : 
                this.currentSystem.sliceCount;
            holeCountInput.value = totalCount;
        }
    }
    
            
            
            
    // Update central lumen checkbox
    const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
    const innerDiameterGroup = document.getElementById('inner-diameter-group');
    if (centralLumenCheckbox && innerDiameterGroup) {
        if (this.currentSystem instanceof CircularHolesSystem) {
            centralLumenCheckbox.checked = this.currentSystem.includeCentralLumen;
            innerDiameterGroup.style.display = this.currentSystem.includeCentralLumen ? 'flex' : 'none';
        } else if (this.currentSystem instanceof PieSliceSystem) {
            centralLumenCheckbox.checked = this.currentSystem.hasCentralHole;
            innerDiameterGroup.style.display = this.currentSystem.hasCentralHole ? 'flex' : 'none';
        }
    }
    
    // Update diameter controls
    const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
    const cylinderDiameterInput = document.getElementById('cylinder-diameter-input');
    if (cylinderDiameterSlider && cylinderDiameterInput) {
        const diameter = this.currentSystem.cylinderRadius * 2;
        cylinderDiameterSlider.value = diameter.toFixed(3);
        cylinderDiameterInput.value = diameter.toFixed(3);
    }
}
           resetUIControls() {
    
    // Reset hole count based on current profile
    const holeCountInput = document.getElementById('hole-count');
    if (holeCountInput) {
        if (this.currentSystem instanceof SmileSystem) {
            holeCountInput.value = 3; // Default for smile profile
        } else {
            holeCountInput.value = 3; // Default for other profiles
        }
    }
    
    // Uncheck central lumen checkbox
    const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
    if (centralLumenCheckbox) {
        centralLumenCheckbox.checked = false;
    }
    
    // Hide inner diameter controls
    const innerDiameterGroup = document.getElementById('inner-diameter-group');
    if (innerDiameterGroup) {
        innerDiameterGroup.style.display = 'none';
    }
    
    // Reset inner diameter to default value - NEW: Remove max limit for central lumen
    const innerDiameterSlider = document.getElementById('inner-diameter');
    const innerDiameterInput = document.getElementById('inner-diameter-input');
    if (innerDiameterSlider && innerDiameterInput) {
        innerDiameterSlider.value = '0.025';
        innerDiameterInput.value = '0.025';
        // NEW: Set max to a much larger value for central lumen
        innerDiameterSlider.max = '0.500'; // Allow up to 50cm diameter
        innerDiameterInput.max = '0.500';
    }
    
    // Reset outer diameter to default value
    const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
    const cylinderDiameterInput = document.getElementById('cylinder-diameter-input');
    if (cylinderDiameterSlider && cylinderDiameterInput) {
        const defaultDiameter = Math.max(0.200, 0.079);
        cylinderDiameterSlider.value = defaultDiameter.toFixed(3);
        cylinderDiameterInput.value = defaultDiameter.toFixed(3);
        
        if (this.currentSystem) {
            this.currentSystem.cylinderRadius = defaultDiameter / 2;
        }
    }
    
    // Reset camera and print mode buttons to default state
    const cameraSwitchBtn = document.getElementById('camera-switch-btn');
    const printModeBtn = document.getElementById('print-mode-btn');
    if (cameraSwitchBtn) {
        cameraSwitchBtn.classList.remove('active');
        cameraSwitchBtn.style.color = '#767676';
    }
    if (printModeBtn) {
        printModeBtn.classList.remove('active');
        printModeBtn.style.color = '#767676';
    }
    
   
             
             if (this.currentSystem instanceof CrescentSystem) {
    const circularRadiusSlider = document.getElementById('circular-radius');
    const circularRadiusInput = document.getElementById('circular-radius-input');
    if (circularRadiusSlider && circularRadiusInput) {
        circularRadiusSlider.value = this.currentSystem.circularDiameter.toFixed(3);
        circularRadiusInput.value = this.currentSystem.circularDiameter.toFixed(3);
    }
    
    const crescentCornerSlider = document.getElementById('crescent-corner-radius');
    const crescentCornerInput = document.getElementById('crescent-corner-radius-input');
    if (crescentCornerSlider && crescentCornerInput) {
        crescentCornerSlider.value = this.currentSystem.crescentCornerRadius.toFixed(4);
        crescentCornerInput.value = this.currentSystem.crescentCornerRadius.toFixed(4);
    }
    
    const crescentSeptumSlider = document.getElementById('crescent-septum-thickness');
    const crescentSeptumInput = document.getElementById('crescent-septum-thickness-input');
    if (crescentSeptumSlider && crescentSeptumInput) {
        crescentSeptumSlider.value = this.currentSystem.septumThickness.toFixed(3);
        crescentSeptumInput.value = this.currentSystem.septumThickness.toFixed(3);
    }
    
   
}
             // Reset smile controls
const semicircleRadiusSlider = document.getElementById('semicircle-radius');
const semicircleRadiusInput = document.getElementById('semicircle-radius-input');
const smileCornerSlider = document.getElementById('smile-corner-radius');
const smileCornerInput = document.getElementById('smile-corner-radius-input');

if (semicircleRadiusSlider && semicircleRadiusInput) {
    semicircleRadiusSlider.value = '0.090';
    semicircleRadiusInput.value = '0.090';
}

if (smileCornerSlider && smileCornerInput) {
    smileCornerSlider.value = '0.01';
    smileCornerInput.value = '0.01';
}
}
            setupGlobalControls() {
  //Interaction Tracking
              
              
  //End interaction tracking
                // Profile switching buttons
               document.getElementById('smile-profile-btn').addEventListener('click', () => {
    autoExitPrintMode();            
    
    this.showSmile();
});   
                document.getElementById('circular-profile-btn').addEventListener('click', () => {
                  autoExitPrintMode();
                   
                    this.showCircular();
                });
         document.getElementById('crescent-profile-btn').addEventListener('click', () => {
           autoExitPrintMode();
    
    this.showCrescent();
});       
                document.getElementById('pie-slice-profile-btn').addEventListener('click', () => {
                  autoExitPrintMode();
                    
                    this.showPieSlice();
                });
                document.getElementById('print-mode-btn').addEventListener('click', (event) => {
    // Prevent any default behavior
    event.preventDefault();
    
    // Create and dispatch a TAB key event to trigger existing functionality
    const keydownEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true
    });
    
    // Dispatch to document to trigger the existing TAB key handler
    document.dispatchEvent(keydownEvent);
});
              
                // Central lumen checkbox - just show/hide diameter controls
                document.getElementById('central-lumen-checkbox').addEventListener('change', (e) => {
                  
                   
                    
                    const innerDiameterGroup = document.getElementById('inner-diameter-group');
                    innerDiameterGroup.style.display = e.target.checked ? 'flex' : 'none';
                    
                    // Don't apply changes here - wait for apply button
                });
                
                // Inner diameter controls
                const innerDiameterSlider = document.getElementById('inner-diameter');
                const innerDiameterInput = document.getElementById('inner-diameter-input');
innerDiameterSlider.addEventListener('mousedown', startInteraction);   
innerDiameterSlider.addEventListener('mouseup', endInteraction);
innerDiameterSlider.addEventListener('change', endInteraction);              
innerDiameterSlider.addEventListener('input', (e) => {
  startInteraction();
    const newDiameter = parseFloat(e.target.value);
     autoExitPrintMode();
    if (this.currentSystem instanceof CircularHolesSystem && this.currentSystem.includeCentralLumen) {
        // NEW: Use the system's validation for central lumen updates
        this.currentSystem.centralLumenRadius = newDiameter / 2;
        this.currentSystem.updateCentralLumen(); // This will handle validation and UI sync
    } else if (this.currentSystem instanceof PieSliceSystem && this.currentSystem.hasCentralHole) {
        // Existing pie slice logic with validation...
        const originalDiameter = this.currentSystem.innerDiameter;
        
        this.currentSystem.innerDiameter = newDiameter;
        const collapseCheck = this.currentSystem.detectSliceCollapse();
        
        if (collapseCheck.collapsed) {
            this.currentSystem.innerDiameter = originalDiameter;
            innerDiameterSlider.value = originalDiameter.toFixed(3);
            innerDiameterInput.value = originalDiameter.toFixed(3);
            
            console.warn(`Inner diameter limited to ${originalDiameter.toFixed(3)}m: ${collapseCheck.reason}`);
            return;
        }
        
        innerDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.updateGeometry();
    }
});

innerDiameterInput.addEventListener('input', (e) => {
    const newDiameter = parseFloat(e.target.value);
   autoExitPrintMode();
    if (!isNaN(newDiameter)) {
        if (this.currentSystem instanceof CircularHolesSystem && this.currentSystem.includeCentralLumen) {
            // NEW: Use the system's validation for central lumen updates
            this.currentSystem.centralLumenRadius = newDiameter / 2;
            this.currentSystem.updateCentralLumen(); // This will handle validation and UI sync
        } else if (this.currentSystem instanceof PieSliceSystem && this.currentSystem.hasCentralHole) {
            // Existing pie slice logic with validation...
            const originalDiameter = this.currentSystem.innerDiameter;
            
            this.currentSystem.innerDiameter = newDiameter;
            const collapseCheck = this.currentSystem.detectSliceCollapse();
            
            if (collapseCheck.collapsed) {
                this.currentSystem.innerDiameter = originalDiameter;
                innerDiameterSlider.value = originalDiameter.toFixed(3);
                e.target.value = originalDiameter.toFixed(3);
                
                console.warn(`Inner diameter limited to ${originalDiameter.toFixed(3)}m: ${collapseCheck.reason}`);
                return;
            }
            
            innerDiameterSlider.value = newDiameter;
            this.currentSystem.updateGeometry();
        }
    }
});
                
                // Cylinder diameter controls
               const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
const cylinderDiameterInput = document.getElementById('cylinder-diameter-input');

cylinderDiameterSlider.addEventListener('mousedown', startInteraction);   
cylinderDiameterSlider.addEventListener('mouseup', endInteraction);
cylinderDiameterSlider.addEventListener('change', endInteraction);              
cylinderDiameterSlider.addEventListener('input', (e) => {
  startInteraction();
  autoExitPrintMode();
    const newDiameter = parseFloat(e.target.value);
     
    if (this.currentSystem instanceof CircularHolesSystem) {
        // Handle circular holes system
        cylinderDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.cylinderRadius = newDiameter / 2;
        this.currentSystem.updateCylinderDiameterConstraints();
        this.currentSystem.createCylinder();
        this.currentSystem.updateHoleDiameterLimits();
    } else if (this.currentSystem instanceof PieSliceSystem) {
        // Handle pie slice system
        cylinderDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.cylinderRadius = newDiameter / 2;
        
        // Update inner diameter limits if central hole is enabled
        if (this.currentSystem.hasCentralHole) {
            this.currentSystem.updateInnerDiameterLimits();
        }
        
        this.currentSystem.updateGeometry();
        
    } else if (this.currentSystem instanceof CrescentSystem) {
        // Handle crescent system diameter changes
        const newRadius = newDiameter / 2;
        const oldMinSeptum = this.currentSystem.getMinimumSeptumThickness();
        
        // Check collapse before applying - FOR BOTH MODES
        if (this.currentSystem.evenWallThickness) {
            // Even wall mode - check with current circular diameter
            const collapseCheck = this.currentSystem.detectCrescentCollapse(newRadius, null, null, null);
            
            if (collapseCheck.collapsed) {
                // Revert to current value
                const currentDiameter = this.currentSystem.cylinderRadius * 2;
                cylinderDiameterSlider.value = currentDiameter.toFixed(3);
                cylinderDiameterInput.value = currentDiameter.toFixed(3);
                this.currentSystem.showParameterWarning(collapseCheck.reason);
                return;
            }
        } else {
            // Independent mode - check with phantom circular diameter
            const phantomCollapseCheck = this.currentSystem.detectCrescentCollapse(newRadius, this.currentSystem.phantomCircularDiameter, null, null);
            
            if (phantomCollapseCheck.collapsed) {
                // Revert to current value
                const currentDiameter = this.currentSystem.cylinderRadius * 2;
                cylinderDiameterSlider.value = currentDiameter.toFixed(3);
                cylinderDiameterInput.value = currentDiameter.toFixed(3);
                this.currentSystem.showParameterWarning(`Phantom crescent would collapse: ${phantomCollapseCheck.reason}`);
                return;
            }
            
           
        }
        
        // Update the system
        cylinderDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.cylinderRadius = newRadius;
        
        // Check if minimum septum thickness changed
        const newMinSeptum = this.currentSystem.getMinimumSeptumThickness();
        
        if (newMinSeptum !== oldMinSeptum) {
           
            
            // Update septum thickness if current value is below new minimum
            if (this.currentSystem.septumThickness < newMinSeptum) {
                this.currentSystem.septumThickness = newMinSeptum;
                
                // Update septum UI controls
                const septumSlider = document.getElementById('crescent-septum-thickness');
                const septumInput = document.getElementById('crescent-septum-thickness-input');
                if (septumSlider) septumSlider.value = newMinSeptum.toFixed(3);
                if (septumInput) septumInput.value = newMinSeptum.toFixed(3);
                
                this.currentSystem.showParameterWarning(`Septum thickness increased to ${newMinSeptum.toFixed(3)}m minimum`);
            }
        }
        
        this.currentSystem.updateCircularDiameterLimits();
        this.currentSystem.updateCylinderGeometry();
        
    } else if (this.currentSystem instanceof SmileSystem) {
        // Handle smile system diameter changes with validation
        const newRadius = newDiameter / 2;
        const validation = this.currentSystem.validateCylinderRadius(newRadius);
        
        if (!validation.valid) {
            // Revert to constrained value and show warning
            const constrainedDiameter = validation.constrainedValue * 2;
            cylinderDiameterSlider.value = constrainedDiameter.toFixed(3);
            cylinderDiameterInput.value = constrainedDiameter.toFixed(3);
            this.currentSystem.showSmileWarning(validation.reason);
            return;
        }
        
        // Update the system
        cylinderDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.cylinderRadius = newRadius;
        
        // Update semicircle radius limits based on new outer diameter
        this.currentSystem.updateSemicircleRadiusLimits();
        
        // Update hole position limits in UI only (don't move holes)
        this.currentSystem.updateHolePositionLimitsUI();
        
        // Update geometry
        this.currentSystem.updateCylinderGeometry();
     this.currentSystem.updateHoleDiameterLimits(); this.currentSystem.updateAllHoleDistanceLimits();
    }
});

cylinderDiameterInput.addEventListener('input', (e) => {
  autoExitPrintMode();
    const newDiameter = parseFloat(e.target.value);
   
    if (!isNaN(newDiameter)) {
        if (this.currentSystem instanceof CircularHolesSystem) {
            // Handle circular holes system
            cylinderDiameterSlider.value = newDiameter;
            this.currentSystem.cylinderRadius = newDiameter / 2;
            this.currentSystem.updateCylinderDiameterConstraints();
            this.currentSystem.createCylinder();
            this.currentSystem.updateHoleDiameterLimits();
        } else if (this.currentSystem instanceof PieSliceSystem) {
            // Handle pie slice system
            cylinderDiameterSlider.value = newDiameter;
            this.currentSystem.cylinderRadius = newDiameter / 2;
            
            // Update inner diameter limits if central hole is enabled
            if (this.currentSystem.hasCentralHole) {
                this.currentSystem.updateInnerDiameterLimits();
            }
            
            this.currentSystem.updateGeometry();
            
        } else if (this.currentSystem instanceof CrescentSystem) {
            // Handle crescent system diameter changes
            const newRadius = newDiameter / 2;
            const oldMinSeptum = this.currentSystem.getMinimumSeptumThickness();
            
            // Check collapse before applying - FOR BOTH MODES
            if (this.currentSystem.evenWallThickness) {
                // Even wall mode - check with current circular diameter
                const collapseCheck = this.currentSystem.detectCrescentCollapse(newRadius, null, null, null);
                
                if (collapseCheck.collapsed) {
                    // Revert to current value
                    const currentDiameter = this.currentSystem.cylinderRadius * 2;
                    cylinderDiameterSlider.value = currentDiameter.toFixed(3);
                    e.target.value = currentDiameter.toFixed(3);
                    this.currentSystem.showParameterWarning(collapseCheck.reason);
                    return;
                }
            } else {
                // Independent mode - check with phantom circular diameter
                const phantomCollapseCheck = this.currentSystem.detectCrescentCollapse(newRadius, this.currentSystem.phantomCircularDiameter, null, null);
                
                if (phantomCollapseCheck.collapsed) {
                    // Revert to current value
                    const currentDiameter = this.currentSystem.cylinderRadius * 2;
                    cylinderDiameterSlider.value = currentDiameter.toFixed(3);
                    e.target.value = currentDiameter.toFixed(3);
                    this.currentSystem.showParameterWarning(`Phantom crescent would collapse: ${phantomCollapseCheck.reason}`);
                    return;
                }
                
                
            }
            
            // Update the system
            cylinderDiameterSlider.value = newDiameter;
            this.currentSystem.cylinderRadius = newRadius;
            
            // Check if minimum septum thickness changed
            const newMinSeptum = this.currentSystem.getMinimumSeptumThickness();
            
            if (newMinSeptum !== oldMinSeptum) {
                
                
                // Update septum thickness if current value is below new minimum
                if (this.currentSystem.septumThickness < newMinSeptum) {
                    this.currentSystem.septumThickness = newMinSeptum;
                    
                    // Update septum UI controls
                    const septumSlider = document.getElementById('crescent-septum-thickness');
                    const septumInput = document.getElementById('crescent-septum-thickness-input');
                    if (septumSlider) septumSlider.value = newMinSeptum.toFixed(3);
                    if (septumInput) septumInput.value = newMinSeptum.toFixed(3);
                    
                    this.currentSystem.showParameterWarning(`Septum thickness increased to ${newMinSeptum.toFixed(3)}m minimum`);
                }
            }
            
            this.currentSystem.updateCircularDiameterLimits();
            this.currentSystem.updateCylinderGeometry();
            
        } else if (this.currentSystem instanceof SmileSystem) {
            // Handle smile system diameter changes with validation
            const newRadius = newDiameter / 2;
            const validation = this.currentSystem.validateCylinderRadius(newRadius);
            
            if (!validation.valid) {
                // Revert to constrained value and show warning
                const constrainedDiameter = validation.constrainedValue * 2;
                cylinderDiameterSlider.value = constrainedDiameter.toFixed(3);
                e.target.value = constrainedDiameter.toFixed(3);
                this.currentSystem.showSmileWarning(validation.reason);
                return;
            }
            
            // Update the system
            cylinderDiameterSlider.value = newDiameter;
            this.currentSystem.cylinderRadius = newRadius;
            
            // Update semicircle radius limits based on new outer diameter
            this.currentSystem.updateSemicircleRadiusLimits();
            
            // Update hole position limits in UI only (don't move holes)
            this.currentSystem.updateHolePositionLimitsUI();
            
            // Update geometry
            this.currentSystem.updateCylinderGeometry();
     this.currentSystem.updateHoleDiameterLimits();     
          this.currentSystem.updateAllHoleDistanceLimits();
        }
    }
});
 const holeCountInput = document.getElementById('hole-count');
holeCountInput.addEventListener('input', (e) => {
  
    if (this.currentSystem instanceof PieSliceSystem) {
        const value = parseInt(e.target.value);
        const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        const hasCentralHole = centralLumenCheckbox.checked;
        
        // Minimum depends on whether central hole is enabled
        const minCount = hasCentralHole ? 3 : 2;
        
        if (value < minCount) {
            e.target.value = minCount;
            
            // Show brief feedback
            const info = document.createElement('div');
            info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:8px;border-radius:3px;z-index:1000;font-family:Arial;font-size:12px;';
            info.textContent = `Minimum ${minCount} holes for pie slice profile ${hasCentralHole ? '(with central hole)' : '(without central hole)'}`;
            document.body.appendChild(info);
            setTimeout(() => info.remove(), 2000);
        }
    }
});          
                // Hole count and apply
document.getElementById('apply-holes').addEventListener('click', () => {
  autoExitPrintMode();
    const holeCount = parseInt(document.getElementById('hole-count').value);
     
    if (this.currentSystem instanceof CircularHolesSystem) {
        // Existing circular logic...
        const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        const includeCentralLumen = centralLumenCheckbox.checked;
        
        this.currentSystem.includeCentralLumen = includeCentralLumen;
        
        if (includeCentralLumen) {
            const innerDiameterSlider = document.getElementById('inner-diameter');
            this.currentSystem.centralLumenRadius = parseFloat(innerDiameterSlider.value) / 2;
        }
        
        this.currentSystem.regenerateHoles(holeCount);
        
    } else if (this.currentSystem instanceof PieSliceSystem) {
        const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
    const hasCentralHole = centralLumenCheckbox.checked;
    
    // NEW: Correct minimum based on central hole status
    const minCount = hasCentralHole ? 3 : 2;
    let adjustedHoleCount = holeCount;
    
    if (adjustedHoleCount < minCount) {
        adjustedHoleCount = minCount;
        document.getElementById('hole-count').value = minCount;
    }
    
    const wasCentralHole = this.currentSystem.hasCentralHole;
    this.currentSystem.hasCentralHole = hasCentralHole;
    
    if (this.currentSystem.hasCentralHole) {
        const innerDiameterSlider = document.getElementById('inner-diameter');
        this.currentSystem.innerDiameter = parseFloat(innerDiameterSlider.value);
        
        // NEW: Update inner diameter limits when enabling central hole
        this.currentSystem.updateInnerDiameterLimits();
    }
    
    // Regenerate with the total count (central hole will be counted if enabled)
    const success = this.currentSystem.regenerateSlices(adjustedHoleCount);
    
    if (!success) {
        // Revert central hole setting if regeneration failed
        this.currentSystem.hasCentralHole = wasCentralHole;
        centralLumenCheckbox.checked = wasCentralHole;
    }
    } else if (this.currentSystem instanceof SmileSystem) {
    // Smile system: 2-3 total holes (1 semicircle + 1-2 circular holes)
    const minHoles = 2; // 1 semicircle + 1 circular
    const maxHoles = 3; // 1 semicircle + 2 circular
    
    let adjustedHoleCount = Math.max(minHoles, Math.min(holeCount, maxHoles));
    
    if (adjustedHoleCount !== holeCount) {
        document.getElementById('hole-count').value = adjustedHoleCount;
        
        // Show feedback about the constraint
        const info = document.createElement('div');
        info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:8px;border-radius:3px;z-index:1000;font-family:Arial;font-size:12px;';
        info.textContent = `Smile profile supports ${minHoles}-${maxHoles} total holes (1 smile + 1-2 circular)`;
        document.body.appendChild(info);
        setTimeout(() => info.remove(), 3000);
    }
    
    this.currentSystem.regenerateHoles(adjustedHoleCount);
}
});
              
    // Crescent-specific controls
// Change these variable names:
const circularRadiusSlider = document.getElementById('circular-radius');
const circularRadiusInput = document.getElementById('circular-radius-input');

// And update the event listeners:
circularRadiusSlider.addEventListener('mousedown', startInteraction);
    circularRadiusSlider.addEventListener('mouseup', endInteraction);
    circularRadiusSlider.addEventListener('change', endInteraction);
circularRadiusSlider.addEventListener('input', (e) => {
  startInteraction();
  autoExitPrintMode();
    const newDiameter = parseFloat(e.target.value);
     
    if (this.currentSystem instanceof CrescentSystem) {
        if (this.currentSystem.evenWallThickness) {
            // Even wall mode - check for crescent collapse
            const collapseCheck = this.currentSystem.detectCrescentCollapse(null, newDiameter, null, null);
            
            if (collapseCheck.collapsed) {
                // Revert to current value and show warning
                circularRadiusSlider.value = this.currentSystem.circularDiameter.toFixed(3);
                circularRadiusInput.value = this.currentSystem.circularDiameter.toFixed(3);
                this.currentSystem.showParameterWarning(`Crescent would collapse: ${collapseCheck.reason}`);
                return;
            }
        } else {
            // Independent mode - validate against septum requirements
            const validation = this.currentSystem.validateIndependentCircularDiameter(newDiameter);
            
            if (!validation.valid) {
                // Update controls to constrained value
                circularRadiusSlider.value = validation.constrainedValue.toFixed(3);
                circularRadiusInput.value = validation.constrainedValue.toFixed(3);
                this.currentSystem.showParameterWarning(validation.reason);
                
                // Only update if the constrained value is different from current
                if (validation.constrainedValue !== this.currentSystem.circularDiameter) {
                    this.currentSystem.circularDiameter = validation.constrainedValue;
                    this.currentSystem.updateCylinderGeometry();
                }
                return;
            }
        }
        
        circularRadiusInput.value = newDiameter.toFixed(3);
        this.currentSystem.circularDiameter = newDiameter;
        this.currentSystem.updateCylinderGeometry();
    }
});

circularRadiusInput.addEventListener('input', (e) => {
  autoExitPrintMode();
    const newDiameter = parseFloat(e.target.value);
   
    if (!isNaN(newDiameter)) {
        if (this.currentSystem instanceof CrescentSystem) {
            if (this.currentSystem.evenWallThickness) {
                // Even wall mode - check for crescent collapse
                const collapseCheck = this.currentSystem.detectCrescentCollapse(null, newDiameter, null, null);
                
                if (collapseCheck.collapsed) {
                    // Revert to current value and show warning
                    circularRadiusSlider.value = this.currentSystem.circularDiameter.toFixed(3);
                    e.target.value = this.currentSystem.circularDiameter.toFixed(3);
                    this.currentSystem.showParameterWarning(`Crescent would collapse: ${collapseCheck.reason}`);
                    return;
                }
            } else {
                // Independent mode - validate against septum requirements
                const validation = this.currentSystem.validateIndependentCircularDiameter(newDiameter);
                
                if (!validation.valid) {
                    // Update controls to constrained value
                    circularRadiusSlider.value = validation.constrainedValue.toFixed(3);
                    e.target.value = validation.constrainedValue.toFixed(3);
                    this.currentSystem.showParameterWarning(validation.reason);
                    
                    // Only update if the constrained value is different from current
                    if (validation.constrainedValue !== this.currentSystem.circularDiameter) {
                        this.currentSystem.circularDiameter = validation.constrainedValue;
                        this.currentSystem.updateCylinderGeometry();
                    }
                    return;
                }
            }
            
            circularRadiusSlider.value = newDiameter;
            this.currentSystem.circularDiameter = newDiameter;
            this.currentSystem.updateCylinderGeometry();
        }
    }
});

// Crescent corner radius controls
const crescentCornerSlider = document.getElementById('crescent-corner-radius');
const crescentCornerInput = document.getElementById('crescent-corner-radius-input');

if (crescentCornerSlider && crescentCornerInput) {
  crescentCornerSlider.addEventListener('mousedown', startInteraction);
 crescentCornerSlider.addEventListener('mouseup', endInteraction);
crescentCornerSlider.addEventListener('change', endInteraction);
    crescentCornerSlider.addEventListener('input', (e) => {
       startInteraction();
       autoExitPrintMode();
    const newRadius = parseFloat(e.target.value);
    
    if (this.currentSystem instanceof CrescentSystem) {
        // Check for collapse
        const collapseCheck = this.currentSystem.detectCrescentCollapse(null, null, null, newRadius);
        
        if (collapseCheck.collapsed) {
            // Revert to current value
            crescentCornerSlider.value = this.currentSystem.crescentCornerRadius.toFixed(4);
            crescentCornerInput.value = this.currentSystem.crescentCornerRadius.toFixed(4);
            this.currentSystem.showParameterWarning(collapseCheck.reason);
            return;
        }
        
        crescentCornerInput.value = newRadius.toFixed(4);
        this.currentSystem.crescentCornerRadius = newRadius;
        this.currentSystem.updateCylinderGeometry();
    }
});
    
    crescentCornerInput.addEventListener('input', (e) => {
       autoExitPrintMode();
        const newRadius = parseFloat(e.target.value);
        if (!isNaN(newRadius)) {
            crescentCornerSlider.value = newRadius;
            
            if (this.currentSystem instanceof CrescentSystem) {
                this.currentSystem.crescentCornerRadius = newRadius;
                this.currentSystem.updateCylinderGeometry();
            }
        }
    });
}

// Crescent septum thickness controls
const crescentSeptumSlider = document.getElementById('crescent-septum-thickness');
const crescentSeptumInput = document.getElementById('crescent-septum-thickness-input');

if (crescentSeptumSlider && crescentSeptumInput) {
  crescentSeptumSlider.addEventListener('mousedown', startInteraction);
  crescentSeptumSlider.addEventListener('mouseup', endInteraction);
crescentSeptumSlider.addEventListener('change', endInteraction);
    crescentSeptumSlider.addEventListener('input', (e) => {
      startInteraction();
       autoExitPrintMode();
    const newThickness = parseFloat(e.target.value);
    
    if (this.currentSystem instanceof CrescentSystem) {
        let validation;
        
        if (this.currentSystem.evenWallThickness) {
            validation = this.currentSystem.validateSeptumThickness(newThickness);
        } else {
            // Independent mode - use special validation
            validation = this.currentSystem.validateSeptumThicknessInIndependentMode(newThickness);
        }
        
        if (!validation.valid) {
            // Revert to constrained value
            crescentSeptumSlider.value = validation.constrainedValue.toFixed(3);
            crescentSeptumInput.value = validation.constrainedValue.toFixed(3);
            this.currentSystem.showParameterWarning(validation.reason);
            return;
        }
        
        crescentSeptumInput.value = newThickness.toFixed(3);
        this.currentSystem.septumThickness = newThickness;
        this.currentSystem.updateCylinderGeometry();
    }
});

crescentSeptumInput.addEventListener('input', (e) => {
   autoExitPrintMode();
    const newThickness = parseFloat(e.target.value);
    if (!isNaN(newThickness)) {
        if (this.currentSystem instanceof CrescentSystem) {
            let validation;
            
            if (this.currentSystem.evenWallThickness) {
                validation = this.currentSystem.validateSeptumThickness(newThickness);
            } else {
                // Independent mode - use special validation
                validation = this.currentSystem.validateSeptumThicknessInIndependentMode(newThickness);
            }
            
            if (!validation.valid) {
                // Revert to constrained value
                crescentSeptumSlider.value = validation.constrainedValue.toFixed(3);
                e.target.value = validation.constrainedValue.toFixed(3);
                this.currentSystem.showParameterWarning(validation.reason);
                return;
            }
            
            crescentSeptumSlider.value = newThickness;
            this.currentSystem.septumThickness = newThickness;
            this.currentSystem.updateCylinderGeometry();
        }
    }
});
}
// Even wall thickness checkbox
const evenWallCheckbox = document.getElementById('even-wall-thickness-checkbox');

if (evenWallCheckbox) {
  evenWallCheckbox.addEventListener('change', (e) => {
     autoExitPrintMode();
    if (this.currentSystem instanceof CrescentSystem) {
        if (!e.target.checked && this.currentSystem.evenWallThickness) {
            // Switching FROM even wall TO independent - store the current circular diameter as phantom
            const currentDiameter = this.currentSystem.circularDiameter;
            
            // Check if the current configuration would create a valid phantom crescent
            const phantomCollapseCheck = this.currentSystem.detectCrescentCollapse(null, currentDiameter, null, null);
            
            if (phantomCollapseCheck.collapsed) {
                // Don't allow switching to independent mode - show warning
                e.target.checked = true; // Revert checkbox
                this.currentSystem.showParameterWarning(`Cannot switch to independent mode: ${phantomCollapseCheck.reason}`);
                return;
            }
            
            this.currentSystem.phantomCircularDiameter = currentDiameter;
            
        }
        
        this.currentSystem.evenWallThickness = e.target.checked;
        
        if (e.target.checked) {
            
            // In even wall mode, phantom and actual are the same
            this.currentSystem.phantomCircularDiameter = this.currentSystem.circularDiameter;
        } else {
            
        }
        
        // Update geometry with new mode
        this.currentSystem.updateCylinderGeometry();
    }
});
}
// Smile-specific controls
const semicircleRadiusSlider = document.getElementById('semicircle-radius');
const semicircleRadiusInput = document.getElementById('semicircle-radius-input');

if (semicircleRadiusSlider && semicircleRadiusInput) {
semicircleRadiusSlider.addEventListener('mousedown', startInteraction);  
semicircleRadiusSlider.addEventListener('mouseup', endInteraction);
semicircleRadiusSlider.addEventListener('change', endInteraction);
semicircleRadiusSlider.addEventListener('input', (e) => {
    startInteraction();
    autoExitPrintMode();
    const newRadius = parseFloat(e.target.value);
    
    if (this.currentSystem instanceof SmileSystem) {
        const validation = this.currentSystem.validateSemicircleRadius(newRadius);
        
        if (!validation.valid) {
            // Revert to constrained value
            semicircleRadiusSlider.value = validation.constrainedValue.toFixed(3);
            semicircleRadiusInput.value = validation.constrainedValue.toFixed(3);
            this.currentSystem.showSmileWarning(validation.reason);
            return;
        }
        
        semicircleRadiusInput.value = newRadius.toFixed(3);
        this.currentSystem.semicircleRadius = newRadius;
        this.currentSystem.updateCylinderGeometry();
        this.currentSystem.updateHolePositionLimitsUI();
        this.currentSystem.updateCornerRadiusLimits();
        // ADD THIS LINE:
        this.currentSystem.updateAllHoleDistanceLimits();
    }
});

semicircleRadiusInput.addEventListener('input', (e) => {
    autoExitPrintMode();
    const newRadius = parseFloat(e.target.value);
    if (!isNaN(newRadius)) {
        if (this.currentSystem instanceof SmileSystem) {
            const validation = this.currentSystem.validateSemicircleRadius(newRadius);
            
            if (!validation.valid) {
                // Revert to constrained value
                semicircleRadiusSlider.value = validation.constrainedValue.toFixed(3);
                e.target.value = validation.constrainedValue.toFixed(3);
                this.currentSystem.showSmileWarning(validation.reason);
                return;
            }
            
            semicircleRadiusSlider.value = newRadius;
            this.currentSystem.semicircleRadius = newRadius;
            this.currentSystem.updateCylinderGeometry();
            this.currentSystem.updateHolePositionLimitsUI();
            this.currentSystem.updateCornerRadiusLimits();
            // ADD THIS LINE:
            this.currentSystem.updateAllHoleDistanceLimits();
        }
    }
});
}

// Smile corner radius controls
const smileCornerSlider = document.getElementById('smile-corner-radius');
const smileCornerInput = document.getElementById('smile-corner-radius-input');

if (smileCornerSlider && smileCornerInput) {
  smileCornerSlider.addEventListener('mousedown', startInteraction);
 smileCornerSlider.addEventListener('mouseup', endInteraction);
smileCornerSlider.addEventListener('change', endInteraction);
    smileCornerSlider.addEventListener('input', (e) => {
        startInteraction();
        autoExitPrintMode();
        const newRadius = parseFloat(e.target.value);
        
        if (this.currentSystem instanceof SmileSystem) {
            const validation = this.currentSystem.validateCornerRadius(newRadius);
            this.currentSystem.updateCornerRadiusLimits();
            if (!validation.valid) {
                // Revert to constrained value
                smileCornerSlider.value = validation.constrainedValue.toFixed(4);
                smileCornerInput.value = validation.constrainedValue.toFixed(4);
                this.currentSystem.showSmileWarning(validation.reason);
                
                // Update the system with constrained value
                this.currentSystem.cornerRadius = validation.constrainedValue;
                this.currentSystem.updateCylinderGeometry();
                return;
            }
            
            smileCornerInput.value = newRadius.toFixed(4);
            this.currentSystem.cornerRadius = newRadius;
            this.currentSystem.updateCylinderGeometry();
        }
    });
    
    smileCornerInput.addEventListener('input', (e) => {
        autoExitPrintMode();
        const newRadius = parseFloat(e.target.value);
        if (!isNaN(newRadius)) {
            if (this.currentSystem instanceof SmileSystem) {
                const validation = this.currentSystem.validateCornerRadius(newRadius);
                this.currentSystem.updateCornerRadiusLimits();
                if (!validation.valid) {
                    // Revert to constrained value
                    smileCornerSlider.value = validation.constrainedValue.toFixed(4);
                    e.target.value = validation.constrainedValue.toFixed(4);
                    this.currentSystem.showSmileWarning(validation.reason);
                    
                    // Update the system with constrained value
                    this.currentSystem.cornerRadius = validation.constrainedValue;
                    this.currentSystem.updateCylinderGeometry();
                    return;
                }
                
                smileCornerSlider.value = newRadius;
                this.currentSystem.cornerRadius = newRadius;
                this.currentSystem.updateCylinderGeometry();
            }
        }
    });
}



            }
            
           showCircular() {
    
    
    if (this.currentSystem) {
        this.currentSystem.cleanup();
    }
    
    this.currentSystem = new CircularHolesSystem();
    
    // Update profile button states
    document.getElementById('circular-profile-btn').classList.add('active');
    document.getElementById('pie-slice-profile-btn').classList.remove('active');
    document.getElementById('crescent-profile-btn').classList.remove('active');
    document.getElementById('circular-hole-controls').style.display = 'block';
    document.getElementById('pie-slice-controls').style.display = 'none';
    document.getElementById('smile-profile-btn').classList.remove('active');
document.getElementById('smile-controls').style.display = 'none';
document.getElementById('smile-hole-controls').style.display = 'none';
    // NEW: Reset UI controls to defaults
    this.resetUIControls();
    this.updateHoleCountConstraints();
    
}
            
            showPieSlice() {
    
    
    if (this.currentSystem) {
        this.currentSystem.cleanup();
    }
    
    this.currentSystem = new PieSliceSystem();
    
    // Update profile button states
    document.getElementById('circular-profile-btn').classList.remove('active');
    document.getElementById('crescent-profile-btn').classList.remove('active');
    document.getElementById('pie-slice-profile-btn').classList.add('active');
    document.getElementById('circular-hole-controls').style.display = 'none';
    document.getElementById('crescent-controls').style.display = 'none';
    document.getElementById('pie-slice-controls').style.display = 'block';
    document.getElementById('smile-profile-btn').classList.remove('active');
document.getElementById('smile-controls').style.display = 'none';
document.getElementById('smile-hole-controls').style.display = 'none';
    // NEW: Reset UI controls to defaults
    this.resetUIControls();
    this.updateHoleCountConstraints();
    
}
          showCrescent() {
    
    
    if (this.currentSystem) {
        this.currentSystem.cleanup();
    }
    
    this.currentSystem = new CrescentSystem();
    
    // Update profile button states
    document.getElementById('circular-profile-btn').classList.remove('active');
    document.getElementById('pie-slice-profile-btn').classList.remove('active');
    document.getElementById('crescent-profile-btn').classList.add('active');
    document.getElementById('circular-hole-controls').style.display = 'none';
    document.getElementById('pie-slice-controls').style.display = 'none';
    document.getElementById('crescent-controls').style.display = 'block';
    document.getElementById('smile-profile-btn').classList.remove('active');
document.getElementById('smile-controls').style.display = 'none';
document.getElementById('smile-hole-controls').style.display = 'none';
    // Reset UI controls to defaults but sync with crescent system
    this.resetUIControls();
    this.syncUIWithCurrentSystem();
    
    this.updateHoleCountConstraints();
    
    
}
        }
function autoExitPrintMode() {
    // Check multiple indicators of print mode state
    const css2dVisible = css2dRenderer && css2dRenderer.domElement.style.display !== 'none';
    const backgroundIsWhite = globalScene && globalScene.background && globalScene.background.getHex() === 0xffffff;
    const printButtonActive = document.getElementById('print-mode-btn')?.textContent?.includes('EXIT');
    
    const actuallyInPrintMode = css2dVisible || backgroundIsWhite || printButtonActive;
    
    
    
    if (actuallyInPrintMode) {
        
        
        // Force the isPrintMode variable to be correct
        isPrintMode = true;
        
        // Use the existing TAB key handler to exit
        const keydownEvent = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true
        });
        
        document.dispatchEvent(keydownEvent);
        
        
        
        // Show notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #2196F3;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            z-index: 1000;
            font-family: Arial;
            font-size: 12px;
        `;
        notification.textContent = 'Auto-exited print mode';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    } else {
        
    }
}
function showInteractiveControls() {
    // Show any spheres or control objects
    globalScene.traverse((child) => {
        if (child.userData && (
            child.userData.type === 'holeControl' || 
            child.userData.type === 'smileControl' ||
            child.userData.type === 'crescentController' ||
            child.userData.sliceIndex !== undefined
        )) {
            child.visible = true;
        }
    });
}
        // Initialize everything
        window.addEventListener('DOMContentLoaded', () => {
            
            setupGlobalResources();
            window.profileManager = new ProfileManagerV2();
          
        });

$(".cost").prop("readonly",true);

var day = dayjs().day();
if (day == 6) {
$("#6-week-date").text(dayjs().add(44, 'day').format('MMMM DD'));
$("#5-week-date").text(dayjs().add(37, 'day').format('MMMM DD'));
$("#4-week-date").text(dayjs().add(30, 'day').format('MMMM DD'));
$("#3-week-date").text(dayjs().add(23, 'day').format('MMMM DD'));

}
else if (day == 7) {
$("#6-week-date").text(dayjs().add(43, 'day').format('MMMM DD'));
$("#5-week-date").text(dayjs().add(36, 'day').format('MMMM DD'));
$("#4-week-date").text(dayjs().add(29, 'day').format('MMMM DD'));
$("#3-week-date").text(dayjs().add(22, 'day').format('MMMM DD'));

} else {
$("#6-week-date").text(dayjs().add(42, 'day').format('MMMM DD'));
$("#5-week-date").text(dayjs().add(35, 'day').format('MMMM DD'));
$("#4-week-date").text(dayjs().add(28, 'day').format('MMMM DD'));
$("#3-week-date").text(dayjs().add(21, 'day').format('MMMM DD'));

}


$(document).on("click", "#apply-expedite", function(){
if($(this).is(":checked")) {
$("#4-week-price").val($("#6-week-price").val());
$("#4-week").prop('checked', true).trigger('change');
} else {
$("#6-week-price").trigger('change');
}
});


$("#6-week-price").on('change', function(){
if(user.model?.discount) {
  var discount = 1 - Number(user.model.discount);
} else {
  discount = 1;
}
var startPrice = this.value;
$("#6-week-price").val((Number(startPrice)*discount).toFixed(2));
$("#6-week-discount").text('$' + (Number(startPrice).toFixed(2)));
$("#5-week-price").val(((Number(startPrice)+500)*discount).toFixed(2));
$("#5-week-discount").text('$' + (Number(startPrice)+500).toFixed(2));
$("#4-week-price").val(((Number(startPrice)+1000)*discount).toFixed(2));
$("#4-week-discount").text('$' + (Number(startPrice)+1000).toFixed(2));
$("#3-week-price").val(((Number(startPrice)+1500)*discount).toFixed(2));
$("#3-week-discount").text('$' + (Number(startPrice)+1500).toFixed(2));

});

$(document).ready(function() {
  



let intervalId;

function attemptAction() {
  // Attempt the action
  const success = doSomething();

  if (success) {
    // If successful, clear the interval
    clearInterval(intervalId);
    console.log("Action succeeded!");
  } else {
    console.log("Action failed, retrying...");
  }
}

// Placeholder for the action to be performed
function doSomething() {
  // Replace this with the actual action that needs to be performed
  // Return true for success, false for failure
  // For example:
  var checkUser = localStorage.getItem('pocketbase_auth');
  if(checkUser === null) {
    return false;
  } else {
    user = JSON.parse(localStorage.getItem('pocketbase_auth'));
    if(user.model?.reward) {
     var reward = user.model.reward; 
    } else {
      var reward = 0;
    }
    
    if((sessionStorage.getItem("rewards") !== null) && (Number((sessionStorage.getItem("rewards"))) > 0)) {
    var storedReward = Number(sessionStorage.getItem("rewards"));
    var checkReward = Math.min(reward, storedReward);
    } else {
    var checkReward = reward;
    }
    $("#reward-counter").val(checkReward);
    if(reward > 0) {
    $("#reward-box").removeClass("hide-price");
    $("#reward-counter").val(checkReward);
    $("#expedites-remaining").text(checkReward);
    }
    $("#6-week-price").trigger("change");
    return true;
  }

}

// Set the interval to run the action every 100 milliseconds
intervalId = setInterval(attemptAction, 100);

  

 


 var browser = $.browser.name +
               " v" + $.browser.versionNumber + 
               " on " + $.browser.platform;
 var message = {
    "system": browser
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
$('#qty-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#qty-popup",
    collision: "none"
  }
  });
$('#shipping-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#shipping-method",
    collision: "none"
  }
  });
$('#account-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#shipping-account",
    collision: "none"
  }
  });
$('#2day-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#2-day-date",
    collision: "none"
  }
  });
  $('#too-many-lines').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#2-day-date",
    collision: "none"
  }
  });
$('#verification').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#po-verification",
    collision: "none"
  }
  });
  $('#empty-po').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#po-number",
    collision: "none"
  }
  });
   $('#material-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#material-2",
    collision: "none"
  }
  });
$('#cert-0').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#cert-0-dialog",
    collision: "none"
  }
  });
$('#cert-1').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#cert-1-dialog",
    collision: "none"
  }
  });
$('#cert-2').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#cert-2-dialog",
    collision: "none"
  }
  });
$('#cert-3').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#cert-3-dialog",
    collision: "none"
  }
  });
$('#wall-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#wall",
    collision: "none"
  }
  });
$('#length-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#length-2",
    collision: "none"
  }
  });
  $('#high-tol').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#id-tol-2",
    collision: "none"
  }
  });
  $('#wall-savings').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#wall",
    collision: "none"
  }
  });
  $('#wall-tol-savings').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#wall-tol",
    collision: "none"
  }
  });
   $('#id-tol-savings').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#id-tol-2",
    collision: "none"
  }
  });
   $('#od-tol-savings').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#od-tol-2",
    collision: "none"
  }
  });
  $('#id-ref-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#id-ref-popup",
    collision: "none"
  }
  });
   $('#od-ref-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#od-ref-popup",
    collision: "none"
  }
  });
   $('#wall-ref-dialog-low').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#wall-ref-popup-low",
    collision: "none"
  }
  });
   $('#wall-ref-dialog-high').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#wall-ref-popup-high",
    collision: "none"
  }
  });
  $('#ref-dialog').dialog({
    autoOpen : false, modal : true, dialogClass: 'no-close', position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#id-3",
    collision: "none"
  },
  buttons: {
    'Continue Anyway': function() { 
              $("#custom-quote").prop('checked', true);
              $("#custom-quote").trigger('change');
              $(this).dialog("close");
              //calculate(true);
    },
    'Go Back': function() { 
              if (['Pebax 45D','Pebax 55D','Pebax 63D', 'Pebax 70D', 'Pebax 72D', 'Pebax 74D', 'Vestamid ML21', 'Grilamid L25'].includes($("#material-2").val()) ){
              $("#od-4").prop("checked", true);
              $("#od-4").trigger("change");
              } else {
              $("#id-3").prop("checked", true);
              $("#id-3").trigger("change");
              }
              $(this).dialog("close");
              //calculate(false);
    }
  }
  });
});


function checkLenTol(lengthTol) {
 
  if ( lengthTol !== 'min' ) { 
    $("#length-tol-2").addClass("error"); 
  } else { 
    $("#length-tol-2").removeClass("error");
}
}


  
$("#greenlight").on('change', function() {
if(this.checked){
  $("#price-block").css('display', 'flex');
  $("#custom-dialogue").css('display', 'none');
} else {
  $("#price-block").css('display', 'none');
}
  
});

$('#mode').on('change', function() {
if($(this).is(":checked")) {
$(".white-text,.text-block-71,.radio-button-label-3,.cert-title,.radio-button-label-2,.sales-rep,.text-block-38,.price-title,.cost,.text-block-37,.text-block-64,.text-block-65,.slider,.text-field-3,.leadtime,.shipping-title,.tol").addClass('light-text');
$('.image-171,.image-167').addClass('reverse');
$('.column-7').addClass('white-background');
$('.text-field-3.tol,.divider').addClass('gray-background');
$('.slim').addClass('no-border');
$('.range-slider').addClass('light-border');
$('#add-extrusion').addClass('blue-button');
sphereController.setValue("#e0e0e0");
$('.price-line').removeClass('chosen');
$('input[data-name=price]:checked').trigger('change');
} else {
$(".white-text,.text-block-71,.radio-button-label-3,.cert-title,.radio-button-label-2,.sales-rep,.text-block-38,.price-title,.cost,.text-block-37,.text-block-64,.text-block-65,.slider,.text-field-3,.leadtime,.shipping-title,.tol").removeClass('light-text');
$('.image-171,.image-167').removeClass('reverse');
$('.column-7').removeClass('white-background');
$('.text-field-3.tol,.divider').removeClass('gray-background');
$('.slim').removeClass('no-border');
$('.range-slider').removeClass('light-border');
$('#add-extrusion').removeClass('blue-button');
sphereController.setValue("#333");
$('.price-line').removeClass('chosen-light');
$('input[data-name=price]:checked').trigger('change');
}
});

$('input[data-name=price]').on('change', function() {
  var unit = $("#unit").val();
  if($("#mode").is(":checked")) {
  $('.price-line').removeClass('chosen-light');
  $(this).closest('div').addClass('chosen-light');
  } else {
  $('.price-line').removeClass('chosen');
  $(this).closest('div').addClass('chosen'); 
  }
  $("#apply-expedite").trigger('change');
});


$("#cert-0-dialog").click(function(){ $("#cert-0").dialog("open"); });
$("#cert-1-dialog").click(function(){ $("#cert-1").dialog("open"); });
$("#cert-2-dialog").click(function(){ $("#cert-2").dialog("open"); });
$("#cert-3-dialog").click(function(){ $("#cert-3").dialog("open"); });
$("#qty-popup").click(function(){ $("#qty-dialog").dialog("open"); });



// $("#wall").on('focusout', function() {
//   var step = 'WT changed to: ' + this.value;
//   updateJourney(step);  
// });
// $("#wall-range").on('mouseup', function() {
//   var step = 'WT changed to: ' + this.value;
//   updateJourney(step); 
// });



$("#custom-quantity").on('change', function() {
  if(this.value < 2501) {$("#custom-quantity").val(2501)}
  var step = 'QTY changed to: ' + this.value;
  updateJourney(step);
});
$("#quantity-2").on('change', function() {
if(this.value == 'More') {
$("#custom-quantity").css('display', 'block');
} else {
$("#custom-quantity").css('display', 'none');
}
//calculate(true);
var step = 'QTY changed to: ' + this.value;
updateJourney(step);
});


$("#material-2").on('change', function() {
  var step = 'Material changed to: ' + this.value;
  updateJourney(step);
  $(this).css('border', '0px');
  
  //calculate();
  
  if (['Pebax 25D','Pebax 35D', 'Pebax 40D','Pebax 45D','Pebax 55D','Pebax 63D','Pebax 72D','Vestamid ML21'].includes(this.value)) { $("#colorant").empty().append('<option value="">Select a Color...</option><option value="White">White</option><option value="Black">Black</option><option value="Cool Grey (7C)">Cool Grey (7C)</option><option value="Green (3248C)">Green (3248C)</option><option value="Green (3268C)">Green (3268C)</option><option value="Green (3298C)">Green (3298C)</option><option value="Blue (290C)">Blue (290C)</option><option value="Blue (295C)">Blue (295C)</option><option value="Blue (2925C)">Blue (2925C)</option><option value="Blue (301C)">Blue (301C)</option><option value="Purple (2655C)">Purple (2655C)</option>') }
  if (['LDPE'].includes(this.value)) {$("#color-2").empty().append('<option value="BaSO4">20% BaSO4</option>'); $("#colorant").empty().append('<option value="None">None</option><option value="Cool Grey (4C)">Cool Grey (4C)</option>')}
  if (['HDPE'].includes(this.value)) {$("#color-2").empty().append('<option value="None">None</option>'); $("#colorant").empty().append('<option value="None">None</option><option value="Cool Grey (4C)">Cool Grey (4C)</option>')}
  if (['Acetal','PET','Tecoflex 80A','Pellethane 80AE','Pellethane 90AE','Pellethane 55D','Pellethane 65D','NeuSoft UR862A','NeuSoft UR842A','NeuSoft UR852A','NeuSoft UR873A'].includes(this.value)) { $("#colorant option:first-child").prop("selectedIndex",0); $("input[id=color]").prop("checked", false).trigger("change").prop("disabled", true); $("#colorant").css('display', 'none'); } else { $("input[id=color]").prop("disabled", false); }
  if (['Pebax 25D','Pebax 35D','Pebax 55D', 'Pebax 63D', 'Pebax 72D', 'Pebax 45D'].includes(this.value)) { $("#color-2").empty().append('<option value="None">None</option><option value="BaSO4">20% BaSO4</option><option value="Lubricious Additive">Lubricious Additive</option><option value="BaSO4 & Lubricious Additive">20% BaSO4 & Lubricious Additive</option>'); return;} 
  if (['Pebax 40D','Pebax 70D'].includes(this.value)) { $("#color-2").empty().append('<option value="None">None</option><option value="BaSO4">20% BaSO4</option>'); return;} 
  if (['Vestamid ML21'].includes(this.value)) { $("#color-2").empty().append('<option value="None">None</option><option value="Lubricious Additive">Lubricious Additive</option>'); return; }
  else { $("#color-2").empty().append('<option value="None">None</option>'); }

});

function checkMaterial() {
  if (['Pebax 72D','Pebax 63D', 'Pebax 55D','Pebax 45D','Pebax 40D','Pebax 35D','Vestamid ML21', 'Pellethane 55D', 'Pellethane 65D'].includes($("#material-2").val())) {
    return true;
  }
  else {
    return false;
  }
}

function checkOD() {
  if(Number($("#cylinder-diameter-input").val()) >= 0.079 && Number($("#cylinder-diameter-input").val()) <= 0.315 ) {
    return true;
  } else {
    return false;
  }
    
}

function checkLength() {
  if(Number($("#length-2").val()) >= 12 && Number($("#length-2").val()) <= 72) {
    return true;
  } else {
    return false;
  }
}

function checkQuantity() {
  if(Number($("#quantity-2").val()) <= 2500) {
    return true;
  } else {
    return false;
  }
  
}


function calculate() {
  if (checkMaterial() && checkOD() && checkLength() && checkQuantity()) {
    $("#greenlight").prop('checked', true);
    $("#price-block").css('display', 'flex');
    var quantity = Number($("#quantity-2").val());
    if (quantity == 300) {
       $("#6-week-price").val(3600).trigger("change");
    } else if (quantity == 1000) {
       $("#6-week-price").val(3600 + 1050).trigger("change");
    } else if(quantity == 2500) {
       $("#6-week-price").val(3600 + 2200).trigger("change");
    }
   
    $("#custom-quote").prop('checked', false);
  } else {
    $("#greenlight").prop('checked', false);
    $("#price-block").css('display', 'none');
    $("#custom-quote").prop('checked', true);
  }
  
  
}

$(".updater").on('input', function() {
  calculate();
});

$("#color").on('click', function() {
var step = 'Color Toggled: ' + this.value;
updateJourney(step);
});
$("#colorant").on('change', function() {
materialController.setValue(this.value);
var step = 'Color changed to: ' + this.value;
updateJourney(step);  
});
$("#color-2").on('change', function() {
var step = 'Additive changed to: ' + this.value;
updateJourney(step);  
});

$("input[name=cert]").on('click', function() {
 var step = 'Cert changed to:' + this.id;
 updateJourney(step); 
});
$("input[name=price]").on('click', function() {
 var step = 'Leadtime changed to:' + this.id;
 updateJourney(step); 
});

$(window).keydown(function(event){
if(event.keyCode == 13) {
event.preventDefault();
return false;
}
});




function storeHistory() {
  if(sessionStorage.getItem("history") !== null) {
  sessionStorage.removeItem("history");
  sessionStorage.removeItem("rewards");
  }
  var previous = $("#quote").html();
  var previousReward = Number($("#reward-counter").val());
  sessionStorage.setItem("history", previous);
  sessionStorage.setItem("rewards", previousReward);
}

function getHistory() {
  var history = sessionStorage.getItem("history");
  if(history !== null) {
    if (confirm("Looks like you were already working on a quote, would you like to pick up where you left off?") == true) {
      $("#quote").empty().append(history);
      $("#quote-panel").css('display', 'flex');

       var getTotal = $(".price-item");
       var total = 0;
       for(var i = 0; i < getTotal.length; i++){
       total += Number($(getTotal[i]).val());
       }
      var shippingTotal = Number($("#shipping-total").val());
      $("#total-text").text(total + shippingTotal);
      $("#continue-to-checkout").removeClass('hide-price');
      styles();
      updateTotal();
      if (user.model.expand.blanket_po){
      updateBlanket();
      }
      var totalExpedites = Number(sessionStorage.getItem("rewards"));
      var expeditesInQuote = $(document).find('.expedited:checked').length;
      if ( totalExpedites > 0 ) {
      $("#reward-counter").val(totalExpedites);
      $("#expedites-remaining").text(totalExpedites);
      $("#reward-box").removeClass('hide-price');
      } else {
      $("#reward-box").addClass('hide-price');
      }
    } else {
      sessionStorage.removeItem("history");
      sessionStorage.removeItem("rewards");
    }
  }
}
getHistory();

// Helper function to get current profile type
function getCurrentProfileType() {
    if (window.profileManager && window.profileManager.currentSystem) {
        if (window.profileManager.currentSystem instanceof CircularHolesSystem) {
            return 'circular';
        } else if (window.profileManager.currentSystem instanceof PieSliceSystem) {
            return 'pie-slice';
        } else if (window.profileManager.currentSystem instanceof CrescentSystem) {
            return 'crescent';
        } else if (window.profileManager.currentSystem instanceof SmileSystem) {
            return 'smile';
        }
    }
    return 'circular'; // fallback
}

// Profile-specific data generators
function getCircularProfileData() {
    const system = window.profileManager.currentSystem;
    const holes = system.holes || [];
    
    let holeTML = '';
    for(let i = 0; i < holes.length; i++){
        const hole = holes[i];
        const holeNum = i + 1;
        const diameter = (hole.radius * 2).toFixed(3);
        const distance = hole.distance.toFixed(3);
        const angle = Math.round(hole.angle);
        
        if (hole.name === 'Central Lumen') {
            holeTML += `<div class="hole-layout">
                <p class="label quarter">${hole.name}</p>
                <input class="quote-input quarter" value="${diameter}" readonly></input>
                <div class="quarter ml-20 no-height"></div>
                <div class="quarter ml-20 no-height"></div>
            </div>`;
        } else {
            holeTML += `<div class="hole-layout">
                <p class="label quarter">${hole.name}</p>
                <input class="quote-input quarter" value="${diameter}" readonly></input>
                <input class="quote-input quarter" value="${distance}" readonly></input>
                <input class="quote-input quarter" value="${angle}" readonly></input>
            </div>`;
        }
    }
    
    return {
        profileName: 'Circular Holes Profile',
        profileId: 1,
        holesHeader: `<div class="hole-layout">
            <p class="label quarter">Lumen</p>
            <p class="label quarter ml-20">Diameter</p>
            <p class="label quarter ml-20">Distance</p>
            <p class="label quarter ml-20">Angle</p>
        </div>`,
        holeTML: holeTML,
        additionalParams: [
            
        ]
    };
}

function getPieSliceProfileData() {
    const system = window.profileManager.currentSystem;
    
    let slicesTML = '';
    for(let i = 0; i < system.sliceCount; i++){
        const sliceAngle = Math.round(system.sliceAngles[i] * 180 / Math.PI);
        slicesTML += `<div class="hole-layout">
            <p class="label quarter">Slice ${i + 1}</p>
            <input class="quote-input quarter" value="${sliceAngle}°" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>`;
    }
    
    // Add central hole if present
    if (system.hasCentralHole) {
        const centralDiameter = (system.innerDiameter).toFixed(3);
        slicesTML += `<div class="hole-layout">
            <p class="label quarter">Central Hole</p>
            <input class="quote-input quarter" value="${centralDiameter}" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>`;
    }
    
    return {
        profileName: 'Pie Slice Profile',
        profileId: 2,
        holesHeader: `<div class="hole-layout">
            <p class="label quarter">Lumen</p>
            <p class="label quarter ml-20">Value</p>
            <p class="label quarter ml-20"></p>
            <p class="label quarter ml-20"></p>
        </div>`,
        holeTML: slicesTML,
        additionalParams: [
            { label: 'Septum Thickness', value: system.septumThickness?.toFixed(3) || '0.005' },
            { label: 'Corner Radius', value: system.cornerRadius?.toFixed(3) || '0.000' },
            { label: 'Slice Count', value: system.sliceCount?.toString() || '3' }
        ]
    };
}

function getCrescentProfileData() {
    const system = window.profileManager.currentSystem;
    const circularDiameter = system.circularDiameter?.toFixed(3) || '0.050';
    const septumThickness = system.septumThickness?.toFixed(3) || '0.010';
    const cornerRadius = system.crescentCornerRadius?.toFixed(3) || '0.005';
    const wallMode = system.evenWallThickness ? 'Even Wall' : 'Independent Wall';
    
    const holeTML = `
        <div class="hole-layout">
            <p class="label quarter">Circular Lumen</p>
            <input class="quote-input quarter" value="${circularDiameter}" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>
        <div class="hole-layout">
            <p class="label quarter">Crescent Lumen</p>
            <input class="quote-input quarter" value="Shaped" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>
        <div class="hole-layout">
            <p class="label quarter">Wall Mode</p>
            <input class="quote-input quarter" value="${wallMode}" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>`;
    
    return {
        profileName: 'Crescent Lumen Profile',
        profileId: 3,
        holesHeader: `<div class="hole-layout">
            <p class="label quarter">Lumen</p>
            <p class="label quarter ml-20">Value</p>
            <p class="label quarter ml-20"></p>
            <p class="label quarter ml-20"></p>
        </div>`,
        holeTML: holeTML,
        additionalParams: [
            { label: 'Septum Thickness', value: septumThickness },
            { label: 'Corner Radius', value: cornerRadius }
        ]
    };
}

function getSmileProfileData() {
    const system = window.profileManager.currentSystem;
    const semicircleRadius = system.semicircleRadius?.toFixed(3) || '0.080';
    const cornerRadius = system.cornerRadius?.toFixed(3) || '0.010';
    
    let holeTML = `
        <div class="hole-layout">
            <p class="label quarter">Smile Lumen</p>
            <input class="quote-input quarter" value="${semicircleRadius}" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>`;
    
    // Add circular holes
    const holes = system.holes || [];
    for(let i = 0; i < holes.length; i++){
        const hole = holes[i];
        const diameter = (hole.radius * 2).toFixed(3);
        const distance = hole.distance.toFixed(3);
        const angle = Math.round(hole.angle);
        
        holeTML += `<div class="hole-layout">
            <p class="label quarter">${hole.name}</p>
            <input class="quote-input quarter" value="${diameter}" readonly></input>
            <input class="quote-input quarter" value="${distance}" readonly></input>
            <input class="quote-input quarter" value="${angle}" readonly></input>
        </div>`;
    }
    
    return {
        profileName: 'Smile Lumen Profile',
        profileId: 4,
        holesHeader: `<div class="hole-layout">
            <p class="label quarter">Lumen</p>
            <p class="label quarter ml-20">Diameter/Radius</p>
            <p class="label quarter ml-20">Distance</p>
            <p class="label quarter ml-20">Angle</p>
        </div>`,
        holeTML: holeTML,
        additionalParams: [
            { label: 'Corner Radius', value: cornerRadius }
        ]
    };
}

// Main function to get profile-specific data
function getProfileSpecificData() {
    const profileType = getCurrentProfileType();
    
    switch(profileType) {
        case 'circular':
            return getCircularProfileData();
        case 'pie-slice':
            return getPieSliceProfileData();
        case 'crescent':
            return getCrescentProfileData();
        case 'smile':
            return getSmileProfileData();
        default:
            return getCircularProfileData();
    }
}

// Updated createLine function
async function createLine(){
    var find = $(".line");
    var lineItem = find.length + 1;
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Capture thumbnail based on current system
    let thumbnailDataUrl;
    if (window.profileManager && window.profileManager.currentSystem) {
        // For now, we'll use a placeholder since the capture method might vary by system
        // You can implement system-specific capture methods later
        thumbnailDataUrl = await captureCurrentSystemThumbnail();
    } else {
        thumbnailDataUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3C/svg%3E";
    }
    
    // Get common data
    var material = $("#material-2").val();
    var additive = $("#color-2").val();
    var color = $("#colorant").val();
    var cert = $('input[data-name=cert]:checked').val();
    var unit = $("#unit").val();
    var price = $('#'+ $('input[data-name=price]:checked').val()).val();
    var leadtime = $('input[data-name=price]:checked').val();
    var od = $("#cylinder-diameter-input").val();
    var odTol = $("#od-tol-2").val();
    var lenTol = $("#length-tol-2").val();
    var length = $("#length-2").val();
    var greenlight = $("#greenlight").is(":checked");
    
    if($("#apply-expedite").is(":checked")) {
        var expedite = `style="display: block;margin-right:5px;" checked`;
        var label = `style="display:flex;"`;
    } else {
        var expedite = `style="display:none;margin-right:5px;"`;
        var label = `style="display:none;"`;
    }
    
    var thumbnailHtml = `<div class="thumbnail-container">
        <img src="${thumbnailDataUrl}" alt="Model Thumbnail" class="model-thumbnail" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin: 10px;">
    </div>`;
    
    if($("#quantity-2").val() == 'More') {
        var quantity = $("#custom-quantity").val();
    } else {
        var quantity = $("#quantity-2").val();
    }
    
    // Get profile-specific data
    const profileData = getProfileSpecificData();
    
    // Get shipping info
    if($("#shipping-carrier").val()) {
        var shipping = $("#custom-method").val(); 
        var account = $("#shipping-account").val(); 
        var carrier = $("#shipping-carrier").val(); 
        $("#custom-carrier").val(carrier); 
        $("#account-number").val(account);
    } else {
        var shipping = $("#shipping-method").val(); 
        var account = ""; 
        var carrier = "";
    }
    
    // Build additional parameters HTML
    let additionalParamsHTML = '';
    if (profileData.additionalParams && profileData.additionalParams.length > 0) {
        additionalParamsHTML = '<div class="quote-divider"></div>';
        profileData.additionalParams.forEach(param => {
            additionalParamsHTML += `<div class="item"><p class="label">${param.label}</p><input class="quote-input" value="${param.value}" readonly></input></div>`;
        });
    }
    
    // Generate line HTML
    if(!$("#custom-quote").is(":checked")){
        var lineHtml = 
        `<div class="line" id="line${lineItem}">
        <div class="title-block"><div style="display:flex;"><p class="delete">x</p><p class="line-title" profileId="${profileData.profileId}">Line ${lineItem} (${unit}) ${profileData.profileName}</p><p class="edit" id="${lineItem}">Edit</p></div>${thumbnailHtml}</div>

        <div class="row">
          <div class="col">
            <div class="item"><p class="label">OD</p><input class="quote-input" id="l${lineItem}-od" value="${od}" readonly></input></div>
            <div class="item"><p class="label">Length</p><input class="quote-input line-length" id="l${lineItem}-length" value="${length}" readonly></input></div>
            <div class="item"><p class="label">Material</p><input class="quote-input" id="l${lineItem}-material" value="${material}" readonly></input></div>
            <div class="item"><p class="label">Additive</p><input class="quote-input" id="l${lineItem}-additive" value="${additive}" readonly></input></div>
            <div class="item"><p class="label">Color</p><input class="quote-input" id="l${lineItem}-color" value="${color}" readonly></input></div>
            <div class="item"><p class="label">Cert Level</p><input class="quote-input" id="l${lineItem}-cert" value="${cert}" readonly></input></div>
            ${additionalParamsHTML}
          </div>
          <div class="col">
            <div class="item"><p class="label">OD Tol</p><input class="quote-input" id="l${lineItem}-od-tol" value="${odTol}" readonly></input></div>
            <div class="item"><p class="label">Length Tol</p><input class="quote-input" id="l${lineItem}-length-tol" value="${lenTol}" readonly></input></div>
            <div class="item"><p class="label">Quantity (Feet)</p><input class="quote-input" id="l${lineItem}-quantity" value="${quantity}" readonly></input></div>
            <div class="item input-remove"><p class="label">Lead Time</p><input class="quote-input line-leadtime" id="l${lineItem}-leadtime" value="${leadtime.replace('-price','')}" readonly></input></div>
            <div class="item input-remove"><p class="label">Price($)</p><input class="quote-input price-item" id="l${lineItem}-price" value="${price}" readonly></input></div>
            <div class="item input-remove"><p class="label">Shipping Method</p><input class="quote-input shipping-line-item" id="l${lineItem}-shipping" value="${shipping}" readonly method="${shipping}" carrier="${carrier}" account="${account}"></input></div>
            <label class="label" ${label}><input type="checkbox" class="expedited" id="l${lineItem}-expedite" readonly ${expedite} onclick="return false"></input>Free Expedite Applied</label>
          </div>
          <input class="linenumber" id="l${lineItem}-line" value="${lineItem}" readonly style="display:none;"></input>
          <input class="quote-input unit" id="l${lineItem}-unit" value="${unit}" readonly style="display:none;"></input>
          <input type="checkbox" class="line-greenlight" id="l${lineItem}-greenlight" value="${greenlight}" readonly style="display:none;"></input>
        </div>
        <div class="quote-divider"></div>
        <div class="row" id="l${lineItem}-holes-container" style="flex-direction: column;">
          ${profileData.holesHeader}
          ${profileData.holeTML}
        </div>
        </div>`;
    } else {
        var lineHtml = 
        `<div class="line" id="line${lineItem}">
        <div class="title-block"><div style="display:flex;"><p class="delete">x</p><p class="line-title" profileId="${profileData.profileId}">Line ${lineItem} (${unit}) ${profileData.profileName}</p><p class="edit" id="${lineItem}">Edit</p></div>${thumbnailHtml}</div>
        <div class="row">
        <p class="label profile" profileId="${profileData.profileId}">${profileData.profileName}</p>
          <div class="col">
            <div class="item"><p class="label">OD</p><input class="quote-input" id="l${lineItem}-od" value="${od}" readonly></input></div>
            <div class="item"><p class="label">Length</p><input class="quote-input line-length" id="l${lineItem}-length" value="${length}" readonly></input></div>
            <div class="item"><p class="label">Material</p><input class="quote-input" id="l${lineItem}-material" value="${material}" readonly></input></div>
            <div class="item"><p class="label">Additive</p><input class="quote-input" id="l${lineItem}-additive" value="${additive}" readonly></input></div>
            <div class="item"><p class="label">Color</p><input class="quote-input" id="l${lineItem}-color" value="${color}" readonly></input></div>
            <div class="item"><p class="label">Cert Level</p><input class="quote-input" id="l${lineItem}-cert" value="${cert}" readonly></input></div>
            ${additionalParamsHTML}
          </div>
          <div class="col">
            <div class="item"><p class="label">OD Tol</p><input class="quote-input" id="l${lineItem}-od-tol" value="${odTol}" readonly></input></div>
            <div class="item"><p class="label">Length Tol</p><input class="quote-input" id="l${lineItem}-length-tol" value="${lenTol}" readonly></input></div>
            <div class="item"><p class="label">Quantity (Feet)</p><input class="quote-input" id="l${lineItem}-quantity" value="${quantity}" readonly></input></div>
            <div class="item input-remove"><p class="label">Lead Time</p><input class="quote-input line-leadtime" id="l${lineItem}-leadtime" value="${leadtime.replace('-price','')}" readonly></input></div>
            <div class="item input-remove"><p class="label">Price($)</p><input class="quote-input price-item" id="l${lineItem}-price" value="${price}" readonly></input></div>
            <div class="item input-remove"><p class="label">Shipping Method</p><input class="quote-input shipping-line-item" id="l${lineItem}-shipping" value="${shipping}" readonly method="${shipping}" carrier="${carrier}" account="${account}"></input></div>
            <label class="label" ${label}><input type="checkbox" class="expedited" id="l${lineItem}-expedite" readonly ${expedite} onclick="return false"></input>Free Expedite Applied</label>
          </div>
          <input class="linenumber" id="l${lineItem}-line" value="${lineItem}" readonly style="display:none;"></input>
          <input class="quote-input unit" id="l${lineItem}-unit" value="${unit}" readonly style="display:none;"></input>
          <input type="checkbox" class="line-greenlight" id="l${lineItem}-greenlight" value="${greenlight}" readonly style="display:none;" checked></input>
        </div>
        <div class="quote-divider"></div>
        <div class="row" id="l${lineItem}-holes-container" style="flex-direction: column;">
          ${profileData.holesHeader}
          ${profileData.holeTML}
        </div>
        </div>`;
    }
    
    $("#quote").append(lineHtml);
    storeHistory();
    
    if (user.model.expand.blanket_po){
        updateBlanket();
    }
    updateTotal();
}

// // Helper function to capture thumbnail - you'll need to implement this based on your systems
// async function captureCurrentSystemThumbnail() {
//     try {
//         if (window.profileManager && window.profileManager.currentSystem) {
//             // If the current system has a capture method, use it
//             if (typeof window.profileManager.currentSystem.captureModelImage === 'function') {
//                 return await window.profileManager.currentSystem.captureModelImage(800, 800);
//             }
//             // Otherwise, use a generic capture method if available
//             else if (typeof cylinderInstance !== 'undefined' && cylinderInstance.captureModelImage) {
//                 return await cylinderInstance.captureModelImage(800, 800);
//             }
//         }
//         // Fallback to placeholder
//         return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em'%3EProfile%3C/text%3E%3C/svg%3E";
//     } catch (error) {
//         console.warn('Could not capture thumbnail:', error);
//         return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em'%3EProfile%3C/text%3E%3C/svg%3E";
//     }
// }
async function captureCurrentSystemThumbnail() {
    try {
        if (!window.profileManager || !window.profileManager.currentSystem) {
            return getPlaceholderThumbnail();
        }
        
        // Store current print mode state
        const wasInPrintMode = isPrintMode;
        const currentCamera = globalCurrentCamera;
        const wasOrthographic = !isPerspectiveView;
        
        // Temporarily enter print mode for clean capture
        if (!wasInPrintMode) {
            await enterPrintModeForCapture();
        }
        
        // Switch to orthographic view if not already
        if (!wasOrthographic) {
            switchCamera();
        }
        
        // Wait for render to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Capture the image
        const thumbnailDataUrl = await captureThumbnailImage(400, 400);
        
        // Restore original state
        if (!wasInPrintMode) {
            await exitPrintModeForCapture();
        }
        
        if (!wasOrthographic) {
            switchCamera();
        }
        
        return thumbnailDataUrl;
        
    } catch (error) {
        console.warn('Could not capture thumbnail:', error);
        return getPlaceholderThumbnail();
    }
}

// Enter print mode specifically for thumbnail capture
async function enterPrintModeForCapture() {
    // Force switch to orthographic camera if not already
    if (isPerspectiveView) {
        switchCamera();
    }
    
    // Change background to white for clean capture
    globalScene.background = new THREE.Color(0xffffff);
    
    // Show CSS2D renderer for labels/dimensions
    css2dRenderer.domElement.style.display = 'block';
    
    // Delegate to current system's print mode logic
    if (window.profileManager && window.profileManager.currentSystem) {
        if (typeof window.profileManager.currentSystem.enterPrintMode === 'function') {
            window.profileManager.currentSystem.enterPrintMode();
        }
    }
    
    // Set print mode flag
    isPrintMode = true;
    
    // Force render
    globalRenderer.render(globalScene, globalCurrentCamera);
    if (css2dRenderer.domElement.style.display !== 'none') {
        css2dRenderer.render(globalScene, globalCurrentCamera);
    }
    
    // Wait for everything to render
    await new Promise(resolve => setTimeout(resolve, 50));
}

// Exit print mode after thumbnail capture
async function exitPrintModeForCapture() {
    // Restore normal background
    globalScene.background = new THREE.Color(0xfcfcfc);
    
    // Hide CSS2D renderer
    css2dRenderer.domElement.style.display = 'none';
    
    // Delegate to current system's print mode logic
    if (window.profileManager && window.profileManager.currentSystem) {
        if (typeof window.profileManager.currentSystem.exitPrintMode === 'function') {
            window.profileManager.currentSystem.exitPrintMode();
        }
    }
    
    // Reset print mode flag
    isPrintMode = false;
    
    // Force render
    globalRenderer.render(globalScene, globalCurrentCamera);
}

// Actual image capture function
async function captureThumbnailImage(width = 400, height = 400) {
    return new Promise((resolve) => {
        // Create a temporary canvas for compositing
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Capture the WebGL renderer
        const rendererCanvas = globalRenderer.domElement;
        
        // Calculate scaling to fit the thumbnail while maintaining aspect ratio
        const rendererAspect = rendererCanvas.width / rendererCanvas.height;
        const thumbnailAspect = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (rendererAspect > thumbnailAspect) {
            // Renderer is wider, fit by height
            drawHeight = height;
            drawWidth = height * rendererAspect;
            drawX = (width - drawWidth) / 2;
            drawY = 0;
        } else {
            // Renderer is taller, fit by width
            drawWidth = width;
            drawHeight = width / rendererAspect;
            drawX = 0;
            drawY = (height - drawHeight) / 2;
        }
        
        // Draw the 3D content
        ctx.drawImage(rendererCanvas, drawX, drawY, drawWidth, drawHeight);
        
        // If CSS2D renderer is visible, overlay it
        if (css2dRenderer.domElement.style.display !== 'none') {
            const css2dCanvas = document.createElement('canvas');
            css2dCanvas.width = css2dRenderer.domElement.offsetWidth;
            css2dCanvas.height = css2dRenderer.domElement.offsetHeight;
            const css2dCtx = css2dCanvas.getContext('2d');
            
            // Convert CSS2D DOM elements to canvas
            html2canvas(css2dRenderer.domElement, {
                canvas: css2dCanvas,
                backgroundColor: null,
                allowTaint: true,
                useCORS: true
            }).then((css2dCanvas) => {
                // Scale and draw the CSS2D content
                ctx.drawImage(css2dCanvas, drawX, drawY, drawWidth, drawHeight);
                
                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/png', 0.9);
                resolve(dataUrl);
            }).catch(() => {
                // If html2canvas fails, just return the WebGL capture
                const dataUrl = canvas.toDataURL('image/png', 0.9);
                resolve(dataUrl);
            });
        } else {
            // No CSS2D content, just return the WebGL capture
            const dataUrl = canvas.toDataURL('image/png', 0.9);
            resolve(dataUrl);
        }
    });
}

// Fallback placeholder thumbnail
function getPlaceholderThumbnail() {
    const profileType = getCurrentProfileType();
    const profileNames = {
        'circular': 'Circular',
        'pie-slice': 'Pie Slice',
        'crescent': 'Crescent',
        'smile': 'Smile'
    };
    
    const profileName = profileNames[profileType] || 'Profile';
    
    return `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <rect width="400" height="400" fill="#f5f5f5" stroke="#ddd" stroke-width="2"/>
            <circle cx="200" cy="200" r="150" fill="none" stroke="#333" stroke-width="3"/>
            <text x="200" y="200" text-anchor="middle" dy="0.35em" font-family="Arial" font-size="16" fill="#666">${profileName} Profile</text>
            <text x="200" y="220" text-anchor="middle" dy="0.35em" font-family="Arial" font-size="12" fill="#999">Thumbnail</text>
        </svg>
    `)}`;
}

function updateBlanket() {
updateTotal();
var total = Number($("#total-price").val());
$("#blanket-value").text($("#selectedBlanket").val());
$("#remaining").text(Number($("#selectedBlanket").val()) - total);
$("#order-price").text(total);
if ( Number($("#selectedBlanket").val()) - total <= -10000 ) {
  $("#open-blanket").addClass('hide-price');
  $("#blanket-box").addClass('hide-price');
  $("#po-details").append(`<a href="mailto:`+user.model.sales_rep+`"><p class="text-block-39 center">Blanket PO has been exhausted. Click here to contact your rep.</p></a>`);
}
$("#blanket-po-number").val($('#selectedBlanket option:selected').attr('recordid'));  
$("#new-blanket-po-amount").val($("#remaining").text());
}
$("#selectedBlanket").on('change', function(){
  updateBlanket();
  var step = 'Blanket PO has been changed to: ' + this.value;
  updateJourney(step); 
});
function styles() {
  var lineItem = 1;
  var greenlight = $(".line-greenlight");
  for(var i = 0; i < greenlight.length; i++){
    if ($(greenlight[i]).is(":checked")) {
    var line = $(greenlight[i]).closest('.line');
    //line.find('.quote-input').addClass('red-input');
    line.addClass('red-line');
    line.find('.input-remove').addClass('hide-price');
    }
    else {
    var line = $(greenlight[i]).closest('.line');
    //line.find('.quote-input').removeClass('red-input');
    line.removeClass('red-line');
    line.find('.input-remove').removeClass('hide-price');
    }
  }
  if($('.line-greenlight:checkbox:checked').length > 0) {
  
    $("#view-quote").text("View Custom Quote");
    $("#view-quote").closest('div').css('background-color', '#f06f59');
    $('input[id="final-check"]').prop("checked", false);
    $("#final-check-text").val(false);
  } else {
  
    $("#view-quote").text("View Instant Quote");
    $("#view-quote").closest('div').css('background-color', '#91c765');
    $('input[id="final-check"]').prop("checked", true);
    $("#final-check-text").val(true);
  }
  var leadtime =$(".line-leadtime");
  for(var i = 0; i < leadtime.length; i++){
    if ($(leadtime[i]).val() == '2-day') {  
      
      if ( user.model.credit_terms == false ) {
      $("#view-po").addClass('hide-price');
      } else {
      $("#view-po").removeClass('hide-price');
      }
      return;
    } else {
      $("#view-po").removeClass('hide-price');
    }
  }
  
}


$("#add-extrusion").click(async function() {
if($("#material-2").val() == '') {$("#material-2").css('border', '3px solid #ff6f6f');$("#material-2").get(0).scrollIntoView(); $("#greenlight").prop('checked', false); $("greenlight").trigger('change');  return;}
if ($("#greenlight").is(":checked")){
 if(!$("#shipping-carrier").val() && !$("#shipping-method").val()) {
    $("#shipping-dialog").dialog("open");
    return false;
  }
  if($("#shipping-carrier").val() && !$("#shipping-account").val()) {
    $("#account-dialog").dialog("open");
    return false;
  }
  if ($(".line").length >= 9) {
    $("#too-many-lines").dialog("open");
    return false;
  }
await createLine();
styles();

if( $("#apply-expedite").is(":checked") ) {
  //get total number of expedites used in the quote, including the one that was potentially just added
  var expeditesInQuote = $(document).find('.expedited:checked').length;
  var expeditesRemaining = Number($("#reward-counter").val()) - 1;
  if ( expeditesRemaining > 0 ) {
  $("#reward-counter").val(Number($("#reward-counter").val()) - 1);
  $("#expedites-remaining").text(expeditesRemaining);
  } else {
  $("#reward-counter").val(Number($("#reward-counter").val()) - 1);
  $("#expedites-remaining").text(expeditesRemaining);
  $("#reward-box").addClass('hide-price');
  }
  }
  
resetInputs();
$("#quote-panel").css('display', 'flex');
$("#left-panel-download").removeClass('hide-price');
$(".lil-gui").addClass('hide-price');
$("#price-block").css('display', 'none');
$("#level-0").prop('checked', true);
$("#next-step").removeClass('hide-price');
$("#continue-to-checkout").removeClass('hide-price');
} else {
  if($("#custom-quote").is(":checked")){
  $("#custom-dialogue").css('display', 'flex');
  } 
  //else { createLine(); $("#price-block").css('display', 'none'); $("#quote-panel").css('display', 'flex'); $(".lil-gui").addClass('hide-price'); styles();}
}
storeHistory();
var find = $(".line");
packageQuote();
var quoteContents = JSON.parse($("#order").val());
var message = {
  "number_of_lines": find.length,
  "quote_contents": quoteContents
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
 setTimeout(function() {
 var step = 'Line Added To Quote';
 updateJourney(step); 
}, 1000);


});


function resetInputs() {
  $("#apply-expedite").prop('checked', false);
  if(Number($("#reward-counter").val()) <= 0) {
  $("#reward-box").addClass('hide-price');
  }
//   if ( $("#unit").val() == 'mm' ) { $("#unit").val('in').trigger('change'); }
//   setTimeout(function() {
//   $("#od-3,#od-range").val(0.120);
//   $("#id-2,#id-range").val(0.100);
//   $("#wall, #wall-range").val(0.01);
//   $("#od-3,#od-range,#id-2,#id-range,#wall,#wall-range").trigger('change');
//   $("#id-tol-2,#wall-tol").val(0.001).trigger('change');
// }, 500);

  
//   $("#length-2,#len-range").val(12);
//   $("#length-tol-2").val('MIN');
  
//   $("#quantity-2").val(300);
//   $("#custom-quantity").val('');
//   $("#custom-quantity").css('display','none');
//   $("#od-tol-2").val('REF');
//   $('input[id="od-4"]').prop("checked",true);
//   $('input[id="od-4"]').trigger("change");
  
//   $("#material-2").val($("#material-2 option:first").val());
//   $("#color-2").val($("#color-2 option:first").val());
//   $("#colorant").val($("#colorant option:first").val());
//   $("#color").trigger("change");
//   $("#price-block").css('display', 'none');
//   $("#carrier-details").addClass('hide-price');
//   $("#view-carrier").text("Charge to your shipping account");
//   $("#shipping-account").val("");
//   $("#custom-method").empty().append('<option value="Select Method...">Select Method...</option>').val($("#custom-method option:first").val());
//   $("#shipping-carrier").val($("#shipping-carrier option:first").val());
//   $("#shipping-method").val($("#shipping-method option:first").val());
//   $("#id-tol-savings").dialog("close");
//   $("#od-tol-savings").dialog("close");
//   $("#wall-savings").dialog("close");
//   $("#wall-tol-savings").dialog("close");
  
}

$("input[id=2-day]").click(function() {
  if( user.model.credit_terms == false ) {
  $("#2day-dialog").dialog("open");
  }
});

$("#custom-change").click(function() {
  
  $("#wall, #id-2, #od-3, #length-2").css('border', 'none');
  $("#id-tol-2, #od-tol-2, #length-tol-2, #wall-tol").css('border', '1px solid white');
  $("#custom-quote").prop('checked', true);
  $("#custom-quote").trigger('change');
  if($('#editing').css('display') == 'none') { createLine(); styles();$("#next-step").removeClass('hide-price');} else { update(); styles();}
  $("#quote-panel").css('display', 'flex');
  $(".lil-gui").addClass('hide-price');
  $("#custom-dialogue").css('display', 'none');
  $(".ui-dialog-content").dialog("close");
  resetInputs();
  var message = {
  "custom_line_added": true
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
});
$("#custom-quote").on('change', function() {
  if ($(this).is(":checked")) {
    
    $("#price-block").css('display', 'none');
    //document.querySelectorAll('.input-remove').forEach(e => e.hide());
    
    //$("#wall,#length-2,#length-tol-2,#id-tol-2,#wall-tol,#id-2,#quantity-2").removeClass("error");
  }
});

$("#continue,#continue-to-checkout,#editContinue").click(function() {
  styles();
  if($('input[id="final-check"]').is(":checked")) {
  //Order is greenlight
  $("#final-details").css('display', 'block');  
  $('html, body').animate({
        scrollTop: $("#final-details").offset().top
    }, 2000);
    updateTotal();
    if (user.model.expand.blanket_po){
    updateBlanket();
    }
  } else {
  //Order is custom
  $("#custom-menu").removeClass('hide-price');
  $('html, body').animate({
        scrollTop: $("#custom-menu").offset().top
    }, 2000);
  }
  
  $("#next-step").addClass('hide-price');
 var step = 'Continue to checkout clicked';
 updateJourney(step); 
});

$("#close-quote").click(function(){
  $(".lil-gui").removeClass('hide-price');
});

$("#open-quote").click(function(){
  $(".lil-gui").addClass('hide-price');
});
$("#close-terms").click(function(){
  $("#terms").addClass('hide-price');
});
$("#add-another").click(function(){
  $("#next-step").addClass('hide-price');
  $("#quote-panel").css('display', 'none');
  $(".lil-gui").removeClass('hide-price');
  var step = 'Add another extrusion was clicked';
  updateJourney(step); 
});

$("#view-carrier").click(function() {
  if($("#carrier-details").hasClass('hide-price')) {
  $("#carrier-details").removeClass('hide-price');
  $(this).text("I don't want to use my shipping account");
  $("#shipping-account").val($("#account-number").val());
  if($("#custom-carrier").val()) {$("#shipping-carrier").val($("#custom-carrier").val());};
  } else {
  $("#carrier-details").addClass('hide-price');
  $(this).text('Charge to your shipping account');
  $("#shipping-account").val('');
  $("#custom-method").empty().append('<option value="Select Method...">Select Method...</option>').val($("#custom-method option:first").val());
  $("#shipping-carrier").val($("#shipping-carrier option:first").val());
  }
  $("#shipping-carrier").trigger("change");
   var step = 'Custom shipping toggled';
   updateJourney(step); 
});
$("#shipping-method").on('change', function() {
  $("#shipping-account").val('');
  $("#custom-method").empty().append('<option value="Select Method...">Select Method...</option>').val($("#custom-method option:first").val());
  $("#shipping-carrier").val($("#shipping-carrier option:first").val());
  $("#carrier-details").addClass('hide-price');

 var step = 'Shipping method changed to:' + this.value;
 updateJourney(step); 

});
$("#view-po").click(function() {
  $("#po-details").css('display', 'flex');
  var step = 'PO selected as checkout method';
  updateJourney(step); 
});

$("#shipping-carrier").on('change', function() {
  if(this.value == 'UPS') {
    $("#custom-method").empty().append('<option value="Select Method...">Select Method...</option><option value="UPS Ground">UPS Ground</option><option value="UPS 2nd Day Air">UPS 2nd Day Air</option><option value="UPS 3rd Day Select">UPS 3rd Day Select</option><option value="UPS Next Day Air">UPS Next Day Air</option><option value="UPS Worldwide Expedited">UPS Worldwide Expedited</option><option value="UPS Worldwide Saver">UPS Worldwide Saver</option>');
    
  } else {
    $("#custom-method").empty().append('<option value="Select Method...">Select Method...</option><option value="FedEx Ground">FedEx Ground</option><option value="FedEx Priority Overnight">FedEx Priority Overnight</option><option value="FedEx Standard Overnight">FedEx Standard Overnight</option><option value="FedEx 2 Day">FedEx 2 Day</option><option value="FedEx Express Saver">FedEx Express Saver</option><option value="FedEx International First">FedEx International First</option><option value="FedEx International Priority">FedEx International Priority</option><option value="FedEx International Priority Express">FedEx International Priority Express</option><option value="FedEx International Economy">FedEx International Economy</option>');
  }
 var step = 'Custom shipping carrier changed to: ' + this.value;
 updateJourney(step); 
});
$("#shipping-account").on('change', function() {
 var step = 'Shipping account number changed to :' + this.value;
 updateJourney(step); 
});
$("#custom-method").on('change', function() {
 var step = 'Custom shipping method changed to: ' + this.value;
 updateJourney(step); 
});
$(document).on("click", ".edit", function(){

$("#next-step").addClass('hide-price');
$("#final-details").css('display', 'none');
$("#custom-menu").addClass('hide-price');
var line = this.id;
$(".line").not("#line"+line).addClass('opacity');
$("#custom-quote").prop("checked",($("#l"+ line + "-greenlight").is(":checked")));
var previousUnit = $("#unit").val();
$("#unit").val($("#l"+ line + "-unit").val());
$("#unit").trigger('change', [previousUnit]);
$("#cylinder-diameter, #cylinder-diameter-input").val($("#l"+ line + "-od").val());
  //odController.setValue(Number($("#l"+ line + "-od").val()));
var allHoles = $("#line"+line).find(".hole-layout");
var holes = allHoles.slice(1);
$("#hole-count").val(holes.length);
if($(holes[0]).children(":first").text() == 'Central Lumen') {
  $("#central-lumen").prop('checked', true);
} else {
  $("#central-lumen").prop('checked', false);
}
const newCount = parseInt(holes.length);
const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        cylinderInstance.includeCentralLumen = centralLumenCheckbox.checked;
        
    if (newCount >= 2 && newCount <= 9) {
        cylinderInstance.regenerateHoles(newCount);
        
        // Directly update the hole data
        for(var i = 0; i < holes.length; i++){
            var inputs = $(holes[i]).find('input');
            const diameter = parseFloat($(inputs[0]).val());
            const distance = parseFloat($(inputs[1]).val());
            const angle = parseFloat($(inputs[2]).val());
            
            // Update the hole object directly
            if (cylinderInstance.holes[i]) {
                cylinderInstance.holes[i].radius = diameter / 2;
                cylinderInstance.holes[i].distance = distance;
                cylinderInstance.holes[i].angle = angle;
                
                // Convert polar to cartesian
                const { x, y } = cylinderInstance.polarToCartesian(angle, distance);
                cylinderInstance.holes[i].x = x;
                cylinderInstance.holes[i].y = y;
            }
            
            // Set UI values
            $("#h"+i+"-diameter, #h"+i+"-diameter-range").val(diameter);
            $("#h"+i+"-distance, #h"+i+"-distance-range").val(distance);
            $("#h"+i+"-angle, #h"+i+"-angle-range").val(angle);
        }
        
        // Refresh the 3D visuals
        cylinderInstance.createPolarTransformControls();
        cylinderInstance.createHoleMarkers();
        cylinderInstance.updateCylinderGeometry();
        cylinderInstance.render();
    }
$("#length-2, #len-range").val($("#l"+ line + "-length").val());
$("#cylinder-diameter-input").trigger("change");
$("#od-tol-2").val($("#l"+ line + "-od-tol").val());

$("#length-tol-2").val($("#l"+ line + "-length-tol").val());
$("#material-2").val($("#l"+ line + "-material").val()).trigger('change');
setTimeout(function() {
$("#color-2").val($("#l"+ line + "-additive").val());
$("#colorant").val($("#l"+ line + "-color").val());
}, 500);
if(Number($("#l"+ line + "-quantity").val()) > 2500) {
  $("#custom-quantity").css('display', 'block');
  $("#quantity-2").val('More');
  $("#custom-quantity").val(Number($("#l"+ line + "-quantity").val()));
} else {
  $("#quantity-2").val($("#l"+ line + "-quantity").val()); 
}  
$("#editing").css('display', 'flex');
$("#now-editing").val(line);
$(".update, .update-button").css('display', 'flex');
   if(!$("#l" + line +  "-greenlight").is(":checked")){
//var radioId = $("#l"+line+"-leadtime").val().replace('-price','');
var radioId = $("#l"+line+"-leadtime").val();
var certId = $("#l"+line+"-cert").val();
$("#"+radioId).prop('checked', true).trigger('change');
$("#level-"+certId).prop('checked', true);
   }
$("#cylinder-diameter-input").trigger('change');

if($("#l"+ line + "-shipping").attr("account").length > 0) {
  $("#carrier-details").removeClass('hide-price');
  $("#view-carrier").text("I don't want to use my shipping account");
  $("#shipping-carrier").val($("#l"+ line + "-shipping").attr("carrier")).trigger('change');
  $("#shipping-account").val($("#l"+ line + "-shipping").attr("account"));
  $("#custom-method").val($("#l"+ line + "-shipping").attr("method"));
  $("#shipping-method").val($("#shipping-method option:first").val());
  
} else {
   $("#carrier-details").addClass('hide-price');
   $("#view-carrier").text("Charge to your shipping account");
   $("#shipping-method").val($("#l"+ line + "-shipping").attr("method"));
   $("#shipping-account").val("");
   $("#custom-method").val($("#custom-method option:first").val());
   $("#shipping-carrier").val($("#shipping-carrier option:first").val());
}
  
$("#submit-container").css('display', 'none');
  
 
  
  
  
 // calculate(false);
  if($("#l" + line +  "-greenlight").is(":checked")){
    $("#price-block").css('display', 'none');
  } else {
    $("#price-block").css('display', 'flex');
  }
  
  
if( $("#l"+ line + "-expedite").is(":checked") ) {
  //get total number of expedites used in the quote, including the one that was potentially just added
  $("#reward-box").removeClass("hide-price");
  var expeditesRemaining = Number($("#reward-counter").val()) + 1;
  $("#reward-counter").val(expeditesRemaining);
  $("#expedites-remaining").text(expeditesRemaining);
  $("#apply-expedite").prop('checked', true).trigger('change');
}

 var step = 'A quote line was edited';
 updateJourney(step); 
});


async function update() {
var line = $("#now-editing").val();
// Capture new thumbnail
const thumbnailDataUrl = await cylinderInstance.captureModelImage(800, 800);
// Update the thumbnail in the existing line
    const existingThumbnail = $(`#line${line} .model-thumbnail`);
    if (existingThumbnail.length > 0) {
        existingThumbnail.attr('src', thumbnailDataUrl);
    } else {
        // If no thumbnail exists, add one
        const thumbnailHtml = `<div class="thumbnail-container">
            <img src="${thumbnailDataUrl}" alt="Model Thumbnail" class="model-thumbnail" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin: 10px;">
        </div>`;
        $(`#line${line} .title-block`).append(thumbnailHtml);
    }
$("#l"+ line + "-unit").val($("#unit").val());
$("#line"+line).find('.line-title').text("Line "+line+" ("+$("#unit").val()+")");

$("#l"+ line + "-od").val($("#cylinder-diameter-input").val());

$("#l"+ line + "-length").val($("#length-2").val());

$("#l"+ line + "-od-tol").val($("#od-tol-2").val());

$("#l"+ line + "-length-tol").val($("#length-tol-2").val());
$("#l"+ line + "-material").val($("#material-2").val());
$("#l"+ line + "-additive").val($("#color-2").val());
$("#l"+ line + "-color").val($("#colorant").val());
  
var holes = $(".hole");
var holeTML = `<div class="hole-layout">
    <p class="label quarter">Lumen</p>
    <p class="label quarter ml-20">Diameter</p>
    <p class="label quarter ml-20">Distance</p>
    <p class="label quarter ml-20">Angle</p>
  </div>`;
for(var i = 0; i < holes.length; i++){
  
  var holeTitle = $(holes[i]).find('.hole-title').text();
  var holeNum = i + 1;
  var diameter = $(holes[i]).find('.diameter').val();
  var distance = $(holes[i]).find('.distance').val();;
  var angle = $(holes[i]).find('.angle').val();
  if (holeTitle == 'Central Lumen') {
    holeTML += `<div class="hole-layout">
    <p class="label quarter">`+holeTitle+`</p>
    <input class="quote-input quarter" id="l`+line+`-h`+holeNum+`-diameter" value="`+diameter+`" readonly></input>
    <div class="quarter ml-20 no-height"></div>
    <div class="quarter ml-20 no-height"></div>
    </div>`;
  } else {
  holeTML += `<div class="hole-layout">
    <p class="label quarter">`+holeTitle+`</p>
    <input class="quote-input quarter" id="l`+line+`-h`+holeNum+`-diameter" value="`+diameter+`" readonly></input>
    <input class="quote-input quarter" id="l`+line+`-h`+holeNum+`-distance" value="`+distance+`" readonly></input>
    <input class="quote-input quarter" id="l`+line+`-h`+holeNum+`-angle" value="`+angle+`" readonly></input>
  </div>`;
  }
}
$("#l"+ line + "-holes-container").empty();
$("#l"+ line + "-holes-container").append(holeTML);

  
if($("#shipping-carrier").val()) {var shipping = $("#custom-method").val(); var account = $("#shipping-account").val(); var carrier = $("#shipping-carrier").val(); $("#custom-carrier").val(carrier); $("#account-number").val(account);} else  {var shipping = $("#shipping-method").val(); var account = ""; var carrier = "";};
$("#carrier-details").addClass('hide-price');
$("#l"+ line + "-shipping").val(shipping);
$("#l"+ line + "-shipping").attr("account", account);  
$("#l"+ line + "-shipping").attr("method", shipping);
$("#l"+ line + "-shipping").attr("carrier", carrier);  
  
if($("#quantity-2").val() == 'More')  {
  $("#l"+ line + "-quantity").val($("#custom-quantity").val());
} else {
$("#l"+ line + "-quantity").val($("#quantity-2").val());
}
 if(!$("#custom-quote").is(":checked")){
$("#l"+ line + "-cert").val($('input[data-name=cert]:checked').val());
$("#l"+ line + "-price").val($('#'+ $('input[data-name=price]:checked').val()).val());
$("#l"+ line + "-leadtime").val($('input[data-name=price]:checked').val().replace('-price', ''));
 }
$("#editing").css('display', 'none');
$(".update, .update-button").css('display', 'none');
$("#submit-container").css('display', 'flex');
$("#price-block").css('display', 'none');
$("#l"+ line + "-greenlight").prop("checked",($("#custom-quote").is(":checked")));
storeHistory();
updateTotal();
if ( $("#apply-expedite").is(":checked") ) {
  $("#l"+ line + "-expedite").prop('checked', true);
  $("#l"+ line + "-expedite").closest(".label").css('display', 'flex')
  var expeditesRemaining = Number($("#reward-counter").val()) - 1
  $("#reward-counter").val(expeditesRemaining);
  $("#expedites-remaining").text(expeditesRemaining);
  } else {
  $("#l"+ line + "-expedite").prop('checked', false);
  $("#l"+ line + "-expedite").closest(".label").css('display', 'none')
}  


}

function updateTotal() {
  calcShipping();
  var getTotal = $(".price-item");
  var total = 0;
  for(var i = 0; i < getTotal.length; i++){
  total += Number($(getTotal[i]).val());
}
var shippingTotal = Number($("#shipping-total").val());    
$("#total-price").val(total+shippingTotal);
$("#total-text").text(total+shippingTotal);
}

$("#update").click(async function(){

await update();
styles();
resetInputs();
$(".line").removeClass('opacity');
$("#next-step").removeClass('hide-price');
var step = 'A quote line was updated';
updateJourney(step); 
});

$(document).on("click", ".delete", function(){
  var lineId = $(this).attr('id');
  if( $("#l"+ lineId + "-expedite").is(":checked") ) {
  var expeditesRemaining = Number($("#reward-counter").val()) + 1
  $("#reward-counter").val(expeditesRemaining);
  $("#expedites-remaining").text(expeditesRemaining);
  }
  $(this).closest('.line').remove();
  var lineItem = 1;
  $(".line").map(function() {
    var unit = $(this).find('.unit').val();
    $(this).find('.line-title').first().text('Line '+ lineItem + ' (' + unit + ')');
    $(this).find('.linenumber').val(lineItem);
    $(this).find('.edit').first().attr("id", lineItem);
    $(this).find('input').map(function(){
      this.id = this.id.replace(/[0-9]/g, lineItem);
      
    });
  ++lineItem;
  });
  storeHistory();
  updateTotal();
  if (user.model.expand.blanket_po){
  updateBlanket();
  }
 var step = 'A quote line was deleted';
 updateJourney(step); 
});

function calcShipping() {
var shippingLines = $(".shipping-line-item");
let finalShipping = [];

var priceMatchSmall = {
  "UPS Ground": 18,
  "UPS Second Day Air": 45,
  "UPS Next Day Air": 75,
  "UPS Worldwide Expedited": 90,
  "UPS Worldwide Saver": 110
};
var priceMatchLarge = {
  "UPS Ground": 55,
  "UPS Second Day Air": 105,
  "UPS Next Day Air": 140,
  "UPS Worldwide Expedited": 140,
  "UPS Worldwide Saver": 160
};
for (let i = 0; i < shippingLines.length; ++i) {
  
  if ( !$(shippingLines[i]).attr("account").length > 0 ) {
  let shippingArray = {};
  var leadtime = 'leadtime';
  var shipping = 'shipping';
  var price = 'price';
  var line = $(shippingLines[i]).closest('.line');
  var leadVal = line.find('.line-leadtime').val();
  var shipVal = $(shippingLines[i]).val();
  if ( line.find('.unit').val() == 'in' ) {
    if ( Number(line.find('.line-length').val()) < 30 ) {
    var priceVal = $(shippingLines[i]).val().replace(/UPS Ground|UPS Next Day Air|UPS Second Day Air|UPS Worldwide Expedited|UPS Worldwide Saver/g, matched => priceMatchSmall[matched]);
    } else {
    var priceVal = $(shippingLines[i]).val().replace(/UPS Ground|UPS Next Day Air|UPS Second Day Air|UPS Worldwide Expedited|UPS Worldwide Saver/g, matched => priceMatchLarge[matched]); 
    }
  } else {
    if ( Number($(shippingLines[i]).closest('.line-length').val()) < 762 ) {
    var priceVal = $(shippingLines[i]).val().replace(/UPS Ground|UPS Next Day Air|UPS Second Day Air|UPS Worldwide Expedited|UPS Worldwide Saver/g, matched => priceMatchSmall[matched]);
    } else {
    var priceVal = $(shippingLines[i]).val().replace(/UPS Ground|UPS Next Day Air|UPS Second Day Air|UPS Worldwide Expedited|UPS Worldwide Saver/g, matched => priceMatchLarge[matched]); 
    }
    
  }
  shippingArray[leadtime] = leadVal;
  shippingArray[shipping] = shipVal;
  shippingArray[price] = priceVal;
  finalShipping = finalShipping.concat(shippingArray);
  }
  
  
}
console.log(finalShipping);
//let result = finalShipping.filter(
//  (finalShipping, index) => index === finalShipping.findIndex(
//    other => finalShipping.leadtime === other.leadtime
//      && finalShipping.shipping === other.shipping
//  ));

let result = finalShipping.filter((value, index, self) =>
  index === self.findIndex((t) => (
    t.leadtime === value.leadtime && t.shipping === value.shipping
  ))
)
  
var totalShipping = 0;
result.forEach(item => {
    totalShipping += Number(item.price);
});
if ( totalShipping > 0 ) {
   $("#shipping-total").val(totalShipping);
} else {
  $("#shipping-total").val('0');
}
  
}

function packageQuote() {
  
  var getTotal = $(".price-item");
  var total = 0;
  for(var i = 0; i < getTotal.length; i++){
    total += Number($(getTotal[i]).val());
}
    
$("#total-price").val(total); 
  /////////
  let order = [];
  var lines = $(".line");
  for (let i = 0; i < lines.length; ++i) {
    
    let line = {};
    var inputs = $("#"+lines[i].id).find('input');
    for (let a = 0; a < inputs.length; ++a) {
      
      var id = inputs[a].id;
      if (inputs[a].id.includes('greenlight')) {
      var value = $(inputs[a]).is(":checked");
      } else if ( inputs[a].id.includes('shipping') ) { 

      if ($(inputs[a]).attr("account").length > 0) { var acct = ' Account #: ' + $(inputs[a]).attr("account"); } else { var acct = ''; };
      var value = inputs[a].value + acct; 
        
      } else {
      var value = inputs[a].value;
      }
      //line.push({ [id] : value });
      line[id] = value;
    }
    order = order.concat(line);
    
}
var output = JSON.stringify(order);
$("#order").val(output); 
}

function createArray() {
packageQuote();
calcShipping();
 $("#quoteNum").val(sessionStorage.getItem("quoteNum"));
 $("#quoteId").val(sessionStorage.getItem("quoteId"));
 
 $("#shipping").val($("#shipping-method").val());
 $("#custom-carrier").val($("#shipping-carrier").val());
 //$("#account-number").val($("#shipping-account").val());
 $("#user-details").val(JSON.stringify(JSON.parse(localStorage.getItem("pocketbase_auth"))));
 $("#po-number-submit").val($("#purchase-order-file").val());
 $("#preferred-method").val($("#custom-method").val());
 //$("#po-file").val($("#purchase-order-file").val());
 sessionStorage.removeItem("history");
 sessionStorage.removeItem("rewards");
 $("#quote").submit();

}
$("#checkout").click(function() {

 var getTotal = $(".price-item");
  var total = 0;
  for(var i = 0; i < getTotal.length; i++){
    total += Number($(getTotal[i]).val());
}
    var fee = (total * 0.03).toFixed(2);
   
  ///////// Ad cc processing fee
var find = $(".line");
var message = {
  "number_of_lines": find.length,
  "submitted": true,
  "checkout_method": "CC"
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
var lineItem = find.length + 1;
var lineHtml = 
`<div class="line" id="line`+lineItem+`" style="display:none;">
		<input class="quote-input" id="l`+lineItem+`-id" value="CC Processing Fee" readonly></input>
  	<input class="quote-input price-item" id="l`+lineItem+`-price" value="`+fee+`" readonly></input>
    <input class="linenumber" id="l`+lineItem+`-line" value="`+lineItem+`" readonly style="display:none;"></input>
</div>`;
   
$("#quote").append(lineHtml);  
  
 
  if( !$("#po-number").val() ) {
  $("#terms").removeClass('hide-price');
  
  }
  if( $("#po-number").val().length > 0) {
    if ($('input[id="po-verification"]').is(":checked")) { $("#terms").removeClass('hide-price'); }
    else {  $('#verification').dialog("open"); }
  } 
 var step = 'Credit Card checkout was selected';
 updateJourney(step); 
});

$("#upload-po").click(function() {
  $("#quote-panel").css('display','flex');
  $("#upload-container").removeClass('hide-price');
  $(this).fadeTo(1000, 1);
  $("#po-buy").fadeTo(1000, 0.2);
  var step = 'Customer has chosen to upload a PO now';
  updateJourney(step); 
});
$("#po-buy").click(function() {
  
  $("#po-accept").removeClass('hide-price');
  $(this).fadeTo(1000, 1);
  $("#upload-po").fadeTo(1000, 0.2);
  $("#po-checkout").addClass('hide-Price');
  var step = 'Customer has chosen to upload a PO later';
  updateJourney(step); 
});
$("#po-verification").click(function() {
  if($(this).is(":checked")) {
    $("#no-po-checkout").removeClass('hide-price');
  } else {
    $("#no-po-checkout").addClass('hide-price');
  }
});
$("#charge-to-blanket").click(function() {
  $("#terms").removeClass('hide-price');
  $("#blanket-po-selected").val(true);
  var find = $(".line");
    var message = {
    "number_of_lines": find.length,
    "submitted": true,
    "checkout_method": "PO"
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
 // $("#po-number-submit").val($("#blanket-number").text());
 var step = 'Customer has continued to terms with a blanket PO';
 updateJourney(step); 
});
$("#no-po-checkout").click(function() {
  if ($('input[id="po-verification"]').is(":checked")) { 
    $("#purchase-order-no-upload").val('no-upload'); 
    $("#terms").removeClass('hide-price');
    var find = $(".line");
    var message = {
    "number_of_lines": find.length,
    "submitted": true,
    "checkout_method": "PO"
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
  }
    else {  $('#verification').dialog("open"); }
 var step = 'Customer will upload PO later and has proceeded to terms';
 updateJourney(step);   
});
$("#send").click(function() {
 var message = {
    "order_placed": true,
    "ended": new Date()
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
createArray();
$("#loading").css("display", "flex");
 var step = 'Customer agreed to terms, order created';
 updateJourney(step); 
});
$("#po-checkout").click(function() {
   $("#terms").removeClass('hide-price');
    var find = $(".line");
    var message = {
    "number_of_lines": find.length,
    "submitted": true,
    "checkout_method": "PO"
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
  var step = 'Customer has uploaded PO and has proceeded to final terms';
  updateJourney(step); 
});
$("#purchase-order-file").on('change', function() {
  $("#upload-container").addClass('hide-price');
  $("#po-checkout").removeClass('hide-price');
  setTimeout(function() {
  $("#upload-po").text($(".text-block-57.w-file-upload-file-name").text());  
  }, 100);
  $("#upload-po").css('background-color', '#91c765');
  
});
$(".close-upload").click(function() {
  $("#upload-container").addClass('hide-price');
});
$("#po-checkout").click(function() {
   $("#terms").removeClass('hide-price');
});
$(".download-quote").click(function(){
  $("#download-quote").val('true');
  $("#loading").css("display", "flex");
  $("#save-quote").val("true");
  createArray();
  var step = 'A quote was saved for later';
  updateJourney(step); 
});
$("#continue-with-custom").click(function() {
  createArray();
  $("#loading").css("display", "flex");
  var find = $(".line");
  var message = {
  "number_of_lines": find.length,
  "submitted": true
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
 var step = 'Redlight line added to quote';
 updateJourney(step); 
});
