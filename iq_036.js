import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
//import { TransformControls } from 'three/addons/controls/TransformControls.js';

var sandbox = document.getElementById('sandbox');
let journey;
var user = "";
function updateJourney(step) {
  journey += step + ', \n';
  var message = {
  "customer_journey": journey
  }
  window.parent.postMessage(message,"https://orders.midwestint.com/instant-quote/designer.html");
}


////////// THREEEEEEEEEEEEEEEEEEEEEEEEEEE

class CylinderWithHoles {
            constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orbitControls = null;
    this.transformControls = [];
    this.includeCentralLumen = false; // Add this line
    this.perspectiveCamera = null;
    this.orthographicCamera = null;
    this.currentCamera = null;
    this.isPerspectiveView = true;
    // Cylinder parameters - SCALED DOWN by 1000x
    this.cylinderRadius = 0.1; 
    this.cylinderHeight = 0.15; 
    this.minimumSeptum = 0.005; 
    //this.mouseThrottle = null;
    // Add position history tracking
    this.positionHistory = [];
    this.maxHistoryLength = 2;
    // Print mode properties
    this.isPrintMode = false;
    this.css2dRenderer = null;
    this.axisLines = [];
    this.dimensionLines = [];
    this.dimensionLabels = [];
    // Hole parameters
    this.defaultHoleRadius = 0.03; // Was 20, now 0.02
    this.holes = [];
    this.holeColors = [
        0x00ff00, 0x0088ff, 0xff4444, 0xffaa00, 0xff00ff, 
        0x00ffff, 0xffff00, 0x8844ff, 0x44ff88
    ];
    
    this.generateInitialHoles(2);
    
    // Mesh references
    this.cylinderMesh = null;
    this.holeMarkers = [];
    this.activeControl = null;
    
    this.init();

    this.workingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.cylinderHeight / 2);
    this.intersectPoint = new THREE.Vector3(); // Reuse this vector
             
              
}

// Snap angle to nearest 1-degree increment
snapAngleToIncrement(angle) {
    return Math.round(angle);
}

          
          
generateInitialHoles(count) {
    this.holes = [];
    const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
    
    let peripheralHoles = count;
    let colorIndex = 0;
    
    // Add central lumen if checkbox is checked
    if (this.includeCentralLumen) {
        this.holes.push({
            x: 0,
            y: 0,
            angle: 0,
            distance: 0,
            radius: this.defaultHoleRadius,
            color: this.holeColors[0],
            name: `Central Lumen`
        });
        peripheralHoles = count - 1;
        colorIndex = 1;
    }
    
    // Add peripheral holes in a circle
    if (peripheralHoles > 0) {
        const optimalRadius = this.calculateOptimalRadius(peripheralHoles);
        
        // Calculate optimal distance for peripheral holes
        let placementDistance;
        
        if (this.includeCentralLumen) {
            // Position holes halfway between central lumen edge and cylinder wall
            const centralLumenRadius = this.holes[0].radius;
            const availableSpace = this.cylinderRadius - centralLumenRadius;
            
            // Place holes at the midpoint of available space
            placementDistance = centralLumenRadius + (availableSpace /2) ;
        } else {
            // No central lumen, use existing logic
            placementDistance = this.cylinderRadius/2;
        }
        
        for (let i = 0; i < peripheralHoles; i++) {
            const angle = (i / peripheralHoles) * 360;
            const { x, y } = this.polarToCartesian(angle, placementDistance);

            this.holes.push({
                x: x,
                y: y,
                angle: angle,
                distance: placementDistance,
                radius: optimalRadius,
                color: this.holeColors[colorIndex + i],
                name: `${colors[colorIndex + i]} Hole`
            });
        }
    }
    
    this.initializePositionHistory();
}

            
calculateOptimalRadius(holeCount) {
    if (holeCount <= 2) return this.defaultHoleRadius;
    
    const availableRadius = this.cylinderRadius - this.minimumSeptum;
    const circumference = 2 * Math.PI * (availableRadius * 0.6);
    const minSpacingPerHole = circumference / holeCount;
    const maxRadiusFromSpacing = (minSpacingPerHole - this.minimumSeptum) / 2;
    const maxRadiusFromBoundary = availableRadius * 0.15;
    
    const optimalRadius = Math.min(
        maxRadiusFromSpacing,
        maxRadiusFromBoundary,
        this.defaultHoleRadius
    );
    
    return Math.max(0.005, Math.min(optimalRadius, 0.025)); // Scaled: was 5-25, now 0.005-0.025
}
            
            init() {
              
                this.setupRenderer();
                this.setupScene();
                this.setupCamera();
                this.setupLighting();
                this.setupControls();
               this.setupPolarControlInteraction(); this.createGeometry();
                this.setupUI();
                this.setupEventListeners();
                this.render();
             
            }
            
setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    sandbox.prepend(this.renderer.domElement);
    
    // Add CSS2D renderer for dimensions (but keep it hidden initially)
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    this.css2dRenderer.domElement.style.position = 'absolute';
    this.css2dRenderer.domElement.style.top = '0px';
    this.css2dRenderer.domElement.style.pointerEvents = 'none';
    this.css2dRenderer.domElement.style.display = 'none'; // Hide initially
    sandbox.appendChild(this.css2dRenderer.domElement);
}
            
setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x191919);
    
    
}
            
setupCamera() {
    // Create perspective camera
    this.perspectiveCamera = new THREE.PerspectiveCamera(50, sandbox.offsetWidth / sandbox.offsetHeight, 0.001, 2);
    this.perspectiveCamera.position.set(0.2, 0.2, 0.3);
    this.scene.add(this.perspectiveCamera);
    
    // Create orthographic camera
    const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
    const frustumSize = 0.4;
    this.orthographicCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2, frustumSize * aspect / 2,
        frustumSize / 2, -frustumSize / 2,
        0.001, 2
    );
    this.orthographicCamera.position.set(0, 0, 0.3);
    this.orthographicCamera.lookAt(0, 0, 0);
    this.scene.add(this.orthographicCamera);
    
    // Set initial camera
    this.currentCamera = this.perspectiveCamera;
    this.camera = this.currentCamera; // Keep backward compatibility
}
            
setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0.1, 0.2, 0.1); // Scaled from (100, 200, 100)
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.0005;
    directionalLight.shadow.camera.far = 0.5;
    directionalLight.shadow.camera.left = -0.2;
    directionalLight.shadow.camera.right = 0.2;
    directionalLight.shadow.camera.top = 0.2;
    directionalLight.shadow.camera.bottom = -0.2;
    this.scene.add(directionalLight);
}
            
setupControls() {
    this.orbitControls = new OrbitControls(this.currentCamera, this.renderer.domElement);
    this.orbitControls.addEventListener('change', () => this.render());
    this.updateControlsForCurrentCamera();
    
    this.createTransformControls();
}
updateControlsForCurrentCamera() {
    if (this.isPerspectiveView) {
        // Perspective camera settings
        this.orbitControls.minDistance = 0.05;
        this.orbitControls.maxDistance = 1;
        this.orbitControls.enableRotate = true;
        this.orbitControls.enableZoom = true;
        this.orbitControls.enablePan = true;
    } else {
        // Orthographic camera settings
        this.orbitControls.enableRotate = false;
        this.orbitControls.enableZoom = true;
        this.orbitControls.enablePan = true;
        this.orbitControls.minZoom = 0.5;
        this.orbitControls.maxZoom = 5;
    }
    
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
}

// Add new method to switch cameras
switchCamera() {
    this.isPerspectiveView = !this.isPerspectiveView;
    
    if (this.isPerspectiveView) {
        this.currentCamera = this.perspectiveCamera;
    } else {
        this.currentCamera = this.orthographicCamera;
    }
    
    this.camera = this.currentCamera; // Keep backward compatibility
    
    // Update orbit controls to use new camera
    this.orbitControls.object = this.currentCamera;
    this.updateControlsForCurrentCamera();
    
    // Update button text
    const cameraButton = document.getElementById('camera-switch-btn');
    if (cameraButton) {
        cameraButton.textContent = this.isPerspectiveView ? 'Switch to Top View' : 'Switch to 3D View';
    }
    
    this.render();
}
setupUI() {
    this.createHoleControlsUI();
    this.setupGlobalControls();
    this.addCameraSwitchButton(); // Add this line
}

// Add new method to create camera switch button
addCameraSwitchButton() {
    const controlsDiv = document.getElementById('global-controls');
    
    // Create camera switch button
    const cameraButtonContainer = document.createElement('div');
    cameraButtonContainer.className = 'global-controls'
    cameraButtonContainer.innerHTML = `
        <button id="camera-switch-btn" class="feet-tag" style="cursor:pointer;">SWITCH TO TOP VIEW (SPACE)</button>
        <button id="print-mode-btn" class="feet-tag" style="cursor:pointer;">PRINT MODE (TAB)</button>
        <p class="feet-tag">SHIFT > DISTANCE</p>
        <p class="feet-tag">CONTROL > DIAMETER</p>
        <p class="feet-tag">ALT > APPLY TO ALL</p>
    `;
    
    controlsDiv.appendChild(cameraButtonContainer);
    
    // Add event listeners
    document.getElementById('camera-switch-btn').addEventListener('click', () => {
        this.switchCamera();
    });
    
    document.getElementById('print-mode-btn').addEventListener('click', () => {
        this.togglePrintMode();
    });
}

// New function to toggle print mode
togglePrintMode() {
    this.isPrintMode = !this.isPrintMode;
    
    if (this.isPrintMode) {
        this.enterPrintMode();
    } else {
        this.exitPrintMode();
    }
    
    // Update button text
    const printButton = document.getElementById('print-mode-btn');
    if (printButton) {
        printButton.textContent = this.isPrintMode ? 'Exit Print Mode' : 'Print Mode';
        printButton.style.background = this.isPrintMode ? '#f44336' : '#4CAF50';
    }
}
// Add to enterPrintMode() function
createOutlines() {
    // Cylinder outline - create a ring at the top face
    const cylinderOutlineGeometry = new THREE.RingGeometry(
        this.cylinderRadius - 0.001, // inner radius (slightly smaller)
        this.cylinderRadius + 0.001, // outer radius (slightly larger)
        64 // segments for smooth circle
    );
    const outlineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    
    const cylinderOutline = new THREE.Mesh(cylinderOutlineGeometry, outlineMaterial);
    cylinderOutline.position.z = this.cylinderHeight / 2 + 0.002; // Slightly above cylinder
    this.scene.add(cylinderOutline);
    this.axisLines.push(cylinderOutline); // Store for cleanup
    
    // Hole outlines
    this.holes.forEach(hole => {
        const holeOutlineGeometry = new THREE.RingGeometry(
            hole.radius - 0.0005, // inner radius
            hole.radius + 0.0005, // outer radius  
            32
        );
        const holeOutline = new THREE.Mesh(holeOutlineGeometry, outlineMaterial.clone());
        holeOutline.position.set(hole.x, hole.y, this.cylinderHeight / 2 + 0.002);
        this.scene.add(holeOutline);
        this.axisLines.push(holeOutline); // Store for cleanup
    });
}
// New function to enter print mode
enterPrintMode() {
    // Switch to orthographic top view
    if (this.isPerspectiveView) {
        this.switchCamera();
    }
    
    // Show CSS2D renderer for labels
    if (this.css2dRenderer) {
        this.css2dRenderer.domElement.style.display = 'block';
    }
    
    // Create axis lines
    this.createAxisLines();
    
    // Create dimension lines and labels
    this.createDimensions();
    
    // Create outlines
    this.createOutlines();
    
    // Hide interactive controls
    this.hideInteractiveControls();
    
    // Change background to white for printing
    this.scene.background = new THREE.Color(0xffffff);
    
    this.render();
}

// New function to exit print mode
exitPrintMode() {
    // Hide CSS2D renderer
    if (this.css2dRenderer) {
        this.css2dRenderer.domElement.style.display = 'none';
    }
    
    // Remove axis lines
    this.removeAxisLines();
    
    // Remove dimensions
    this.removeDimensions();
    
    // Show interactive controls
    this.showInteractiveControls();
    
    // Restore original background
    this.scene.background = new THREE.Color(0x191919);
   
    this.render();
}

// New function to create axis lines
createAxisLines() {
    const axisLength = this.cylinderRadius * .25;
    const axisLabelLength = this.cylinderRadius * 1.1;
    
    // X-axis (red)
    const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-axisLength, 0, this.cylinderHeight / 2 + 0.001),
        new THREE.Vector3(axisLength, 0, this.cylinderHeight / 2 + 0.001)
    ]);
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 });
    const xAxisLine = new THREE.Line(xAxisGeometry, xAxisMaterial);
    this.axisLines.push(xAxisLine);
    this.scene.add(xAxisLine);
    
    // Y-axis (green)
    const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -axisLength, this.cylinderHeight / 2 + 0.005),
        new THREE.Vector3(0, axisLength, this.cylinderHeight / 2 + 0.005)
    ]);
    const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x000000 , linewidth: 3 });
    const yAxisLine = new THREE.Line(yAxisGeometry, yAxisMaterial);
    this.axisLines.push(yAxisLine);
    this.scene.add(yAxisLine);
    
    // Add axis labels
    const xLabelDiv = document.createElement('div');
    xLabelDiv.className = 'axis-label';
    xLabelDiv.textContent = '0°';
    xLabelDiv.style.cssText = 'color: black; font-size: 16px; font-weight: bold; ';
    const xLabel = new CSS2DObject(xLabelDiv);
    xLabel.position.set(axisLabelLength + 0.01, 0, this.cylinderHeight / 2 + 0.005 );
    this.axisLines.push(xLabel);
    this.scene.add(xLabel);
    
}

// New function to create dimensions
createDimensions() {
    // Check if outer holes are symmetric
    const isSymmetric = this.areOuterHolesSymmetric();
    
    if (isSymmetric) {
        // Only create dimensions for first two outer holes
        const outerHoles = this.getOuterHoles();
        const angleBetweenHoles = 360 / outerHoles.length; // Calculate angle between holes
        
        outerHoles.slice(0, 2).forEach((hole, index) => {
            const originalIndex = this.holes.indexOf(hole);
            if (index === 0) {
                // For first hole, show labels with angle between holes instead of position angle
                this.createHoleDimensions(hole, originalIndex, true, angleBetweenHoles);
            } else {
                // For second hole, just show dimension lines without labels
                this.createHoleDimensions(hole, originalIndex, false);
            }
        });
        
        // Create arc between first and second holes
        if (outerHoles.length >= 2) {
            this.createAngleDimensionArc(outerHoles[0], outerHoles[1]);
        }
        
        // Only create dimensions for central lumen if it actually exists
        const centralHole = this.holes.find(h => h.distance === 0);
        if (centralHole && this.includeCentralLumen) {
            const centralIndex = this.holes.indexOf(centralHole);
            this.createHoleDimensions(centralHole, centralIndex, true);
          console.log('creating central lumen dim')
        }
    } else {
        // Create dimensions for all holes as before
        this.holes.forEach((hole, index) => {
            this.createHoleDimensions(hole, index, true);
        });
    }
}
createAngleDimensionArc(hole1, hole2) {
    const arcRadius = this.cylinderRadius + 0.03; // Place arc outside cylinder
    const z = this.cylinderHeight / 2 + 0.002;
    
    // Calculate angles
    const angle1 = hole1.angle * Math.PI / 180;
    const angle2 = hole2.angle * Math.PI / 180;
    
    // Create arc geometry
    const arcGeometry = new THREE.BufferGeometry();
    const arcPoints = [];
    
    // Determine which direction to draw the arc (shortest path)
    let startAngle = angle1;
    let endAngle = angle2;
    let angleDiff = endAngle - startAngle;
    
    // Normalize to shortest arc
    if (angleDiff > Math.PI) {
        angleDiff -= 2 * Math.PI;
    } else if (angleDiff < -Math.PI) {
        angleDiff += 2 * Math.PI;
    }
    
    endAngle = startAngle + angleDiff;
    
    // Create arc points
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const currentAngle = startAngle + t * angleDiff;
        const x = Math.cos(currentAngle) * arcRadius;
        const y = Math.sin(currentAngle) * arcRadius;
        arcPoints.push(new THREE.Vector3(x, y, z));
    }
    
    arcGeometry.setFromPoints(arcPoints);
    
    const arcMaterial = new THREE.LineBasicMaterial({ 
        color: 0xd1d1d1, 
        linewidth: 2 
    });
    
    const arcLine = new THREE.Line(arcGeometry, arcMaterial);
    this.dimensionLines.push(arcLine);
    this.scene.add(arcLine);
}
areOuterHolesSymmetric() {
    const outerHoles = this.getOuterHoles();
    
    if (outerHoles.length < 2) return false;
    
    const firstHole = outerHoles[0];
    const tolerance = 0.001; // Small tolerance for floating point comparison
    
    // Check if all outer holes have same radius and distance
    for (let i = 1; i < outerHoles.length; i++) {
        const hole = outerHoles[i];
        if (Math.abs(hole.radius - firstHole.radius) > tolerance ||
            Math.abs(hole.distance - firstHole.distance) > tolerance) {
            return false;
        }
    }
    
    // Check if holes are evenly spaced around the circle
    const expectedAngleStep = 360 / outerHoles.length;
    for (let i = 0; i < outerHoles.length; i++) {
        const expectedAngle = (i * expectedAngleStep) % 360;
        const actualAngle = outerHoles[i].angle % 360;
        const angleDiff = Math.min(
            Math.abs(expectedAngle - actualAngle),
            Math.abs(expectedAngle - actualAngle + 360),
            Math.abs(expectedAngle - actualAngle - 360)
        );
        if (angleDiff > tolerance * 180) { // Convert tolerance to degrees
            return false;
        }
    }
    
    return true;
}

getOuterHoles() {
    return this.holes.filter(hole => hole.distance > 0);
}
// New function to create dimensions for a single hole
createHoleDimensions(hole, index, showLabels = true, customAngle = null) {
    const diameter = hole.radius * 2;
    const z = this.cylinderHeight / 2 + 0.002;
    
    // Skip dimension lines for central lumen (it's at origin)
    if (hole.distance > 0) {
        // Calculate the direction from center to hole
        const holeAngle = Math.atan2(hole.y, hole.x);
        
        // Extend the line beyond the cylinder radius
        const extensionDistance = this.cylinderRadius + 0.04; // Extend 0.03 units beyond cylinder
        const endX = Math.cos(holeAngle) * extensionDistance;
        const endY = Math.sin(holeAngle) * extensionDistance;
        
        // Create single dimension line from center through hole to beyond cylinder
        const dimLine = this.createDimensionLine(
            new THREE.Vector3(0, 0, z),
            new THREE.Vector3(endX, endY, z),
            0xd1d1d1
        );
        this.dimensionLines.push(dimLine);
        this.scene.add(dimLine);
        
        // Create perpendicular cross line through the hole center
        const perpendicularAngle = holeAngle + Math.PI/2; // 90 degrees perpendicular
        const crossStart = {
            x: hole.x + Math.cos(perpendicularAngle) * hole.radius*.5,
            y: hole.y + Math.sin(perpendicularAngle) * hole.radius*.5
        };
        const crossEnd = {
            x: hole.x - Math.cos(perpendicularAngle) * hole.radius*.5,
            y: hole.y - Math.sin(perpendicularAngle) * hole.radius*.5
        };
        
        const crossLine = this.createDimensionLine(
            new THREE.Vector3(crossStart.x, crossStart.y, z),
            new THREE.Vector3(crossEnd.x, crossEnd.y, z),
            0x000000
        );
        this.dimensionLines.push(crossLine);
        this.scene.add(crossLine);
        
        if (showLabels) {
            // Create dimension label at the end of the line
            const wrapperDiv = document.createElement('div');
            const xLabelDiv = document.createElement('div');
            xLabelDiv.className = 'dimension-label';
            xLabelDiv.textContent = `[ ${Math.abs(hole.x).toFixed(3)}, ${Math.abs(hole.y).toFixed(3)} ]`;
            xLabelDiv.style.cssText = 'color: black; font-size: 12px; background: white; padding: 5px; border: 1px solid black; border-radius: 5px;';
            
            const radiusLabelDiv = document.createElement('div');
            radiusLabelDiv.className = 'dimension-label';
            radiusLabelDiv.textContent = `⌀ ${diameter.toFixed(3)}`;
            radiusLabelDiv.style.cssText = 'color: black; font-size: 12px; margin-top: 5px;';
            xLabelDiv.appendChild(radiusLabelDiv);
            
            const displayAngle = customAngle !== null ? customAngle : hole.angle;
            const angleLabelDiv = document.createElement('div');
            angleLabelDiv.className = 'dimension-label';
            angleLabelDiv.textContent = `∠ ${displayAngle.toFixed(2)}°`;
            angleLabelDiv.style.cssText = 'color: black; font-size: 12px; margin-top: 5px;';
            xLabelDiv.appendChild(angleLabelDiv);
            
            const distanceLabelDiv = document.createElement('div');
            distanceLabelDiv.className = 'dimension-label';
            distanceLabelDiv.textContent = `↔ ${hole.distance.toFixed(2)}`;
            distanceLabelDiv.style.cssText = 'color: black; font-size: 12px; margin-top: 5px;';
            xLabelDiv.appendChild(distanceLabelDiv);
            
            // Position label at the end of the line with appropriate offset for readability
            // Determine which side of the line to place the label based on angle
            let offsetX = 0.0; // Small offset for readability
            let offsetY = 0.0;
            let transform = 'translate(-50%, -50%)'; // Center by default
            
            // Adjust offset and transform based on quadrant
            if (holeAngle >= -Math.PI/4 && holeAngle <= Math.PI/4) {
                // Right side (0°)
                offsetX = 0.0;
                transform = 'translate(50%, 0%)';
            } else if (holeAngle > Math.PI/4 && holeAngle < 3*Math.PI/4) {
                // Top side (90°)
                offsetY = 0.0;
                transform = 'translate(0%, -50%)';
            } else if (holeAngle >= 3*Math.PI/4 || holeAngle <= -3*Math.PI/4) {
                // Left side (180°)
                offsetX = -0.0;
                transform = 'translate(-50%, 0%)';
            } else {
                // Bottom side (270°)
                offsetY = -0.0;
                transform = 'translate(0%, 50%)';
            }
            
            xLabelDiv.style.transform = transform;
            wrapperDiv.appendChild(xLabelDiv);
            
            const xLabel = new CSS2DObject(wrapperDiv);
            xLabel.position.set(endX + offsetX, endY + offsetY, z);
            this.dimensionLabels.push(xLabel);
            this.scene.add(xLabel);
        }
    } else if (hole.distance === 0 && showLabels) {
        // For central lumen, just add the label at a fixed position
        console.log('Creating central lumen label for hole:', hole.name, 'distance:', hole.distance);
        const wrapperDiv = document.createElement('div');
        const centralLabelDiv = document.createElement('div');
        centralLabelDiv.className = 'dimension-label';
        centralLabelDiv.textContent = `Central Lumen`;
        centralLabelDiv.style.cssText = 'color: black; font-size: 12px; background: white; padding: 5px; border: 1px solid black; border-radius: 5px;';
        
        const radiusLabelDiv = document.createElement('div');
        radiusLabelDiv.className = 'dimension-label';
        radiusLabelDiv.textContent = `⌀ ${diameter.toFixed(3)}`;
        radiusLabelDiv.style.cssText = 'color: black; font-size: 12px; margin-top: 5px;';
        centralLabelDiv.appendChild(radiusLabelDiv);
        
        centralLabelDiv.style.transform = 'translate(-50%, -100%)';
        wrapperDiv.appendChild(centralLabelDiv);
        
        const centralLabel = new CSS2DObject(wrapperDiv);
        centralLabel.position.set(-.1, this.cylinderRadius + 0.02, z);
        this.dimensionLabels.push(centralLabel);
        this.scene.add(centralLabel);
    }
}

// Helper function to create dimension lines
createDimensionLine(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ 
        color: color, 
        linewidth: 1,
        transparent: true,
        opacity: 0.7
    });
    return new THREE.Line(geometry, material);
}

// New function to remove axis lines
removeAxisLines() {
    this.axisLines.forEach(line => {
        this.scene.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
    });
    this.axisLines = [];
}

// New function to remove dimensions
removeDimensions() {
    this.dimensionLines.forEach(line => {
        this.scene.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
    });
    this.dimensionLines = [];
    
    this.dimensionLabels.forEach(label => {
        this.scene.remove(label);
        if (label.element && label.element.parentNode) {
            label.element.parentNode.removeChild(label.element);
        }
    });
    this.dimensionLabels = [];
}

// New function to hide interactive controls
hideInteractiveControls() {
    // Hide polar transform controls
    this.transformControls.forEach(control => {
        control.visible = false;
    });
    //hide cylinder
    this.cylinderMesh.visible = false;
    // Hide hole markers
    this.holeMarkers.forEach(marker => {
        marker.visible = false;
    });
}

// New function to show interactive controls
showInteractiveControls() {
    // Show polar transform controls
    this.transformControls.forEach(control => {
        control.visible = true;
    });
    //show cylinder
    this.cylinderMesh.visible = true;
    // Show hole markers
    this.holeMarkers.forEach(marker => {
        marker.visible = true;
    });
}
            createTransformControls() {
             this.createPolarTransformControls();
    this.setupPolarControlInteraction();  
            }
            
            
calculateMinimumCylinderRadius() {
    if (this.holes.length === 0) return 0.02; // Scaled from 20 to 0.02
    
    let maxRequiredRadius = 0;
    
    this.holes.forEach(hole => {
        const distanceFromCenter = Math.sqrt(hole.x * hole.x + hole.y * hole.y);
        const requiredRadius = distanceFromCenter + hole.radius + this.minimumSeptum;
        maxRequiredRadius = Math.max(maxRequiredRadius, requiredRadius);
    });
    
    return Math.max(maxRequiredRadius, 0.05); // Scaled from 20 to 0.02
}

setupGlobalControls() {
    const holeCountInput = document.getElementById('hole-count');
    const applyButton = document.getElementById('apply-holes');
    
    // Existing hole count controls
    applyButton.addEventListener('click', () => {
        const newCount = parseInt(holeCountInput.value);
        const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        this.includeCentralLumen = centralLumenCheckbox.checked;
        
        if (newCount >= 2 && newCount <= 9) {
            this.regenerateHoles(newCount);
        }
    });
    
    holeCountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyButton.click();
        }
    });
    
    // Central lumen checkbox listener
    const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
    centralLumenCheckbox.addEventListener('change', (e) => {
        this.includeCentralLumen = e.target.checked;
        // Don't auto-regenerate, wait for Apply button
    });
    
    // ... rest of existing cylinder diameter controls code ...
    
    // Cylinder diameter controls with manual input
    const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
    const cylinderDiameterInput = document.getElementById('cylinder-diameter-input');
   
    
    
    // Set initial values
    cylinderDiameterSlider.value = this.cylinderRadius * 2;
    cylinderDiameterInput.value = this.cylinderRadius * 2;
    
    
    // Update min value based on current holes
    const minRadius = this.calculateMinimumCylinderRadius();
    cylinderDiameterSlider.min = minRadius * 2;
    cylinderDiameterInput.min = minRadius * 2;
    
    // Slider event listener
    cylinderDiameterSlider.addEventListener('input', (e) => {
        const newDiameter = parseFloat(e.target.value);
        this.updateCylinderDiameter(newDiameter, cylinderDiameterInput);
    });
    
    // Manual input event listener
    cylinderDiameterInput.addEventListener('input', (e) => {
        const newDiameter = parseFloat(e.target.value);
        if (!isNaN(newDiameter)) {
            cylinderDiameterSlider.value = newDiameter;
            this.updateCylinderDiameter(newDiameter, cylinderDiameterInput);
        }
    });
    
    cylinderDiameterInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });
}
          
          initializePositionHistory() {
   this.positionHistory = this.holes.map(hole => [
    { x: hole.x, y: hole.y, angle: hole.angle, distance: hole.distance, radius: hole.radius }
]);
}
updateCylinderDiameter(newDiameter, inputElement) {
    const newRadius = newDiameter / 2;
    const minAllowedRadius = this.calculateMinimumCylinderRadius();
    const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
    const cylinderDiameterInput = document.getElementById('cylinder-diameter-input');
    cylinderDiameterSlider.min = minAllowedRadius * 2;
    cylinderDiameterInput.min = minAllowedRadius * 2;
    if (newRadius >= minAllowedRadius) {
        this.cylinderRadius = newRadius;
        inputElement.value = newDiameter.toFixed(3);
        
       
        
        this.updatePositionSliderRanges();
        this.updateCylinderGeometry();
        
        this.render();
    } else {
        const minDiameter = minAllowedRadius * 2;
        document.getElementById('cylinder-diameter').value = minDiameter.toFixed(3);
        inputElement.value = minDiameter.toFixed(3);
        
       
    }
}
          
// Add this new method to record valid positions
recordValidPosition(holeIndex) {
    const hole = this.holes[holeIndex];
    const history = this.positionHistory[holeIndex];
    
    // Add current position to history
   history.push({ 
    x: hole.x, 
    y: hole.y, 
    angle: hole.angle, 
    distance: hole.distance, 
    radius: hole.radius 
});
    
    // Keep only the most recent positions
    if (history.length > this.maxHistoryLength) {
        history.shift(); // Remove oldest position
    }
  console.log(history)
}

// Add this new method to check if a position is valid
isValidPosition(x, y, radius, holeIndex) {
    // Check cylinder boundary constraint
    const distanceFromCenter = Math.sqrt(x * x + y * y);
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
// Convert Cartesian coordinates to polar
cartesianToPolar(x, y) {
    const distance = Math.sqrt(x * x + y * y);
    let angle = Math.atan2(y, x);
    // Convert to degrees and ensure positive angle (0-360)
    angle = (angle * 180 / Math.PI + 360) % 360;
    return { angle, distance };
}

// Convert polar coordinates to Cartesian
polarToCartesian(angle, distance) {
    const angleRad = angle * Math.PI / 180;
    const x = Math.cos(angleRad) * distance;
    const y = Math.sin(angleRad) * distance;
    return { x, y };
}
// Create custom polar transform controls
createPolarTransformControls() {
// Clean up existing controls
    this.transformControls.forEach(control => {
        this.scene.remove(control);
        // Dispose of geometries and materials in the control group
        control.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    });
    this.transformControls = [];
    
    // Create new polar controls for current holes
    this.holes.forEach((hole, index) => {
        const polarControl = this.createPolarControl(hole, index);
        this.transformControls.push(polarControl);
        this.scene.add(polarControl);
    });
}

// Create individual polar control for a hole
createPolarControl(hole, index) {
    const controlGroup = new THREE.Group();
    controlGroup.holeIndex = index;
    
    // Create rotation ring (for angle control) - scaled down
    const ringGeometry = new THREE.RingGeometry(hole.distance - 0.0001, hole.distance + 0.0001, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: .6,
        side: THREE.DoubleSide
    });
    const rotationRing = new THREE.Mesh(ringGeometry, ringMaterial);
    rotationRing.position.z = this.cylinderHeight / 2 + 0.001;
    rotationRing.userData.controlType = 'rotation';
    rotationRing.userData.holeIndex = index;
    controlGroup.add(rotationRing);
    
    // Create distance handle (for radial control) - scaled down
    const handleGeometry = new THREE.SphereGeometry(0.008, 16, 16); // Scaled from 8 to 0.008
    const handleMaterial = new THREE.MeshBasicMaterial({ 
        color: hole.color,
        transparent: true,
        opacity: 0.6
    });
    const distanceHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    distanceHandle.position.set(hole.x, hole.y, this.cylinderHeight / 2);
    distanceHandle.userData.controlType = 'distance';
    distanceHandle.userData.holeIndex = index;
    controlGroup.add(distanceHandle);
    
    // Create radial line (visual guide)
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, this.cylinderHeight / 2),
        new THREE.Vector3(hole.x, hole.y, this.cylinderHeight / 2)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.5 
    });
    const radialLine = new THREE.Line(lineGeometry, lineMaterial);
    controlGroup.add(radialLine);
    
    // Store references for easy access
    controlGroup.rotationRing = rotationRing;
    controlGroup.distanceHandle = distanceHandle;
    controlGroup.radialLine = radialLine;
    controlGroup.isActive = false;
    
    return controlGroup;
}

// Handle polar control interactions
setupPolarControlInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let activeControl = null;
    let isShiftPressed = false;
    let isControlPressed = false;
    let isAltPressed = false;
    let initialAngle = 0;
    let initialDistance = 0;
    let initialMouseAngle = 0;
    let initialMouseDistance = 0;
    let initialHoleRadii = []; // Store initial radii for all holes
    let initialHoleDistances = []; // Store initial distances for all holes
    
    // Track shift, control, alt, and tab key state 
    const onKeyDown = (event) => {
        if (event.key === 'Shift') {
            isShiftPressed = true;
        } else if (event.key === 'Control') {
            isControlPressed = true;
        } else if (event.key === 'Alt') {
            isAltPressed = true;
            event.preventDefault(); // Prevent browser alt key behavior
        } else if (event.key === 'Tab') {
            event.preventDefault(); // Prevent tab navigation
            this.togglePrintMode(); // Toggle print mode
        }
    };
    
    const onKeyUp = (event) => {
        if (event.key === 'Shift') {
            isShiftPressed = false;
        } else if (event.key === 'Control') {
            isControlPressed = false;
        } else if (event.key === 'Alt') {
            isAltPressed = false;
        }
    };
    
    const onMouseDown = (event) => {
        // Get the canvas bounding rectangle to account for its position on the page
        const rect = this.renderer.domElement.getBoundingClientRect();
        
        // Calculate mouse position relative to the canvas
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, this.camera);
        
        // Only check for intersections with distance handles (spheres)
        const controlObjects = [];
        this.transformControls.forEach(control => {
            controlObjects.push(control.distanceHandle);
        });
        
        const intersects = raycaster.intersectObjects(controlObjects);
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const holeIndex = intersect.object.userData.holeIndex;
            
            isDragging = true;
            activeControl = this.transformControls[holeIndex];
            
            // Disable orbit controls
            this.orbitControls.enabled = false;
            
            // Store initial values
            const hole = this.holes[holeIndex];
            initialAngle = hole.angle;
            initialDistance = hole.distance;
            
            // Calculate initial mouse angle and distance for rotation reference
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.cylinderHeight / 2);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersectPoint);
            initialMouseAngle = Math.atan2(intersectPoint.y, intersectPoint.x) * 180 / Math.PI;
            initialMouseDistance = Math.sqrt(intersectPoint.x * intersectPoint.x + intersectPoint.y * intersectPoint.y);
            
            // Store initial radii and distances for all holes (for modifier key functionality)
            initialHoleRadii = this.holes.map(h => h.radius);
            initialHoleDistances = this.holes.map(h => h.distance);
            
            // Highlight active control
            this.highlightControl(holeIndex, true);
        }
    };

    const onMouseHover = (event) => {
        // Only do hover effects when not dragging
        if (isDragging) return;
        
        // Get the canvas bounding rectangle to account for its position on the page
        const rect = this.renderer.domElement.getBoundingClientRect();
        
        // Calculate mouse position relative to the canvas
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, this.camera);
        
        // Only check for intersections with distance handles (spheres)
        const controlObjects = [];
        this.transformControls.forEach(control => {
            controlObjects.push(control.distanceHandle);
        });
        
        const intersects = raycaster.intersectObjects(controlObjects);
        
        // Clear all highlights first
        this.transformControls.forEach((control, index) => {
            this.highlightControl(index, false);
        });
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const holeIndex = intersect.object.userData.holeIndex;

            // Highlight hovered control
            this.highlightControl(holeIndex, true);
            
            // Change cursor to indicate interactivity
            this.renderer.domElement.style.cursor = 'pointer';
        } else {
            // Reset cursor
            this.renderer.domElement.style.cursor = 'default';
        }
    };   

const onMouseMove = (event) => {
    if (!isDragging || !activeControl) return;
    // // Throttle to ~60fps instead of unlimited
    // if (this.mouseThrottle) return;
    // this.mouseThrottle = setTimeout(() => {
    //     this.mouseThrottle = null;
    // }, 8); // ~60fps
    // Get the canvas bounding rectangle
    const rect = this.renderer.domElement.getBoundingClientRect();
    
    // Calculate mouse position relative to the canvas
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, this.camera);
    
    const holeIndex = activeControl.holeIndex;
    const hole = this.holes[holeIndex];
    
    // Get intersection point on the cylinder plane
raycaster.ray.intersectPlane(this.workingPlane, this.intersectPoint);
    
    if (isAltPressed && isControlPressed) {
        // Alt + Control: Set ALL holes to the same size based on mouse distance from center
        const currentMouseDistance = Math.sqrt(this.intersectPoint.x * this.intersectPoint.x + this.intersectPoint.y * this.intersectPoint.y);
        
        // Calculate the target radius based on mouse distance (scale for sensitivity)
        const targetRadius = Math.max(0.005, Math.min(currentMouseDistance * 0.5, 0.03));
        
        // Apply the same radius to all holes
        this.holes.forEach((h, index) => {
            // Check if the new radius is valid for this hole
            if (this.isValidPosition(h.x, h.y, targetRadius, index)) {
                h.radius = targetRadius;
            }
          this.updateSliderValues(index);
        });
        
        // Update all hole markers and UI
        this.updateAllHoleMarkersAndUI();
        
        
        
    } else if (isShiftPressed && isAltPressed) {
        // Shift + Alt: Set ALL holes to the same distance from center
        const targetDistance = Math.sqrt(this.intersectPoint.x * this.intersectPoint.x + this.intersectPoint.y * this.intersectPoint.y);
        
        // Set all holes to the same distance (except central lumen)
        this.holes.forEach((h, index) => {
            if (h.distance === 0) return; // Skip central lumen
            
            // Check if the target distance is valid for this hole
            if (this.isValidPolarPosition(h.angle, targetDistance, h.radius, index)) {
                // Update hole data directly without individual visual updates
                const { x, y } = this.polarToCartesian(h.angle, targetDistance);
                h.distance = targetDistance;
                h.x = x;
                h.y = y;
            }
        });
        
        // Update all visuals at once
        this.updateAllHoleMarkersAndUI();
        
        // Update polar control visuals for all holes
        this.holes.forEach((h, index) => {
            if (h.distance === 0) return; // Skip central lumen
            this.updatePolarControlVisuals(index);
            this.updateSliderValues(index);
        });
         
        
        
    } else if (isControlPressed) {
        // Control only: Change hole diameter based on mouse distance from hole center
        const distanceFromHole = Math.sqrt(
            (this.intersectPoint.x - hole.x) * (this.intersectPoint.x - hole.x) + 
            (this.intersectPoint.y - hole.y) * (this.intersectPoint.y - hole.y)
        );
        
        // Convert distance to diameter (multiply by 2 to make it more responsive)
        const newRadius = Math.max(0.005, Math.min(distanceFromHole, 0.03)); // Keep within reasonable bounds
        
        if (this.isValidPosition(hole.x, hole.y, newRadius, holeIndex)) {
            this.updateHoleDiameterDirect(holeIndex, newRadius);
           
        }
    } else if (isShiftPressed) {
        // Shift only: Change distance from center
        // Skip central holes (they cannot be moved with shift)
        const isCentralHole = (Math.abs(hole.x) < 0.001 && Math.abs(hole.y) < 0.001);
        
        if (!isCentralHole) {
            const newDistance = Math.sqrt(this.intersectPoint.x * this.intersectPoint.x + this.intersectPoint.y * this.intersectPoint.y);
            
            if (this.isValidPolarPosition(hole.angle, newDistance, hole.radius, holeIndex)) {
                this.updateHoleFromPolar(holeIndex, hole.angle, newDistance);
                
            }
        }
    } else {
        // Normal drag: Change angle around center
        const currentMouseAngle = Math.atan2(this.intersectPoint.y, this.intersectPoint.x) * 180 / Math.PI;
        const angleDelta = currentMouseAngle - initialMouseAngle;
        let newAngle = (initialAngle + angleDelta + 360) % 360;
        
        // Snap angle to 1-degree increments
        newAngle = this.snapAngleToIncrement(newAngle);
        
        if (this.isValidPolarPosition(newAngle, hole.distance, hole.radius, holeIndex)) {
            this.updateHoleFromPolar(holeIndex, newAngle, hole.distance);
            
        }
    }
};
    
    const onMouseUp = () => {
        if (isDragging && activeControl) {
            this.highlightControl(activeControl.holeIndex, false);
            this.recordValidPosition(activeControl.holeIndex);
        }
        
        isDragging = false;
        activeControl = null;
        this.orbitControls.enabled = true;
    };
    
    // Add event listeners
    this.renderer.domElement.addEventListener('mousedown', onMouseDown);
    this.renderer.domElement.addEventListener('mousemove', onMouseMove);
    this.renderer.domElement.addEventListener('mouseup', onMouseUp);
    this.renderer.domElement.addEventListener('mousemove', onMouseHover); // For hover effects
    
    // Add keyboard event listeners for shift, control, alt, and tab keys
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
}
updateAllHoleMarkersAndUI() {
    this.holes.forEach((hole, index) => {
        // Update hole markers
        this.updateHoleMarker(index);
        
        // Update UI sliders for diameter
        const diameterSlider = document.getElementById(`h${index}-diameter-range`);
        const diameterInput = document.getElementById(`h${index}-diameter`);
        
        
        if (diameterSlider) diameterSlider.value = (hole.radius * 2).toFixed(4);
        if (diameterInput) diameterInput.value = (hole.radius * 2).toFixed(4);
        
    });
    
    // Update cylinder geometry
    this.updateCylinderGeometry();
    this.render();
}
// Update hole position from polar coordinates
updateHoleFromPolar(holeIndex, angle, distance) {
    const hole = this.holes[holeIndex];
    const { x, y } = this.polarToCartesian(angle, distance);
    
    hole.angle = angle;
    hole.distance = distance;
    hole.x = x;
    hole.y = y;
    
    // Update visual elements
    this.updatePolarControlVisuals(holeIndex);
    this.updateHoleMarkerPosition(holeIndex);
    this.updateCylinderGeometry();
    
    // Make sure to update ALL slider values after polar change
    this.updateSliderValues(holeIndex);
    
  
    this.render();
}

// Update polar control visual elements
updatePolarControlVisuals(holeIndex) {
    const hole = this.holes[holeIndex];
    const control = this.transformControls[holeIndex];
    
    // Update rotation ring size
    control.rotationRing.geometry.dispose();
    control.rotationRing.geometry = new THREE.RingGeometry(hole.distance - 0.0001, hole.distance + 0.0001, 64);
    
    // Update distance handle position
    control.distanceHandle.position.set(hole.x, hole.y, this.cylinderHeight / 2 + 0.001);
    
    // Update radial line
    control.radialLine.geometry.dispose();
    control.radialLine.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, this.cylinderHeight / 2),
        new THREE.Vector3(hole.x, hole.y, this.cylinderHeight / 2)
    ]);
}
updateHoleDiameterDirect(holeIndex, newRadius) {
    if (this.isValidPosition(this.holes[holeIndex].x, this.holes[holeIndex].y, newRadius, holeIndex)) {
        this.holes[holeIndex].radius = newRadius;
        
        // Update visual elements
        this.updateHoleMarker(holeIndex);
        this.updateCylinderGeometry();
        
        // Update UI sliders
        const diameterSlider = document.getElementById(`h${holeIndex}-diameter-slider`);
        const diameterInput = document.getElementById(`h${holeIndex}-diameter`);
        
        
        if (diameterSlider) diameterSlider.value = (newRadius * 2).toFixed(4);
        if (diameterInput) diameterInput.value = (newRadius * 2).toFixed(4);
       
        
        this.render();
        return true;
    }
    return false;
}
// Highlight control when active
highlightControl(holeIndex, highlight) {
    const control = this.transformControls[holeIndex];
    
    if (highlight) {
        control.rotationRing.material.opacity = 0.6;
        control.distanceHandle.material.opacity = 1.0;
        control.radialLine.material.opacity = 0.8;
    } else {
        control.rotationRing.material.opacity = 0.3;
        control.distanceHandle.material.opacity = 0.8;
        control.radialLine.material.opacity = 0.5;
    }
}
// Validate polar coordinates
isValidPolarPosition(angle, distance, radius, holeIndex) {
    // Convert to Cartesian for existing validation
    const { x, y } = this.polarToCartesian(angle, distance);
    return this.isValidPosition(x, y, radius, holeIndex);
}
// Add this new method to revert to last valid position
revertToLastValidPosition(holeIndex) {
    const history = this.positionHistory[holeIndex];
    
    // Go through history from most recent to oldest
    for (let i = history.length - 1; i >= 0; i--) {
        const historicalPosition = history[i];
        
        if (this.isValidPosition(
            historicalPosition.x, 
            historicalPosition.y, 
            historicalPosition.radius, 
            holeIndex
        )) {
            // Found a valid historical position, revert to it
            this.holes[holeIndex].x = historicalPosition.x;
            this.holes[holeIndex].y = historicalPosition.y;
            this.holes[holeIndex].radius = historicalPosition.radius;
            return true;
        }
    }
    
    // If no valid position found in history, keep current position
    // (this shouldn't happen in normal operation)
    return false;
}
updatePositionSliderRanges() {
    const maxDistance = this.cylinderRadius * 0.8;

    this.holes.forEach((hole, index) => {
        const distanceSlider = document.getElementById(`h${index}-distance-range`);
        const distanceInput = document.getElementById(`h${index}-distance`);
        
        if (distanceSlider) {
            distanceSlider.max = maxDistance.toFixed(3);
        }
        if (distanceInput) {
            distanceInput.max = maxDistance.toFixed(3);
        }
    });
}
            
regenerateHoles(count) {
    // Generate new hole configuration
    this.generateInitialHoles(count);
    
    // Recreate all 3D elements
    this.createPolarTransformControls();
    this.createHoleMarkers();
    this.updateCylinderGeometry();
    
    // Recreate UI controls
    this.createHoleControlsUI();
    
    // Update hole count input
    document.getElementById('hole-count').value = count;
    
    // Update cylinder diameter control constraints
    const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
    const minRadius = this.calculateMinimumCylinderRadius();
    cylinderDiameterSlider.min = minRadius * 2;
    
    // Update print mode if active
    if (this.isPrintMode) {
        this.removeDimensions();
        this.createDimensions();
    }
    
    this.render();
}
            
            
createHoleControlsUI() {
    const controlsContainer = document.getElementById('hole-controls');
    controlsContainer.innerHTML = '';
    const titleContainer = document.getElementById('hole-titles');
    titleContainer.innerHTML = '';
    const maxPosition = this.cylinderRadius * 0.8;
    
    this.holes.forEach((hole, index) => {
        const holeControl = document.createElement('div');
        holeControl.className = 'div-block-264 hole';
        const holeTitle = document.createElement('div');
        // Check if this is the central lumen (distance = 0)
        const isCentralLumen = hole.distance === 0;
        let controlsTitleHTML = `<div class="div-block-408">
              <p class="white-text strong right hole-title">${hole.name}</p>
              <p class="unit-tag">(IN)</p>
            </div>
            <div class="divider"></div>`;
      
        let controlsHTML = `
          <p class="hide-price hole-title">${hole.name}</p>
          <div class="input-box">
            <div class="slidecontainer">
              <input class="range-slider" type="range" min="0.015" max="0.15" value="${(hole.radius * 2).toFixed(4)}" step="0.001" id="h${index}-diameter-range" >
            </div>
            <input class="text-field-3 slider w-input diameter" type="number" id="h${index}-diameter" value="${(hole.radius * 2).toFixed(4)}" min="0.015" max="0.15" step="0.001">
            
          </div>
          `;
        
        // Only add angle and distance controls for non-central holes
        if (!isCentralLumen) {
            controlsHTML += `
            <div class="input-box">
            <div class="slidecontainer">
              <input class="range-slider" type="range" min="0" max="${maxPosition.toFixed(3)}" value="${hole.distance.toFixed(4)}" step="0.001" id="h${index}-distance-range" >
            </div>
            <input class="text-field-3 slider w-input distance" type="number" id="h${index}-distance" min="0" max="${maxPosition.toFixed(3)}" value="${hole.distance.toFixed(4)}" step="0.001">
            
          </div>
          
          <div class="input-box">
            <div class="slidecontainer">
              <input class="range-slider" type="range" min="0" max="360" value="${hole.angle}" step="1" id="h${index}-angle-range" >
            </div>
            <input class="text-field-3 slider w-input angle" type="number" id="h${index}-angle" min="0" max="360" value="${hole.angle}" step="1">
            
          </div>`;
        }
        
        controlsHTML += `<div class="warning" id="warning-${index}"></div>`;
        const divider = document.createElement('div');
        divider.className = 'divider';
        holeControl.innerHTML = controlsHTML;
        holeTitle.innerHTML = controlsTitleHTML;
        controlsContainer.appendChild(holeControl);
        controlsContainer.appendChild(divider);
        titleContainer.appendChild(holeTitle);
        this.setupHoleSliderListeners(index);
    });
}

setupHoleSliderListeners(index) {
    const hole = this.holes[index];
    const isCentralLumen = hole.distance === 0;
    
    const diameterSlider = document.getElementById(`h${index}-diameter-range`);
    const diameterInput = document.getElementById(`h${index}-diameter`);
   
    
    
    // Diameter controls (available for all holes)
    diameterSlider.addEventListener('input', (e) => {
        const newDiameter = parseFloat(e.target.value);
        diameterInput.value = newDiameter.toFixed(4);
        this.updateHoleDiameter(index, newDiameter);
    });
    
    diameterInput.addEventListener('input', (e) => {
        const newDiameter = parseFloat(e.target.value);
        if (!isNaN(newDiameter)) {
            diameterSlider.value = newDiameter;
            this.updateHoleDiameter(index, newDiameter);
        }
    });
    
    // Only add angle and distance listeners for non-central holes
    if (!isCentralLumen) {
        const angleSlider = document.getElementById(`h${index}-angle-range`);
        const angleInput = document.getElementById(`h${index}-angle`);
        const distanceSlider = document.getElementById(`h${index}-distance-range`);
        const distanceInput = document.getElementById(`h${index}-distance`);
        
        
        
        // Angle controls
        angleSlider.addEventListener('input', (e) => {
            const newAngle = parseFloat(e.target.value);
            angleInput.value = Math.round(newAngle);
            this.updateHoleAngle(index, newAngle);
        });
        
        angleInput.addEventListener('input', (e) => {
            const newAngle = parseFloat(e.target.value);
            if (!isNaN(newAngle)) {
                angleSlider.value = newAngle;
                this.updateHoleAngle(index, newAngle);
            }
        });
        
        // Distance controls
        distanceSlider.addEventListener('input', (e) => {
            const newDistance = parseFloat(e.target.value);
            distanceInput.value = newDistance.toFixed(4);
            this.updateHoleDistance(index, newDistance);
        });
        
        distanceInput.addEventListener('input', (e) => {
            const newDistance = parseFloat(e.target.value);
            if (!isNaN(newDistance)) {
                distanceSlider.value = newDistance;
                this.updateHoleDistance(index, newDistance);
            }
        });
    }
}


updateHoleDiameter(index, newDiameter, valueDisplay) {
    const newRadius = newDiameter / 2;
    const hole = this.holes[index];
    
    // Instead of rejecting invalid values, find the closest valid value
    const constrainedRadius = this.findClosestValidRadius(hole.x, hole.y, newRadius, index);
    const constrainedDiameter = constrainedRadius * 2;
    
    // Always update to the constrained value (no rejection)
    this.holes[index].radius = constrainedRadius;
    this.recordValidPosition(index);
    
    // Update slider to match constrained value (prevents jumping)
    const diameterSlider = document.getElementById(`h${index}-diameter-range`);
    const diameterInput = document.getElementById(`h${index}-diameter`);
    if (diameterSlider && Math.abs(diameterSlider.value - constrainedDiameter) > 0.001) {
        diameterSlider.value = constrainedDiameter.toFixed(4);
    }
    if (diameterInput && Math.abs(diameterInput.value - constrainedDiameter) > 0.001) {
        diameterInput.value = constrainedDiameter.toFixed(4);
    }
    
    // Update 3D model immediately
    this.updateHoleMarker(index);
    this.updateCylinderGeometry();
    this.updatePolarControlVisuals(index);
    
    this.render();
}
// Helper methods to find closest valid values:

findClosestValidRadius(x, y, targetRadius, holeIndex) {
    const maxRadius = 0.075; // Half of 0.15 max diameter
    const minRadius = 0.0075; // Half of 0.015 min diameter
    
    // Start with bounds checking
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

findClosestValidAngle(targetAngle, distance, radius, holeIndex) {
    // If current position is valid, return target
    if (this.isValidPolarPosition(targetAngle, distance, radius, holeIndex)) {
        return targetAngle;
    }
    
    // Search for closest valid angle in both directions
    const searchStep = 1; // 1 degree steps
    const maxSearch = 180; // Don't search more than 180 degrees
    
    for (let offset = searchStep; offset <= maxSearch; offset += searchStep) {
        // Try positive direction
        const anglePos = (targetAngle + offset) % 360;
        if (this.isValidPolarPosition(anglePos, distance, radius, holeIndex)) {
            return anglePos;
        }
        
        // Try negative direction
        const angleNeg = (targetAngle - offset + 360) % 360;
        if (this.isValidPolarPosition(angleNeg, distance, radius, holeIndex)) {
            return angleNeg;
        }
    }
    
    // If no valid angle found, return current angle
    return this.holes[holeIndex].angle;
}

findClosestValidDistance(angle, targetDistance, radius, holeIndex) {
    // If current position is valid, return target
    if (this.isValidPolarPosition(angle, targetDistance, radius, holeIndex)) {
        return targetDistance;
    }
    
    // Search for closest valid distance
    const maxDistance = this.cylinderRadius - radius - this.minimumSeptum;
    const minDistance = 0;
    
    // Clamp to bounds first
    let testDistance = Math.max(minDistance, Math.min(targetDistance, maxDistance));
    
    // Binary search for valid distance
    const searchStep = 0.001;
    const maxSearchSteps = 100;
    
    // Search towards center first
    for (let i = 0; i < maxSearchSteps; i++) {
        if (this.isValidPolarPosition(angle, testDistance, radius, holeIndex)) {
            return testDistance;
        }
        testDistance -= searchStep;
        if (testDistance < minDistance) break;
    }
    
    // If that failed, search away from center
    testDistance = Math.max(minDistance, Math.min(targetDistance, maxDistance));
    for (let i = 0; i < maxSearchSteps; i++) {
        if (this.isValidPolarPosition(angle, testDistance, radius, holeIndex)) {
            return testDistance;
        }
        testDistance += searchStep;
        if (testDistance > maxDistance) break;
    }
    
    // Fallback to current distance
    return this.holes[holeIndex].distance;
}
updateHoleAngle(index, newAngle, valueDisplay) {
    const snappedAngle = this.snapAngleToIncrement(newAngle);
    const hole = this.holes[index];
    
    // Find closest valid angle
    const constrainedAngle = this.findClosestValidAngle(snappedAngle, hole.distance, hole.radius, index);
    
    // Always update to constrained value
    this.holes[index].angle = constrainedAngle;
    const { x, y } = this.polarToCartesian(constrainedAngle, this.holes[index].distance);
    this.holes[index].x = x;
    this.holes[index].y = y;
    this.recordValidPosition(index);
    
    // Update slider to match constrained value
    const angleSlider = document.getElementById(`h${index}-angle-range`);
    const angleInput = document.getElementById(`h${index}-angle`);
    if (angleSlider && Math.abs(angleSlider.value - constrainedAngle) > 1) {
        angleSlider.value = constrainedAngle;
    }
    if (angleInput && Math.abs(angleInput.value - constrainedAngle) > 1) {
        angleInput.value = Math.round(constrainedAngle);
    }
    
    // Update 3D model immediately
    this.updateHoleMarkerPosition(index);
    this.updateCylinderGeometry();
    this.updatePolarControlVisuals(index);
   
    this.render();
}

updateHoleDistance(index, newDistance, valueDisplay) {
    const hole = this.holes[index];
    
    // Find closest valid distance
    const constrainedDistance = this.findClosestValidDistance(hole.angle, newDistance, hole.radius, index);
    
    // Always update to constrained value
    this.holes[index].distance = constrainedDistance;
    const { x, y } = this.polarToCartesian(this.holes[index].angle, constrainedDistance);
    this.holes[index].x = x;
    this.holes[index].y = y;
    this.recordValidPosition(index);
    
    // Update slider to match constrained value
    const distanceSlider = document.getElementById(`h${index}-distance-range`);
    const distanceInput = document.getElementById(`h${index}-distance`);
    if (distanceSlider && Math.abs(distanceSlider.value - constrainedDistance) > 0.001) {
        distanceSlider.value = constrainedDistance.toFixed(4);
    }
    if (distanceInput && Math.abs(distanceInput.value - constrainedDistance) > 0.001) {
        distanceInput.value = constrainedDistance.toFixed(4);
    }
    
    // Update 3D model immediately
    this.updateHoleMarkerPosition(index);
    this.updateCylinderGeometry();
    this.updatePolarControlVisuals(index);
    
    this.render();
}


// New helper function to update hole marker position without recreating geometry
updateHoleMarkerPosition(index) {
   const hole = this.holes[index];
    const marker = this.holeMarkers[index];
    
    // Update marker position
    marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
    
    // Update polar control visuals instead of transform control object
    if (this.transformControls[index]) {
        this.updatePolarControlVisuals(index);
    }
}
            
            canResizeHole(holeIndex, newRadius) {
                const hole = this.holes[holeIndex];
                
                // Check cylinder boundary constraint
                const distanceFromCenter = Math.sqrt(hole.x * hole.x + hole.y * hole.y);
                const maxAllowedRadius = this.cylinderRadius - distanceFromCenter - this.minimumSeptum;
                
                if (newRadius > maxAllowedRadius) {
                    return false;
                }
                
                // Check separation from other holes
                for (let i = 0; i < this.holes.length; i++) {
                    if (i === holeIndex) continue;
                    
                    const otherHole = this.holes[i];
                    const dx = hole.x - otherHole.x;
                    const dy = hole.y - otherHole.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minRequiredDistance = newRadius + otherHole.radius + this.minimumSeptum;
                    
                    if (distance < minRequiredDistance) {
                        return false;
                    }
                }
                
                return true;
            }
            
            createGeometry() {
                this.updateCylinderGeometry();
                this.createHoleMarkers();
this.setupPolarControlInteraction();
            }
            
            createHoleMarkers() {
                // Clean up existing markers
                this.holeMarkers.forEach(marker => {
                    this.scene.remove(marker);
                    if (marker.geometry) marker.geometry.dispose();
                    if (marker.material) marker.material.dispose();
                });
                this.holeMarkers = [];
                
                // Create new markers for current holes
                this.holes.forEach((hole, index) => {
                    const marker = this.createHoleMarker(hole, index);
                    this.holeMarkers.push(marker);
                    this.scene.add(marker);
                    this.transformControls[index].attach(marker);
                });
            }
            
            createHoleMarker(hole, index) {
                const geometry = new THREE.CircleGeometry(hole.radius, 32);
                const material = new THREE.MeshBasicMaterial({ 
                    color: hole.color,
                    transparent: true, 
                    opacity: 0.3,
                    side: THREE.DoubleSide,
            
                });
                
                const marker = new THREE.Mesh(geometry, material);
                marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
                marker.userData.holeIndex = index;
                
                return marker;
            }
            
            updateHoleMarker(index) {
                const hole = this.holes[index];
                const marker = this.holeMarkers[index];
                
                // Update geometry
                marker.geometry.dispose();
                marker.geometry = new THREE.CircleGeometry(hole.radius, 32);
                
                // Update position
                marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            }
            
            updateCylinderGeometry() {
                if (this.cylinderMesh) {
                    this.cylinderMesh.geometry.dispose();
                    this.scene.remove(this.cylinderMesh);
                }
                
                const cylinderShape = new THREE.Shape();
                cylinderShape.absarc(0, 0, this.cylinderRadius, 0, Math.PI * 2, false);
                
                this.holes.forEach(hole => {
                    const holePath = new THREE.Path();
                    holePath.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
                    cylinderShape.holes.push(holePath);
                });
                
                  const extrudeSettings = {
                    depth: this.cylinderHeight,
                    bevelEnabled: false,
                    steps: 1,
                    curveSegments: 32
                };
                
                const geometry = new THREE.ExtrudeGeometry(cylinderShape, extrudeSettings);
                geometry.center();
                
                const material = new THREE.MeshLambertMaterial({ 
                    color: 0x8ac1c3,
                    transparent: true,
                    opacity: 1
                    
                });
                
                this.cylinderMesh = new THREE.Mesh(geometry, material);
                this.cylinderMesh.castShadow = true;
                this.cylinderMesh.receiveShadow = true;
                this.scene.add(this.cylinderMesh);
                //const controlTest = new TransformControls(this.camera, this.renderer.domElement);
           
            }
            

          
            applyConstraints(newX, newY, currentHoleIndex) {
                const currentHole = this.holes[currentHoleIndex];
                let constrainedX = newX;
                let constrainedY = newY;
                
                this.holes.forEach((otherHole, index) => {
                    if (index === currentHoleIndex) return;
                    
                    const dx = constrainedX - otherHole.x;
                    const dy = constrainedY - otherHole.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = currentHole.radius + otherHole.radius + this.minimumSeptum;
                    
                    if (distance < minDistance) {
                        const angle = Math.atan2(dy, dx);
                        constrainedX = otherHole.x + Math.cos(angle) * minDistance;
                        constrainedY = otherHole.y + Math.sin(angle) * minDistance;
                    }
                });
                
                const maxDistance = this.cylinderRadius - currentHole.radius - this.minimumSeptum;
                const distanceFromCenter = Math.sqrt(constrainedX * constrainedX + constrainedY * constrainedY);
                
                if (distanceFromCenter > maxDistance) {
                    const bestPosition = this.findValidPosition(newX, newY, currentHoleIndex);
                    constrainedX = bestPosition.x;
                    constrainedY = bestPosition.y;
                }
                
                return { x: constrainedX, y: constrainedY };
            }

            findValidPosition(targetX, targetY, currentHoleIndex) {
                const currentHole = this.holes[currentHoleIndex];
                const maxDistance = this.cylinderRadius - currentHole.radius - this.minimumSeptum;
                
                const targetDistance = Math.sqrt(targetX * targetX + targetY * targetY);
                let bestX, bestY;
                
                if (targetDistance > maxDistance) {
                    const angle = Math.atan2(targetY, targetX);
                    bestX = Math.cos(angle) * maxDistance;
                    bestY = Math.sin(angle) * maxDistance;
                } else {
                    bestX = targetX;
                    bestY = targetY;
                }
                
                let violations = [];
                
                this.holes.forEach((otherHole, index) => {
                    if (index === currentHoleIndex) return;
                    
                    const dx = bestX - otherHole.x;
                    const dy = bestY - otherHole.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = currentHole.radius + otherHole.radius + this.minimumSeptum;
                    
                    if (distance < minDistance) {
                        violations.push({ 
                            hole: otherHole, 
                            minDistance, 
                            index,
                            violationAmount: minDistance - distance 
                        });
                    }
                });
                
                if (violations.length === 0) {
                    return { x: bestX, y: bestY };
                }
                
                const closestViolation = violations.reduce((worst, current) => 
                    current.violationAmount > worst.violationAmount ? current : worst
                );
                
                const otherHole = closestViolation.hole;
                const minDistanceFromOther = closestViolation.minDistance;
                
                const baseAngle = Math.atan2(targetY - otherHole.y, targetX - otherHole.x);
                
                const searchAngles = [0, Math.PI/6, -Math.PI/6, Math.PI/4, -Math.PI/4, Math.PI/3, -Math.PI/3, Math.PI/2, -Math.PI/2];
                
                for (const angleOffset of searchAngles) {
                    const testAngle = baseAngle + angleOffset;
                    const testX = otherHole.x + Math.cos(testAngle) * minDistanceFromOther;
                    const testY = otherHole.y + Math.sin(testAngle) * minDistanceFromOther;
                    
                    const testDistanceFromCenter = Math.sqrt(testX * testX + testY * testY);
                    if (testDistanceFromCenter <= maxDistance) {
                        let validPosition = true;
                        
                        for (let i = 0; i < this.holes.length; i++) {
                            if (i === currentHoleIndex) continue;
                            
                            const checkHole = this.holes[i];
                            const checkDx = testX - checkHole.x;
                            const checkDy = testY - checkHole.y;
                            const checkDistance = Math.sqrt(checkDx * checkDx + checkDy * checkDy);
                            const checkMinDistance = currentHole.radius + checkHole.radius + this.minimumSeptum;
                            
                            if (checkDistance < checkMinDistance) {
                                validPosition = false;
                                break;
                            }
                        }
                        
                        if (validPosition) {
                            return { x: testX, y: testY };
                        }
                    }
                }
                
                const fallbackAngle = Math.atan2(targetY - otherHole.y, targetX - otherHole.x);
                let fallbackX = otherHole.x + Math.cos(fallbackAngle) * minDistanceFromOther;
                let fallbackY = otherHole.y + Math.sin(fallbackAngle) * minDistanceFromOther;
                
                const fallbackDistance = Math.sqrt(fallbackX * fallbackX + fallbackY * fallbackY);
                if (fallbackDistance > maxDistance) {
                    const constrainAngle = Math.atan2(fallbackY, fallbackX);
                    fallbackX = Math.cos(constrainAngle) * maxDistance;
                    fallbackY = Math.sin(constrainAngle) * maxDistance;
                }
                
                return { x: fallbackX, y: fallbackY };
            }
            
updateSliderValues(holeIndex) {
    const hole = this.holes[holeIndex];
    
    // Get all the controls for this hole
    const angleSlider = document.getElementById(`h${holeIndex}-angle-range`);
    const angleInput = document.getElementById(`h${holeIndex}-angle`);
    
    
    const distanceSlider = document.getElementById(`h${holeIndex}-distance-range`);
    const distanceInput = document.getElementById(`h${holeIndex}-distance`);
   

    const diameterSlider = document.getElementById(`h${holeIndex}-diameter-range`);
    const diameterInput = document.getElementById(`h${holeIndex}-diameter`);
   
    // Update angle controls
    if (angleSlider && angleInput) {
        angleSlider.value = hole.angle;
        angleInput.value = Math.round(hole.angle);
      
    }
    
    // Update distance controls
    if (distanceSlider && distanceInput) {
        distanceSlider.value = hole.distance.toFixed(3);
        distanceInput.value = hole.distance.toFixed(3);
        
    }
    if (diameterSlider && diameterInput) {
        diameterSlider.value = (hole.radius*2).toFixed(3);
        diameterInput.value = (hole.radius*2).toFixed(3);
        
    }
}
            
            setupEventListeners() {
              //const stats = new Stats();
              //document.body.appendChild(stats.dom);
         window.addEventListener('resize', () => this.onWindowResize(), false);
                
                const animate = () => {
                  //stats.begin();
                    requestAnimationFrame(animate);
                    this.orbitControls.update();
                  //stats.end();
                   // this.render();
                  
                };
                animate();
            }
            
onWindowResize() {
    const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
    
    // Update perspective camera
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();
    
    // Update orthographic camera
    const frustumSize = 0.4;
    this.orthographicCamera.left = -frustumSize * aspect / 2;
    this.orthographicCamera.right = frustumSize * aspect / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = -frustumSize / 2;
    this.orthographicCamera.updateProjectionMatrix();
    
    this.renderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    
    // Only update CSS2D renderer size when it's being used
    if (this.css2dRenderer && this.isPrintMode) {
        this.css2dRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    }
    
    this.render();
}
            
render() {
    this.renderer.render(this.scene, this.currentCamera);
    
    // Only render CSS2D when in print mode (when labels/dimensions are needed)
    if (this.css2dRenderer && this.isPrintMode) {
        this.css2dRenderer.render(this.scene, this.currentCamera);
    }
}
        }
        
        new CylinderWithHoles();

////// END THREE
//updateJourney('Three JS objects: ' + this.scene.children.length);  

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
    $("#6-week-price").val(3600).trigger("change");
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
function createLine(){
var find = $(".line");
var lineItem = find.length +1;
var material = $("#material-2").val();
var additive = $("#color-2").val();
var color = $("#colorant").val();
var cert = $('input[data-name=cert]:checked').val();
var unit = $("#unit").val();
var price = $('#'+ $('input[data-name=price]:checked').val()).val();
var leadtime =  $('input[data-name=price]:checked').val();
var od = $("#cylinder-diameter-input").val();
var odTol = $("#od-tol-2").val();
var lenTol = $("#length-tol-2").val();
if($("#apply-expedite").is(":checked")) {
  var expedite = `style="display: block;margin-right:5px;" checked`;
  var label = `style="display:flex;"`;
  } else {
  var expedite = `style="display:none;margin-right:5px;"`;
  var label = `style="display:none;"`;
  }
  

if($("#quantity-2").val() == 'More') {
  var quantity = $("#custom-quantity").val();
} else {
  var quantity = $("#quantity-2").val();
}
//Create Hole HTML
var holes = $(".hole");
var holeTML = '';
for(var i = 0; i < holes.length; i++){
  
  var holeTitle = $(holes[i]).find('.hole-title').text();
  var holeNum = i + 1;
  var diameter = $(holes[i]).find('.diameter').val();
  var distance = $(holes[i]).find('.distance').val();;
  var angle = $(holes[i]).find('.angle').val();
  if (holeTitle == 'Central Lumen') {
    holeTML += `<div class="hole-layout">
    <p class="label quarter">`+holeTitle+`</p>
    <input class="quote-input quarter" id="l`+lineItem+`-h`+holeNum+`-diameter" value="`+diameter+`" readonly></input>
    <div class="quarter ml-20 no-height"></div>
    <div class="quarter ml-20 no-height"></div>
    </div>`;
  } else {
  holeTML += `<div class="hole-layout">
    <p class="label quarter">`+holeTitle+`</p>
    <input class="quote-input quarter" id="l`+lineItem+`-h`+holeNum+`-diameter" value="`+diameter+`" readonly></input>
    <input class="quote-input quarter" id="l`+lineItem+`-h`+holeNum+`-distance" value="`+distance+`" readonly></input>
    <input class="quote-input quarter" id="l`+lineItem+`-h`+holeNum+`-angle" value="`+angle+`" readonly></input>
  </div>`;
  }
}
  

  
//
if($("#shipping-carrier").val()) {var shipping = $("#custom-method").val(); var account = $("#shipping-account").val(); var carrier = $("#shipping-carrier").val(); $("#custom-carrier").val(carrier); $("#account-number").val(account);} else  {var shipping = $("#shipping-method").val(); var account = ""; var carrier = "";};
if(!$("#custom-quote").is(":checked")){
var lineHtml = 
`<div class="line" id="line`+lineItem+`">
<div class="title-block"><p class="delete">x</p><p class="line-title">Line `+ lineItem +` (`+ unit +`)</p><p class="edit" id="`+ lineItem +`">Edit</p></div>
<p class="label profile" profileId="1">Circular Hole Profile</p>
<div class="row">

  <div class="col">
    <div class="item"><p class="label">OD</p><input class="quote-input" id="l`+lineItem+`-od" value="`+od+`" readonly></input></div>
    <div class="item"><p class="label">Length</p><input class="quote-input line-length" id="l`+lineItem+`-length" value="`+length+`" readonly></input></div>
    <div class="item"><p class="label">Material</p><input class="quote-input" id="l`+lineItem+`-material" value="`+material+`" readonly></input></div>
    <div class="item"><p class="label">Additive</p><input class="quote-input" id="l`+lineItem+`-additive" value="`+additive+`" readonly></input></div>
    <div class="item"><p class="label">Color</p><input class="quote-input" id="l`+lineItem+`-color" value="`+color+`" readonly></input></div>
    <div class="item"><p class="label">Cert Level</p><input class="quote-input" id="l`+lineItem+`-cert" value="`+cert+`" readonly></input></div>
  </div>
  <div class="col">
    <div class="item"><p class="label">OD Tol</p><input class="quote-input" id="l`+lineItem+`-od-tol" value="`+odTol+`" readonly></input></div>
    <div class="item"><p class="label">Length Tol</p><input class="quote-input" id="l`+lineItem+`-length-tol" value="`+lenTol+`" readonly></input></div>
    <div class="item"><p class="label">Quantity (Feet)</p><input class="quote-input" id="l`+lineItem+`-quantity" value="`+quantity+`" readonly></input></div>
    <div class="item input-remove"><p class="label">Lead Time</p><input class="quote-input line-leadtime" id="l`+lineItem+`-leadtime" value="`+leadtime.replace('-price','')+`" readonly></input></div>
    <div class="item input-remove"><p class="label">Price($)</p><input class="quote-input price-item" id="l`+lineItem+`-price" value="`+price+`" readonly></input></div>
    <div class="item input-remove"><p class="label">Shipping Method</p><input class="quote-input shipping-line-item" id="l`+lineItem+`-shipping" value="`+shipping+`" readonly method="`+shipping+`" carrier="`+carrier+`" account="`+account+`"></input></div>
    <label class="label" `+ label +`><input type="checkbox" class="expedited" id="l`+lineItem+`-expedite" readonly `+ expedite +` onclick="return false"></input>Free Expedite Applied</label>
  </div>
  <input class="linenumber" id="l`+lineItem+`-line" value="`+lineItem+`" readonly style="display:none;"></input>
  <input class="quote-input unit" id="l`+lineItem+`-unit" value="`+unit+`" readonly style="display:none;"></input>
  <input type="checkbox" class="line-greenlight" id="l`+lineItem+`-greenlight" value="`+greenlight+`" readonly style="display:none;"></input>
</div>
<div class="quote-divider"></div>
<div class="row" style="flex-direction: column;">
  <div class="hole-layout">
    <p class="label quarter">Hole</p>
    <p class="label quarter ml-20">Diameter</p>
    <p class="label quarter ml-20">Distance</p>
    <p class="label quarter ml-20">Angle</p>
  </div>
  `+holeTML+`
</div>
</div>`;} else {
var lineHtml = 
  `<div class="line" id="line`+lineItem+`">
<div class="title-block"><p class="delete">x</p><p class="line-title">Line `+ lineItem +` (`+ unit +`)</p><p class="edit" id="`+ lineItem +`">Edit</p></div>
<div class="row">
<p class="label profile" profileId="1">Circular Hole Profile</p>
  <div class="col">
    <div class="item"><p class="label">OD</p><input class="quote-input" id="l`+lineItem+`-od" value="`+od+`" readonly></input></div>
    <div class="item"><p class="label">Length</p><input class="quote-input line-length" id="l`+lineItem+`-length" value="`+length+`" readonly></input></div>
    <div class="item"><p class="label">Material</p><input class="quote-input" id="l`+lineItem+`-material" value="`+material+`" readonly></input></div>
    <div class="item"><p class="label">Additive</p><input class="quote-input" id="l`+lineItem+`-additive" value="`+additive+`" readonly></input></div>
    <div class="item"><p class="label">Color</p><input class="quote-input" id="l`+lineItem+`-color" value="`+color+`" readonly></input></div>
    <div class="item"><p class="label">Cert Level</p><input class="quote-input" id="l`+lineItem+`-cert" value="`+cert+`" readonly></input></div>
  </div>
  <div class="col">
    <div class="item"><p class="label">OD Tol</p><input class="quote-input" id="l`+lineItem+`-od-tol" value="`+odTol+`" readonly></input></div>
    <div class="item"><p class="label">Length Tol</p><input class="quote-input" id="l`+lineItem+`-length-tol" value="`+lenTol+`" readonly></input></div>
    <div class="item"><p class="label">Quantity (Feet)</p><input class="quote-input" id="l`+lineItem+`-quantity" value="`+quantity+`" readonly></input></div>
    <div class="item input-remove"><p class="label">Lead Time</p><input class="quote-input line-leadtime" id="l`+lineItem+`-leadtime" value="`+leadtime.replace('-price','')+`" readonly></input></div>
    <div class="item input-remove"><p class="label">Price($)</p><input class="quote-input price-item" id="l`+lineItem+`-price" value="`+price+`" readonly></input></div>
    <div class="item input-remove"><p class="label">Shipping Method</p><input class="quote-input shipping-line-item" id="l`+lineItem+`-shipping" value="`+shipping+`" readonly method="`+shipping+`" carrier="`+carrier+`" account="`+account+`"></input></div>
    <label class="label" `+ label +`><input type="checkbox" class="expedited" id="l`+lineItem+`-expedite" readonly `+ expedite +` onclick="return false"></input>Free Expedite Applied</label>
  </div>
  <input class="linenumber" id="l`+lineItem+`-line" value="`+lineItem+`" readonly style="display:none;"></input>
  <input class="quote-input unit" id="l`+lineItem+`-unit" value="`+unit+`" readonly style="display:none;"></input>
  <input type="checkbox" class="line-greenlight" id="l`+lineItem+`-greenlight" value="`+greenlight+`" readonly style="display:none;" checked></input>
</div>
<div class="row">
  <div class="hole-layout">
    <p class="label quarter">Hole</p>
    <p class="label quarter ml-20">Diameter</p>
    <p class="label quarter ml-20">Distance</p>
    <p class="label quarter ml-20">Angle</p>
  </div>
  `+holeTML+`
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


$("#add-extrusion").click(function() {
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
createLine();
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
//resetInputs();
$("#next-step").addClass('hide-price');
$("#final-details").css('display', 'none');
$("#custom-menu").addClass('hide-price');
var line = this.id;
$(".line").not("#line"+line).addClass('opacity');
$("#custom-quote").prop("checked",($("#l"+ line + "-greenlight").is(":checked")));
var previousUnit = $("#unit").val();
$("#unit").val($("#l"+ line + "-unit").val());
$("#unit").trigger('change', [previousUnit]);
$("#od-3, #od-range").val($("#l"+ line + "-od").val());
  //odController.setValue(Number($("#l"+ line + "-od").val()));
$("#id-2, #id-range").val($("#l"+ line + "-id").val());
  //idController.setValue(Number($("#l"+ line + "-id").val()));
$("#length-2, #len-range").val($("#l"+ line + "-length").val());
$("#id-tol-2").val($("#l"+ line + "-id-tol").val());
$("#wall").val($("#l"+ line + "-wall").val());
$("#od-tol-2").val($("#l"+ line + "-od-tol").val());
$("#wall-tol").val($("#l"+ line + "-wall-tol").val());
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
$("#od-3").trigger('change');

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
  
  if($("#l"+ line + "-id-tol").val() == 'REF') { $("#id-3").prop("checked", true); $("#id-3").trigger('change');}
  if($("#l"+ line + "-od-tol").val() == 'REF') { $("#od-4").prop("checked", true); $("#od-4").trigger('change');}
  if($("#l"+ line + "-wall-tol").val() == 'REF') { $("#wall-2").prop("checked", true); $("#wall-2").trigger('change');}
  $("#id-2, #wall, #material-2").trigger('change');
  $("#id-tol-2").val($("#l"+ line + "-id-tol").val());
  $("#od-tol-2").val($("#l"+ line + "-od-tol").val());
  $("#wall-tol").val($("#l"+ line + "-wall-tol").val());
  $("#length-tol-2").val($("#l"+ line + "-length-tol").val());
 // calculate(false);
  if($("#l" + line +  "-greenlight").is(":checked")){
    $("#price-block").css('display', 'none');
  } else {
    $("#price-block").css('display', 'flex');
  }
  $("#id-tol-2").val($("#l"+ line + "-id-tol").val());
  $("#od-tol-2").val($("#l"+ line + "-od-tol").val());
  $("#wall-tol").val($("#l"+ line + "-wall-tol").val());
  $("#length-tol-2").val($("#l"+ line + "-length-tol").val());
  
if( $("#l"+ line + "-expedite").is(":checked") ) {
  //get total number of expedites used in the quote, including the one that was potentially just added
  $("#reward-box").removeClass("hide-price");
  var expeditesRemaining = Number($("#reward-counter").val()) + 1;
  $("#reward-counter").val(expeditesRemaining);
  $("#expedites-remaining").text(expeditesRemaining);
  $("#apply-expedite").prop('checked', true).trigger('change');
}
if( $("#l"+ line + "-balloon-tube").is(":checked") ) {
  $("#balloon-tubing").prop('checked', true).trigger("change")
} else {
  $("#balloon-tubing").prop('checked', false).trigger("change")
}
 var step = 'A quote line was edited';
 updateJourney(step); 
});


function update() {
var line = $("#now-editing").val();
$("#l"+ line + "-unit").val($("#unit").val());
$("#line"+line).find('.line-title').text("Line "+line+" ("+$("#unit").val()+")");
$("#l"+ line + "-id").val($("#id-2").val());
$("#l"+ line + "-od").val($("#od-3").val());
$("#l"+ line + "-wall").val($("#wall").val());
$("#l"+ line + "-length").val($("#length-2").val());
$("#l"+ line + "-id-tol").val($("#id-tol-2").val());
$("#l"+ line + "-od-tol").val($("#od-tol-2").val());
$("#l"+ line + "-wall-tol").val($("#wall-tol").val());
$("#l"+ line + "-length-tol").val($("#length-tol-2").val());
$("#l"+ line + "-material").val($("#material-2").val());
$("#l"+ line + "-additive").val($("#color-2").val());
$("#l"+ line + "-color").val($("#colorant").val());

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

if ( $("#balloon-tubing").is(":checked") ) {
  $("#l"+ line + "-balloon-tube").prop('checked', true);
  $("#l"+ line + "-balloon-tube").closest(".label").css('display', 'flex')
} else {
  $("#l"+ line + "-balloon-tube").prop('checked', false);
  $("#l"+ line + "-balloon-tube").closest(".label").css('display', 'none')
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

$("#update").click(function(){

update();
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
