
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { TransformControls } from 'three/addons/controls/TransformControls.js';
        import { STLExporter } from 'three/addons/exporters/STLExporter.js';


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
let controlsVisible = true;
let isInteracting = false;
let interactionTimeout = null;
let isCapturingThumbnail = false;
const INTERACTION_TIMEOUT = 100; // 100ms after interaction stops
const LOW_QUALITY_SEGMENTS = 32;
const HIGH_QUALITY_SEGMENTS = 128;


// Global STL export function
async function exportCurrentSystemAsSTL() {
    if (!window.profileManager || !window.profileManager.currentSystem) {
        alert('No active profile system to export');
        return;
    }
    
    const system = window.profileManager.currentSystem;
    
    // Store original state
    const originalHeight = system.cylinderHeight;
    const originalMesh = system.cylinderMesh;
    
    // Get the current length from the UI
    const lengthField = document.getElementById('length-2');
    const exportLength = lengthField ? parseFloat(lengthField.value) : originalHeight;
    
    console.log(`Exporting STL with length: ${exportLength}`);
    
    try {
        // Step 1: Hide control elements
      
        hideControlElements(system);
        
        // Step 2: Create export geometry with correct length
        const exportMesh = await createExportGeometry(system, exportLength);
        
        if (!exportMesh) {
            throw new Error('Failed to create export geometry');
        }
        
        // Step 3: Export to STL
        const stlExporter = new STLExporter();
        const stlString = stlExporter.parse(exportMesh);
        
        // Step 4: Download the file
        downloadSTL(stlString, generateSTLFilename(system));
        
        // Step 5: Clean up export mesh
        if (exportMesh.geometry) exportMesh.geometry.dispose();
        if (exportMesh.material) exportMesh.material.dispose();
        
    } catch (error) {
        console.error('STL export failed:', error);
        alert('STL export failed. Please try again.');
    } finally {
        // Step 6: Restore original state
        restoreControlElements(system);
        
        // Restore original geometry if it was changed
        if (system.cylinderHeight !== originalHeight) {
            system.cylinderHeight = originalHeight;
            system.updateCylinderGeometry();
        }
        
        console.log('STL export completed, original state restored');
    }
}

//  all control elements
function hideControlElements(system) {
    // Hide hole markers
    if (system.holeMarkers) {
        system.holeMarkers.forEach(marker => {
            marker.visible = false;
        });
    }
    
    // Hide transform controls (CircularHolesSystem)
    if (system.transformControls) {
        system.transformControls.forEach(control => {
            control.visible = false;
        });
    }
    
    // Hide polar controls (SmileSystem)
    if (system.polarControls) {
        system.polarControls.forEach(control => {
            control.visible = false;
        });
    }
    
    // Hide control spheres (PieSliceSystem)
    if (system.controlSpheres) {
        system.controlSpheres.forEach(sphere => {
            sphere.visible = false;
        });
    }
    
    // Hide crescent controller (CrescentSystem)
    if (system.crescentController) {
        system.crescentController.visible = false;
    }
  
}

// Restore all control elements
function restoreControlElements(system) {
    // Show hole markers
    if (system.holeMarkers) {
        system.holeMarkers.forEach(marker => {
            marker.visible = true;
        });
    }
    
    // Show transform controls (CircularHolesSystem)
    if (system.transformControls) {
        system.transformControls.forEach(control => {
            control.visible = true;
        });
    }
    
    // Show polar controls (SmileSystem)
    if (system.polarControls) {
        system.polarControls.forEach(control => {
            control.visible = true;
        });
    }
    
    // Show control spheres (PieSliceSystem)  
    if (system.controlSpheres) {
        system.controlSpheres.forEach(sphere => {
            sphere.visible = true;
        });
    }
    
    // Show crescent controller (CrescentSystem)
    if (system.crescentController) {
        system.crescentController.visible = true;
    }
  
}

// Create geometry specifically for export with the correct length
async function createExportGeometry(system, exportLength) {
    // Store original height
    const originalHeight = system.cylinderHeight;
    
    // Temporarily set the export length
    system.cylinderHeight = exportLength;
    
    // Create new geometry with export length
    let exportMesh = null;
    
    if (system instanceof CircularHolesSystem) {
        exportMesh = createCircularHolesExportMesh(system);
    } else if (system instanceof PieSliceSystem) {
        exportMesh = createPieSliceExportMesh(system);
    } else if (system instanceof CrescentSystem) {
        exportMesh = createCrescentExportMesh(system);
    } else if (system instanceof SmileSystem) {
        exportMesh = createSmileExportMesh(system);
    }
    
    // Restore original height
    system.cylinderHeight = originalHeight;
    
    return exportMesh;
}

// Create export mesh for CircularHolesSystem
function createCircularHolesExportMesh(system) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, system.cylinderRadius, 0, Math.PI * 2, false);
    
    // Add holes
    system.holes.forEach(hole => {
        const holePath = new THREE.Path();
        holePath.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
        shape.holes.push(holePath);
    });
    
    const extrudeSettings = {
        depth: system.cylinderHeight,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 64 // Higher quality for export
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    
    const material = new THREE.MeshBasicMaterial({ color: 0x808080 });
    return new THREE.Mesh(geometry, material);
}

// Create export mesh for PieSliceSystem  
function createPieSliceExportMesh(system) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, system.cylinderRadius, 0, Math.PI * 2, false);
    
    // Add central hole if enabled
    if (system.hasCentralHole) {
        const innerRadius = system.innerDiameter / 2;
        const centralHole = new THREE.Path();
        centralHole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
        shape.holes.push(centralHole);
    }
    
    // Create pie slice holes (simplified version of the complex geometry)
    const effectiveInnerRadius = system.hasCentralHole ? 
        (system.innerDiameter / 2 + system.septumThickness) : 
        system.septumThickness;
    const effectiveOuterRadius = system.cylinderRadius - system.septumThickness;
    
    let currentAngle = 0;
    for (let i = 0; i < system.sliceCount; i++) {
        const sliceAngle = system.sliceAngles[i];
        const holeShape = new THREE.Shape();
        
        if (system.hasCentralHole) {
            // Create 4-sided pie slice
            const startAngle = currentAngle + system.septumThickness / effectiveOuterRadius / 2;
            const endAngle = startAngle + sliceAngle - system.septumThickness / effectiveOuterRadius;
            
            holeShape.moveTo(Math.cos(startAngle) * effectiveInnerRadius, Math.sin(startAngle) * effectiveInnerRadius);
            holeShape.lineTo(Math.cos(startAngle) * effectiveOuterRadius, Math.sin(startAngle) * effectiveOuterRadius);
            holeShape.absarc(0, 0, effectiveOuterRadius, startAngle, endAngle, false);
            holeShape.lineTo(Math.cos(endAngle) * effectiveInnerRadius, Math.sin(endAngle) * effectiveInnerRadius);
            holeShape.absarc(0, 0, effectiveInnerRadius, endAngle, startAngle, true);
        } else {
            // Create 3-sided pie slice
            const septumAngle = system.septumThickness / effectiveOuterRadius;
            const startAngle = currentAngle + septumAngle / 2;
            const endAngle = startAngle + sliceAngle - septumAngle;
            
            const convergenceDistance = system.septumThickness / (2 * Math.sin((endAngle - startAngle) / 2));
            const midAngle = (startAngle + endAngle) / 2;
            const convergenceX = Math.cos(midAngle) * convergenceDistance;
            const convergenceY = Math.sin(midAngle) * convergenceDistance;
            
            holeShape.moveTo(convergenceX, convergenceY);
            holeShape.lineTo(Math.cos(startAngle) * effectiveOuterRadius, Math.sin(startAngle) * effectiveOuterRadius);
            holeShape.absarc(0, 0, effectiveOuterRadius, startAngle, endAngle, false);
            holeShape.lineTo(convergenceX, convergenceY);
        }
        
        shape.holes.push(holeShape);
        currentAngle += sliceAngle;
    }
    
    const extrudeSettings = {
        depth: system.cylinderHeight,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 64
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    
    const material = new THREE.MeshBasicMaterial({ color: 0x808080 });
    return new THREE.Mesh(geometry, material);
}

// Create export mesh for CrescentSystem
function createCrescentExportMesh(system) {
    const cylinderShape = new THREE.Shape();
    cylinderShape.absarc(0, 0, system.cylinderRadius, 0, Math.PI * 2, false);
    
    // Get geometry data
    const geometry = system.calculateIndependentCrescentGeometry();
    
    if (geometry.isIndependentMode) {
        // Add actual circular hole at calculated position
        const circularHole = new THREE.Path();
        circularHole.absarc(0, geometry.actualCircularCenterY, system.circularDiameter / 2, 0, Math.PI * 2, true);
        cylinderShape.holes.push(circularHole);
        
        // Add crescent hole
        const crescentHole = system.createCrescentShape();
        cylinderShape.holes.push(crescentHole);
    } else {
        // Add both holes normally
        const circularHole = new THREE.Path();
        circularHole.absarc(0, geometry.circularCenterY, system.circularDiameter / 2, 0, Math.PI * 2, true);
        cylinderShape.holes.push(circularHole);
        
        const crescentHole = system.createCrescentShape();
        cylinderShape.holes.push(crescentHole);
    }
    
    const extrudeSettings = {
        depth: system.cylinderHeight,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 64
    };
    
    const exportGeometry = new THREE.ExtrudeGeometry(cylinderShape, extrudeSettings);
    exportGeometry.center();
    
    const material = new THREE.MeshBasicMaterial({ color: 0x808080 });
    return new THREE.Mesh(exportGeometry, material);
}

// Create export mesh for SmileSystem
function createSmileExportMesh(system) {
    const cylinderShape = new THREE.Shape();
    cylinderShape.absarc(0, 0, system.cylinderRadius, 0, Math.PI * 2, false);
    
    // Add semi-circle hole at bottom
    const semicircleHole = system.createSemiCircleShape();
    cylinderShape.holes.push(semicircleHole);
    
    // Add circular holes at top
    system.holes.forEach(hole => {
        const holePath = new THREE.Path();
        holePath.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
        cylinderShape.holes.push(holePath);
    });
    
    const extrudeSettings = {
        depth: system.cylinderHeight,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 64
    };
    
    const geometry = new THREE.ExtrudeGeometry(cylinderShape, extrudeSettings);
    geometry.center();
    
    const material = new THREE.MeshBasicMaterial({ color: 0x808080 });
    return new THREE.Mesh(geometry, material);
}

// Generate filename for STL export
function generateSTLFilename(system) {
    const unit = $("#unit").val() || 'in';
    const material = $("#material-2").val() || 'Unknown';
    const od = $("#cylinder-diameter-input").val() || '0';
    const length = $("#length-2").val() || '0';
    
    let profileType = 'Profile';
    if (system instanceof CircularHolesSystem) {
        profileType = `CircularHoles_${system.holes.length}holes`;
    } else if (system instanceof PieSliceSystem) {
        profileType = `PieSlice_${system.sliceCount}slices`;
    } else if (system instanceof CrescentSystem) {
        profileType = 'Crescent';
    } else if (system instanceof SmileSystem) {
        profileType = `Smile_${system.holes.length + 1}lumens`;
    }
    
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    return `${profileType}_OD${od}${unit}_L${length}${unit}_${material}_${timestamp}.stl`;
}

// Download STL file
function downloadSTL(stlString, filename) {
    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log(`STL exported as: ${filename}`);
}




// Main function to toggle control visibility
function toggleControlVisibility() {
    controlsVisible = !controlsVisible;
    if(controlsVisible) {
      $("#hide-controls-btn").text("HIDE CONTROLS (H)");
    } else {
      $("#hide-controls-btn").text("SHOW CONTROLS (H)");
    }
    if (!window.profileManager || !window.profileManager.currentSystem) {
        console.warn('No active profile system found');
        return;
    }
    
    const system = window.profileManager.currentSystem;
    
    // Handle different profile types
    if (system instanceof CircularHolesSystem) {
        toggleCircularHolesControls(system, controlsVisible);
    } else if (system instanceof PieSliceSystem) {
        togglePieSliceControls(system, controlsVisible);
    } else if (system instanceof CrescentSystem) {
        toggleCrescentControls(system, controlsVisible);
    } else if (system instanceof SmileSystem) {
        toggleSmileControls(system, controlsVisible);
    }
    
    // Log the action
    console.log(`Controls ${controlsVisible ? 'shown' : 'hidden'}`);
    
    // Show brief notification to user
    showControlToggleNotification(controlsVisible);
}

// Toggle controls for CircularHolesSystem
function toggleCircularHolesControls(system, visible) {
    // Hide/show hole markers (visual circles)
    if (system.holeMarkers) {
        system.holeMarkers.forEach(marker => {
            marker.visible = visible;
        });
    }
    
    // Hide/show transform controls (interactive spheres)
    if (system.transformControls) {
        system.transformControls.forEach(control => {
            control.visible = visible;
        });
    }
    
    console.log(`Circular holes controls ${visible ? 'shown' : 'hidden'}: ${system.holeMarkers?.length || 0} markers, ${system.transformControls?.length || 0} controls`);
}

// Toggle controls for PieSliceSystem
function togglePieSliceControls(system, visible) {
    // Hide/show control spheres
    if (system.controlSpheres) {
        system.controlSpheres.forEach(sphere => {
            sphere.visible = visible;
        });
    }
    
    console.log(`Pie slice controls ${visible ? 'shown' : 'hidden'}: ${system.controlSpheres?.length || 0} control spheres`);
}

// Toggle controls for CrescentSystem
function toggleCrescentControls(system, visible) {
    // Hide/show the crescent controller sphere
    if (system.crescentController) {
        system.crescentController.visible = visible;
    }
    
    console.log(`Crescent controls ${visible ? 'shown' : 'hidden'}: controller sphere`);
}

// Toggle controls for SmileSystem
function toggleSmileControls(system, visible) {
    // Hide/show hole markers (visual circles)
    if (system.holeMarkers) {
        system.holeMarkers.forEach(marker => {
            marker.visible = visible;
        });
    }
    
    // Hide/show polar controls (interactive spheres)
    if (system.polarControls) {
        system.polarControls.forEach(control => {
            control.visible = visible;
        });
    }
    
    console.log(`Smile controls ${visible ? 'shown' : 'hidden'}: ${system.holeMarkers?.length || 0} markers, ${system.polarControls?.length || 0} controls`);
}

// Show a brief notification to the user
function showControlToggleNotification(visible) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: ${visible ? '#4CAF50' : '#FF9800'};
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        z-index: 1000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        pointer-events: none;
    `;
    notification.textContent = `Controls ${visible ? 'Shown' : 'Hidden'} (Press H to toggle)`;
    
    document.body.appendChild(notification);
    
    // Fade out and remove after 2 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 1700);
}

// Set up the keyboard event listener


// Function to ensure controls are visible when switching profiles
function ensureControlsVisible() {
    if (!controlsVisible) {
        controlsVisible = true;
        
        if (window.profileManager && window.profileManager.currentSystem) {
            const system = window.profileManager.currentSystem;
            
            if (system instanceof CircularHolesSystem) {
                toggleCircularHolesControls(system, true);
            } else if (system instanceof PieSliceSystem) {
                togglePieSliceControls(system, true);
            } else if (system instanceof CrescentSystem) {
                toggleCrescentControls(system, true);
            } else if (system instanceof SmileSystem) {
                toggleSmileControls(system, true);
            }
        }
    }
}

// Function to restore control visibility when exiting print mode
function restoreControlVisibility() {
    if (window.profileManager && window.profileManager.currentSystem) {
        const system = window.profileManager.currentSystem;
        
        if (system instanceof CircularHolesSystem) {
            toggleCircularHolesControls(system, controlsVisible);
        } else if (system instanceof PieSliceSystem) {
            togglePieSliceControls(system, controlsVisible);
        } else if (system instanceof CrescentSystem) {
            toggleCrescentControls(system, controlsVisible);
        } else if (system instanceof SmileSystem) {
            toggleSmileControls(system, controlsVisible);
        }
    }
}




const UNIT_CONVERSIONS = {
    INCH_TO_MM: 25.4,
    MM_TO_INCH: 1 / 25.4
};

// Base values in inches (your current hardcoded values)
// These represent all the minimums, maximums, and defaults currently used in your code
const BASE_VALUES_INCHES = {
    minimumSeptum: 0.005,           // Minimum septum thickness
    cylinderRadius: 0.1,
    cylinderHeight: 0.15,
    centralLumenRadius: 0.0125,
    cornerRadius: 0.01,
    controlRadius: 0.008,
    safeId: 0.001,
    minGreenlightLength: 12,
    maxGreenlightLength: 72,
    maxGreenCylinderDiameter: 0.315,
    controlDistance: 0.02,
    innerDiameter: 0.025,
    minimumHoleRadius: 0.0025,      // Minimum hole radius (0.005 diameter)
    minimumCornerRadius: 0.005,     // Minimum corner radius
    defaultCylinderRadius: 0.1,     // Default cylinder radius (000 diameter)
    defaultHoleRadius: 0.015,       // Default hole radius (0.030 diameter)  
    defaultSemicircleRadius: 0.08,  // Default semicircle radius for smile
    minCylinderDiameter: 0.079,     // Minimum cylinder diameter
    maxCylinderDiameter: 0.500,     // Maximum cylinder diameter
    minInnerDiameter: 0.010,        // Minimum inner diameter
    maxInnerDiameter: 0.500,        // Maximum inner diameter
    defaultLength: 12,              // Default length
    minLength: 0,                   // Minimum length
    maxLength: 100,                 // Maximum length
    cameraFrustumSize: 0.4,         // Camera frustum size for orthographic view
    cameraMinDistance: 0.05,        // Camera minimum distance
    cameraMaxDistance: 1.0,           // Camera maximum distance
    interactionSphereRadius: 0.008, // Size of interactive control spheres
    minDistanceBetweenHoles: 0.005, // Minimum distance between holes
    defaultWallThickness: 0.01,     // Default wall thickness
    maxCornerRadius: 0.050,         // Maximum corner radius
    minimumCrescentCircularDiameter: 0.011,
};

// Convert value from current unit to target unit
function convertValue(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    
    if (fromUnit === 'in' && toUnit === 'mm') {
        return value * UNIT_CONVERSIONS.INCH_TO_MM;
    } else if (fromUnit === 'mm' && toUnit === 'in') {
        return value * UNIT_CONVERSIONS.MM_TO_INCH;
    }
    
    return value;
}

// Get base values for current unit
function getBaseValues(unit) {
    if (unit === 'mm') {
        const mmValues = {};
        for (const [key, value] of Object.entries(BASE_VALUES_INCHES)) {
            mmValues[key] = value * UNIT_CONVERSIONS.INCH_TO_MM;
        }
        return mmValues;
    }
    return BASE_VALUES_INCHES;
}

function getMinimumWallThickness(outerDiameter, unit = 'in') {
    // Convert to inches if needed for consistent comparison
    let diameterInInches = outerDiameter;
    if (unit === 'mm') {
        diameterInInches = outerDiameter * UNIT_CONVERSIONS.MM_TO_INCH;
    }
    
    let minWallInInches;
    if (diameterInInches >= 0.079 && diameterInInches <= 0.125) {
        minWallInInches = 0.005;
    } else if (diameterInInches >= 0.126 && diameterInInches <= 0.150) {
        minWallInInches = 0.006;
    } else if (diameterInInches >= 0.151 && diameterInInches <= 0.170) {
        minWallInInches = 0.007;
    } else if (diameterInInches >= 0.171 && diameterInInches <= 0.315) {
        minWallInInches = 0.008;
    } else {
        // Fallback for diameters outside the specified ranges
        minWallInInches = 0.005;
    }
    
    // Convert back to the requested unit
    if (unit === 'mm') {
        return minWallInInches * UNIT_CONVERSIONS.INCH_TO_MM;
    }
    return minWallInInches;
}
// Get step values for inputs based on unit
function getStepValue(unit, type = 'default') {
    const steps = {
        'in': {
            default: 0.001,
            diameter: 0.001,
            length: 1,
            angle: 1,
            corner: 0.0001
        },
        'mm': {
            default: 0.025,
            diameter: 0.025,
            length: 25,
            angle: 1,
            corner: 0.0025
        }
    };
    
    return steps[unit][type] || steps[unit].default;
}

// Main unit conversion function
function convertUnits(fromUnit, toUnit) {
    if (fromUnit === toUnit) return;
    
    console.log(`Converting from ${fromUnit} to ${toUnit}`);
    
    // Update all input values
    updateAllInputValues(fromUnit, toUnit);
    
    // Update system parameters
    updateSystemParameters(fromUnit, toUnit);
    
    // Update 3D model
    update3DModel(fromUnit, toUnit);
    
    // Update camera
    updateCameraConstraints(toUnit);

  setTimeout(() => {
        ensureCameraPositionForUnit();
    }, 100);
  
    console.log(`Unit conversion complete: ${fromUnit} → ${toUnit}`);
}

// Update all form input values and constraints
function updateAllInputValues(fromUnit, toUnit) {
    const baseValues = getBaseValues(toUnit);
    
    // Global controls
    updateInputWithConversion('#cylinder-diameter', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#cylinder-diameter-input', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#inner-diameter', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#inner-diameter-input', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#length-2', fromUnit, toUnit, 'length');
    updateInputWithConversion('#len-range', fromUnit, toUnit, 'length');
    updateInputWithConversion('#od-tol-2', fromUnit, toUnit, 'default');
    updateInputWithConversion('#length-tol-2', fromUnit, toUnit, 'default');
    
    // Update min/max/step for global controls
    updateInputConstraints('#cylinder-diameter', toUnit, baseValues.minCylinderDiameter, baseValues.maxCylinderDiameter, 'diameter');
    updateInputConstraints('#cylinder-diameter-input', toUnit, baseValues.minCylinderDiameter, baseValues.maxCylinderDiameter, 'diameter');
    updateInputConstraints('#inner-diameter', toUnit, baseValues.minInnerDiameter, baseValues.maxInnerDiameter, 'diameter');
    updateInputConstraints('#inner-diameter-input', toUnit, baseValues.minInnerDiameter, baseValues.maxInnerDiameter, 'diameter');
    updateInputConstraints('#length-2', toUnit, baseValues.minLength, baseValues.maxLength, 'length');
    updateInputConstraints('#len-range', toUnit, baseValues.minLength, baseValues.maxLength, 'length');
    
    // Profile-specific controls
    updateProfileSpecificInputs(fromUnit, toUnit, baseValues);
    
    // System-specific hole controls
    updateSystemHoleControls(fromUnit, toUnit);
}

// Update individual input with conversion
function updateInputWithConversion(selector, fromUnit, toUnit, type) {
    const input = document.querySelector(selector);
    if (input && input.value && !isNaN(parseFloat(input.value))) {
        const currentValue = parseFloat(input.value);
        const convertedValue = convertValue(currentValue, fromUnit, toUnit);
        const precision = toUnit === 'mm' ? 2 : 3;
        
        // For range inputs, we need to update constraints FIRST, then value
        if (input.type === 'range') {
            // Store the converted value temporarily
            input.dataset.pendingValue = convertedValue.toFixed(precision);
        } else {
            // For regular inputs, update value directly
            input.value = convertedValue.toFixed(precision);
        }
    }
}

// Update input constraints (min, max, step) - FIXED VERSION
function updateInputConstraints(selector, unit, minValue, maxValue, type) {
    const input = document.querySelector(selector);
    if (input) {
        const precision = unit === 'mm' ? 2 : 3;
        
        // Update constraints first
        input.min = minValue.toFixed(precision);
        input.max = maxValue.toFixed(precision);
        input.step = getStepValue(unit, type);
        
        // For range inputs, now set the pending value after constraints are updated
        if (input.type === 'range' && input.dataset.pendingValue) {
            const pendingValue = parseFloat(input.dataset.pendingValue);
            
            // Ensure the pending value is within the new constraints
            const clampedValue = Math.max(minValue, Math.min(maxValue, pendingValue));
            input.value = clampedValue.toFixed(precision);
            
            // Clean up the temporary data
            delete input.dataset.pendingValue;
        }
    }
}

// Alternative approach: Combined update function that handles both value and constraints
function updateInputWithConversionAndConstraints(selector, fromUnit, toUnit, type, minValue, maxValue) {
    const input = document.querySelector(selector);
    if (!input) return;
    
    const precision = toUnit === 'mm' ? 2 : 3;
    
    // Convert current value
    let convertedValue = null;
    if (input.value && !isNaN(parseFloat(input.value))) {
        const currentValue = parseFloat(input.value);
        convertedValue = convertValue(currentValue, fromUnit, toUnit);
    }
    
    // Update constraints first
    input.min = minValue.toFixed(precision);
    input.max = maxValue.toFixed(precision);
    input.step = getStepValue(toUnit, type);
    
    // Then update value (clamped to new constraints if necessary)
    if (convertedValue !== null) {
        const clampedValue = Math.max(minValue, Math.min(maxValue, convertedValue));
        input.value = clampedValue.toFixed(precision);
        
        // Log if we had to clamp the value
        if (Math.abs(clampedValue - convertedValue) > 0.001) {
            console.warn(`Value clamped for ${selector}: ${convertedValue.toFixed(precision)} → ${clampedValue.toFixed(precision)}`);
        }
    }
}

// Update profile-specific inputs
function updateProfileSpecificInputs(fromUnit, toUnit, baseValues) {
    // Crescent controls
    updateInputWithConversion('#circular-radius', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#circular-radius-input', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#crescent-corner-radius', fromUnit, toUnit, 'corner');
    updateInputWithConversion('#crescent-corner-radius-input', fromUnit, toUnit, 'corner');
    updateInputWithConversion('#crescent-septum-thickness', fromUnit, toUnit, 'default');
    updateInputWithConversion('#crescent-septum-thickness-input', fromUnit, toUnit, 'default');
    
    // Smile controls
    updateInputWithConversion('#semicircle-radius', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#semicircle-radius-input', fromUnit, toUnit, 'diameter');
    updateInputWithConversion('#smile-corner-radius', fromUnit, toUnit, 'corner');
    updateInputWithConversion('#smile-corner-radius-input', fromUnit, toUnit, 'corner');
    
    // Pie slice controls
    updateInputWithConversion('#septum-thickness', fromUnit, toUnit, 'default');
    updateInputWithConversion('#septum-thickness-input', fromUnit, toUnit, 'default');
    
    // Update constraints for profile-specific controls
    updateInputConstraints('#circular-radius', toUnit, baseValues.minInnerDiameter, baseValues.maxInnerDiameter, 'diameter');
    updateInputConstraints('#circular-radius-input', toUnit, baseValues.minInnerDiameter, baseValues.maxInnerDiameter, 'diameter');
    updateInputConstraints('#crescent-corner-radius', toUnit, baseValues.minimumCornerRadius, baseValues.minimumCornerRadius * 10, 'corner');
    updateInputConstraints('#crescent-corner-radius-input', toUnit, baseValues.minimumCornerRadius, baseValues.minimumCornerRadius * 10, 'corner');
    updateInputConstraints('#crescent-septum-thickness', toUnit, baseValues.minimumSeptum, baseValues.minimumSeptum * 10, 'default');
    updateInputConstraints('#crescent-septum-thickness-input', toUnit, baseValues.minimumSeptum, baseValues.minimumSeptum * 10, 'default');
    
    updateInputConstraints('#semicircle-radius', toUnit, baseValues.minimumHoleRadius * 2, baseValues.maxCylinderDiameter * 0.8, 'diameter');
    updateInputConstraints('#semicircle-radius-input', toUnit, baseValues.minimumHoleRadius * 2, baseValues.maxCylinderDiameter * 0.8, 'diameter');
    updateInputConstraints('#smile-corner-radius', toUnit, baseValues.minimumCornerRadius, baseValues.minimumCornerRadius * 10, 'corner');
    updateInputConstraints('#smile-corner-radius-input', toUnit, baseValues.minimumCornerRadius, baseValues.minimumCornerRadius * 10, 'corner');
    
    updateInputConstraints('#septum-thickness', toUnit, baseValues.minimumSeptum, baseValues.minimumSeptum * 10, 'default');
    updateInputConstraints('#septum-thickness-input', toUnit, baseValues.minimumSeptum, baseValues.minimumSeptum * 10, 'default');
}

// Update system-specific hole controls
function updateSystemHoleControls(fromUnit, toUnit) {
    if (!window.profileManager || !window.profileManager.currentSystem) return;
    
    const system = window.profileManager.currentSystem;
    
    if (system instanceof CircularHolesSystem) {
        updateCircularHoleControls(fromUnit, toUnit);
    } else if (system instanceof SmileSystem) {
        updateSmileHoleControls(fromUnit, toUnit);
    }
}

// Update circular hole controls
function updateCircularHoleControls(fromUnit, toUnit) {
    const system = window.profileManager.currentSystem;
    const baseValues = getBaseValues(toUnit);
    
    // Update each hole's controls
    for (let i = 0; i < system.holes.length; i++) {
        const diameterSlider = document.querySelector(`#hole-${i}-diameter-range`);
        const diameterInput = document.querySelector(`#hole-${i}-diameter`);
        const angleSlider = document.querySelector(`#hole-${i}-angle-range`);
        const angleInput = document.querySelector(`#hole-${i}-angle`);
        const distanceSlider = document.querySelector(`#hole-${i}-distance-range`);
        const distanceInput = document.querySelector(`#hole-${i}-distance`);
        
        // Update values
        if (diameterSlider) updateInputWithConversion(`#hole-${i}-diameter-range`, fromUnit, toUnit, 'diameter');
        if (diameterInput) updateInputWithConversion(`#hole-${i}-diameter`, fromUnit, toUnit, 'diameter');
        if (distanceSlider) updateInputWithConversion(`#hole-${i}-distance-range`, fromUnit, toUnit, 'default');
        if (distanceInput) updateInputWithConversion(`#hole-${i}-distance`, fromUnit, toUnit, 'default');
        
        // Update constraints
        const maxHoleDiameter = system.cylinderRadius * 2;
        if (diameterSlider) updateInputConstraints(`#hole-${i}-diameter-range`, toUnit, baseValues.minimumHoleRadius * 2, maxHoleDiameter, 'diameter');
        if (diameterInput) updateInputConstraints(`#hole-${i}-diameter`, toUnit, baseValues.minimumHoleRadius * 2, maxHoleDiameter, 'diameter');
        if (distanceSlider) updateInputConstraints(`#hole-${i}-distance-range`, toUnit, 0, system.cylinderRadius * 0.8, 'default');
        if (distanceInput) updateInputConstraints(`#hole-${i}-distance`, toUnit, 0, system.cylinderRadius * 0.8, 'default');
    }
}

// Update smile hole controls
function updateSmileHoleControls(fromUnit, toUnit) {
    const system = window.profileManager.currentSystem;
    const baseValues = getBaseValues(toUnit);
    
    for (let i = 0; i < system.holes.length; i++) {
        const diameterSlider = document.querySelector(`#smile-hole-${i}-diameter-range`);
        const diameterInput = document.querySelector(`#smile-hole-${i}-diameter`);
        const distanceSlider = document.querySelector(`#smile-hole-${i}-distance-range`);
        const distanceInput = document.querySelector(`#smile-hole-${i}-distance`);
        
        // Update values
        if (diameterSlider) updateInputWithConversion(`#smile-hole-${i}-diameter-range`, fromUnit, toUnit, 'diameter');
        if (diameterInput) updateInputWithConversion(`#smile-hole-${i}-diameter`, fromUnit, toUnit, 'diameter');
        if (distanceSlider) updateInputWithConversion(`#smile-hole-${i}-distance-range`, fromUnit, toUnit, 'default');
        if (distanceInput) updateInputWithConversion(`#smile-hole-${i}-distance`, fromUnit, toUnit, 'default');
        
        // Update constraints
        const maxHoleDiameter = system.cylinderRadius * 2;
        if (diameterSlider) updateInputConstraints(`#smile-hole-${i}-diameter-range`, toUnit, baseValues.minimumHoleRadius * 2, maxHoleDiameter, 'diameter');
        if (diameterInput) updateInputConstraints(`#smile-hole-${i}-diameter`, toUnit, baseValues.minimumHoleRadius * 2, maxHoleDiameter, 'diameter');
    }
}

// Update system parameters
function updateSystemParameters(fromUnit, toUnit) {
    if (!window.profileManager || !window.profileManager.currentSystem) return;
    
    const system = window.profileManager.currentSystem;
    const baseValues = getBaseValues(toUnit);
    
    // Update common parameters
    system.cylinderRadius = convertValue(system.cylinderRadius, fromUnit, toUnit);
    system.cylinderHeight = convertValue(system.cylinderHeight, fromUnit, toUnit);
    system.minimumSeptum = getMinimumWallThickness(system.cylinderRadius * 2, toUnit);
    
    // Update system-specific parameters
    if (system instanceof CircularHolesSystem) {
        system.centralLumenRadius = convertValue(system.centralLumenRadius, fromUnit, toUnit);
        
        // Update holes
        system.holes.forEach(hole => {
            hole.radius = convertValue(hole.radius, fromUnit, toUnit);
            hole.distance = convertValue(hole.distance, fromUnit, toUnit);
            hole.x = convertValue(hole.x, fromUnit, toUnit);
            hole.y = convertValue(hole.y, fromUnit, toUnit);
        });
        
    } else if (system instanceof PieSliceSystem) {
        system.septumThickness = convertValue(system.septumThickness, fromUnit, toUnit);
        system.cornerRadius = convertValue(system.cornerRadius, fromUnit, toUnit);
        if (system.hasCentralHole) {
            system.innerDiameter = convertValue(system.innerDiameter, fromUnit, toUnit);
        }
        
    } else if (system instanceof CrescentSystem) {
        system.circularDiameter = convertValue(system.circularDiameter, fromUnit, toUnit);
        system.septumThickness = convertValue(system.septumThickness, fromUnit, toUnit);
        system.crescentCornerRadius = convertValue(system.crescentCornerRadius, fromUnit, toUnit);
        if (system.phantomCircularDiameter) {
            system.phantomCircularDiameter = convertValue(system.phantomCircularDiameter, fromUnit, toUnit);
        }
        
    } else if (system instanceof SmileSystem) {
        system.semicircleRadius = convertValue(system.semicircleRadius, fromUnit, toUnit);
        system.cornerRadius = convertValue(system.cornerRadius, fromUnit, toUnit);
        system.defaultHoleRadius = convertValue(system.defaultHoleRadius, fromUnit, toUnit);
        
        // Update holes
        system.holes.forEach(hole => {
            hole.radius = convertValue(hole.radius, fromUnit, toUnit);
            hole.distance = convertValue(hole.distance, fromUnit, toUnit);
            hole.x = convertValue(hole.x, fromUnit, toUnit);
            hole.y = convertValue(hole.y, fromUnit, toUnit);
        });
    }
}

// Update 3D model
function update3DModel(fromUnit, toUnit) {
    if (!window.profileManager || !window.profileManager.currentSystem) return;
    
    const system = window.profileManager.currentSystem;
    const baseValues = getBaseValues(toUnit);
    
    // Update interaction sphere size
    const newSphereRadius = baseValues.interactionSphereRadius;
    
    // Update geometry using the correct method for each system
    if (system instanceof CircularHolesSystem) {
        system.createCylinder();  // Main geometry update method
        system.createHoleMarkers();
        system.updateHoleDiameterLimits();
        system.updateCylinderDiameterConstraints();
        
        // Update control sphere sizes
        system.transformControls.forEach(control => {
            if (control && control.geometry) {
                control.geometry.dispose();
                control.geometry = new THREE.SphereGeometry(newSphereRadius, 16, 16);
            }
        });
        
    } else if (system instanceof PieSliceSystem) {
        system.updateGeometry();  // This calls createPieSliceCylinder() and createControlSpheres()
        if (system.hasCentralHole) {
            system.updateInnerDiameterLimits();
        }
        
    } else if (system instanceof CrescentSystem) {
        system.updateCylinderGeometry();  // This exists in CrescentSystem
        system.updateCircularDiameterLimits();
        system.updateControllerPosition();
        
        // Update controller size
        if (system.crescentController && system.crescentController.geometry) {
            system.crescentController.geometry.dispose();
            system.crescentController.geometry = new THREE.SphereGeometry(newSphereRadius, 16, 16);
        }
        
    } else if (system instanceof SmileSystem) {
        system.updateCylinderGeometry();  // This exists in SmileSystem
        system.createHoleMarkers();
        system.createPolarControls();
        system.updateHoleDiameterLimits();
        system.updateAllHoleDistanceLimits();
        system.updateSemicircleRadiusLimits();
        system.updateCornerRadiusLimits();
        
        // Update control sphere sizes
        system.polarControls.forEach(control => {
            if (control && control.geometry) {
                control.geometry.dispose();
                control.geometry = new THREE.SphereGeometry(newSphereRadius, 16, 16);
            }
        });
    }
    
    // Update UI to reflect new values
    if (system.createHoleUI) system.createHoleUI();
    if (system.createSmileHoleUI) system.createSmileHoleUI();
    if (system.createSliceUI) system.createSliceUI();
}

// Update camera constraints for new unit
function updateCameraConstraints(unit) {
    const baseValues = getBaseValues(unit);
    
    // Update perspective camera constraints
    if (globalControls) {
        globalControls.minDistance = baseValues.cameraMinDistance;
        globalControls.maxDistance = baseValues.cameraMaxDistance;
    }
    
    // FIXED: Update orthographic camera with proper unit scaling
    if (globalOrthographicCamera) {
        const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
        
        // Set frustum size based on unit
        const frustumSize = unit === 'mm' ? 10.16 : 0.4;
        const cameraDistance = unit === 'mm' ? 154 : 0.6;
        
        globalOrthographicCamera.left = -frustumSize * aspect / 2;
        globalOrthographicCamera.right = frustumSize * aspect / 2;
        globalOrthographicCamera.top = frustumSize / 2;
        globalOrthographicCamera.bottom = -frustumSize / 2;
        globalOrthographicCamera.near = 0.001;
        globalOrthographicCamera.far = unit === 'mm' ? 50.8 : 2;
        
        // Reset camera position for the unit
        globalOrthographicCamera.position.set(0, 0, cameraDistance);
        globalOrthographicCamera.lookAt(0, 0, 0);
        globalOrthographicCamera.zoom = 1;
        globalOrthographicCamera.updateProjectionMatrix();
    }
    
    // Update perspective camera position
    if (globalPerspectiveCamera) {
        const perspectiveDistance = unit === 'mm' ? 10.16 : 0.4;
        globalPerspectiveCamera.position.set(
            perspectiveDistance * 0.7,
            perspectiveDistance * 0.7,
            perspectiveDistance * 0.7
        );
        globalPerspectiveCamera.lookAt(0, 0, 0);
        globalPerspectiveCamera.updateProjectionMatrix();
    }
    
    // Update controls
    if (globalControls) {
        globalControls.target.set(0, 0, 0);
        globalControls.update();
    }
    
    // Force renders
    if (globalRenderer && globalScene && globalCurrentCamera) {
        globalRenderer.render(globalScene, globalCurrentCamera);
        if (css2dRenderer && css2dRenderer.domElement.style.display !== 'none') {
            css2dRenderer.render(globalScene, globalCurrentCamera);
        }
    }
    
    console.log(`Camera updated for ${unit}: frustum=${frustumSize}, distance=${cameraDistance}`);
}

function ensureCameraPositionForUnit() {
    const unit = $("#unit").val() || 'in';
    
    if (!window.profileManager || !window.profileManager.currentSystem) {
        updateCameraConstraints(unit);
        return;
    }
    
    const system = window.profileManager.currentSystem;
    
    // Use the system's camera positioning if available
    if (typeof system.setConsistentCameraForCapture === 'function') {
        system.setConsistentCameraForCapture();
    } else {
        // Fallback to general positioning
        updateCameraConstraints(unit);
        
        // Additional positioning based on system size
        const systemRadius = system.cylinderRadius || (unit === 'mm' ? 2.54 : 0.1);
        const padding = 1;
        const targetFrustumSize = systemRadius * 2 * padding;
        
        if (globalOrthographicCamera) {
            const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
            const halfWidth = (targetFrustumSize / 2) * aspect;
            const halfHeight = targetFrustumSize / 2;
            
            globalOrthographicCamera.left = -halfWidth;
            globalOrthographicCamera.right = halfWidth;
            globalOrthographicCamera.top = halfHeight;
            globalOrthographicCamera.bottom = -halfHeight;
            globalOrthographicCamera.updateProjectionMatrix();
        }
    }
    
    // Force render
    if (globalRenderer && globalScene && globalCurrentCamera) {
        globalRenderer.render(globalScene, globalCurrentCamera);
    }
}

// Add to the setupGlobalControls function in ProfileManagerV2
// Add this event listener for the unit selector
function setupUnitConversion() {
    const unitSelector = document.getElementById('unit');
    if (unitSelector) {
        unitSelector.addEventListener('change', function(event, fromUnit) {
            const toUnit = this.value;
            const previousUnit = fromUnit || (toUnit === 'in' ? 'mm' : 'in');
            
            // Perform the conversion
            convertUnits(previousUnit, toUnit);
            
            // Auto-exit print mode if active
            autoExitPrintMode();
            
            // Log the change
            const step = `Units changed from ${previousUnit} to ${toUnit}`;
            if (typeof updateJourney === 'function') {
                updateJourney(step);
            }
        });
    }
}

// Update the ProfileManagerV2 setupGlobalControls method to include unit conversion
// Add this line to the setupGlobalControls method:
// setupUnitConversion();

// Helper function to format values for display based on unit
function formatValueForUnit(value, unit, precision = null) {
    if (precision === null) {
        precision = unit === 'mm' ? 2 : 3;
    }
    return parseFloat(value).toFixed(precision);
}

// Helper function to get minimum septum thickness for current unit and diameter
function getMinimumSeptumForUnit(unit, outerDiameter) {
    const baseValues = getBaseValues(unit);
    const threshold = unit === 'mm' ? 5.08 : 0.200; // 200mm = 5.08 inches
    
    return outerDiameter <= threshold ? baseValues.minimumSeptum : baseValues.minimumSeptum * 1.6;
}
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
    const unit = $("#unit").val() || 'in';
    
    // Clear any existing elements
    while (sandbox.firstChild) {
        sandbox.removeChild(sandbox.firstChild);
    }
    
    // Create renderer
    globalRenderer = new THREE.WebGLRenderer({ antialias: true });
    globalRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    globalRenderer.shadowMap.enabled = true;
    globalRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    globalRenderer.outputColorSpace = THREE.SRGBColorSpace;
    globalRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    globalRenderer.toneMappingExposure = 1.0;
    sandbox.appendChild(globalRenderer.domElement);
    
    // Create CSS2D renderer for print mode
    css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(sandbox.offsetWidth, sandbox.offsetHeight);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0px';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    css2dRenderer.domElement.style.display = 'none';
    sandbox.appendChild(css2dRenderer.domElement);
    
    // Create scene
    globalScene = new THREE.Scene();
    globalScene.background = new THREE.Color(0xf5f5f5);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    globalScene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffff, 2);
    sunLight.position.set(10, 10, 5);
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    globalScene.add(sunLight);
    
    const envLight1 = new THREE.DirectionalLight(0x8ac1c3, 2);
    envLight1.position.set(-5, 8, -2);
    globalScene.add(envLight1);
    
    const envLight2 = new THREE.DirectionalLight(0xff8040, 0.4);
    envLight2.position.set(5, -2, 8);
    globalScene.add(envLight2);
    
    const envLight3 = new THREE.DirectionalLight(0xffffff, 2);
    envLight3.position.set(-8, 2, 3);
    globalScene.add(envLight3);
    
    const pointLight1 = new THREE.PointLight(0xffffff, 0.8, 8);
    pointLight1.position.set(2, 3, 4);
    globalScene.add(pointLight1);
    
    const bottomPointLight = new THREE.PointLight(0xffffff, 0.7, 4);
    bottomPointLight.position.set(0, -1.5, 0.5);
    globalScene.add(bottomPointLight);
    
    const pointLight2 = new THREE.PointLight(0x8ac1c3, 0.5, 8);
    pointLight2.position.set(-3, -2, 2);
    globalScene.add(pointLight2);
    
    const backRightLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backRightLight.position.set(1, 0.5, -2);
    globalScene.add(backRightLight);
    
    // FIXED: Create cameras with proper unit-aware positioning
    const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
    const baseValues = getBaseValues(unit);
    
    // Perspective camera (3D view)
    const perspectiveDistance = unit === 'mm' ? 10.16 : 0.4;
    globalPerspectiveCamera = new THREE.PerspectiveCamera(50, aspect, 0.01, 100);
    globalPerspectiveCamera.position.set(
        perspectiveDistance * 0.7, 
        perspectiveDistance * 0.7, 
        perspectiveDistance * 0.7
    );
    globalPerspectiveCamera.lookAt(0, 0, 0);
    
    // Orthographic camera (top view) - CRITICAL FIX
   
    const frustumSize = unit === 'mm' ? 10.16 : 0.4; // Proper frustum size for each unit
    const orthoDistance = unit === 'mm' ? 154 : 0.6; // Camera distance for each unit
    
    globalOrthographicCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2, 
        frustumSize * aspect / 2,
        frustumSize / 2, 
        -frustumSize / 2,
        0.001, 
        unit === 'mm' ? 50.8 : 2 // Near/far planes appropriate for each unit
    );
    globalOrthographicCamera.position.set(0, 0, orthoDistance);
    globalOrthographicCamera.lookAt(0, 0, 0);
    
    // Set initial camera
    globalCurrentCamera = globalPerspectiveCamera;
    globalCamera = globalCurrentCamera;
    
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
        
        if (css2dRenderer.domElement.style.display !== 'none') {
            css2dRenderer.render(globalScene, globalCurrentCamera);
        }
    }
    animate();
}


function setupCameraControls() {
    const unit = $("#unit").val() || 'in';
    globalControls.enableDamping = true;
    globalControls.dampingFactor = 0.05;
    globalControls.enableZoom = true;
    globalControls.enablePan = true;
    globalControls.target.set(0, 0, 0);
    
    if (isPerspectiveView) {
        // Perspective camera settings (3D view)
        globalControls.enableRotate = true;
        globalControls.minDistance = getBaseValues(unit).cameraMinDistance;
        globalControls.maxDistance = getBaseValues(unit).cameraMaxDistance;
    } else {
        // Orthographic camera settings (top view)
        globalControls.enableRotate = false;
        globalControls.minZoom = getBaseValues(unit).cameraMinDistance;
        globalControls.maxZoom = getBaseValues(unit).cameraMaxDistance*5;
    }
}
function resetOrthographicCameraToTopView() {
    const unit = $("#unit").val() || 'in';
    const frustumSize = unit === 'mm' ? 10.16 : 0.4;
    const orthoDistance = unit === 'mm' ? 15.24 : 0.6;
    
    // CRITICAL: Reset all camera orientation properties
    globalOrthographicCamera.position.set(0, 0, orthoDistance);
    globalOrthographicCamera.lookAt(0, 0, 0);
    
    // Force the "up" vector to be Y-axis (this is often the culprit)
    globalOrthographicCamera.up.set(0, 1, 0);
    
    // Reset zoom to 1
    globalOrthographicCamera.zoom = 1;
    
    // Ensure frustum is properly sized
    const aspect = sandbox.offsetWidth / sandbox.offsetHeight;
    globalOrthographicCamera.left = -frustumSize * aspect / 2;
    globalOrthographicCamera.right = frustumSize * aspect / 2;
    globalOrthographicCamera.top = frustumSize / 2;
    globalOrthographicCamera.bottom = -frustumSize / 2;
    
    // Update projection matrix
    globalOrthographicCamera.updateProjectionMatrix();
    
    // Reset OrbitControls target and update
    if (globalControls) {
        globalControls.target.set(0, 0, 0);
        globalControls.update();
    }
    
    // Force render
    globalRenderer.render(globalScene, globalCurrentCamera);
}
// Main camera switching function
function switchCamera() {
    
    
    isPerspectiveView = !isPerspectiveView;
    
    if (isPerspectiveView) {
        globalCurrentCamera = globalPerspectiveCamera;
        
    } else {
        globalCurrentCamera = globalOrthographicCamera;
        resetOrthographicCameraToTopView();
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
let validationTimeout = null;
class GlobalErrorSystem {
    constructor() {
        this.errors = new Map(); // Store errors by unique ID
        this.container = null;
        this.initialized = false;
        this.init();
     
    }

    init() {
        if (this.initialized) return;
        
        // Create the error container HTML structure
        this.createErrorContainer();
        this.initialized = true;
    }

    createErrorContainer() {
        // Create the main error container
        const errorContainer = document.createElement('div');
        errorContainer.id = 'global-error-container';
        errorContainer.className = 'error-container hidden';
        
        errorContainer.innerHTML = `
            <div class="error-list" id="error-list">
                <!-- Error messages will be dynamically added here -->
            </div>
        `;

        
        
        // Insert the container into the page (adjust selector as needed)
        const targetParent = document.getElementById('error-parent'); // or wherever you want to place it
        targetParent.appendChild(errorContainer);
        
        this.container = errorContainer;
    }
// Add a new error
    addError(id, title, description, buttonConfig = null) {
        // Check if error already exists - if so, don't add duplicate
        if (this.errors.has(id)) {
            $('.'+id).not(':first').remove();
            return id;
        }

        const errorElement = document.createElement('div');
        errorElement.className = 'error-item new';
        errorElement.dataset.errorId = id;
        
        let buttonHTML = '';
        if (buttonConfig) {
        buttonHTML = `<button class="error-button" data-error-id="${id}">${buttonConfig.text}</button>`;
        }

        errorElement.innerHTML = `
            <div class="error-header ${id}">
                <div class="error-icon"></div>
                <div class="error-title">${title}</div>
            </div>
            <div class="error-content">
                <p>${description}</p>
                ${buttonHTML}
            </div>
        `;
      // Store in our errors map
        this.errors.set(id, {
            element: errorElement,
            title: title,
            description: description,
            buttonConfig: buttonConfig,
            expanded: false
        });
        // Add click handler for expand/collapse
        errorElement.addEventListener('click', (e) => {
            // Don't toggle if a button was clicked
            if (e.target.classList.contains('error-button')) {
                e.stopPropagation();
                this.handleButtonClick(id, buttonConfig);
                return;
            }
            this.toggleError(id);
        });

        // Add to the list (new errors go to the bottom)
        const errorList = document.getElementById('error-list');
        errorList.appendChild(errorElement);

        


        // Show container if it was hidden
        this.showContainer();

        // Remove the 'new' class after animation
        setTimeout(() => {
            errorElement.classList.remove('new');
        }, 300);

        return id;
    }
    handleButtonClick(errorId, buttonConfig) {
        if (buttonConfig && typeof buttonConfig.onClick === 'function') {
            buttonConfig.onClick(errorId);
        }
    }
    // Remove an error
    removeError(id) {
        const error = this.errors.get(id);
        if (!error) return false;

        const errorElement = error.element;
        errorElement.classList.add('removing');

        // Remove from DOM after animation
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
            this.errors.delete(id);

            // Hide container if no errors remain
            if (this.errors.size === 0) {
                this.hideContainer();
            }
        }, 300);

        return true;
    }

    // Toggle error expansion
    toggleError(id) {
        const error = this.errors.get(id);
        if (!error) return;

        error.expanded = !error.expanded;
        
        if (error.expanded) {
            error.element.classList.add('expanded');
        } else {
            error.element.classList.remove('expanded');
        }
    }

    // Clear all errors
    clearAllErrors() {
        Array.from(this.errors.keys()).forEach(id => {
            this.removeError(id);
        });
    }

    // Show the error container
    showContainer() {
        if (this.container) {
            this.container.classList.remove('hidden');
        }
    }

    // Hide the error container
    hideContainer() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }

    // Check if an error exists
    hasError(id) {
        return this.errors.has(id);
    }

    // Get error count
    getErrorCount() {
        return this.errors.size;
    }

    // Update an existing error
    updateError(id, title, description) {
        const error = this.errors.get(id);
        if (!error) {
            // If error doesn't exist, create it
            return this.addError(id, title, description);
        }

        // Update the content
        const titleElement = error.element.querySelector('.error-title');
        const contentElement = error.element.querySelector('.error-content p');
        
        if (titleElement) titleElement.textContent = title;
        if (contentElement) contentElement.textContent = description;

        // Update stored data
        error.title = title;
        error.description = description;

        return id;
    }
}
// Create global instance
const globalErrorSystem = new GlobalErrorSystem();

// Global convenience functions
function addError(id, title, description, buttonConfig = null) {
    return globalErrorSystem.addError(id, title, description, buttonConfig);
}

function removeError(id) {
    return globalErrorSystem.removeError(id);
}

function updateError(id, title, description) {
    return globalErrorSystem.updateError(id, title, description);
}

function clearAllErrors() {
    return globalErrorSystem.clearAllErrors();
}

function hasError(id) {
    return globalErrorSystem.hasError(id);
}

function getErrorCount() {
    return globalErrorSystem.getErrorCount();
}


  
        // Circular Holes Implementation
        class CircularHolesSystem {
          
            constructor() {
    const unit = $("#unit").val() || 'in';
    this.cylinderMesh = null;
    this.holeMarkers = [];
    this.transformControls = [];
    this.cylinderRadius = getBaseValues(unit).cylinderRadius; // Default: 0.200m diameter
    this.cylinderHeight = getBaseValues(unit).cylinderHeight;
    this.minimumSeptum = getMinimumWallThickness(this.cylinderRadius * 2, unit);
    this.includeCentralLumen = false; // Default: no central lumen
    this.centralLumenRadius = getBaseValues(unit).centralLumenRadius; // Default: 0.025m diameter
   
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
          arePeripheralHolesUniform() {
    const peripheralHoles = this.holes.filter(hole => hole.distance > 0);
    if (peripheralHoles.length <= 1) return true;
    
    const firstHole = peripheralHoles[0];
    const tolerance = 0.001; // Small tolerance for floating point comparison
    
    // Check if all holes have the same radius
    const sameRadius = peripheralHoles.every(hole => 
        Math.abs(hole.radius - firstHole.radius) < tolerance
    );
    
    // Check if holes are evenly spaced angularly
    const expectedAngleStep = 360 / peripheralHoles.length;
    const evenlySpaced = peripheralHoles.every((hole, index) => {
        const expectedAngle = (index * expectedAngleStep) % 360;
        const angleDiff = Math.abs(hole.angle - expectedAngle);
        // Account for wrap-around (e.g., 359° vs 1°)
        const wrappedDiff = Math.min(angleDiff, 360 - angleDiff);
        return wrappedDiff < 1; // 1 degree tolerance
    });
    
    return sameRadius && evenlySpaced;
}

          setupGlobalDistanceListeners() {
    const globalDistanceSlider = document.getElementById('global-distance');
    const globalDistanceInput = document.getElementById('global-distance-input');
    
    if (!globalDistanceSlider || !globalDistanceInput) return;
    
    // Remove any existing listeners to prevent conflicts
    globalDistanceSlider.removeEventListener('input', this.globalDistanceHandler);
    globalDistanceInput.removeEventListener('input', this.globalDistanceInputHandler);
    
    // Create bound handlers to store references
    this.globalDistanceHandler = (e) => {
        startInteraction();
        autoExitPrintMode();
        const newDistance = parseFloat(e.target.value);
        globalDistanceInput.value = newDistance.toFixed(4);
        this.updateGlobalDistance(newDistance);
    };
    
    this.globalDistanceInputHandler = (e) => {
        autoExitPrintMode();
        const newDistance = parseFloat(e.target.value);
        if (!isNaN(newDistance)) {
            globalDistanceSlider.value = newDistance.toFixed(4);
            this.updateGlobalDistance(newDistance);
        }
    };
    
    globalDistanceSlider.addEventListener('mousedown', startInteraction);
    globalDistanceSlider.addEventListener('mouseup', endInteraction);
    globalDistanceSlider.addEventListener('change', endInteraction);
    globalDistanceSlider.addEventListener('input', this.globalDistanceHandler);
    globalDistanceInput.addEventListener('input', this.globalDistanceInputHandler);
}
getMinimumSeptumThickness() {
    const unit = $("#unit").val() || 'in';
    const outerDiameter = this.cylinderRadius * 2;
    return getMinimumWallThickness(outerDiameter, unit);
}
updateGlobalDistance(newDistance) {
    // First, check if ALL peripheral holes can move to the new distance
    let allHolesValid = true;
    
    // Create temporary positions for all peripheral holes at the new distance
    const tempPositions = [];
    
    this.holes.forEach((hole, index) => {
        if (hole.distance > 0) { // Skip central lumen
            const { x, y } = this.polarToCartesian(hole.angle, newDistance);
            tempPositions.push({ index, x, y, radius: hole.radius });
        } else {
            tempPositions.push(null); // Placeholder for central lumen
        }
    });
    
    // Check if ALL temp positions are valid
    tempPositions.forEach((tempPos, index) => {
        if (tempPos !== null) { // Skip central lumen
            if (!this.isValidPosition(tempPos.x, tempPos.y, tempPos.radius, index)) {
                allHolesValid = false;
            }
        }
    });
    
    // Only update if ALL holes can move to the new distance
    if (allHolesValid) {
        this.holes.forEach((hole, index) => {
            if (hole.distance > 0) { // Skip central lumen
                const { x, y } = this.polarToCartesian(hole.angle, newDistance);
                hole.distance = newDistance;
                hole.x = x;
                hole.y = y;
            }
        });
        
        this.updateAllGeometry();
        
        // Update the global distance controls to reflect the successful change
        const globalDistanceSlider = document.getElementById('global-distance');
        const globalDistanceInput = document.getElementById('global-distance-input');
        if (globalDistanceSlider) globalDistanceSlider.value = newDistance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = newDistance.toFixed(4);

      setTimeout(() => {
            checkAndUpdateHoleDistribution();
        }, 100);
    } else {
        // If any hole would be invalid, revert the UI controls to the current valid distance
        const currentDistance = this.holes.find(hole => hole.distance > 0)?.distance || newDistance;
        const globalDistanceSlider = document.getElementById('global-distance');
        const globalDistanceInput = document.getElementById('global-distance-input');
        if (globalDistanceSlider) globalDistanceSlider.value = currentDistance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = currentDistance.toFixed(4);
        
        console.log('Global distance change blocked: would cause hole intersection');
    }
}


          updateGlobalDistanceLimits() {
    const globalDistanceSlider = document.getElementById('global-distance');
    const globalDistanceInput = document.getElementById('global-distance-input');
    
    if (globalDistanceSlider && globalDistanceInput) {
        // Find the maximum hole radius to determine minimum distance
        let maxHoleRadius = 0;
        this.holes.forEach(hole => {
            if (hole.distance > 0) { // Skip central lumen
                maxHoleRadius = Math.max(maxHoleRadius, hole.radius);
            }
        });
        
        const minDistance = maxHoleRadius + this.minimumSeptum;
        const maxDistance = this.cylinderRadius - maxHoleRadius - this.minimumSeptum;
        
        globalDistanceSlider.min = minDistance.toFixed(3);
        globalDistanceSlider.max = maxDistance.toFixed(3);
        globalDistanceInput.min = minDistance.toFixed(3);
        globalDistanceInput.max = maxDistance.toFixed(3);
        
        // Update current value if it's outside the new range
        const currentDistance = this.holes.find(hole => hole.distance > 0)?.distance || minDistance;
        if (currentDistance < minDistance || currentDistance > maxDistance) {
            const clampedDistance = Math.max(minDistance, Math.min(maxDistance, currentDistance));
            globalDistanceSlider.value = clampedDistance.toFixed(4);
            globalDistanceInput.value = clampedDistance.toFixed(4);
            this.updateGlobalDistance(clampedDistance);
        } else {
            globalDistanceSlider.value = currentDistance.toFixed(4);
            globalDistanceInput.value = currentDistance.toFixed(4);
        }
    }
}
          
          setConsistentCameraForCapture() {
    const baseRadius = this.cylinderRadius;
    let maxExtent = baseRadius;
    
    // Check hole extents
    this.holes.forEach(hole => {
        const holeExtent = Math.sqrt(hole.x * hole.x + hole.y * hole.y) + hole.radius;
        maxExtent = Math.max(maxExtent, holeExtent);
    });
    
    // Add space for dimension lines and labels
    const dimensionSpace = baseRadius * 0.6;
    const labelSpace = baseRadius * 0.4;
    const totalExtent = maxExtent + dimensionSpace + labelSpace;
    const padding = 1.2;
    const frustumSize = totalExtent * 2 * padding;
    
    const sandboxRect = sandbox.getBoundingClientRect();
    const aspectRatio = sandboxRect.width / sandboxRect.height;
    
    const halfWidth = (frustumSize / 2) * aspectRatio;
    const halfHeight = frustumSize / 2;
    
    globalOrthographicCamera.left = -halfWidth;
    globalOrthographicCamera.right = halfWidth;
    globalOrthographicCamera.top = halfHeight;
    globalOrthographicCamera.bottom = -halfHeight;
    globalOrthographicCamera.zoom = 1;
    
    // Center camera on holes centroid
    let centerX = 0, centerY = 0;
    if (this.holes.length > 0) {
        let totalX = 0, totalY = 0, weightedHoles = 0;
        this.holes.forEach(hole => {
            const weight = hole.distance === 0 ? 0.1 : 1.0;
            totalX += hole.x * weight;
            totalY += hole.y * weight;
            weightedHoles += weight;
        });
        if (weightedHoles > 0) {
            centerX = totalX / weightedHoles;
            centerY = totalY / weightedHoles;
        }
    }
    const unit = $("#unit").val() || 'in';
    //const frustumSize = unit === 'mm' ? 10.16 : 0.4; // Proper frustum size for each unit
    const orthoDistance = unit === 'mm' ? 15.24 : 0.6; // Camera distance for each unit
    globalOrthographicCamera.position.set(centerX, centerY, orthoDistance);
    globalOrthographicCamera.lookAt(centerX, centerY, 0);
    globalOrthographicCamera.updateProjectionMatrix();
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
                const minSeptum = this.getMinimumSeptumThickness();
                if (distanceFromCenter < 0.001) {
                    // This is the central lumen - only check if radius fits
                    return radius < this.cylinderRadius - minSeptum;
                }
                
                // Check cylinder boundary constraint for peripheral holes
                const maxDistance = this.cylinderRadius - radius - minSeptum;
                
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
                    const minRequiredDistance = radius + otherHole.radius + minSeptum;
                    
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
    const unit = $("#unit").val() || 'in';
    
    const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
    this.holes = [];
    
    let peripheralHoles = count;
    let colorIndex = 0;
    
    // Add central lumen if enabled
    if (this.includeCentralLumen) {
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
        
        const innerDiameterSlider = document.getElementById('inner-diameter');
        const innerDiameterInput = document.getElementById('inner-diameter-input');
        const centralLumenDiameter = centralLumenRadius * 2;
        
        if (innerDiameterSlider) innerDiameterSlider.value = centralLumenDiameter.toFixed(3);
        if (innerDiameterInput) innerDiameterInput.value = centralLumenDiameter.toFixed(3);
    }
    
    // Add peripheral holes - ALL at the SAME distance
    if (peripheralHoles > 0) {
        let placementDistance;
        let holeRadius;
        
        if (this.includeCentralLumen) {
            const centralLumenRadius = this.centralLumenRadius;
            const innerBoundary = centralLumenRadius;
            const outerBoundary = this.cylinderRadius;
            const availableSpace = outerBoundary - innerBoundary;
            
            placementDistance = innerBoundary + (availableSpace / 2);
            holeRadius = availableSpace / 4;
        } else {
            placementDistance = this.cylinderRadius / 2;
            holeRadius = this.cylinderRadius / 8;
        }
        
        // Ensure minimum hole size
        holeRadius = Math.max(holeRadius, getBaseValues(unit).minimumHoleRadius * 2);
        
        // Create peripheral holes in a circle - ALL at the SAME distance
        for (let i = 0; i < peripheralHoles; i++) {
            const angle = (i / peripheralHoles) * 360;
            const { x, y } = this.polarToCartesian(angle, placementDistance);

            this.holes.push({
                x: x,
                y: y,
                angle: angle,
                distance: placementDistance, // Same distance for all
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
    clearEmptySliceHighlight();
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
     setTimeout(() => {
        checkAndUpdateHoleDistribution();
    }, 200);
}
            
  findClosestValidRadius(x, y, targetRadius, holeIndex) {
    const unit = $("#unit").val() || 'in';
    // UPDATED: Use dynamic limits based on cylinder size
    const maxRadius = this.cylinderRadius; // Use cylinder radius as max
    const minRadius = getBaseValues(unit).minimumHoleRadius*1.5; // Keep general min
    
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
  const hideButton = document.getElementById('hide-controls-btn');
  if (hideButton) {
    
        
    hideButton.addEventListener('click', toggleControlVisibility)
    
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
        
    } else if (isShiftPressed) {
    // Shift + Alt: Set ALL holes to the same distance
    const targetDistance = Math.sqrt(intersectPoint.x * intersectPoint.x + intersectPoint.y * intersectPoint.y);
    
    // Check if ALL holes can move to this distance before moving any
    let allValid = true;
    const tempPositions = [];
    
    this.holes.forEach((h, index) => {
        if (h.distance === 0) {
            tempPositions.push(null); // Skip central lumen
            return;
        }
        
        const { x, y } = this.polarToCartesian(h.angle, targetDistance);
        if (this.isValidPosition(x, y, h.radius, index)) {
            tempPositions.push({ x, y });
        } else {
            allValid = false;
        }
    });
    
    // Only update if ALL holes can move to the new distance
    if (allValid) {
        this.holes.forEach((h, index) => {
            if (h.distance === 0) return; // Skip central lumen
            
            const tempPos = tempPositions[index];
            if (tempPos) {
                h.distance = targetDistance;
                h.x = tempPos.x;
                h.y = tempPos.y;
            }
        });
        
        // Update global distance controls
        const globalDistanceSlider = document.getElementById('global-distance');
        const globalDistanceInput = document.getElementById('global-distance-input');
        if (globalDistanceSlider) globalDistanceSlider.value = targetDistance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = targetDistance.toFixed(4);
        
        // CRITICAL: Update all visual elements
        this.updateAllGeometry();
        
        // Also update individual hole UIs to reflect the new distance
        this.holes.forEach((hole, index) => {
            if (hole.distance > 0) { // Skip central lumen
                this.updateHoleUI(index);
            }
        });
    }
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


    clearTimeout(validationTimeout);
    validationTimeout = setTimeout(() => {
        calculate();
    }, 100); // Wait 100ms after the last call              
    calculate();
});
                
                globalRenderer.domElement.addEventListener('mouseup', () => {
                    if (isDragging && activeHoleIndex !== -1) {
                      endInteraction();
                        // Reset control sphere opacity
                        this.transformControls[activeHoleIndex].material.opacity = 0.8;
                        this.recordValidPosition(activeHoleIndex);
                      if (!isPerspectiveView) {
            resetOrthographicCameraToTopView();
        }
                    }
                    
                    isDragging = false;
                    activeHoleIndex = -1;
                    globalControls.enabled = true;
                  calculate();
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
              setTimeout(() => {
                checkAndUpdateHoleDistribution();
              }, 100);
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
              
              setTimeout(() => {
                checkAndPromptCentralHole();
                checkAndUpdateHoleDistribution();
              }, 100);
            }
            
           updateHoleUI(holeIndex) {
    const hole = this.holes[holeIndex];
    
    // Update diameter controls
    const diameterSlider = document.querySelector(`#hole-${holeIndex}-diameter-range`);
    const diameterInput = document.querySelector(`#hole-${holeIndex}-diameter`);
    if (diameterSlider) diameterSlider.value = (hole.radius * 2).toFixed(4);
    if (diameterInput) diameterInput.value = (hole.radius * 2).toFixed(4);
    
    // Update angle controls (only for peripheral holes)
    if (hole.distance > 0) {
        const angleSlider = document.querySelector(`#hole-${holeIndex}-angle-range`);
        const angleInput = document.querySelector(`#hole-${holeIndex}-angle`);
        if (angleSlider) angleSlider.value = Math.round(hole.angle);
        if (angleInput) angleInput.value = Math.round(hole.angle);
    }
    
    // Update global distance control if this is a peripheral hole
    if (hole.distance > 0) {
        const globalDistanceSlider = document.getElementById('global-distance');
        const globalDistanceInput = document.getElementById('global-distance-input');
        if (globalDistanceSlider) globalDistanceSlider.value = hole.distance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = hole.distance.toFixed(4);
    }
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
               const unit = $("#unit").val() || 'in';
                
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
                    const controlGeometry = new THREE.SphereGeometry(getBaseValues(unit).interactionSphereRadius, 16, 16);
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
    const unit = $("#unit").val() || 'in';
    const container = document.getElementById('hole-controls');
    container.innerHTML = '';
    
    // Add global distance control first (only if there are peripheral holes)
    const peripheralHoles = this.holes.filter(hole => hole.distance > 0);
    if (peripheralHoles.length > 0) {
        const globalDistance = peripheralHoles[0].distance; // Use the first peripheral hole's distance
        const maxGlobalDistance = this.cylinderRadius * 0.8;
        
        const globalDiv = document.createElement('div');
        globalDiv.className = 'hole-control-item';
        globalDiv.innerHTML = `
            <p class="hole-title">Global Distance Control</p>
            <div class="input-group">
                <label>Distance:</label>
                <input type="range" class="range-slider updater" id="global-distance" min="0" max="${maxGlobalDistance.toFixed(3)}" value="${globalDistance.toFixed(4)}" step="${getStepValue(unit, 'diameter')}">
                <input type="number" class="updater" id="global-distance-input" min="0" max="${maxGlobalDistance.toFixed(3)}" value="${globalDistance.toFixed(4)}" step="${getStepValue(unit, 'diameter')}">
            </div>
        `;
        container.appendChild(globalDiv);
        
        // Setup global distance control listeners
        this.setupGlobalDistanceListeners();
    }
    
    this.holes.forEach((hole, index) => {
        const div = document.createElement('div');
        div.className = 'hole-control-item';
        
        const isCentralLumen = hole.distance === 0;
        const maxHoleDiameter = this.cylinderRadius * 2;
        
        let controlsHTML = `
            <p class="hole-title">${hole.name}</p>
            <div class="input-group">
                <label>Diameter:</label>
                <input class="range-slider c-${hole.color} updater" type="range" min="0.015" max="${maxHoleDiameter.toFixed(3)}" value="${(hole.radius * 2).toFixed(4)}" step="${getStepValue(unit, 'diameter')}" id="hole-${index}-diameter-range" >
                <input class="updater" type="number" id="hole-${index}-diameter" value="${(hole.radius * 2).toFixed(4)}" min="0.015" max="${maxHoleDiameter.toFixed(3)}" step="${getStepValue(unit, 'diameter')}">
            </div>
        `;
        
        if (!isCentralLumen) {
            controlsHTML += `
                <div class="input-group">
                    <label>Angle:</label>
                    <input type="range" class="range-slider c-${hole.color} updater" min="0" max="360" value="${Math.round(hole.angle)}" step="1" id="hole-${index}-angle-range">
                    <input class="updater" type="number" id="hole-${index}-angle" min="0" max="360" value="${Math.round(hole.angle)}" step="1">
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
        
        diameterSlider.value = constrainedDiameter.toFixed(4);
        diameterInput.value = constrainedDiameter.toFixed(4);
        
        hole.radius = constrainedRadius;
        this.updateSingleHole(index);
        this.recordValidPosition(index);
        
        if (isCentralLumen) {
            this.centralLumenRadius = constrainedRadius;
        }
        
        // Update global distance limits when hole size changes
        this.updateGlobalDistanceLimits();
    });
    
    diameterInput.addEventListener('input', (e) => {
        autoExitPrintMode();
        const newDiameter = parseFloat(e.target.value);
        if (!isNaN(newDiameter)) {
            const newRadius = newDiameter / 2;
            const constrainedRadius = this.findClosestValidRadius(hole.x, hole.y, newRadius, index);
            const constrainedDiameter = constrainedRadius * 2;
            
            diameterSlider.value = constrainedDiameter.toFixed(4);
            diameterInput.value = constrainedDiameter.toFixed(4);
            
            hole.radius = constrainedRadius;
            this.updateSingleHole(index);
            this.recordValidPosition(index);
            
            if (isCentralLumen) {
                this.centralLumenRadius = constrainedRadius;
            }
            
            // Update global distance limits when hole size changes
            this.updateGlobalDistanceLimits();
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
            const newAngle = Math.round(parseFloat(e.target.value));
            const { x, y } = this.polarToCartesian(newAngle, hole.distance);
            
            if (this.isValidPosition(x, y, hole.radius, index)) {
                hole.angle = newAngle;
                hole.x = x;
                hole.y = y;
                angleInput.value = newAngle;
                this.updateSingleHole(index);
                this.recordValidPosition(index);
            } else {
                angleSlider.value = Math.round(hole.angle);
            }
        });
        
        angleInput.addEventListener('input', (e) => {
            autoExitPrintMode();
            const newAngle = Math.round(parseFloat(e.target.value));
            if (!isNaN(newAngle)) {
                const { x, y } = this.polarToCartesian(newAngle, hole.distance);
                
                if (this.isValidPosition(x, y, hole.radius, index)) {
                    hole.angle = newAngle;
                    hole.x = x;
                    hole.y = y;
                    angleSlider.value = newAngle;
                    this.updateSingleHole(index);
                    this.recordValidPosition(index);
                } else {
                    e.target.value = Math.round(hole.angle);
                }
            }
        });
    }
}
            
            cleanup() {
               clearEmptySliceHighlight();
                
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
                
              // Remove global distance listeners
    const globalDistanceSlider = document.getElementById('global-distance');
    const globalDistanceInput = document.getElementById('global-distance-input');
    
    if (globalDistanceSlider && this.globalDistanceHandler) {
        globalDistanceSlider.removeEventListener('input', this.globalDistanceHandler);
    }
    if (globalDistanceInput && this.globalDistanceInputHandler) {
        globalDistanceInput.removeEventListener('input', this.globalDistanceInputHandler);
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
  restoreControlVisibility();
}
createHoleCenterCircle() {
    const unit = $("#unit").val();
    // Get distance from center to holes (assuming all holes have same distance)
    const peripheralHoles = this.holes.filter(hole => hole.distance > 0);
    if (peripheralHoles.length === 0) return;
    
    const holeDistance = peripheralHoles[0].distance;
    const z = this.cylinderHeight / 2 + 0.002;
    
    // Create circle outline through hole centers
    this.createCircleOutline(0, 0, holeDistance, z, true);

    this.createHoleCenterCircleLabel(holeDistance, z, unit);
}
createHoleCenterCircleLabel(radius, z, unit) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'dimension-label';
    labelDiv.style.cssText = `
        color: black; 
        font-size: 11px; 
        background: rgba(255,255,255,0.9); 
        padding: 2px 5px; 
        border: 1px solid black; 
        border-radius: 2px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    
    labelDiv.innerHTML = `R ${radius.toFixed(3)}${unit}`;
    
    // Position the label at the center (0,0) instead of at 45-degree angle
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(0, 0, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}
arePeripheralHolesUniform() {
    const peripheralHoles = this.holes.filter(hole => hole.distance > 0);
    if (peripheralHoles.length <= 1) return true;
    
    const firstHole = peripheralHoles[0];
    const tolerance = 0.001; // Small tolerance for floating point comparison
    
    // Check if all holes have the same radius
    const sameRadius = peripheralHoles.every(hole => 
        Math.abs(hole.radius - firstHole.radius) < tolerance
    );
    
    // Check if holes are evenly spaced angularly
    const expectedAngleStep = 360 / peripheralHoles.length;
    const evenlySpaced = peripheralHoles.every((hole, index) => {
        const expectedAngle = (index * expectedAngleStep) % 360;
        const angleDiff = Math.abs(hole.angle - expectedAngle);
        // Account for wrap-around (e.g., 359° vs 1°)
        const wrappedDiff = Math.min(angleDiff, 360 - angleDiff);
        return wrappedDiff < 1; // 1 degree tolerance
    });
    
    return sameRadius && evenlySpaced;
}     
createArcDimension(peripheralHoles, z, unit, holeCenterRadius) {
    const firstHole = peripheralHoles[0];
    const secondHole = peripheralHoles[1];
    
    // Extension distance from hole centers outward - use fixed distance for consistent positioning
    const extensionDistance = this.cylinderRadius + 0.03;
    
    // Calculate angles for the first two holes
    const angle1 = Math.atan2(firstHole.y, firstHole.x);
    const angle2 = Math.atan2(secondHole.y, secondHole.x);
    
    // Create extension lines from hole edges to arc radius
    const line1StartX = firstHole.x + Math.cos(angle1) * firstHole.radius;
    const line1StartY = firstHole.y + Math.sin(angle1) * firstHole.radius;
    const line1EndX = Math.cos(angle1) * extensionDistance;
    const line1EndY = Math.sin(angle1) * extensionDistance;
    
    const line2StartX = secondHole.x + Math.cos(angle2) * secondHole.radius;
    const line2StartY = secondHole.y + Math.sin(angle2) * secondHole.radius;
    const line2EndX = Math.cos(angle2) * extensionDistance;
    const line2EndY = Math.sin(angle2) * extensionDistance;
    
    // Create the two radial lines
    const line1Geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(line1StartX, line1StartY, z),
        new THREE.Vector3(line1EndX, line1EndY, z)
    ]);
    const line1Material = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 2 });
    const line1 = new THREE.Line(line1Geometry, line1Material);
    
    const line2Geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(line2StartX, line2StartY, z),
        new THREE.Vector3(line2EndX, line2EndY, z)
    ]);
    const line2Material = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 2 });
    const line2 = new THREE.Line(line2Geometry, line2Material);
    
    globalScene.add(line1);
    globalScene.add(line2);
    this.printModeElements.push(line1);
    this.printModeElements.push(line2);
    
    // Create the arc between the two lines
    this.createDimensionArc(angle1, angle2, extensionDistance, z);
    
    // Calculate the angular spacing between holes and create appropriate label
    const numberOfPeripheralHoles = peripheralHoles.length;
    const angularSpacing = 360 / numberOfPeripheralHoles;
    const holeDiameter = firstHole.radius * 2; // All holes are uniform, so use first hole's diameter
    
    // Position label at the midpoint of the arc, slightly outside
    const midAngle = (angle1 + angle2) / 2;
    // Handle angle wrap-around
    if (Math.abs(angle2 - angle1) > Math.PI) {
        const adjustedAngle2 = angle2 > angle1 ? angle2 - 2 * Math.PI : angle2 + 2 * Math.PI;
        const midAngleAdjusted = (angle1 + adjustedAngle2) / 2;
        const labelRadius = extensionDistance + 0.02;
        const labelX = Math.cos(midAngleAdjusted) * labelRadius;
        const labelY = Math.sin(midAngleAdjusted) * labelRadius;
        this.createHoleAngularLabel(holeDiameter, angularSpacing, labelX, labelY, z, unit);
    } else {
        const labelRadius = extensionDistance + 0.02;
        const labelX = Math.cos(midAngle) * labelRadius;
        const labelY = Math.sin(midAngle) * labelRadius;
        this.createHoleAngularLabel(holeDiameter, angularSpacing, labelX, labelY, z, unit);
    }
}

// New method to create the hole angular label (diameter + angular spacing)
createHoleAngularLabel(diameter, angularSpacing, x, y, z, unit) {
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
    
    labelDiv.innerHTML = `
        <div>⌀ ${diameter.toFixed(3)}${unit}</div>
        <div>∠ ${angularSpacing.toFixed(0)}°</div>
    `;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(x, y, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}

// Helper method to create the arc geometry
createDimensionArc(startAngle, endAngle, radius, z) {
    const points = [];
    const segments = 32;
    
    // Ensure we draw the shorter arc
    let actualStartAngle = startAngle;
    let actualEndAngle = endAngle;
    
    if (Math.abs(endAngle - startAngle) > Math.PI) {
        if (endAngle > startAngle) {
            actualEndAngle = endAngle - 2 * Math.PI;
        } else {
            actualStartAngle = startAngle - 2 * Math.PI;
        }
    }
    
    const angleRange = actualEndAngle - actualStartAngle;
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const currentAngle = actualStartAngle + angleRange * t;
        points.push(new THREE.Vector3(
            Math.cos(currentAngle) * radius,
            Math.sin(currentAngle) * radius,
            z
        ));
    }
    
    const arcGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const arcMaterial = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 2 });
    const arc = new THREE.Line(arcGeometry, arcMaterial);
    
    globalScene.add(arc);
    this.printModeElements.push(arc);
}          
createInterHoleSpacingDimensions() {
    const peripheralHoles = this.holes.filter(hole => hole.distance > 0);
    if (peripheralHoles.length < 2) return;
    
    const z = this.cylinderHeight / 2 + 0.002;
    const unit = $("#unit").val();
    const holeCenterRadius = peripheralHoles[0].distance;
    const isUniform = this.arePeripheralHolesUniform();
    
    if (isUniform) {
        // Create arc-based dimension between holes 1 and 2
        this.createArcDimension(peripheralHoles, z, unit, holeCenterRadius);
        
        // Create linear inter-hole spacing dimension
        let spacingHole1, spacingHole2, shouldFlip;
        if (peripheralHoles.length === 2) {
            // Only 2 holes: use holes 1 and 2 for spacing, and flip direction
            spacingHole1 = peripheralHoles[0];
            spacingHole2 = peripheralHoles[1];
            shouldFlip = true; // Flip direction for 2 holes to avoid arc dimension
        } else {
            // 3+ holes: use holes 2 and 3 for spacing, normal direction
            spacingHole1 = peripheralHoles[1];
            spacingHole2 = peripheralHoles[2];
            shouldFlip = false;
        }
        
        this.createLinearSpacingDimension(spacingHole1, spacingHole2, z, unit, holeCenterRadius, shouldFlip);
        
    } else {
        // Use original linear dimensions for non-uniform holes
        const iterationCount = peripheralHoles.length === 2 ? 1 : peripheralHoles.length;
        
        for (let i = 0; i < iterationCount; i++) {
            const currentHole = peripheralHoles[i];
            const nextHole = peripheralHoles[(i + 1) % peripheralHoles.length];
            
            this.createLinearSpacingDimension(currentHole, nextHole, z, unit, holeCenterRadius, false);
        }
    }
}

// New helper method to create a single linear spacing dimension
createLinearSpacingDimension(currentHole, nextHole, z, unit, holeCenterRadius, flipDirection = false) {
    const dx = nextHole.x - currentHole.x;
    const dy = nextHole.y - currentHole.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Calculate perpendicular direction - flip if requested
    const perpX = flipDirection ? -dirY : dirY;
    const perpY = flipDirection ? dirX : -dirX;
    
    const start1X = currentHole.x + dirX * currentHole.radius;
    const start1Y = currentHole.y + dirY * currentHole.radius;
    const start2X = nextHole.x - dirX * nextHole.radius;
    const start2Y = nextHole.y - dirY * nextHole.radius;
    
    const extensionLength = holeCenterRadius + 0.02;
    const overlapLength = 0.005;

    const end1X = start1X + perpX * extensionLength;
    const end1Y = start1Y + perpY * extensionLength;
    const end2X = start2X + perpX * extensionLength;
    const end2Y = start2Y + perpY * extensionLength;

    const connect1X = start1X + perpX * (extensionLength - overlapLength);
    const connect1Y = start1Y + perpY * (extensionLength - overlapLength);
    const connect2X = start2X + perpX * (extensionLength - overlapLength);
    const connect2Y = start2Y + perpY * (extensionLength - overlapLength);

    const geometry1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start1X, start1Y, z),
        new THREE.Vector3(end1X, end1Y, z)
    ]);
    const material1 = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 2 });
    const line1 = new THREE.Line(geometry1, material1);

    globalScene.add(line1);
    this.printModeElements.push(line1);

    const geometry2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start2X, start2Y, z),
        new THREE.Vector3(end2X, end2Y, z)
    ]);
    const material2 = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 2 });
    const line2 = new THREE.Line(geometry2, material2);

    globalScene.add(line2);
    this.printModeElements.push(line2);

    const connectGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(connect1X, connect1Y, z),
        new THREE.Vector3(connect2X, connect2Y, z)
    ]);
    const connectMaterial = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 2 });
    const connectLine = new THREE.Line(connectGeometry, connectMaterial);

    globalScene.add(connectLine);
    this.printModeElements.push(connectLine);

    const actualSpacing = distance - currentHole.radius - nextHole.radius;
    const labelX = (connect1X + connect2X) / 2 + perpX * 0.02;
    const labelY = (connect1Y + connect2Y) / 2 + perpY * 0.02;

    this.createSpacingLabel(actualSpacing, labelX, labelY, z, unit);
}
          createSpacingLabel(spacing, x, y, z, unit) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'dimension-label';
    labelDiv.style.cssText = `
        color: black; 
        font-size: 10px; 
        background: white; 
        padding: 2px 4px; 
        border: 1px solid black; 
        border-radius: 2px;
        font-family: Arial, sans-serif;
        white-space: nowrap;
    `;
    
    labelDiv.innerHTML = `${spacing.toFixed(3)}${unit}`;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(x, y, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
}
createCircularPrintElements() {
    const outerRadius = this.cylinderRadius;
    const z = this.cylinderHeight / 2 + 0.002;
    
    // Create outer cylinder outline
    this.createCircleOutline(0, 0, outerRadius, z, false);
    this.createHoleCenterCircle();
    this.createInterHoleSpacingDimensions();
    
    // Create central hole outline if present
    if (this.includeCentralLumen) {
        const centralHole = this.holes.find(hole => hole.distance === 0);
        if (centralHole) {
            this.createCircleOutline(0, 0, centralHole.radius, z, false);
        }
    }
    
    // Create hole outlines and dimensions
    const peripheralHoles = this.holes.filter(hole => hole.distance > 0);
    const isUniform = this.arePeripheralHolesUniform();
    
    peripheralHoles.forEach((hole, index) => {
        // Always create hole outlines
        this.createCircleOutline(hole.x, hole.y, hole.radius, z, false);
        
        // Only create dimension lines for the first hole if uniform, otherwise all holes
        if (!isUniform) {
            this.createHoleDimensionLines(hole, index);
        }
    });
    
    // Create axis lines and outer diameter dimension
    const centralHole = this.includeCentralLumen ? this.holes.find(hole => hole.distance === 0) : null;
    createOuterDiameterDimension(this, z, centralHole);
}

createCircleOutline(centerX, centerY, radius, z, dimension) {
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
    var color = 0x000000;
    if (dimension) { color = 0xd1d1d1} else {color = 0x000000}
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const circle = new THREE.Line(geometry, material);
    
    globalScene.add(circle);
    this.printModeElements.push(circle);
}

createHoleDimensionLines(hole, index) {
    const unit = $("#unit").val();
    const z = this.cylinderHeight / 2 + 0.002;
    const spacing = getDimensionSpacing(unit);
    const extensionDistance = this.cylinderRadius + spacing.extensionDistance;
    const holeAngle = Math.atan2(hole.y, hole.x);
    const holeEdgeX = hole.x + Math.cos(holeAngle) * hole.radius;
    const holeEdgeY = hole.y + Math.sin(holeAngle) * hole.radius;
    
    // Create line from center to hole center (light gray)
    
    
    // Create extension line from hole to label
    const endX = Math.cos(holeAngle) * extensionDistance;
    const endY = Math.sin(holeAngle) * extensionDistance;
    
    const extensionGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(holeEdgeX, holeEdgeY, z),
        new THREE.Vector3(endX, endY, z)
    ]);
    const extensionMaterial = new THREE.LineBasicMaterial({ color: 0xd1d1d1, linewidth: 1 });
    const extensionLine = new THREE.Line(extensionGeometry, extensionMaterial);
    
    globalScene.add(extensionLine);
    this.dimensionLines.push(extensionLine);
    
    // Create perpendicular cross line through hole center (black)
   
    
    // Create dimension label
    this.createHoleLabel(hole, endX, endY, z, index, spacing);
};

createHoleLabel(hole, x, y, z, index, spacing) {
    const unit = $("#unit").val();
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
    
    const angle = Math.round(hole.angle);
    
    labelDiv.innerHTML = `
        <div>⌀ ${diameter}${unit}</div>
        <div>∠ ${angle}°</div>
    `;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(x + spacing.labelOffset, y + spacing.labelOffset, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
};








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
    const unit = $("#unit").val() || 'in';
    this.cylinderMesh = null;
    this.controlSpheres = [];
    this.cylinderRadius = getBaseValues(unit).cylinderRadius; // Default: 0.200m diameter
    this.cylinderHeight = getBaseValues(unit).cylinderHeight;
    this.septumThickness = getBaseValues(unit).minimumSeptum; // NEW: Ensure minimum 0.005m (currently 0.01 so this doesn't change anything)
    this.cornerRadius = getBaseValues(unit).cornerRadius;
    this.sliceCount = 3; // Default: 3 slices
    this.sliceAngles = [];
    this.hasCentralHole = false; // Default: no central hole
    this.innerDiameter = getBaseValues(unit).innerDiameter; // Default: 0.025m diameter
    this.printModeElements = [];
    this.dimensionLines = [];
    this.dimensionLabels = [];
    // Add interaction state
    this.isDragging = false;
    this.draggedControlIndex = -1;
    this.holeColors = [
    0x00ff00, 0x0088ff, 0xff4444, 0xffaa00, 0xff00ff, 
    0x00ffff, 0xffff00, 0x8844ff, 0x44ff88
    ];

    // Color names for UI - same as CircularHolesSystem  
    this.colorNames = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];

    this.initializeSliceAngles();
    this.create();
    this.setupInteraction();
}
          setConsistentCameraForCapture() {
    const baseRadius = this.cylinderRadius;
    let maxExtent = baseRadius;
    
    // For pie slices, the extent is generally the outer radius
    // Add space for dimension lines that extend beyond the cylinder
    const dimensionSpace = baseRadius * 0.8; // Pie slices have more extensive dimension lines
    const labelSpace = baseRadius * 0.5;
    const totalExtent = maxExtent + dimensionSpace + labelSpace;
    const padding = 1.3; // Slightly more padding for pie slice dimensions
    const frustumSize = totalExtent * 2 * padding;
    
    const sandboxRect = sandbox.getBoundingClientRect();
    const aspectRatio = sandboxRect.width / sandboxRect.height;
    
    const halfWidth = (frustumSize / 2) * aspectRatio;
    const halfHeight = frustumSize / 2;
    
    globalOrthographicCamera.left = -halfWidth;
    globalOrthographicCamera.right = halfWidth;
    globalOrthographicCamera.top = halfHeight;
    globalOrthographicCamera.bottom = -halfHeight;
    globalOrthographicCamera.zoom = 1;
    const unit = $("#unit").val() || 'in';
    //const frustumSize = unit === 'mm' ? 10.16 : 0.4; // Proper frustum size for each unit
    const orthoDistance = unit === 'mm' ? 15.24 : 0.6; // Camera distance for each unit
    // Center camera on cylinder center
    globalOrthographicCamera.position.set(0, 0, orthoDistance);
    globalOrthographicCamera.lookAt(0, 0, 0);
    globalOrthographicCamera.updateProjectionMatrix();
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
      if (!isPerspectiveView) {
            resetOrthographicCameraToTopView();
        }
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
    if (maxInnerDiameter < getBaseValues(unit).safeId) {
        console.warn('Outer diameter too small for any inner diameter');
        return getBaseValues(unit).safeId;
    }
    
    // Save current state
    const originalInnerDiameter = this.innerDiameter;
    
    let minDiameter = getBaseValues(unit).safeId; // 1mm minimum
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
        return getBaseValues(unit).safeId;
    }
    
    // Return the largest valid diameter with a small safety margin
    const result = Math.max(getBaseValues(unit).safeId, minDiameter - getBaseValues(unit).safeId);
    
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
      const unit = $("#unit").val();
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
        if (newSeptumThickness < getBaseValues(unit).minimumSeptum) {
            septumSlider.value = getBaseValues(unit).minimumSeptum;
            septumInput.value = getBaseValues(unit).minimumSeptum;
            
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
            if (newSeptumThickness < getBaseValues(unit).minimumSeptum) {
                septumSlider.value = getBaseValues(unit).minimumSeptum;
                e.target.value = getBaseValues(unit).minimumSeptum;
                
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
    const unit = $("#unit").val();
    let minRadius = getBaseValues(unit).minCylinderDiameter / 2; // Basic minimum
    
    if (this.hasCentralHole) {
        // With central hole, need space for CURRENT inner radius + septum + outer slices
        // IMPORTANT: Don't change the inner diameter, just calculate minimum outer needed
        const currentInnerRadius = this.innerDiameter / 2;
        const minRadiusForInner = currentInnerRadius + this.septumThickness * 3;
        minRadius = Math.max(minRadius, minRadiusForInner);
        
        console.log(`Minimum outer radius for current inner diameter (${this.innerDiameter.toFixed(3)}${unit}): ${minRadiusForInner.toFixed(3)}${unit}`);
    }
    
    // Test if current slice configuration fits within this minimum
    const originalRadius = this.cylinderRadius;
    this.cylinderRadius = minRadius;
    const collapseCheck = this.detectSliceCollapse();
    this.cylinderRadius = originalRadius; // Restore original
    
    if (collapseCheck.collapsed) {
        // Need even larger radius to accommodate current slice angles
        // Use binary search to find minimum viable radius
        let testRadius = minRadius;
        let maxTestRadius = minRadius * 2;
        
        for (let i = 0; i < 20 && testRadius < maxTestRadius; i++) {
            this.cylinderRadius = testRadius;
            const testCollapse = this.detectSliceCollapse();
            this.cylinderRadius = originalRadius; // Always restore
            
            if (!testCollapse.collapsed) {
                minRadius = testRadius;
                break;
            }
            testRadius += 0.005; // Increment by 5mm
        }
    }
    
    return Math.max(getBaseValues(unit).minCylinderDiameter, minRadius * 2);
}
calculateMaximumInnerDiameterFromOuter() {
  const unit = $("#unit").val();
    if (!this.hasCentralHole) return 0;
    
    const outerRadius = this.cylinderRadius;
    
    // Your formula: outer radius - septum thickness * 2 - 0.02
    const maxInnerRadius = outerRadius - (this.septumThickness * 2) - getBaseValues(unit).defaultWallThickness*2;
    const maxInnerDiameter = maxInnerRadius * 2;
    
    // Ensure it's not negative and has a reasonable minimum
    return Math.max(getBaseValues(unit).safeId, maxInnerDiameter);
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
        
        // ONLY clamp if current value actually exceeds the maximum
        // Don't change it just because outer diameter changed
        if (this.innerDiameter > maxInnerDiameter) {
            console.log(`Clamping inner diameter from ${this.innerDiameter.toFixed(3)} to ${maxInnerDiameter.toFixed(3)}`);
            this.innerDiameter = maxInnerDiameter;
            innerDiameterSlider.value = maxInnerDiameter.toFixed(3);
            innerDiameterInput.value = maxInnerDiameter.toFixed(3);
            
            // Update geometry with new inner diameter
            this.updateGeometry();
        }
        // If inner diameter is within limits, leave it unchanged
    }
}
updateSeptumThickness(newSeptumThickness) {
  const unit = $("#unit").val();
    // NEW: Extra validation for minimum septum thickness
    if (newSeptumThickness < getBaseValues(unit).minimumSeptum) {
        console.warn(`Septum thickness ${newSeptumThickness.toFixed(3)}${unit} is below minimum 0.005m, using minimum`);
        newSeptumThickness = getBaseValues(unit).minimumSeptum;
        
        // Update UI to reflect the corrected value
        const septumSlider = document.getElementById('septum-thickness');
        const septumInput = document.getElementById('septum-thickness-input');
        if (septumSlider) septumSlider.value = getBaseValues(unit).minimumSeptum;
        if (septumInput) septumInput.value = getBaseValues(unit).minimumSeptum;
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
        console.warn(`Septum thickness limited to ${originalSeptumThickness.toFixed(3)}${unit}: ${collapseCheck.reason}`);
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
  const unit = $("#unit").val();
    const minimumLineLength = getBaseValues(unit).minimumSeptum * 3; // 15mm minimum line length
    const minimumLineLength4Sided = getBaseValues(unit).minimumSeptum * 2; // 1mm minimum for 4-sided
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
                    reason: `Slice ${i + 1}: Inner corners too close (${innerCornerDistance.toFixed(4)}${unit} apart, min: ${minLineLength.toFixed(3)}${unit})`,
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
                    reason: `Slice ${i + 1}: Start radial line too short (${effectiveRadialLine1.toFixed(4)}${unit}, min: ${minLineLength.toFixed(3)}${unit})`,
                    sliceIndex: i,
                    lineType: "radial_line"
                };
            }
            if (effectiveRadialLine2 < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: End radial line too short (${effectiveRadialLine2.toFixed(4)}${unit}, min: ${minLineLength.toFixed(3)}${unit})`,
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
                    reason: `Slice ${i + 1}: Outer arc too short (${effectiveOuterArc.toFixed(4)}${unit}, min: ${minLineLength.toFixed(3)}${unit})`,
                    sliceIndex: i,
                    lineType: "outer_arc"
                };
            }
            if (effectiveInnerArc < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Inner arc too short (${effectiveInnerArc.toFixed(4)}${unit}, min: ${minLineLength.toFixed(3)}${unit})`,
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
                    reason: `Slice ${i + 1}: Start line too short (${effectiveLine1.toFixed(4)}${unit}, min: ${minLineLength.toFixed(3)}${unit})`,
                    sliceIndex: i,
                    lineType: "convergence_line"
                };
            }
            if (effectiveLine2 < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: End line too short (${effectiveLine2.toFixed(4)}${unit}, min: ${minLineLength.toFixed(3)}${unit})`,
                    sliceIndex: i,
                    lineType: "convergence_line"
                };
            }
            if (effectiveOuterArc < minLineLength) {
                return {
                    collapsed: true,
                    reason: `Slice ${i + 1}: Outer arc too short (${effectiveOuterArc.toFixed(4)}${unit}, min: ${minLineLength.toFixed(3)}${unit})`,
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
              const unit = $("#unit").val();
                const controlRadius = getBaseValues(unit).controlRadius;
                const controlDistance = this.cylinderRadius + getBaseValues(unit).controlDistance;
                
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
                    const colorIndex = i % this.holeColors.length;
                    const material = new THREE.MeshLambertMaterial({ 
                      color: this.holeColors[colorIndex],
                      emissive: new THREE.Color(this.holeColors[colorIndex]).multiplyScalar(0.2)
                    });
                    
                    const sphere = new THREE.Mesh(geometry, material);
                    sphere.position.set(controlX, controlY, this.cylinderHeight / 2);
                    sphere.userData = { sliceIndex: i };
                    
                    this.controlSpheres.push(sphere);
                    globalScene.add(sphere);
                }
                
              
            }
regenerateSlices(totalCount) {
   const unit = $("#unit").val();
    
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
            
            
            if (maxSafeInnerDiameter > getBaseValues(unit).safeId) {
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
                        Inner diameter adjusted from ${originalInnerDiameter.toFixed(3)}${unit} to ${maxSafeInnerDiameter.toFixed(3)}${unit}<br>
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
       
        if (minDiameter > 0 && minDiameter <= getBaseValues(unit).cameraMaxDistance*2) { // Reasonable upper limit
            
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
                Outer diameter increased to ${minDiameter.toFixed(3)}${unit}<br>
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
  const unit = $("#unit").val();
    const originalSliceCount = this.sliceCount;
    const originalAngles = [...this.sliceAngles];
    const originalDiameter = this.cylinderRadius * 2;
    const originalInnerDiameter = this.innerDiameter;
  
    
    
    // Temporarily set the new slice count and equal angles
    this.sliceCount = sliceCount;
    const equalAngle = (Math.PI * 2) / sliceCount;
    this.sliceAngles = new Array(sliceCount).fill(equalAngle);
    
    // Start with a reasonable minimum based on geometry requirements
    let testDiameter = Math.max(getBaseValues(unit).maxCornerRadius, originalDiameter); // Start with at least 5cm or current diameter
    
    // If we have a central hole, factor that into minimum diameter
    if (this.hasCentralHole) {
        const centralHoleSpace = this.innerDiameter + (this.septumThickness * 4); // Inner + space for septums
        testDiameter = Math.max(testDiameter, centralHoleSpace);
        
    }
    
    let stepSize = getBaseValues(unit).minimumSeptum; // 5mm steps for faster search
    let maxIterations = 400; // Increased iterations
    let iterations = 0;
    let foundValidDiameter = false;
    
   
    
    // Search upward until we find a valid diameter
    while (iterations < maxIterations && testDiameter <= getBaseValues(unit).cameraMaxDistance*2) {
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
        console.error(`Could not find valid diameter after ${iterations} iterations, max tested: ${testDiameter.toFixed(3)}${unit}`);
        
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
        if (Math.abs(minValidDiameter - maxInvalidDiameter) < getBaseValues(unit).safeId) {
            break;
        }
    }
    
    // Add safety margin
    const finalDiameter = minValidDiameter + getBaseValues(unit).minimumSeptum; // Add 5mm safety margin
    
   
    
    // Restore original state
    this.sliceCount = originalSliceCount;
    this.sliceAngles = [...originalAngles];
    this.cylinderRadius = originalDiameter / 2;
    this.innerDiameter = originalInnerDiameter;
    
    return finalDiameter;
}
            createSliceUI() {
            const unit = $("#unit").val() || 'in';
      const colors = this.colorNames;
      const colorCodes = ['65280', '35071', '16729156', '16755200', '16711935', '65535', '16776960', '8930559', '4521864'];
      const colorIndex = 0;
     const container = document.getElementById('pie-slice-controls');
    container.innerHTML = `
        <h3>Pie Slice Controls</h3>
        
        <div class="input-group">
            <label>Septum:</label>
            <input type="range" class="range-slider" id="septum-thickness" min="${getBaseValues(unit).minimumSeptum}" max="${getBaseValues(unit).maxCornerRadius}" value="${this.septumThickness.toFixed(3)}" step="${getBaseValues(unit).safeId}">
            <input type="number" id="septum-thickness-input" min="${getBaseValues(unit).minimumSeptum}" max="${getBaseValues(unit).maxCornerRadius}" value="${this.septumThickness.toFixed(3)}" step="${getBaseValues(unit).safeId}">
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
        <label class="lumen-label">${colors[colorIndex + i]} Lumen:</label>
        <div class="input-group">
            <label>Angle:</label>
            <input type="range" class="range-slider c-${colorCodes[colorIndex + i]}" id="slice-${i}" min="45" max="315" value="${Math.round(this.sliceAngles[i] * 180 / Math.PI)}" step="1">
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
  restoreControlVisibility();
}

createPieSlicePrintElements() {
    const z = this.cylinderHeight / 2 + 0.002;
    const outerRadius = this.cylinderRadius;
    
    // Create outer cylinder outline
    this.createCircleOutline(0, 0, outerRadius, z, false);
    
    // Create central hole outline if present
    if (this.hasCentralHole) {
        const innerRadius = this.innerDiameter / 2;
        this.createCircleOutline(0, 0, innerRadius, z);
    }
    
    // Create pie slice hole outlines using the same logic as geometry creation
    this.createPieSliceOutlines();
    
    // Create slice dimension lines and labels
    this.createSliceDimensions();
    createOuterDiameterDimension(this, z);
    
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
    const unit = $("#unit").val();
    const z = this.cylinderHeight / 2 + 0.002;
    const spacing = getDimensionSpacing(unit);
    const dimensionRadius = this.cylinderRadius + spacing.lineOffset;
    
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
        const labelDistance = dimensionRadius + spacing.labelOffset;
        this.createAngleLabel(midAngle, labelDistance, z, i, sliceAngle);
        
        currentAngle += sliceAngle;
    }
    
    // Create parameter labels
    this.createParameterLabels();
};

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
    const unit = $("#unit").val();
    const z = this.cylinderHeight / 2 + 0.002;
    const spacing = getDimensionSpacing(unit);
    const labelX = -this.cylinderRadius * 1.4;
    const labelY = this.cylinderRadius * 1.4;
    
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
        <div>Outer ⌀: ${outerDiameter}${unit}</div>
        <div>Septum: ${septumThickness}${unit}</div>
        <div>Corner R: ${cornerRadius}${unit}</div>
    `;
    
    if (this.hasCentralHole) {
        const innerDiameter = this.innerDiameter.toFixed(3);
        content += `<div>Inner ⌀: ${innerDiameter}${unit}</div>`;
    }
    
    labelDiv.innerHTML = content;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(labelX, labelY, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
};



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
        const unit = $("#unit").val() || 'in';
        this.cylinderMesh = null;
        this.holeMarker = null;
        this.polarControls = null;
        
        // Cylinder parameters
        this.cylinderRadius = getBaseValues(unit).cylinderRadius;
        this.cylinderHeight = getBaseValues(unit).cylinderHeight;
        this.septumThickness = getBaseValues(unit).defaultWallThickness;
         // Wall thickness mode
         this.evenWallThickness = true; // Default: checked
        // Circular lumen parameters
        this.circularDiameter = getBaseValues(unit).maxCornerRadius; // Now storing diameter instead of radius
       this.phantomCircularDiameter = getBaseValues(unit).maxCornerRadius; // NEW: Store the diameter used for crescent calculation
        
        // Crescent parameters
        this.crescentCornerRadius = getBaseValues(unit).minimumSeptum;
        
        
        
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
  setConsistentCameraForCapture() {
    const baseRadius = this.cylinderRadius;
    
    // For crescent, consider both circular and crescent lumen positions
    const geometry = this.calculateIndependentCrescentGeometry();
    const circularCenterY = geometry.isIndependentMode ? geometry.actualCircularCenterY : geometry.circularCenterY;
    
    // Calculate extents including both lumens
    let maxExtent = baseRadius;
    const circularRadius = this.circularDiameter / 2;
    const circularExtent = Math.abs(circularCenterY) + circularRadius;
    maxExtent = Math.max(maxExtent, circularExtent);
    
    // Add space for dimension lines and labels
    const dimensionSpace = baseRadius * 0.7; // Crescent has moderate dimension lines
    const labelSpace = baseRadius * 0.4;
    const totalExtent = maxExtent + dimensionSpace + labelSpace;
    const padding = 1.2;
    const frustumSize = totalExtent * 2 * padding;
    
    const sandboxRect = sandbox.getBoundingClientRect();
    const aspectRatio = sandboxRect.width / sandboxRect.height;
    
    const halfWidth = (frustumSize / 2) * aspectRatio;
    const halfHeight = frustumSize / 2;
    
    globalOrthographicCamera.left = -halfWidth;
    globalOrthographicCamera.right = halfWidth;
    globalOrthographicCamera.top = halfHeight;
    globalOrthographicCamera.bottom = -halfHeight;
    globalOrthographicCamera.zoom = 1;
    const unit = $("#unit").val() || 'in';
    //const frustumSize = unit === 'mm' ? 10.16 : 0.4; // Proper frustum size for each unit
    const orthoDistance = unit === 'mm' ? 15.24 : 0.6; // Camera distance for each unit
    // Center camera between the two lumens
    const centerY = circularCenterY * 0.3; // Bias slightly toward center
    globalOrthographicCamera.position.set(0, centerY, orthoDistance);
    globalOrthographicCamera.lookAt(0, centerY, 0);
    globalOrthographicCamera.updateProjectionMatrix();
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
  const unit = $("#unit").val();
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
            reason: `Minimum septum thickness is ${minSeptum.toFixed(3)}${unit} for this outer diameter`
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
            reason: `Would reduce circular lumen wall thickness below ${minSeptum.toFixed(3)}${unit} minimum`
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
  const unit = $("#unit").val() || 'in';
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
        const minRequiredDiameter = Math.max(getBaseValues(unit).defaultWallThickness, minRequiredRadius * 2);
        
        
        
        return {
            valid: false,
            constrainedValue: minRequiredDiameter,
            reason: `Wall thickness would be ${wallThicknessToOuter.toFixed(3)}${unit}, maximum allowed is ${this.septumThickness.toFixed(3)}${unit}`
        };
    }
    
    // Basic bounds checking (original logic)
    if (circularTop > topBoundary) {
        const maxRadius = topBoundary - actualCircularCenterY;
        const maxDiameter = Math.max(getBaseValues(unit).defaultWallThickness, maxRadius * 2);
        return {
            valid: false,
            constrainedValue: maxDiameter,
            reason: `Exceeds available space`
        };
    }
    
    const circularBottom = actualCircularCenterY - newRadius;
    if (circularBottom < bottomBoundary) {
        const maxRadius = actualCircularCenterY - bottomBoundary;
        const maxDiameter = Math.max(getBaseValues(unit).defaultWallThickness, maxRadius * 2);
        return {
            valid: false,
            constrainedValue: maxDiameter,
            reason: `Too close to crescent`
        };
    }
    
    // Basic minimum
    if (newDiameter < getBaseValues(unit).defaultWallThickness) {
        return {
            valid: false,
            constrainedValue: getBaseValues(unit).defaultWallThickness,
            reason: `Minimum diameter is 0.010`
        };
    }
    
   
    return { valid: true, constrainedValue: newDiameter };
}
  createCrescentController() {
    const unit = $("#unit").val() || 'in';
    if (this.crescentController) {
        globalScene.remove(this.crescentController);
        if (this.crescentController.geometry) this.crescentController.geometry.dispose();
        if (this.crescentController.material) this.crescentController.material.dispose();
    }
    
    // Calculate circular lumen center position
    const geometry = this.calculateCrescentGeometry();
    const circularCenterY = geometry.circularCenterY;
    
    // Create control sphere at center of circular lumen
    const controlGeometry = new THREE.SphereGeometry(getBaseValues(unit).interactionSphereRadius, 16, 16);
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
    const unit = $("#unit").val() || 'in';
    if (!isDragging) return;
    autoExitPrintMode();
    const rect = globalRenderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const deltaY = mouse.y - initialMouseY;
    const sensitivity = unit === 'mm' ? 2.54 : 0.1;
    const diameterChange = -deltaY * sensitivity;
    const newDiameter = Math.max(getBaseValues(unit).defaultWallThickness, initialDiameter + diameterChange);
    
   
    
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
      if (!isPerspectiveView) {
            resetOrthographicCameraToTopView();
        }
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
    const unit = $("#unit").val() || 'in';
    const circularRadiusSlider = document.getElementById('circular-radius');
    const circularRadiusInput = document.getElementById('circular-radius-input');
    
    if (circularRadiusSlider && circularRadiusInput) {
        let maxCircularDiameter;
        let minCircularDiameter = getBaseValues(unit).minimumCrescentCircularDiameter; // Basic minimum
        
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
            maxCircularDiameter = Math.max(getBaseValues(unit).defaultWallThickness, maxRadius * 2);
            
           
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
    const unit = $("#unit").val() || 'in';
    // Binary search to find the maximum circular diameter that doesn't cause crescent collapse
    let minDiameter = getBaseValues(unit).defaultWallThickness; // 10mm minimum
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
    const unit = $("#unit").val() || 'in';
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
    
    const minimumCornerDistance = getBaseValues(unit).minDistanceBetweenHoles; // 5mm minimum distance
    
    if (distanceBetweenCorners < minimumCornerDistance) {
        return {
            collapsed: true,
            reason: `Corner centers too close (${distanceBetweenCorners.toFixed(4)}${unit} apart, minimum: ${minimumCornerDistance.toFixed(3)}${unit})`
        };
    }
    
    return { collapsed: false };
}
  // Get minimum septum thickness based on outer diameter
getMinimumSeptumThickness() {
    const unit = $("#unit").val() || 'in';
    const outerDiameter = this.cylinderRadius * 2;
    return getMinimumWallThickness(outerDiameter, unit);
}
  // Validate and constrain septum thickness
validateSeptumThickness(newSeptumThickness) {
    const minSeptum = this.getMinimumSeptumThickness();
    
    if (newSeptumThickness < minSeptum) {
        return {
            valid: false,
            constrainedValue: minSeptum,
            reason: `Minimum septum thickness is ${minSeptum.toFixed(3)}${unit} for this outer diameter`
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
  restoreControlVisibility();
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
    createOuterDiameterDimension(this, z);
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
    const unit = $("#unit").val();
    const spacing = getDimensionSpacing(unit);
    
    // Determine which geometry to use for positioning
    const actualGeometry = this.evenWallThickness ? geometry : this.calculateIndependentCrescentGeometry();
    const circularCenterY = actualGeometry.isIndependentMode ? actualGeometry.actualCircularCenterY : actualGeometry.circularCenterY;
    
    // 1. Circular lumen diameter dimension line (vertical from center, going up)
    const extensionDistance = this.cylinderRadius + spacing.extensionDistance;
    
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
    circularLabelDiv.innerHTML = `⌀ ${(this.circularDiameter).toFixed(3)}${unit}`;
    
    const circularLabel = new CSS2DObject(circularLabelDiv);
    circularLabel.position.set(spacing.labelOffset, extensionDistance + spacing.labelOffset, z);
    globalScene.add(circularLabel);
    this.dimensionLabels.push(circularLabel);
    
    // 2. If in independent mode, add dimension between circular and crescent lumens
    if (!this.evenWallThickness) {
        // Calculate crescent position using phantom diameter
        const crescentGeometry = this.calculateCrescentGeometryWithDiameter(this.phantomCircularDiameter);
        const crescentInnerBottom = crescentGeometry.circularCenterY - crescentGeometry.crescentInnerRadius;
        const circularBottom = circularCenterY - (this.circularDiameter / 2);
        
        // Create horizontal dimension lines extending from left side to center of cylinder
        const lumenSeparationDimX = -this.cylinderRadius - spacing.separationLineOffset;
        
        // Horizontal line at circular bottom level (extends to center)
        const circularBottomLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(lumenSeparationDimX, circularBottom, z),
            new THREE.Vector3(0, circularBottom, z)
        ]);
        const circularBottomLine = new THREE.Line(circularBottomLineGeometry, new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 }));
        globalScene.add(circularBottomLine);
        this.dimensionLines.push(circularBottomLine);
        
        // Horizontal line at crescent top level (extends to center)
        const crescentTopLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(lumenSeparationDimX, crescentInnerBottom, z),
            new THREE.Vector3(0, crescentInnerBottom, z)
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
        const tickLength = spacing.tickLength;
        
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
        gapDimensionDiv.innerHTML = `${lumenSeparation.toFixed(3)}${unit}`;
        
        const gapDimensionLabel = new CSS2DObject(gapDimensionDiv);
        gapDimensionLabel.position.set(lumenSeparationDimX - spacing.labelOffset, (circularBottom + crescentInnerBottom) / 2, z);
        globalScene.add(gapDimensionLabel);
        this.dimensionLabels.push(gapDimensionLabel);
    }
    
    // 3. Septum thickness dimension line (at bottom)
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
    septumLabelDiv.innerHTML = `Septum: ${this.septumThickness.toFixed(3)}${unit}`;
    
    const septumLabel = new CSS2DObject(septumLabelDiv);
    septumLabel.position.set(spacing.labelOffset, bottomY - spacing.labelOffset, z);
    globalScene.add(septumLabel);
    this.dimensionLabels.push(septumLabel);
    
    // 4. Corner radius dimension line
    const rightCornerCenterX = geometry.rightCornerCenterX || 0;
    const rightCornerCenterY = geometry.rightCornerCenterY || 0;
    const cornerRadius = this.crescentCornerRadius;
    
    const rightCornerEdgeX = rightCornerCenterX + cornerRadius;
    const rightCornerEdgeY = rightCornerCenterY;
    const cornerExtensionDistance = this.cylinderRadius + spacing.extensionDistance * 1.5;
    
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
    cornerLabelDiv.innerHTML = `Corner R: ${this.crescentCornerRadius.toFixed(3)}${unit}`;
    
    const cornerLabel = new CSS2DObject(cornerLabelDiv);
    cornerLabel.position.set(cornerExtensionDistance + spacing.labelOffset, rightCornerEdgeY, z);
    globalScene.add(cornerLabel);
    this.dimensionLabels.push(cornerLabel);
};



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
    const unit = $("#unit").val() || 'in';
    this.cylinderMesh = null;
    this.holeMarkers = [];
    this.polarControls = [];
    
    // Cylinder parameters
    this.cylinderRadius = getBaseValues(unit).cylinderRadius; // Will be synced with global controls
    this.cylinderHeight = getBaseValues(unit).cylinderHeight;
    this.minimumSeptum = getBaseValues(unit).minimumSeptum;
    
    // Semi-circle lumen parameters
    this.semicircleRadius = getBaseValues(unit).defaultSemicircleRadius; // Start smaller to ensure valid initial state
    this.cornerRadius = getBaseValues(unit).defaultWallThickness;
    
    // Print mode properties
    this.printModeElements = [];
    this.dimensionLines = [];
    this.dimensionLabels = [];
    
    // Hole parameters
    this.defaultHoleRadius = getBaseValues(unit).defaultHoleRadius;
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
    setTimeout(() => {
        this.updateGlobalDistanceLimits();
    }, 100);
}
  mirrorAngleOverYAxis(angle) {
    // Mirror angle over y-axis: angle -> 180° - angle
    return 180 - angle;
}
  setupGlobalDistanceListeners() {
    const globalDistanceSlider = document.getElementById('global-distance-smile');
    const globalDistanceInput = document.getElementById('global-distance-input-smile');
    
    if (!globalDistanceSlider || !globalDistanceInput) return;
    
    // Remove any existing listeners to prevent conflicts
    globalDistanceSlider.removeEventListener('input', this.globalDistanceHandler);
    globalDistanceInput.removeEventListener('input', this.globalDistanceInputHandler);
    
    // Create bound handlers to store references
    this.globalDistanceHandler = (e) => {
        startInteraction();
        autoExitPrintMode();
        const newDistance = parseFloat(e.target.value);
        globalDistanceInput.value = newDistance.toFixed(4);
        this.updateGlobalDistance(newDistance);
    };
    
    this.globalDistanceInputHandler = (e) => {
        autoExitPrintMode();
        const newDistance = parseFloat(e.target.value);
        if (!isNaN(newDistance)) {
            globalDistanceSlider.value = newDistance.toFixed(4);
            this.updateGlobalDistance(newDistance);
        }
    };
    
    globalDistanceSlider.addEventListener('mousedown', startInteraction);
    globalDistanceSlider.addEventListener('mouseup', endInteraction);
    globalDistanceSlider.addEventListener('change', endInteraction);
    globalDistanceSlider.addEventListener('input', this.globalDistanceHandler);
    globalDistanceInput.addEventListener('input', this.globalDistanceInputHandler);
}
updateGlobalDistance(newDistance) {
    // Check if ALL holes can move to the new distance
    let allHolesValid = true;
    
    // Create temporary positions for all holes at the new distance
    const tempPositions = [];
    
    this.holes.forEach((hole, index) => {
        const { x, y } = this.polarToCartesian(hole.angle, newDistance);
        tempPositions.push({ index, x, y, radius: hole.radius });
    });
    
    // Check if ALL temp positions are valid
    tempPositions.forEach((tempPos, index) => {
        if (!this.isValidPosition(tempPos.x, tempPos.y, tempPos.radius, index)) {
            allHolesValid = false;
        }
    });
    
    // Only update if ALL holes can move to the new distance
    if (allHolesValid) {
        this.holes.forEach((hole, index) => {
            const { x, y } = this.polarToCartesian(hole.angle, newDistance);
            hole.distance = newDistance;
            hole.x = x;
            hole.y = y;
            this.updateSingleHole(index);
        });
        
        
        
        // Update the global distance controls
        const globalDistanceSlider = document.getElementById('global-distance');
        const globalDistanceInput = document.getElementById('global-distance-input');
        if (globalDistanceSlider) globalDistanceSlider.value = newDistance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = newDistance.toFixed(4);

        setTimeout(() => {
            this.updateAllHoleDistanceLimits();
        }, 100);
    } else {
        // Revert the UI controls to the current valid distance
        const currentDistance = this.holes[0]?.distance || newDistance;
        const globalDistanceSlider = document.getElementById('global-distance');
        const globalDistanceInput = document.getElementById('global-distance-input');
        if (globalDistanceSlider) globalDistanceSlider.value = currentDistance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = currentDistance.toFixed(4);
        
        console.log('Global distance change blocked: would cause hole intersection');
    }
}



updateGlobalDistanceLimits() {
    const globalDistanceSlider = document.getElementById('global-distance-smile');
    const globalDistanceInput = document.getElementById('global-distance-input-smile');
    
    if (!globalDistanceSlider || !globalDistanceInput) return;
    
    // Find the maximum hole radius to determine constraints
    let maxHoleRadius = 0;
    this.holes.forEach(hole => {
        maxHoleRadius = Math.max(maxHoleRadius, hole.radius);
    });
    
    // For smile profile, holes must be above the semicircle
    // The minimum distance is determined by the semicircle radius plus spacing
    const availableSpace = this.cylinderRadius - this.semicircleRadius;
    const minDistanceFromSemicircle = maxHoleRadius + availableSpace;
        // Calculate constraints based on cylinder geometry and semicircle
    const outerConstraint = this.cylinderRadius - maxHoleRadius - availableSpace;
    const maxDistance = outerConstraint;
    const minDistance = minDistanceFromSemicircle;
    
    // Ensure valid range
    if (minDistance >= maxDistance) {
        console.warn('Invalid global distance range for smile profile');
        return;
    }
    
    globalDistanceSlider.min = minDistance.toFixed(3);
    globalDistanceSlider.max = maxDistance.toFixed(3);
    globalDistanceInput.min = minDistance.toFixed(3);
    globalDistanceInput.max = maxDistance.toFixed(3);
    
    // Update current value if it's outside the new range
    const currentDistance = this.holes[0]?.distance || minDistance;
    if (currentDistance < minDistance || currentDistance > maxDistance) {
        const clampedDistance = Math.max(minDistance, Math.min(maxDistance, currentDistance));
        globalDistanceSlider.value = clampedDistance.toFixed(4);
        globalDistanceInput.value = clampedDistance.toFixed(4);
        this.updateGlobalDistance(clampedDistance);
    } else {
        globalDistanceSlider.value = currentDistance.toFixed(4);
        globalDistanceInput.value = currentDistance.toFixed(4);
    }
}
  getMinimumSeptumThickness() {
    const unit = $("#unit").val() || 'in';
    const outerDiameter = this.cylinderRadius * 2;
    return getMinimumWallThickness(outerDiameter, unit);
}
  
  setConsistentCameraForCapture() {
    const baseRadius = this.cylinderRadius;
    let maxExtent = baseRadius;
    
    // Consider semicircle and circular holes
    const semicircleExtent = this.semicircleRadius;
    maxExtent = Math.max(maxExtent, semicircleExtent);
    
    // Check hole extents
    if (this.holes && this.holes.length > 0) {
        this.holes.forEach(hole => {
            const holeExtent = Math.sqrt(hole.x * hole.x + hole.y * hole.y) + hole.radius;
            maxExtent = Math.max(maxExtent, holeExtent);
        });
    }
    
    // Add space for dimension lines and labels
    const dimensionSpace = baseRadius * 0.6;
    const labelSpace = baseRadius * 0.4;
    const totalExtent = maxExtent + dimensionSpace + labelSpace;
    const padding = 1.2;
    const frustumSize = totalExtent * 2 * padding;
    
    const sandboxRect = sandbox.getBoundingClientRect();
    const aspectRatio = sandboxRect.width / sandboxRect.height;
    
    const halfWidth = (frustumSize / 2) * aspectRatio;
    const halfHeight = frustumSize / 2;
    
    globalOrthographicCamera.left = -halfWidth;
    globalOrthographicCamera.right = halfWidth;
    globalOrthographicCamera.top = halfHeight;
    globalOrthographicCamera.bottom = -halfHeight;
    globalOrthographicCamera.zoom = 1;
    
    // Center camera slightly toward the upper holes
    let centerX = 0, centerY = 0;
    if (this.holes && this.holes.length > 0) {
        let totalX = 0, totalY = 0;
        this.holes.forEach(hole => {
            totalX += hole.x;
            totalY += hole.y;
        });
        centerX = totalX / this.holes.length;
        centerY = totalY / this.holes.length;
        // Bias slightly toward center between holes and semicircle
        centerY = centerY * 0.3; // Reduce Y offset for better framing
    }
    const unit = $("#unit").val() || 'in';
    //const frustumSize = unit === 'mm' ? 10.16 : 0.4; // Proper frustum size for each unit
    const orthoDistance = unit === 'mm' ? 15.24 : 0.6; // Camera distance for each unit
    globalOrthographicCamera.position.set(centerX, centerY, orthoDistance);
    globalOrthographicCamera.lookAt(centerX, centerY, 0);
    globalOrthographicCamera.updateProjectionMatrix();
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
    const unit = $("#unit").val() || 'in';
    const R = this.semicircleRadius;
    
    // The corner radius cannot be larger than the semicircle radius
    if (newCornerRadius >= R) {
        return {
            valid: false,
            constrainedValue: Math.max(getBaseValues(unit).minimumSeptum, R * 0.9), // 90% of semicircle radius
            reason: `Corner radius cannot exceed ${(R * 0.9).toFixed(3)}${unit} (90% of semicircle radius)`
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
            constrainedValue: Math.max(getBaseValues(unit).minimumSeptum, maxValidCornerRadius - getBaseValues(unit).safeId), // Small safety margin
            reason: `Corner radius too large - would cause geometric collapse. Maximum: ${maxValidCornerRadius.toFixed(3)}${unit}`
        };
    }
    
    // Minimum practical corner radius
    const minCornerRadius = getBaseValues(unit).minimumSeptum; // 5mm minimum
    if (newCornerRadius < minCornerRadius) {
        return {
            valid: false,
            constrainedValue: minCornerRadius,
            reason: `Minimum corner radius is ${minCornerRadius.toFixed(3)}${unit}`
        };
    }
    
    return { valid: true, constrainedValue: newCornerRadius };
}
  // Validate cylinder radius change to prevent hole intersections
validateCylinderRadius(newRadius) {
    const unit = $("#unit").val() || 'in';
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
                reason: `Would intersect with ${hole.name} - minimum outer diameter: ${(requiredRadius * 2).toFixed(3)}${unit}`
            };
        }
    }
    
    // Check if semicircle would intersect with new outer boundary
    const requiredRadiusForSemicircle = this.semicircleRadius + minSeptum;
    if (newRadius < requiredRadiusForSemicircle) {
        return {
            valid: false,
            constrainedValue: this.cylinderRadius, // Keep current value
            reason: `Would intersect with smile lumen - minimum outer diameter: ${(requiredRadiusForSemicircle * 2).toFixed(3)}${unit}`
        };
    }
    
    // Additional check: ensure minimum practical cylinder size
    const absoluteMinRadius = getBaseValues(unit).defaultSemicircleRadius/2; 
    if (newRadius < absoluteMinRadius) {
        return {
            valid: false,
            constrainedValue: absoluteMinRadius,
            reason: `Minimum outer diameter is ${(absoluteMinRadius * 2).toFixed(3)}${unit}`
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
  const unit = $("#unit").val() || 'in';
    let minRequired = getBaseValues(unit).defaultWallThickness*2; // Absolute minimum (4cm radius)
    
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
    const unit = $("#unit").val() || 'in';
    const maxRadius = this.calculateMaxSemicircleRadius();
    
    if (newRadius > maxRadius) {
        return {
            valid: false,
            constrainedValue: this.semicircleRadius, // Keep current value
            reason: `Maximum radius is ${maxRadius.toFixed(3)}${unit} (maintains ${this.minimumSeptum.toFixed(3)}${unit} septum from outer wall)`
        };
    }
    
    // Check holes that could interfere with the new semicircle position
    // With the new constraint, holes must maintain (cylinderRadius - semicircleRadius) spacing
    for (let i = 0; i < this.holes.length; i++) {
        const hole = this.holes[i];
        const requiredAvailableSpace = this.cylinderRadius - newRadius;
        
        // Check if hole's Y position would be valid with new semicircle radius
        const newMinYPosition = requiredAvailableSpace + hole.radius;
        
        if (hole.y < newMinYPosition) {
            const maxAllowedRadius = this.cylinderRadius - requiredAvailableSpace - hole.radius;
            return {
                valid: false,
                constrainedValue: this.semicircleRadius, // Keep current value
                reason: `Would interfere with ${hole.name} - maximum radius: ${Math.max(0, maxAllowedRadius).toFixed(3)}${unit}`
            };
        }
    }
    
    // Additional check: ensure minimum practical semicircle size
    const absoluteMinRadius = getBaseValues(unit).defaultWallThickness*2; // 4cm minimum radius
    if (newRadius < absoluteMinRadius) {
        return {
            valid: false,
            constrainedValue: Math.max(absoluteMinRadius, this.semicircleRadius),
            reason: `Minimum semicircle radius is ${absoluteMinRadius.toFixed(3)}${unit}`
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
    
    const circularHoleCount = totalCount - 1; // Subtract 1 for the semicircle
    
    const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
    let colorIndex = 0;
    
    for (let i = 0; i < circularHoleCount; i++) {
        let angle;
        if (circularHoleCount === 1) {
            angle = 90; // Single hole at top center
        } else if (circularHoleCount === 2) {
            // Two holes symmetrically placed and mirrored
            angle = i === 0 ? 60 : 120; // 60° and 120° (mirrored over y-axis)
        }
        
        const distance = this.calculateOptimalDistance();
        const { x, y } = this.polarToCartesian(angle, distance);
        
        this.holes.push({
            x: x,
            y: y,
            angle: angle,
            distance: distance,
            radius: this.defaultHoleRadius,
            color: this.holeColors[colorIndex + i],
            name: `${colors[colorIndex + i]} Lumen`
        });
    }
}
    
   calculateOptimalDistance() {
     const unit = $("#unit").val() || 'in';
    const maxDistance = this.cylinderRadius - this.defaultHoleRadius - this.minimumSeptum;
    const minDistance = this.semicircleRadius + this.defaultHoleRadius + this.minimumSeptum;
    
    // FIXED: Ensure we return a valid distance
    if (minDistance >= maxDistance) {
        console.warn('Optimal distance calculation: min >= max, using safe fallback');
        return Math.max(getBaseValues(unit).defaultWallThickness*3, this.cylinderRadius * 0.6);
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
    this.holes.forEach((hole, index) => {
        // Use the positions from the actual markers/controllers which are validated
        let holeX = hole.x;
        let holeY = hole.y;
        
        // If we have markers, use their validated positions instead
        if (this.holeMarkers && this.holeMarkers[index]) {
            holeX = this.holeMarkers[index].position.x;
            holeY = this.holeMarkers[index].position.y;
        }
        
        const holePath = new THREE.Path();
        holePath.absarc(holeX, holeY, hole.radius, 0, Math.PI * 2, true);
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
            metalness: 0.1,
            roughness: 0.4,
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
    
    // REMOVED: this.updateAllHoleDistanceLimits(); 
    // This was causing the circular dependency!
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
      const unit = $("#unit").val() || 'in';
        // Clean up existing controls
        this.polarControls.forEach(control => {
            globalScene.remove(control);
            if (control.geometry) control.geometry.dispose();
            if (control.material) control.material.dispose();
        });
        this.polarControls = [];
        
        // Create new controls
        this.holes.forEach((hole, index) => {
            const controlGeometry = new THREE.SphereGeometry(getBaseValues(unit).interactionSphereRadius, 16, 16);
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
     const unit = $("#unit").val() || 'in';
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
                const newRadius = Math.max(getBaseValues(unit).minimumSeptum, Math.min(distanceFromHole, this.cylinderRadius));
                
                if (this.isValidPosition(hole.x, hole.y, newRadius, this.activeHoleIndex)) {
                    hole.radius = newRadius;
                    this.updateSingleHole(this.activeHoleIndex);
                }
            }
            
        } else if (this.dragMode === 'distance') {
    const newDistance = Math.sqrt(intersectPoint.x * intersectPoint.x + intersectPoint.y * intersectPoint.y);

    // Check if ALL holes can move to the new distance
    let allHolesValid = true;
    
    // Create temporary positions for all holes at the new distance
    const tempPositions = [];
    
    this.holes.forEach((hole, index) => {
        const { x, y } = this.polarToCartesian(hole.angle, newDistance);
        tempPositions.push({ index, x, y, radius: hole.radius });
    });
    
    // Check if ALL temp positions are valid
    tempPositions.forEach((tempPos, index) => {
        if (!this.isValidPosition(tempPos.x, tempPos.y, tempPos.radius, index)) {
            allHolesValid = false;
        }
    });
    
    // Only update if ALL holes can move to the new distance
    if (allHolesValid) {
        this.holes.forEach((hole, index) => {
            const { x, y } = this.polarToCartesian(hole.angle, newDistance);
            hole.distance = newDistance;
            hole.x = x;
            hole.y = y;
            this.updateSingleHole(index);
        });
        
        // Update global distance controls
        const globalDistanceSlider = document.getElementById('global-distance-smile');
        const globalDistanceInput = document.getElementById('global-distance-input-smile');
        if (globalDistanceSlider) globalDistanceSlider.value = newDistance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = newDistance.toFixed(4);
        
        // Update limits after distance change
        setTimeout(() => {
            this.updateGlobalDistanceLimits(); // Add this line
        }, 100);
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
        
        // Mirror the other hole if we have exactly 2 circular holes
        if (this.holes.length === 2) {
            const otherHoleIndex = this.activeHoleIndex === 0 ? 1 : 0;
            const otherHole = this.holes[otherHoleIndex];
            const mirroredAngle = this.mirrorAngleOverYAxis(angle);
            const { x: mirroredX, y: mirroredY } = this.polarToCartesian(mirroredAngle, otherHole.distance);
            
            if (this.isValidPosition(mirroredX, mirroredY, otherHole.radius, otherHoleIndex)) {
                otherHole.angle = mirroredAngle;
                otherHole.x = mirroredX;
                otherHole.y = mirroredY;
                this.updateSingleHole(otherHoleIndex);
            }
        }
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
      if (!isPerspectiveView) {
            resetOrthographicCameraToTopView();
        }
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
    
    // Update geometry
    this.updateCylinderGeometry();
    this.updateHoleUI(holeIndex);
    
    // Update distance limits
    this.updateSingleHoleDistanceLimitsOnly(holeIndex);
    
    // NEW: Sync global distance controls with hole distance
    const globalDistanceSlider = document.getElementById('global-distance-smile');
    const globalDistanceInput = document.getElementById('global-distance-input-smile');
    if (globalDistanceSlider && globalDistanceInput && hole.distance > 0) {
        globalDistanceSlider.value = hole.distance.toFixed(4);
        globalDistanceInput.value = hole.distance.toFixed(4);
    }
}
 updateSingleHoleDistanceLimits(holeIndex) {
    const unit = $("#unit").val() || 'in';
    const hole = this.holes[holeIndex];
    
    // Calculate the available space between semicircle and outer cylinder
    const availableSpace = this.cylinderRadius - this.semicircleRadius;
    
    // Use available space as the minimum constraint instead of minimum septum
    const spacingConstraint = availableSpace;
    
    // Calculate limits based on the new constraint
    const cylinderInnerEdge = this.cylinderRadius - spacingConstraint;
    const semicircleOuterEdge = this.semicircleRadius;
    const holeRadius = hole.radius;
    
    const maxDistance = cylinderInnerEdge - holeRadius;
    
    let minDistance = holeRadius + spacingConstraint;
    if (hole.y <= spacingConstraint) { // Use spacing constraint instead of minimumSeptum
        minDistance = Math.max(minDistance, semicircleOuterEdge - holeRadius);
    }
    
    // Ensure valid range
    if (minDistance >= maxDistance) {
        console.warn(`Invalid range for hole ${holeIndex}, adjusting`);
        minDistance = Math.max(getBaseValues(unit).defaultWallThickness*2, maxDistance - getBaseValues(unit).defaultWallThickness*2);
    }
    
    const distanceSlider = document.querySelector(`#smile-hole-${holeIndex}-distance-range`);
    const distanceInput = document.querySelector(`#smile-hole-${holeIndex}-distance`);
    
    if (distanceSlider) {
        const currentSliderValue = parseFloat(distanceSlider.value);
        const currentHoleDistance = hole.distance;
        
        // Update min/max
        distanceSlider.min = minDistance.toFixed(3);
        distanceSlider.max = maxDistance.toFixed(3);
        
        let targetValue = currentHoleDistance;
        
        // Only clamp if the hole distance is actually outside the valid range
        if (currentHoleDistance < minDistance || currentHoleDistance > maxDistance) {
            targetValue = Math.max(minDistance, Math.min(maxDistance, currentHoleDistance));
            
            // Update the hole position ONLY if we had to clamp
            const { x, y } = this.polarToCartesian(hole.angle, targetValue);
            hole.distance = targetValue;
            hole.x = x;
            hole.y = y;
            
            // Update markers/controls without triggering full geometry update
            const marker = this.holeMarkers[holeIndex];
            if (marker) {
                marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            }
            const control = this.polarControls[holeIndex];
            if (control) {
                control.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            }
        }
        
        distanceSlider.value = targetValue.toFixed(4);
    }
    
    if (distanceInput) {
        distanceInput.min = minDistance.toFixed(3);
        distanceInput.max = maxDistance.toFixed(3);
        distanceInput.value = hole.distance.toFixed(4);
    }
}
isValidPosition(x, y, radius, holeIndex) {
    const distanceFromCenter = Math.sqrt(x * x + y * y);
    
    // Calculate the available space constraint (distance between semicircle and outer wall)
    const availableSpace = this.cylinderRadius - this.semicircleRadius;
    const spacingConstraint = availableSpace;
    
    // Check cylinder boundary using available space constraint
    const maxDistance = this.cylinderRadius - spacingConstraint - radius;
    if (distanceFromCenter > maxDistance) {
        console.log(`❌ Hole ${holeIndex}: Distance ${distanceFromCenter.toFixed(4)} exceeds max ${maxDistance.toFixed(4)}`);
        return false;
    }
    
    // Check semicircle interference using the new constraint
    // The hole must have y position of at least: spacingConstraint + hole radius
    const minYPosition = spacingConstraint + radius;
    
    if (y < minYPosition) {
        console.log(`❌ Hole ${holeIndex}: Y position ${y.toFixed(4)} below minimum ${minYPosition.toFixed(4)}`);
        return false;
    }
    
    // Check separation from other holes using the same spacing constraint
    for (let i = 0; i < this.holes.length; i++) {
        if (i === holeIndex) continue;
        
        const otherHole = this.holes[i];
        const dx = x - otherHole.x;
        const dy = y - otherHole.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minRequiredDistance = radius + otherHole.radius + spacingConstraint;
        
        if (distance < minRequiredDistance) {
            console.log(`❌ Hole ${holeIndex}: Distance ${distance.toFixed(4)} to hole ${i} below minimum ${minRequiredDistance.toFixed(4)}`);
            return false;
        }
    }
    
    console.log(`✅ Hole ${holeIndex}: Valid position at (${x.toFixed(4)}, ${y.toFixed(4)})`);
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
    const unit = $("#unit").val() || 'in';
    const container = document.getElementById('smile-hole-controls');
    if (!container) {
        console.error('smile-hole-controls container not found!');
        return;
    }
    
    container.innerHTML = '<h3>Lumen Controls (Polar Coordinates)</h3>';
    
    // Add global distance control first if there are holes
    if (this.holes.length > 0) {
        const globalDistance = this.holes[0].distance;
        const availableSpace = this.cylinderRadius - this.semicircleRadius;
        const spacingConstraint = availableSpace;
        const maxGlobalDistance = this.cylinderRadius - spacingConstraint - Math.max(...this.holes.map(h => h.radius));
        const minGlobalDistance = this.semicircleRadius + spacingConstraint + Math.max(...this.holes.map(h => h.radius));
        
        const globalDiv = document.createElement('div');
        globalDiv.className = 'hole-control-item';
        globalDiv.innerHTML = `
            <p class="hole-title">Global Distance Control</p>
            <div class="input-group">
                <label>Distance:</label>
                <input type="range" class="range-slider updater" id="global-distance-smile" min="${minGlobalDistance.toFixed(3)}" max="${maxGlobalDistance.toFixed(3)}" value="${globalDistance.toFixed(4)}" step="${getStepValue(unit, 'diameter')}">
                <input type="number" class="updater" id="global-distance-input-smile" min="${minGlobalDistance.toFixed(3)}" max="${maxGlobalDistance.toFixed(3)}" value="${globalDistance.toFixed(4)}" step="${getStepValue(unit, 'diameter')}">
            </div>
        `;
        container.appendChild(globalDiv);
        
        // Setup global distance control listeners
        this.setupGlobalDistanceListeners();
    }
    
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
            minDistance = Math.max(getBaseValues(unit).defaultWallThickness*2, maxDistance - getBaseValues(unit).defaultWallThickness*2);
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
                <input type="range" class="range-slider c-${hole.color}" id="smile-hole-${index}-diameter-range" min="0.005" max="${maxHoleDiameter.toFixed(3)}" value="${(hole.radius * 2).toFixed(4)}" step="${getStepValue(unit, 'diameter')}">
                <input type="number" id="smile-hole-${index}-diameter" min="0.005" max="${maxHoleDiameter.toFixed(3)}" value="${(hole.radius * 2).toFixed(4)}" step="${getStepValue(unit, 'diameter')}">
            </div>
            <div class="input-group">
                <label>Angle:</label>
                <input type="range" class="range-slider c-${hole.color}" id="smile-hole-${index}-angle-range" min="${minAngle}" max="${maxAngle}" value="${Math.round(useAngle)}" step="1">
                <input type="number" id="smile-hole-${index}-angle" min="${minAngle}" max="${maxAngle}" value="${Math.round(useAngle)}" step="1">
            </div>
        `;
        
        container.appendChild(div);
        
        // Update hole position if we had to adjust angle or distance
        if (Math.abs(useDistance - hole.distance) > getBaseValues(unit).safeId || Math.abs(useAngle - hole.angle) > 0.1) {
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
    const unit = $("#unit").val() || 'in';
    const hole = this.holes[holeIndex];
    
    // Calculate the available space between semicircle and outer cylinder
    const availableSpace = this.cylinderRadius - this.semicircleRadius;
    
    // Use available space as the minimum constraint instead of minimum septum
    const spacingConstraint = availableSpace;
    
    // Calculate limits based on the new constraint
    const cylinderInnerEdge = this.cylinderRadius - spacingConstraint;
    const semicircleOuterEdge = this.semicircleRadius + spacingConstraint;
    const holeRadius = hole.radius;
    
    const maxDistance = cylinderInnerEdge - holeRadius;
    
    let minDistance = holeRadius + spacingConstraint;
    if (hole.y <= spacingConstraint) { // Use spacing constraint instead of minimumSeptum
        minDistance = Math.max(minDistance, semicircleOuterEdge + holeRadius);
    }
    
    // Ensure valid range
    if (minDistance >= maxDistance) {
        console.warn(`Invalid range for hole ${holeIndex}, adjusting`);
        minDistance = Math.max(getBaseValues(unit).defaultWallThickness*2, maxDistance - getBaseValues(unit).defaultWallThickness*2);
    }
    
    const distanceSlider = document.querySelector(`#smile-hole-${holeIndex}-distance-range`);
    const distanceInput = document.querySelector(`#smile-hole-${holeIndex}-distance`);
    
    if (distanceSlider) {
        const currentSliderValue = parseFloat(distanceSlider.value);
        const currentHoleDistance = hole.distance;
        
        // Update min/max
        distanceSlider.min = minDistance.toFixed(3);
        distanceSlider.max = maxDistance.toFixed(3);
        
        let targetValue = currentHoleDistance;
        
        // Only clamp if the hole distance is actually outside the valid range
        if (currentHoleDistance < minDistance || currentHoleDistance > maxDistance) {
            targetValue = Math.max(minDistance, Math.min(maxDistance, currentHoleDistance));
            
            // Update the hole position ONLY if we had to clamp
            const { x, y } = this.polarToCartesian(hole.angle, targetValue);
            hole.distance = targetValue;
            hole.x = x;
            hole.y = y;
            
            // Update markers/controls without triggering full geometry update
            const marker = this.holeMarkers[holeIndex];
            if (marker) {
                marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            }
            const control = this.polarControls[holeIndex];
            if (control) {
                control.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            }
        }
        
        distanceSlider.value = targetValue.toFixed(4);
    }
    
    if (distanceInput) {
        distanceInput.min = minDistance.toFixed(3);
        distanceInput.max = maxDistance.toFixed(3);
        distanceInput.value = hole.distance.toFixed(4);
    }
}
  // Update distance limits for all holes when semicircle or cylinder parameters change
updateAllHoleDistanceLimits() {
    this.holes.forEach((hole, index) => {
        // Use the non-circular version
        this.updateSingleHoleDistanceLimitsOnly(index);
    });
}
  updateSingleHoleDistanceLimitsOnly(holeIndex) {
    const hole = this.holes[holeIndex];
    
    // Calculate the available space between semicircle and outer cylinder
    const availableSpace = this.cylinderRadius - this.semicircleRadius;
    
    // Use available space as the constraint
    const spacingConstraint = availableSpace;
    
    const cylinderInnerEdge = this.cylinderRadius - spacingConstraint;
    const semicircleOuterEdge = this.semicircleRadius + spacingConstraint;
    const holeRadius = hole.radius;
    
    const maxDistance = cylinderInnerEdge - holeRadius;
    
    let minDistance = holeRadius + spacingConstraint;
    if (hole.y <= spacingConstraint) {
        minDistance = Math.max(minDistance, semicircleOuterEdge - holeRadius);
    }
    
    // Ensure valid range
    if (minDistance >= maxDistance) {
        console.warn(`Invalid range for hole ${holeIndex}, adjusting`);
        const unit = $("#unit").val() || 'in';
        minDistance = Math.max(getBaseValues(unit).defaultWallThickness*2, maxDistance - getBaseValues(unit).defaultWallThickness*2);
    }
    
    const distanceSlider = document.querySelector(`#smile-hole-${holeIndex}-distance-range`);
    const distanceInput = document.querySelector(`#smile-hole-${holeIndex}-distance`);
    
    if (distanceSlider) {
        const currentSliderValue = parseFloat(distanceSlider.value);
        const currentHoleDistance = hole.distance;
        
        // Update min/max
        distanceSlider.min = minDistance.toFixed(3);
        distanceSlider.max = maxDistance.toFixed(3);
        
        let targetValue = currentHoleDistance;
        
        // Only clamp if the hole distance is actually outside the valid range
        if (currentHoleDistance < minDistance || currentHoleDistance > maxDistance) {
            targetValue = Math.max(minDistance, Math.min(maxDistance, currentHoleDistance));
            
            // Update the hole position ONLY if we had to clamp
            const { x, y } = this.polarToCartesian(hole.angle, targetValue);
            hole.distance = targetValue;
            hole.x = x;
            hole.y = y;
            
            // Update markers/controls without triggering full geometry update
            const marker = this.holeMarkers[holeIndex];
            if (marker) {
                marker.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            }
            const control = this.polarControls[holeIndex];
            if (control) {
                control.position.set(hole.x, hole.y, this.cylinderHeight / 2);
            }
        }
        
        distanceSlider.value = targetValue.toFixed(4);
    }
    
    if (distanceInput) {
        distanceInput.min = minDistance.toFixed(3);
        distanceInput.max = maxDistance.toFixed(3);
        distanceInput.value = hole.distance.toFixed(4);
    }
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
        
        // Mirror the other hole if we have exactly 2 circular holes
        if (this.holes.length === 2) {
            const otherHoleIndex = index === 0 ? 1 : 0;
            const otherHole = this.holes[otherHoleIndex];
            const mirroredAngle = this.mirrorAngleOverYAxis(newAngle);
            const { x: mirroredX, y: mirroredY } = this.polarToCartesian(mirroredAngle, otherHole.distance);
            
            if (this.isValidPosition(mirroredX, mirroredY, otherHole.radius, otherHoleIndex)) {
                otherHole.angle = mirroredAngle;
                otherHole.x = mirroredX;
                otherHole.y = mirroredY;
                this.updateSingleHole(otherHoleIndex);
            }
        }
    }
});

// Angle input listener:
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
            
            // Mirror the other hole if we have exactly 2 circular holes
            if (this.holes.length === 2) {
                const otherHoleIndex = index === 0 ? 1 : 0;
                const otherHole = this.holes[otherHoleIndex];
                const mirroredAngle = this.mirrorAngleOverYAxis(newAngle);
                const { x: mirroredX, y: mirroredY } = this.polarToCartesian(mirroredAngle, otherHole.distance);
                
                if (this.isValidPosition(mirroredX, mirroredY, otherHole.radius, otherHoleIndex)) {
                    otherHole.angle = mirroredAngle;
                    otherHole.x = mirroredX;
                    otherHole.y = mirroredY;
                    this.updateSingleHole(otherHoleIndex);
                }
            }
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
        
        // Remove global distance listeners
    const globalDistanceSlider = document.getElementById('global-distance-smile');
    const globalDistanceInput = document.getElementById('global-distance-input-smile');
    
    if (globalDistanceSlider && this.globalDistanceHandler) {
        globalDistanceSlider.removeEventListener('input', this.globalDistanceHandler);
    }
    if (globalDistanceInput && this.globalDistanceInputHandler) {
        globalDistanceInput.removeEventListener('input', this.globalDistanceInputHandler);
    }
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
      restoreControlVisibility();
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
        createOuterDiameterDimension(this, z);
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
    const unit = $("#unit").val();
    const z = this.cylinderHeight / 2 + 0.002;
    const spacing = getDimensionSpacing(unit);
    const extensionDistance = this.cylinderRadius + spacing.extensionDistance;
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
    const crossLength = spacing.crossLength;
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
        <div>⌀ ${diameter}${unit}</div>
        <div>↔ ${distance}${unit}</div>
        <div>∠ ${angle}°</div>
    `;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(endX + spacing.labelOffset, endY + spacing.labelOffset, z);
    
    globalScene.add(css2dLabel);
    this.dimensionLabels.push(css2dLabel);
};
   
   createSemicircleDimensions(z) {
    const unit = $("#unit").val();
    const spacing = getDimensionSpacing(unit);
    
    // Create 45-degree dimension line from semicircle edge
    const angle45 = -Math.PI / 4;
    const startX = this.semicircleRadius * Math.cos(angle45);
    const startY = this.semicircleRadius * Math.sin(angle45);
    
    const extensionDistance = this.cylinderRadius + spacing.extensionDistance;
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
        <div>Radius: ${this.semicircleRadius.toFixed(3)}${unit}</div>
        <div>Corner R: ${this.cornerRadius.toFixed(3)}${unit}</div>
    `;
    
    const label = new CSS2DObject(labelDiv);
    label.position.set(endX + spacing.labelOffset, endY + spacing.labelOffset, z);
    
    globalScene.add(label);
    this.dimensionLabels.push(label);
};
   
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
                setupUnitConversion();
                this.currentSystem = null;
               this.setupGlobalControls();
                this.showCircular();
            }
 


          
showPieSliceConstraintWarning(message, attemptedValue, unit) {
    const warning = document.createElement('div');
    warning.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        padding: 12px;
        border-radius: 5px;
        z-index: 1000;
        font-family: Arial;
        font-size: 13px;
        max-width: 350px;
        line-height: 1.4;
    `;
    
    warning.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">Pie Slice Constraint</div>
        <div>${message}</div>
        <div style="margin-top: 8px; font-size: 11px; opacity: 0.9;">
            Attempted: ${attemptedValue.toFixed(3)}${unit} diameter
        </div>
    `;
    
    document.body.appendChild(warning);
    setTimeout(() => {
        if (warning.parentNode) {
            warning.parentNode.removeChild(warning);
        }
    }, 4000);
}
applyHoleChanges() {
    const holeCount = parseInt(document.getElementById('hole-count').value);
    
    if (this.currentSystem instanceof CircularHolesSystem) {
        const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        const includeCentralLumen = centralLumenCheckbox.checked;
        console.log('applyHoleChanges - holeCount:', holeCount, 'includeCentralLumen:', includeCentralLumen);
        // Update the system's central lumen setting
        this.currentSystem.includeCentralLumen = includeCentralLumen;
        
        // Regenerate holes - this will create central lumen as holes[0] if enabled
        this.currentSystem.regenerateHoles(holeCount);
        console.log('After regeneration, system has', this.currentSystem.holes.length, 'holes');
    } else if (this.currentSystem instanceof PieSliceSystem) {
        clearEmptySliceHighlight();
        // Existing pie slice logic...
        const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        const hasCentralHole = centralLumenCheckbox.checked;
        const minCount = hasCentralHole ? 3 : 2;
        let adjustedHoleCount = Math.max(holeCount, minCount);
        
        if (adjustedHoleCount !== holeCount) {
            document.getElementById('hole-count').value = adjustedHoleCount;
        }
        
        const wasCentralHole = this.currentSystem.hasCentralHole;
        this.currentSystem.hasCentralHole = hasCentralHole;
        
        if (this.currentSystem.hasCentralHole) {
            const innerDiameterSlider = document.getElementById('inner-diameter');
            this.currentSystem.innerDiameter = parseFloat(innerDiameterSlider.value);
            this.currentSystem.updateInnerDiameterLimits();
        }
        
        const success = this.currentSystem.regenerateSlices(adjustedHoleCount);
        
        if (!success) {
            this.currentSystem.hasCentralHole = wasCentralHole;
            centralLumenCheckbox.checked = wasCentralHole;
        }
        
    } else if (this.currentSystem instanceof SmileSystem) {
      clearEmptySliceHighlight();
        // Existing smile logic...
        const minHoles = 2;
        const maxHoles = 3;
        let adjustedHoleCount = Math.max(minHoles, Math.min(holeCount, maxHoles));
        
        if (adjustedHoleCount !== holeCount) {
            document.getElementById('hole-count').value = adjustedHoleCount;
        }
        
        this.currentSystem.regenerateHoles(adjustedHoleCount);
    }
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
        holeCountInput.value = 3;
        holeCountInput.max = 9;
        holeCountInput.title = "Circular profile: 2-9 holes";
    } else if (this.currentSystem instanceof PieSliceSystem) {
       const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        const hasCentralHole = centralLumenCheckbox ? centralLumenCheckbox.checked : false;
        
        holeCountInput.min = 2;
        if (hasCentralHole) {
            holeCountInput.max = 9; // 8 slices + 1 central hole = 9 total
            holeCountInput.title = "Pie slice profile with central hole: 3-9 holes (2-8 slices + 1 central)";
        } else {
            holeCountInput.max = 8; // Maximum 8 slices without central hole
            holeCountInput.title = "Pie slice profile: 2-8 holes (2-8 slices)";
        }
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
    
    clearEmptySliceHighlight();
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
    document.getElementById('center-hole-container').classList.add('locked');
    setTimeout(() => {
        if (this.currentSystem && this.currentSystem.setupGlobalDistanceListeners) {
            this.currentSystem.setupGlobalDistanceListeners();
        }
    }, 200);
    const globalDistanceGroup = document.getElementById('global-distance-group');
    if (globalDistanceGroup) {
        globalDistanceGroup.style.display = 'flex'; // Changed from 'none' to 'flex'
    }
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
    ensureControlsVisible();
    $("#cylinder-diameter, #cylinder-diameter-input").attr("min", 0.079).trigger("change");
    $("#lumen-counter").removeClass('locked');
    
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
            //innerDiameterGroup.style.display = this.currentSystem.includeCentralLumen ? 'flex' : 'none';
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
    const unit = $("#unit").val() || 'in';
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
    if (innerDiameterSlider && innerDiameterInput && this.currentSystem instanceof PieSliceSystem) {
        innerDiameterSlider.value = getBaseValues(unit).cameraMinDistance/2;
        innerDiameterInput.value = getBaseValues(unit).cameraMinDistance/2;
        innerDiameterSlider.max = getBaseValues(unit).maxInnerDiameter;
        innerDiameterInput.max = getBaseValues(unit).maxInnerDiameter;
    }
    
    // Reset outer diameter to default value
    const cylinderDiameterSlider = document.getElementById('cylinder-diameter');
    const cylinderDiameterInput = document.getElementById('cylinder-diameter-input');
    if (cylinderDiameterSlider && cylinderDiameterInput) {
        const defaultDiameter = Math.max(getBaseValues(unit).defaultCylinderRadius*2, getBaseValues(unit).minCylinderDiameter);
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
    semicircleRadiusSlider.value = getBaseValues(unit).defaultSemicircleRadius;
    semicircleRadiusInput.value = getBaseValues(unit).defaultSemicircleRadius;
}

if (smileCornerSlider && smileCornerInput) {
    smileCornerSlider.value = getBaseValues(unit).defaultWallThickness;
    smileCornerInput.value = getBaseValues(unit).defaultWallThickness;
}
}
            setupGlobalControls() {
              const unit = $("#unit").val();
  document.getElementById('export-stl-btn').addEventListener('click', () => {
    exportCurrentSystemAsSTL();
});
      document.addEventListener('keydown', (event) => {
        // Check if 'H' key is pressed (case insensitive)
        if (event.key === 'h' || event.key === 'H') {
            // Make sure we're not in an input field or other text area
            const activeElement = document.activeElement;
            const isInputField = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.contentEditable === 'true'
            );
            
            // Only trigger if not in an input field and no modifier keys are pressed
            if (!isInputField && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
                event.preventDefault();
                toggleControlVisibility();
            }
        }
    });            
              
  
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
document.getElementById('hide-controls-btn').addEventListener('click', (event) => {
    // Prevent any default behavior
    event.preventDefault();
    
    // Create and dispatch a TAB key event to trigger existing functionality
    const keydownEvent = new KeyboardEvent('keydown', {
        key: 'H',
        bubbles: true,
        cancelable: true
    });
    
    // Dispatch to document to trigger the existing TAB key handler
    document.dispatchEvent(keydownEvent);
});
              
                // Central lumen checkbox - just show/hide diameter controls
                document.getElementById('central-lumen-checkbox').addEventListener('change', (e) => {
                  autoExitPrintMode();
                   
                    
                    const innerDiameterGroup = document.getElementById('inner-diameter-group');
                    if (this.currentSystem instanceof PieSliceSystem) {
                    innerDiameterGroup.style.display = e.target.checked ? 'flex' : 'none';
                      this.updateHoleCountConstraints();
        
        // NEW: Validate current hole count against new constraints
        const holeCountInput = document.getElementById('hole-count');
        const currentCount = parseInt(holeCountInput.value);
        const maxCount = parseInt(holeCountInput.max);
        
        if (currentCount > maxCount) {
            holeCountInput.value = maxCount;
            
            // Show brief feedback to user
            const info = document.createElement('div');
            info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:8px;border-radius:3px;z-index:1000;font-family:Arial;font-size:12px;';
            info.textContent = `Hole count reduced to ${maxCount} (maximum for ${e.target.checked ? 'pie slice with central hole' : 'pie slice without central hole'})`;
            document.body.appendChild(info);
            setTimeout(() => info.remove(), 3000);
        }
                    } else {
        // For circular holes, always keep it hidden
        innerDiameterGroup.style.display = 'none';
    }
         this.applyHoleChanges();           
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
    if (this.currentSystem instanceof PieSliceSystem && this.currentSystem.hasCentralHole) {
        // Existing pie slice logic with validation...
        const originalDiameter = this.currentSystem.innerDiameter;
        
        this.currentSystem.innerDiameter = newDiameter;
        const collapseCheck = this.currentSystem.detectSliceCollapse();
        
        if (collapseCheck.collapsed) {
            this.currentSystem.innerDiameter = originalDiameter;
            innerDiameterSlider.value = originalDiameter.toFixed(3);
            innerDiameterInput.value = originalDiameter.toFixed(3);
            
            console.warn(`Inner diameter limited to ${originalDiameter.toFixed(3)}${unit}: ${collapseCheck.reason}`);
            return;
        }
        
        innerDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.updateGeometry();
    }
});

innerDiameterInput.addEventListener('input', (e) => {
    const newDiameter = parseFloat(e.target.value);
    const unit = $("#unit").val();
   autoExitPrintMode();
    if (!isNaN(newDiameter)) {
        if (this.currentSystem instanceof PieSliceSystem && this.currentSystem.hasCentralHole) {
            // Existing pie slice logic with validation...
            const originalDiameter = this.currentSystem.innerDiameter;
            
            this.currentSystem.innerDiameter = newDiameter;
            const collapseCheck = this.currentSystem.detectSliceCollapse();
            
            if (collapseCheck.collapsed) {
                this.currentSystem.innerDiameter = originalDiameter;
                innerDiameterSlider.value = originalDiameter.toFixed(3);
                e.target.value = originalDiameter.toFixed(3);
                
                console.warn(`Inner diameter limited to ${originalDiameter.toFixed(3)}${unit}: ${collapseCheck.reason}`);
                return;
            }
            
            innerDiameterSlider.value = newDiameter;
            this.currentSystem.updateGeometry();
        }
    }
});

$("#len-range").on('input', function() {
  $("#length-2").val(this.value);
});              
$("#length-2").on('change', function() {
$("#len-range").val(this.value);

var step = 'Length changed to: ' + this.value;
updateJourney(step);
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
        this.currentSystem.minimumSeptum = getMinimumWallThickness(newDiameter, $("#unit").val());
        cylinderDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.cylinderRadius = newDiameter / 2;
        this.currentSystem.updateCylinderDiameterConstraints();
        this.currentSystem.createCylinder();
        this.currentSystem.updateHoleDiameterLimits();
    } else if (this.currentSystem instanceof PieSliceSystem) {
        const newRadius = newDiameter / 2;
        const originalRadius = this.currentSystem.cylinderRadius;
        
        // Temporarily set the new radius to test for collapse
        this.currentSystem.cylinderRadius = newRadius;
        const collapseCheck = this.currentSystem.detectSliceCollapse();
        
        if (collapseCheck.collapsed) {
            // Revert to original radius and show warning
            this.currentSystem.cylinderRadius = originalRadius;
            cylinderDiameterSlider.value = (originalRadius * 2).toFixed(3);
            cylinderDiameterInput.value = (originalRadius * 2).toFixed(3);
            
            // Show user-friendly warning
            const unit = $("#unit").val();
            this.showPieSliceConstraintWarning(`Cannot reduce outer diameter further: ${collapseCheck.reason}`, newDiameter, unit);
            return;
        }
        
        // If no collapse, apply the change
        cylinderDiameterInput.value = newDiameter.toFixed(3);
        this.currentSystem.cylinderRadius = newRadius;
        
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
                
                this.currentSystem.showParameterWarning(`Septum thickness increased to ${newMinSeptum.toFixed(3)}${unit} minimum`);
            }
        }
        
        this.currentSystem.updateCircularDiameterLimits();
        this.currentSystem.updateCylinderGeometry();
        
    } else if (this.currentSystem instanceof SmileSystem) {
        this.currentSystem.minimumSeptum = getMinimumWallThickness(newDiameter, $("#unit").val());
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
    const unit = $("#unit").val();
    if (!isNaN(newDiameter)) {
        if (this.currentSystem instanceof CircularHolesSystem) {
            // Handle circular holes system
            cylinderDiameterSlider.value = newDiameter;
            this.currentSystem.cylinderRadius = newDiameter / 2;
            this.currentSystem.updateCylinderDiameterConstraints();
            this.currentSystem.createCylinder();
            this.currentSystem.updateHoleDiameterLimits();
        } else if (this.currentSystem instanceof PieSliceSystem) {
           const newRadius = newDiameter / 2;
            const originalRadius = this.currentSystem.cylinderRadius;
            
            // Temporarily set the new radius to test for collapse
            this.currentSystem.cylinderRadius = newRadius;
            const collapseCheck = this.currentSystem.detectSliceCollapse();
            
            if (collapseCheck.collapsed) {
                // Revert to original radius and show warning
                this.currentSystem.cylinderRadius = originalRadius;
                cylinderDiameterSlider.value = (originalRadius * 2).toFixed(3);
                e.target.value = (originalRadius * 2).toFixed(3);
                
                this.showPieSliceConstraintWarning(`Cannot reduce outer diameter further: ${collapseCheck.reason}`, newDiameter, unit);
                return;
            }
            
            // If no collapse, apply the change
            cylinderDiameterSlider.value = newDiameter;
            this.currentSystem.cylinderRadius = newRadius;
            
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
                    
                    this.currentSystem.showParameterWarning(`Septum thickness increased to ${newMinSeptum.toFixed(3)}${unit} minimum`);
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
    autoExitPrintMode();
    if (this.currentSystem instanceof PieSliceSystem) {
        const value = parseInt(e.target.value);
        const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
        const hasCentralHole = centralLumenCheckbox.checked;
        
        // NEW: Dynamic minimum and maximum based on central hole setting
        const minCount = hasCentralHole ? 3 : 2; // With central hole: min 3 (1 central + 2 slices), without: min 2 slices
        const maxCount = hasCentralHole ? 9 : 8; // With central hole: max 9 (1 central + 8 slices), without: max 8 slices
        
        if (value < minCount) {
            e.target.value = minCount;
            
            // Show brief feedback
            const info = document.createElement('div');
            info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:8px;border-radius:3px;z-index:1000;font-family:Arial;font-size:12px;';
            info.textContent = `Minimum ${minCount} holes for pie slice profile ${hasCentralHole ? '(with central hole)' : '(without central hole)'}`;
            document.body.appendChild(info);
            setTimeout(() => info.remove(), 2000);
        } else if (value > maxCount) {
            e.target.value = maxCount;
            
            // Show brief feedback
            const info = document.createElement('div');
            info.style.cssText = 'position:fixed;top:10px;right:10px;background:#FF9800;color:white;padding:8px;border-radius:3px;z-index:1000;font-family:Arial;font-size:12px;';
            info.textContent = `Maximum ${maxCount} holes for pie slice profile ${hasCentralHole ? '(with central hole - 8 slices max)' : '(without central hole - 8 slices max)'}`;
            document.body.appendChild(info);
            setTimeout(() => info.remove(), 2000);
        }
    }
  this.applyHoleChanges();
});          
                // Hole count and apply


              
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
    
    clearEmptySliceHighlight();
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
    document.getElementById('crescent-controls').style.display = 'none';
    document.getElementById('smile-profile-btn').classList.remove('active');
    document.getElementById('smile-controls').style.display = 'none';
    document.getElementById('smile-hole-controls').style.display = 'none';
    document.getElementById('center-hole-container').classList.remove('locked');
    setTimeout(() => {
        
            this.currentSystem.setupGlobalDistanceListeners();
        
    }, 200);
    const globalDistanceGroup = document.getElementById('global-distance-group');
    if (globalDistanceGroup) {
        globalDistanceGroup.style.display = 'flex';
    }
    // NEW: Reset UI controls to defaults
             
    this.resetUIControls();
    this.updateHoleCountConstraints();
    ensureControlsVisible();
    $("#lumen-counter").removeClass('locked');
    setTimeout(() => {
        checkAndUpdateHoleDistribution();
    }, 500);
}
            
            showPieSlice() {
    
    clearEmptySliceHighlight();
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
    document.getElementById('center-hole-container').classList.add('locked'); 
    const globalDistanceGroup = document.getElementById('global-distance-group');
    if (globalDistanceGroup) {
        globalDistanceGroup.style.display = 'none';
    }
    // NEW: Reset UI controls to defaults
    this.resetUIControls();
    this.updateHoleCountConstraints();
    ensureControlsVisible();
    $("#cylinder-diameter, #cylinder-diameter-input").attr("min", 0.079).trigger("change");
    $("#lumen-counter").removeClass('locked');
    
}
          showCrescent() {
    
    clearEmptySliceHighlight();
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
    document.getElementById('center-hole-container').classList.remove('locked');   
    const globalDistanceGroup = document.getElementById('global-distance-group');
    if (globalDistanceGroup) {
        globalDistanceGroup.style.display = 'none';
    }
    // Reset UI controls to defaults but sync with crescent system
    this.resetUIControls();
    this.syncUIWithCurrentSystem();
    
    this.updateHoleCountConstraints();
    ensureControlsVisible();
    $("#cylinder-diameter, #cylinder-diameter-input").attr("min", 0.079).trigger("change");
    $("#lumen-counter").addClass('locked');
    
}
        }
function autoExitPrintMode() {
    if (isCapturingThumbnail) {
        console.log('🚫 Auto-exit print mode blocked during thumbnail capture');
        return;
    }
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
function getDimensionSpacing(unit) {
    const baseValues = getBaseValues(unit);
    return {
        // Base spacing relative to cylinder radius
        extensionDistance: baseValues.cylinderRadius * 0.4,      // Distance from cylinder edge to label
        lineOffset: baseValues.cylinderRadius * 0.3,            // Distance from cylinder edge to dimension line start
        tickLength: baseValues.cylinderRadius * 0.05,           // Length of tick marks
        labelOffset: baseValues.cylinderRadius * 0.08,          // Additional offset for labels
        crossLength: baseValues.cylinderRadius * 0.06,          // Length of cross marks on holes
        axisLength: baseValues.cylinderRadius * 0.25,           // Length of axis lines
        separationLineOffset: baseValues.cylinderRadius * 0.02  // Offset for separation dimension lines
    };
}
function createOuterDiameterDimension(system, z, centralHole = null) {
    const unit = $("#unit").val();
    const outerRadius = system.cylinderRadius;
    const spacing = getDimensionSpacing(unit);
    
    // Find the best position to avoid conflicts with existing dimensions
    const bestAngle = findBestAngleForOuterDimension(system);
    
    const startX = Math.cos(bestAngle) * outerRadius;
    const startY = Math.sin(bestAngle) * outerRadius;
    const extensionDistance = outerRadius + spacing.extensionDistance;
    const endX = Math.cos(bestAngle) * extensionDistance;
    const endY = Math.sin(bestAngle) * extensionDistance;
    
    // Create dimension line from cylinder edge to label
    const dimLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(startX, startY, z),
        new THREE.Vector3(endX, endY, z)
    ]);
    const dimLineMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
    const dimLine = new THREE.Line(dimLineGeometry, dimLineMaterial);
    
    globalScene.add(dimLine);
    system.dimensionLines.push(dimLine);
    
    
    
    // Create dimension label
    const outerDiameter = (outerRadius * 2).toFixed(3);
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
  // Create the label content
    let labelContent = `<div><strong>Outer Diameter</strong></div><div>⌀ ${outerDiameter}${unit}</div>`;
    
    // Add central lumen info if present
    if (centralHole) {
        const centralDiameter = (centralHole.radius * 2).toFixed(3);
        labelContent += `<div><strong>Central Lumen</strong></div><div>⌀ ${centralDiameter}${unit}</div>`;
    }
    labelDiv.innerHTML = labelContent;
    
    const css2dLabel = new CSS2DObject(labelDiv);
    css2dLabel.position.set(endX + spacing.labelOffset, endY + spacing.labelOffset, z);
    
    globalScene.add(css2dLabel);
    system.dimensionLabels.push(css2dLabel);
}

// Function to find the best angle for outer diameter dimension to avoid conflicts
function findBestAngleForOuterDimension(system) {
    // Define candidate angles (in radians) - 8 positions around the circle
    const candidateAngles = [
        0,              // Right (0°)
        Math.PI / 4,    // Top-right (45°)
        Math.PI / 2,    // Top (90°)
        3 * Math.PI / 4, // Top-left (135°)
        Math.PI,        // Left (180°)
        5 * Math.PI / 4, // Bottom-left (225°)
        3 * Math.PI / 2, // Bottom (270°)
        7 * Math.PI / 4  // Bottom-right (315°)
    ];
    
    // Get occupied angles based on system type
    const occupiedAngles = getOccupiedAngles(system);
    
    // Score each candidate angle (higher score = better position)
    let bestAngle = candidateAngles[0];
    let bestScore = -1;
    
    candidateAngles.forEach(angle => {
        const score = scoreAnglePosition(angle, occupiedAngles);
        if (score > bestScore) {
            bestScore = score;
            bestAngle = angle;
        }
    });
    
    return bestAngle;
}

// Get angles that are occupied by existing dimensions based on system type
function getOccupiedAngles(system) {
    const occupiedAngles = [];
    
    if (system instanceof CircularHolesSystem) {
        const peripheralHoles = system.holes.filter(hole => hole.distance > 0);
        const isUniform = system.arePeripheralHolesUniform();
        
        if (isUniform && peripheralHoles.length >= 2) {
            // For uniform holes, we have specific dimension patterns
            
            // 1. Arc dimension between holes 1 and 2
            const hole1Angle = Math.atan2(peripheralHoles[0].y, peripheralHoles[0].x);
            const hole2Angle = Math.atan2(peripheralHoles[1].y, peripheralHoles[1].x);
            
            // Add both hole angles
            occupiedAngles.push(normalizeAngle(hole1Angle));
            occupiedAngles.push(normalizeAngle(hole2Angle));
            
            // Add the arc midpoint angle (where the arc label is placed)
            let arcMidAngle;
            if (Math.abs(hole2Angle - hole1Angle) > Math.PI) {
                const adjustedHole2Angle = hole2Angle > hole1Angle ? hole2Angle - 2 * Math.PI : hole2Angle + 2 * Math.PI;
                arcMidAngle = (hole1Angle + adjustedHole2Angle) / 2;
            } else {
                arcMidAngle = (hole1Angle + hole2Angle) / 2;
            }
            occupiedAngles.push(normalizeAngle(arcMidAngle));
            
            // 2. Linear spacing dimension
            let spacingHole1, spacingHole2;
            if (peripheralHoles.length === 2) {
                // Only 2 holes: spacing is between holes 1 and 2
                spacingHole1 = peripheralHoles[0];
                spacingHole2 = peripheralHoles[1];
            } else {
                // 3+ holes: spacing is between holes 2 and 3
                spacingHole1 = peripheralHoles[1];
                spacingHole2 = peripheralHoles[2];
            }
            
            const spacingAngle1 = Math.atan2(spacingHole1.y, spacingHole1.x);
            const spacingAngle2 = Math.atan2(spacingHole2.y, spacingHole2.x);
            const spacingMidAngle = (spacingAngle1 + spacingAngle2) / 2;
            
            occupiedAngles.push(normalizeAngle(spacingAngle1));
            occupiedAngles.push(normalizeAngle(spacingAngle2));
            occupiedAngles.push(normalizeAngle(spacingMidAngle));
            
            // 3. Individual hole dimension (only for first hole when uniform)
            // This extends radially outward from the first hole
            occupiedAngles.push(normalizeAngle(hole1Angle));
            
        } else {
            // For non-uniform holes, add angles for each hole (each has individual dimensions)
            peripheralHoles.forEach(hole => {
                const angle = Math.atan2(hole.y, hole.x);
                occupiedAngles.push(normalizeAngle(angle));
                
                // For non-uniform, also consider spacing dimensions between adjacent holes
                // These extend perpendicular to the hole-to-hole line, so add some buffer angles
                const bufferAngle1 = normalizeAngle(angle + Math.PI / 6); // +30 degrees
                const bufferAngle2 = normalizeAngle(angle - Math.PI / 6); // -30 degrees
                occupiedAngles.push(bufferAngle1);
                occupiedAngles.push(bufferAngle2);
            });
        }
        
        // Always avoid the center area if there's a central lumen
        const centralHole = system.holes.find(hole => hole.distance === 0);
        if (centralHole) {
            // Add buffer angles around common label positions for central lumen
            occupiedAngles.push(0); // Right
            occupiedAngles.push(Math.PI / 2); // Top
            occupiedAngles.push(Math.PI); // Left
            occupiedAngles.push(3 * Math.PI / 2); // Bottom
        }
        
    } else if (system instanceof PieSliceSystem) {
        // For pie slices, avoid the areas where slice dimension lines extend
        // Add angles at regular intervals based on slice count
        const angleStep = (2 * Math.PI) / system.sliceCount;
        for (let i = 0; i < system.sliceCount; i++) {
            const angle = i * angleStep;
            occupiedAngles.push(normalizeAngle(angle));
            occupiedAngles.push(normalizeAngle(angle + angleStep / 2)); // Middle of slice
        }
        
    } else if (system instanceof CrescentSystem) {
        // For crescent, avoid the top where circular lumen might have dimensions
        // and avoid areas where crescent extends
        occupiedAngles.push(Math.PI / 2); // Top (90°)
        occupiedAngles.push(0); // Right (0°)
        occupiedAngles.push(Math.PI); // Left (180°)
        occupiedAngles.push(Math.PI * 1.5); //Bottom (270°)
        
    } else if (system instanceof SmileSystem) {
        // For smile, avoid bottom where semicircle is, and hole positions
        occupiedAngles.push(3 * Math.PI / 2); // Bottom (270°)
        occupiedAngles.push(5 * Math.PI / 4); // Bottom-left (225°)
        occupiedAngles.push(7 * Math.PI / 4); // Bottom-right (315°)
        
        // Add angles for each circular hole
        if (system.holes) {
            system.holes.forEach(hole => {
                const angle = Math.atan2(hole.y, hole.x);
                occupiedAngles.push(normalizeAngle(angle));
            });
        }
    }
    
    return occupiedAngles;
}

// Score an angle position (higher = better)
function scoreAnglePosition(candidateAngle, occupiedAngles) {
    let score = 100; // Base score
    
    // Prefer certain positions
    if (candidateAngle === 0 || candidateAngle === Math.PI / 2) {
        score += 20; // Prefer right or top
    }
    
    // Penalize positions near occupied angles
    occupiedAngles.forEach(occupiedAngle => {
        const angleDiff = Math.min(
            Math.abs(candidateAngle - occupiedAngle),
            2 * Math.PI - Math.abs(candidateAngle - occupiedAngle)
        );
        
        if (angleDiff < Math.PI / 6) { // Within 30 degrees
            score -= 50;
        } else if (angleDiff < Math.PI / 4) { // Within 45 degrees
            score -= 25;
        } else if (angleDiff < Math.PI / 3) { // Within 60 degrees
            score -= 10;
        }
    });
    
    return score;
}

// Normalize angle to 0-2π range
function normalizeAngle(angle) {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
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

$('#central-hole-dialog').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#global-distance-input",
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
  $('#crescent-height-warning').dialog({
    autoOpen : false, position: { 
    my: "left+10 top", 
    at: "right top",
    of: "#circular-radius-input",
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
  if (['Pebax 72D','Pebax 63D', 'Pebax 55D','Pebax 45D','Vestamid ML21', 'Pellethane 55D', 'Pellethane 65D'].includes($("#material-2").val())) {
    return true;
  }
  else {
    return false;
  }
}

function checkOD() {
  const unit = $("#unit").val() || 'in';
  if(Number($("#cylinder-diameter-input").val()) >=  getBaseValues(unit).minCylinderDiameter && Number($("#cylinder-diameter-input").val()) <=  getBaseValues(unit).maxGreenCylinderDiameter ) {
    return true;
  } else {
    return false;
  }
    
}

function checkLength() {
  const unit = $("#unit").val() || 'in';
  if(Number($("#length-2").val()) >= getBaseValues(unit).minGreenlightLength && Number($("#length-2").val()) <= getBaseValues(unit).maxGreenlightLength) {
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

function checkAndPromptCentralHole() {
  
  if(window.profileManager.currentSystem instanceof CircularHolesSystem) {
    const system = window.profileManager.currentSystem;
    
    // Skip if we already have a central hole or if we're at maximum holes
    if (system.includeCentralLumen || system.holes.length >= 9) {
      return;
    }
    
    // Get peripheral holes (distance > 0)
    const peripheralHoles = system.holes.filter(hole => hole.distance > 0);
    
    if (peripheralHoles.length === 0) {
      return; // No peripheral holes to analyze
    }
    
    // Check the condition: hole distance >= 2 * (outer radius - hole distance)
    const outerRadius = system.cylinderRadius;
    let needsCentralHole = false;
    
    peripheralHoles.forEach(hole => {
      const holeDistance = hole.distance;
      const wallThickness = outerRadius - holeDistance - hole.radius;
      
      if (holeDistance - hole.radius >= 2 * wallThickness) {
        needsCentralHole = true;
      }
    });
   const errorId = 'central-lumen-needed';
    if (needsCentralHole) {
      addError(
            'central-lumen-needed',
            'Too much surface area in the middle, add a central lumen to qualify for an instant quote.',
            'Click to Add Central Lumen',
        {
        text: 'Add Central Lumen',
        onClick: (errorId) => {
            // Your function to add central lumen
            addCentralHoleAutomatically();
            removeError(errorId);
        }
    }
        );
      // Configure and open dialog
      // $("#central-hole-dialog").dialog({
      //   modal: true,
      //   width: 400,
      //   height: 250,
      //   resizable: false,
      //   buttons: {
      //     'Add Central Hole': function() {
      //       addCentralHoleAutomatically();
      //       $(this).dialog("close");
      //     },
      //     'Keep Current Design': function() {
      //       console.log('User chose to keep design without central hole');
      //       $(this).dialog("close");
      //     }
      //   }
      // });
      
      // Actually open the dialog
      // $("#central-hole-dialog").dialog("open");
    } else {
      removeError(errorId);
      // $("#central-hole-dialog").dialog("close");
    }
  }
}

// 3. Function to actually add the central hole (extracted from original)
function addCentralHoleAutomatically() {
  if(window.profileManager.currentSystem instanceof CircularHolesSystem) {
    const system = window.profileManager.currentSystem;
    
    // Get peripheral holes
    const peripheralHoles = system.holes.filter(hole => hole.distance > 0);
    
    if (peripheralHoles.length === 0) {
      return;
    }
    
    // Calculate the central hole size
    const outerRadius = system.cylinderRadius;
    const representativeHole = peripheralHoles[0];
    const wallThickness = outerRadius - representativeHole.distance;
    const centralHoleRadius = representativeHole.distance - wallThickness;
    
    // Ensure the central hole is reasonable sized
    const unit = $("#unit").val() || 'in';
    const minCentralRadius = getBaseValues(unit).minimumHoleRadius * 2;
    const maxCentralRadius = representativeHole.distance * 0.8;
    
    const finalCentralRadius = Math.max(minCentralRadius, Math.min(centralHoleRadius, maxCentralRadius));
    
    // Update the system flags
    system.includeCentralLumen = true;
    system.centralLumenRadius = finalCentralRadius;
    
    // Create the central lumen hole and insert it at the beginning of the holes array
    const centralHole = {
      x: 0,
      y: 0,
      angle: 0,
      distance: 0,
      radius: finalCentralRadius,
      color: system.holeColors[0],
      name: 'Central Lumen'
    };
    
    // Insert central hole at the beginning
    system.holes.unshift(centralHole);
    
    // Update colors and names for existing peripheral holes (they got shifted by 1)
    for (let i = 1; i < system.holes.length; i++) {
      const hole = system.holes[i];
      hole.color = system.holeColors[i];
      // Keep the existing names if they were already set
      if (!hole.name || hole.name.includes('Lumen')) {
        const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
        hole.name = `${colors[i]} Lumen`;
      }
    }
    
    // Update the UI checkbox
    const centralLumenCheckbox = document.getElementById('central-lumen-checkbox');
    if (centralLumenCheckbox) {
      centralLumenCheckbox.checked = true;
    }
    
    // Update hole count in UI
    const holeCountInput = document.getElementById('hole-count');
    if (holeCountInput) {
      holeCountInput.value = system.holes.length;
    }
    
    // Update the 3D geometry and UI
    system.createCylinder();
    system.createHoleMarkers();
    system.createHoleUI();
    system.updateCylinderDiameterConstraints();
    
    // Update inner diameter controls
    const innerDiameterSlider = document.getElementById('inner-diameter');
    const innerDiameterInput = document.getElementById('inner-diameter-input');
    const centralDiameter = finalCentralRadius * 2;
    
    if (innerDiameterSlider) innerDiameterSlider.value = centralDiameter.toFixed(3);
    if (innerDiameterInput) innerDiameterInput.value = centralDiameter.toFixed(3);
    
    // Show success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #4CAF50;
      color: white;
      padding: 12px;
      border-radius: 5px;
      z-index: 1000;
      font-family: Arial;
      font-size: 13px;
      max-width: 300px;
      line-height: 1.4;
    `;
    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">Central Hole Added</div>
      <div>Central lumen added for optimal wall thickness.</div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
    
    console.log(`Central hole added with radius: ${finalCentralRadius.toFixed(3)} ${unit}`);
    
    // Recalculate after adding the hole
    calculate();
  }
}
function debouncedCheckCentralHoleCompliance() {
    clearTimeout(validationTimeout);
    validationTimeout = setTimeout(() => {
        return checkCentralHoleCompliance();
    }, 100); // Wait 100ms after the last call
}
// 4. Function to check if central hole is needed but missing (for calculate function)
function checkCentralHoleCompliance() {

  if(window.profileManager.currentSystem instanceof CircularHolesSystem) {
    const system = window.profileManager.currentSystem;
    
    // Get peripheral holes
    const peripheralHoles = system.holes.filter(hole => hole.distance > 0);
    
    if (peripheralHoles.length === 0) {
      return true; // No holes to check
    }
    
    // Check if central hole is needed
    const outerRadius = system.cylinderRadius;
    let needsCentralHole = false;
    
    peripheralHoles.forEach(hole => {
      const holeDistance = hole.distance;
      const wallThickness = outerRadius - holeDistance - hole.radius;
      
      if (holeDistance - hole.radius >= 2 * wallThickness) {
        needsCentralHole = true;
      }
    });
    
    // If no central hole is needed, return true
    if (!needsCentralHole) {
      removeError('central-lumen-needed');
      return true;
    }
    
    // If central hole is needed but doesn't exist, return false
    
    if (!system.includeCentralLumen) {
            
      return false;
    }
    
    // Central hole exists and is needed - now check the distance relationship
    const centralHole = system.holes.find(hole => hole.distance === 0);
    if (!centralHole) {
      return false; // This shouldn't happen if includeCentralLumen is true
    }
    
    // For each peripheral hole, check the distance constraint
      
      const peripheralDistance = peripheralHoles[0].distance;
      const centralRadius = centralHole.radius;
      
      // Distance from outside of central hole to center of peripheral holes
      const innerToPeripheralDistance = peripheralDistance - centralRadius;
      
      // Distance from center of peripheral holes to outer diameter
      const peripheralToOuterDistance = outerRadius - peripheralDistance;
      
      // Check if inner-to-peripheral distance is NOT larger than peripheral-to-outer distance
      if (innerToPeripheralDistance > peripheralToOuterDistance) {
        addError(
            'central-lumen-size',
            'Central lumen needs to be larger for a more even septum thickness in order to qualify for an instant quote',
            'Increase central lumen diameter.'
        );
        return false; // Constraint violated
      }
    removeError('central-lumen-size');
    removeError('central-lumen-needed');
    return true; // All constraints satisfied
    
  } else {
    return true; // For non-circular systems, always return true
  }
}
function checkSurfaceArea() {
    const system = window.profileManager.currentSystem;
    
    if (!system) return false;
    
    // Calculate outer diameter surface area (circle area = π * r²)
    const outerRadius = system.cylinderRadius;
    const outerSurfaceArea = Math.PI * outerRadius * outerRadius;
    
    // Calculate combined surface areas based on profile type
    let combinedHoleSurfaceArea = 0;
    
    if (system instanceof CircularHolesSystem) {
        // Circular holes - sum all hole areas
        system.holes.forEach(hole => {
            const holeArea = Math.PI * hole.radius * hole.radius;
            combinedHoleSurfaceArea += holeArea;
        });
        
    } else if (system instanceof SmileSystem) {
        // Smile profile - semicircle + circular holes
        // Semicircle area = (π * r²) / 2
        const semicircleArea = (Math.PI * system.semicircleRadius * system.semicircleRadius) / 2;
        combinedHoleSurfaceArea += semicircleArea;
        
        // Add circular holes
        system.holes.forEach(hole => {
            const holeArea = Math.PI * hole.radius * hole.radius;
            combinedHoleSurfaceArea += holeArea;
        });
        
    } else if (system instanceof PieSliceSystem) {
        // Pie slice profile - calculate based on slice geometry
        const effectiveInnerRadius = system.hasCentralHole ? 
            (system.innerDiameter / 2 + system.septumThickness) : 
            system.septumThickness;
        const effectiveOuterRadius = system.cylinderRadius - system.septumThickness;
        
        // Total area available for slices (annulus or full circle)
        let totalSliceArea;
        if (system.hasCentralHole) {
            // Central hole area
            const centralHoleArea = Math.PI * (system.innerDiameter / 2) * (system.innerDiameter / 2);
            combinedHoleSurfaceArea += centralHoleArea;
            
            // Slice areas (annulus minus septums)
            const annulusArea = Math.PI * (effectiveOuterRadius * effectiveOuterRadius - effectiveInnerRadius * effectiveInnerRadius);
            totalSliceArea = annulusArea;
        } else {
            // Full circle minus center and outer septums
            totalSliceArea = Math.PI * (effectiveOuterRadius * effectiveOuterRadius - effectiveInnerRadius * effectiveInnerRadius);
        }
        
        // Calculate actual slice area (total area minus septum areas)
        const totalAngle = system.sliceAngles.reduce((sum, angle) => sum + angle, 0);
        const septumCount = system.sliceCount;
        const septumAngle = (septumCount * system.septumThickness) / effectiveOuterRadius;
        const actualSliceAngle = totalAngle - septumAngle;
        
        const sliceArea = (actualSliceAngle / (Math.PI * 2)) * totalSliceArea;
        combinedHoleSurfaceArea += sliceArea;
        
    } else if (system instanceof CrescentSystem) {
        // Crescent profile - circular lumen + crescent lumen
        
        // Circular lumen area
        const circularArea = Math.PI * (system.circularDiameter / 2) * (system.circularDiameter / 2);
        combinedHoleSurfaceArea += circularArea;
        
        // Crescent area calculation (more complex)
        const geometry = system.calculateIndependentCrescentGeometry();
        const crescentOuterRadius = geometry.crescentOuterRadius || (system.cylinderRadius - system.septumThickness);
        const crescentInnerRadius = geometry.crescentInnerRadius || ((system.circularDiameter / 2) + system.septumThickness);
        
        // Approximate crescent area as difference between two circle segments
        // This is a simplified calculation - for exact area you'd need to calculate the actual crescent shape
        const outerSegmentAngle = geometry.outerLeftAngle - geometry.outerRightAngle;
        const innerSegmentAngle = geometry.innerLeftAngle - geometry.innerRightAngle;
        
        if (outerSegmentAngle && innerSegmentAngle) {
            const outerSegmentArea = (outerSegmentAngle / (2 * Math.PI)) * Math.PI * crescentOuterRadius * crescentOuterRadius;
            const innerSegmentArea = (innerSegmentAngle / (2 * Math.PI)) * Math.PI * crescentInnerRadius * crescentInnerRadius;
            const crescentArea = outerSegmentArea - innerSegmentArea;
            combinedHoleSurfaceArea += Math.abs(crescentArea);
        } else {
            // Fallback: approximate as half the difference between outer and inner circles
            const outerCircleArea = Math.PI * crescentOuterRadius * crescentOuterRadius;
            const innerCircleArea = Math.PI * crescentInnerRadius * crescentInnerRadius;
            const crescentArea = (outerCircleArea - innerCircleArea) * 0.5; // Approximate as half
            combinedHoleSurfaceArea += crescentArea;
        }
    }
    
    // Calculate ratio (outer area / combined hole area)
    if (combinedHoleSurfaceArea === 0) {
        return false; // Avoid division by zero
    }
    
    const ratio = outerSurfaceArea / combinedHoleSurfaceArea;
    
    // Check if ratio is between min and max values
    const minRatio = Number($("#min-ratio").val());
    const maxRatio = Number($("#max-ratio").val());
    $("#ratio-reader").text(ratio.toFixed(3));
    
    return ratio >= maxRatio && ratio <= minRatio;
}

let emptySliceHighlight = null;
function checkAndUpdateHoleDistribution() {
  if(window.profileManager.currentSystem instanceof CircularHolesSystem) {
    const system = window.profileManager.currentSystem;
    
    // Get peripheral holes (excluding central lumen)
    const peripheralHoles = system.holes.filter(hole => hole.distance > 0);
    
    if (peripheralHoles.length === 0) {
      clearEmptySliceHighlight();
      return true; // No peripheral holes to check
    }
    
    if (peripheralHoles.length === 1) {
      clearEmptySliceHighlight();
      return true; // Single hole is always "evenly distributed"
    }
    
    // Sort holes by angle for proper neighbor calculation
    const sortedHoles = [...peripheralHoles].sort((a, b) => a.angle - b.angle);
    
    // Calculate maximum allowed angle between neighbors
    const maxAllowedAngle = 360 / (peripheralHoles.length - 1);
    
    console.log(`Checking distribution: ${peripheralHoles.length} holes, max allowed angle between neighbors: ${maxAllowedAngle}°`);
    
    // Check angle between each pair of neighboring holes
    for (let i = 0; i < sortedHoles.length; i++) {
      const currentHole = sortedHoles[i];
      const nextHole = sortedHoles[(i + 1) % sortedHoles.length]; // Wrap around to first hole
      
      // Calculate angle between current and next hole
      let angleBetween = nextHole.angle - currentHole.angle;
      
      // Handle wraparound case (crossing 360°/0° boundary)
      if (angleBetween < 0) {
        angleBetween += 360;
      }
      
      // If this angle exceeds the maximum allowed, highlight it
      if (angleBetween > maxAllowedAngle) {
        console.log(`Large gap found between holes at ${currentHole.angle}° and ${nextHole.angle}°: ${angleBetween}° (max allowed: ${maxAllowedAngle}°)`);
        highlightAngleBetweenHoles(currentHole.angle, nextHole.angle, system);
        return false; // Found uneven distribution
      }
    }
    
    console.log('All hole gaps within acceptable range - distribution is good');
    clearEmptySliceHighlight(); // Clear highlight if distribution is good
    return true; // All gaps are acceptable
  } else {
    clearEmptySliceHighlight();
    return true; // For non-circular systems, always return true
  }
}
function highlightAngleBetweenHoles(startAngleDeg, endAngleDeg, system) {
  if (!globalScene) return;
  
  // Clear any existing highlight
  clearEmptySliceHighlight();
  
  // Normalize angles to 0-360 range
  startAngleDeg = ((startAngleDeg % 360) + 360) % 360;
  endAngleDeg = ((endAngleDeg % 360) + 360) % 360;
  
  // Calculate the angle span, handling wraparound
  let angleSpan = endAngleDeg - startAngleDeg;
  if (angleSpan <= 0) {
    angleSpan += 360;
  }
  
  // Convert to radians
  const startAngleRad = startAngleDeg * Math.PI / 180;
  const angleSpanRad = angleSpan * Math.PI / 180;
  
  // Create a sector geometry to highlight the gap between holes
  const innerRadius = system.cylinderRadius * 0.3; // Start from 30% of radius to avoid center
  const outerRadius = system.cylinderRadius * 1.1; // Extend slightly beyond cylinder
  
  const geometry = new THREE.RingGeometry(
    innerRadius, 
    outerRadius, 
    32, // radial segments
    1, // theta segments
    startAngleRad, // theta start
    angleSpanRad // theta length
  );
  
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xff4444, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  
  emptySliceHighlight = new THREE.Mesh(geometry, material);
  emptySliceHighlight.position.set(0, 0, system.cylinderHeight / 2 + 0.001); // Slightly above the cylinder
  emptySliceHighlight.userData = { type: 'emptySliceHighlight' };
  
  globalScene.add(emptySliceHighlight);
  
  // Show notification to user
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff4444;
    color: white;
    padding: 12px;
    border-radius: 5px;
    z-index: 1000;
    font-family: Arial;
    font-size: 13px;
    max-width: 350px;
    line-height: 1.4;
  `;
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">Uneven Hole Distribution</div>
    <div>The highlighted area shows a gap that's too large between holes (${angleSpan.toFixed(1)}°). For an automatic quote, holes should be more evenly distributed around the cylinder.</div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
  
  console.log(`Highlighted gap from ${startAngleDeg}° to ${endAngleDeg}° (span: ${angleSpan.toFixed(1)}°)`);
}

function checkHoleDistribution() {
  return checkAndUpdateHoleDistribution();
}
function angleWithinSlice(angle, sliceStart, sliceEnd) {
  // Normalize angles to 0-360 range
  angle = ((angle % 360) + 360) % 360;
  sliceStart = ((sliceStart % 360) + 360) % 360;
  sliceEnd = ((sliceEnd % 360) + 360) % 360;
  
  // Handle wraparound case (slice crosses 360/0 boundary)
  if (sliceStart > sliceEnd) {
    // Slice wraps around 360/0 boundary
    return (angle >= sliceStart && angle <= 360) || (angle >= 0 && angle <= sliceEnd);
  } else {
    // Normal case - slice doesn't wrap around
    return angle >= sliceStart && angle <= sliceEnd;
  }
}
// Helper function to check if two angular ranges overlap


// Function to highlight an empty slice
function highlightEmptySlice(startAngleDeg, endAngleDeg, system) {
  if (!globalScene) return;
  
  // Clear any existing highlight
  clearEmptySliceHighlight();
  
  // Convert to radians
  const startAngleRad = startAngleDeg * Math.PI / 180;
  const endAngleRad = endAngleDeg * Math.PI / 180;
  
  // Create a sector geometry to highlight the empty slice
  const innerRadius = 0; // Start from center
  const outerRadius = system.cylinderRadius; // Slightly larger than cylinder
  if(endAngleRad - startAngleRad > 0) {
  var thetaLength = endAngleRad - startAngleRad;
  } else {
  var thetaLength = endAngleRad - startAngleRad + Math.PI * 2;
  }
  
  const geometry = new THREE.RingGeometry(
    innerRadius, 
    outerRadius, 
    32, // radial segments
    1, // theta segments
    startAngleRad, // theta start
    thetaLength // theta length
  );
  
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xff4444, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  
  emptySliceHighlight = new THREE.Mesh(geometry, material);
  emptySliceHighlight.position.set(0, 0, system.cylinderHeight / 2 + 0.001); // Slightly above the cylinder
  emptySliceHighlight.userData = { type: 'emptySliceHighlight' };
  
  globalScene.add(emptySliceHighlight);
  
  // Show notification to user
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff4444;
    color: white;
    padding: 12px;
    border-radius: 5px;
    z-index: 1000;
    font-family: Arial;
    font-size: 13px;
    max-width: 350px;
    line-height: 1.4;
  `;
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">Uneven Hole Distribution</div>
    <div>The highlighted area has no holes. For an automatic quote, holes should be evenly distributed around the cylinder.</div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
  
  console.log(`Highlighted empty slice from ${startAngleDeg}° to ${endAngleDeg}°`);
}

// Function to clear the empty slice highlight
function clearEmptySliceHighlight() {
  if (emptySliceHighlight && globalScene) {
    globalScene.remove(emptySliceHighlight);
    if (emptySliceHighlight.geometry) emptySliceHighlight.geometry.dispose();
    if (emptySliceHighlight.material) emptySliceHighlight.material.dispose();
    emptySliceHighlight = null;
  }
}

function calculate() {
  console.log ('material: '+ checkMaterial() +'OD: ' + checkOD() + 'Length: ' + checkLength() + 'QTY: ' + checkQuantity() + 'Surface Area: ' + checkSurfaceArea() +'Central Hole' + checkCentralHoleCompliance() + 'Distribution: '+ checkHoleDistribution())
  if (checkMaterial() && checkOD() && checkLength() && checkQuantity() && checkSurfaceArea() && checkCentralHoleCompliance() && checkHoleDistribution()) {
    
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
function getCircularProfileData(lineItem) {
    const system = window.profileManager.currentSystem;
    const holes = system.holes || [];
    
    // Get global distance from the first peripheral hole
    let globalDistance = 'N/A';
    const peripheralHole = holes.find(hole => hole.distance > 0);
    if (peripheralHole) {
        globalDistance = peripheralHole.distance.toFixed(3);
    }
    
    let holeTML = '';
    
    // Add individual holes only (no global distance here)
    for(let i = 0; i < holes.length; i++){
        const hole = holes[i];
        const holeNum = i + 1;
        const diameter = (hole.radius * 2).toFixed(3);
        const angle = Math.round(hole.angle);
        
        if (hole.name === 'Central Lumen') {
            holeTML += `<div class="hole-layout">
                <p class="label quarter">${hole.name}</p>
                <input id="l${lineItem}-central-diameter" class="quote-input quarter" value="${diameter}" readonly></input>
                <div class="quarter ml-20 no-height"></div>
                <div class="quarter ml-20 no-height"></div>
            </div>`;
        } else {
            holeTML += `<div class="hole-layout">
                <p class="label quarter">${hole.name}</p>
                <input id="l${lineItem}-${hole.name}-diameter" class="quote-input quarter" value="${diameter}" readonly></input>
                <input id="l${lineItem}-${hole.name}-angle" class="quote-input quarter" value="${angle}" readonly></input>
                <div class="quarter ml-20 no-height"></div>
            </div>`;
        }
    }
    
    // Add global distance as additional parameter only if there are peripheral holes
    const additionalParams = [];
    if (peripheralHole) {
        additionalParams.push({ label: 'Global Distance', value: globalDistance });
    }
    
    return {
        profileName: 'Circular Holes Profile',
        profileId: 1,
        holesHeader: `<div class="hole-layout">
            <p class="label quarter">Lumen</p>
            <p class="label quarter ml-20">Diameter</p>
            <p class="label quarter ml-20">Angle</p>
            <p class="label quarter ml-20"></p>
        </div>`,
        holeTML: holeTML,
        additionalParams: additionalParams
    };
}

function getPieSliceProfileData(lineItem) {
    const system = window.profileManager.currentSystem;
    const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
    let slicesTML = '';
    for(let i = 0; i < system.sliceCount; i++){
        const sliceAngle = Math.round(system.sliceAngles[i] * 180 / Math.PI);
        slicesTML += `<div class="hole-layout">
            <p class="label quarter">${colors[i]} Lumen</p>
            <input id="l${lineItem}-${colors[i]}-angle" class="quote-input quarter" value="${sliceAngle}°" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>`;
    }
    
    // Add central hole if present
    if (system.hasCentralHole) {
        const centralDiameter = (system.innerDiameter).toFixed(3);
        slicesTML += `<div class="hole-layout">
            <p class="label quarter">Central Hole</p>
            <input id="l${lineItem}-central-diameter" class="quote-input quarter" value="${centralDiameter}" readonly></input>
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

function getCrescentProfileData(lineItem) {
    const system = window.profileManager.currentSystem;
    const circularDiameter = system.circularDiameter?.toFixed(3) || '0.050';
    const septumThickness = system.septumThickness?.toFixed(3) || '0.010';
    const cornerRadius = system.crescentCornerRadius?.toFixed(3) || '0.005';
    const wallMode = system.evenWallThickness ? 'Even Wall' : 'Independent Wall';
    
    const holeTML = `
        <div class="hole-layout">
            <p class="label quarter">Circular Lumen</p>
            <input id="l${lineItem}-circular-diameter" class="quote-input quarter" value="${circularDiameter}" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>
        <div class="hole-layout">
            <p class="label quarter">Crescent Lumen</p>
            <input id="l${lineItem}-crescent" class="quote-input quarter" value="Shaped" readonly></input>
            <div class="quarter ml-20 no-height"></div>
            <div class="quarter ml-20 no-height"></div>
        </div>
        <div class="hole-layout">
            <p class="label quarter">Wall Mode</p>
            <input id="l${lineItem}-wall-mode" class="quote-input quarter" value="${wallMode}" readonly></input>
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

function getSmileProfileData(lineItem) {
    const system = window.profileManager.currentSystem;
    const semicircleRadius = system.semicircleRadius?.toFixed(3) || '0.080';
    const cornerRadius = system.cornerRadius?.toFixed(3) || '0.010';
    
    let holeTML = `
        <div class="hole-layout">
            <p class="label quarter">Smile Lumen</p>
            <input id="l${lineItem}-semi-circle" class="quote-input quarter" value="${semicircleRadius}" readonly></input>
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
            <input id="l${lineItem}-${hole.name}-diameter" class="quote-input quarter" value="${diameter}" readonly></input>
            <input id="l${lineItem}-${hole.name}-distance" class="quote-input quarter" value="${distance}" readonly></input>
            <input id="l${lineItem}-${hole.name}-angle" class="quote-input quarter" value="${angle}" readonly></input>
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
function getProfileSpecificData(lineItem) {
    const profileType = getCurrentProfileType();
    
    switch(profileType) {
        case 'circular':
            return getCircularProfileData(lineItem);
        case 'pie-slice':
            return getPieSliceProfileData(lineItem);
        case 'crescent':
            return getCrescentProfileData(lineItem);
        case 'smile':
            return getSmileProfileData(lineItem);
        default:
            return getCircularProfileData(lineItem);
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
    const profileData = getProfileSpecificData(lineItem);
    
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
            additionalParamsHTML += `<div class="item"><p class="label">${param.label}</p><input id="l${lineItem}-${param.label}" class="quote-input" value="${param.value}" readonly></input></div>`;
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
// Global thumbnail capture function that works with all systems
async function captureCurrentSystemThumbnail() {
    try {
        if (!window.profileManager || !window.profileManager.currentSystem) {
            return getPlaceholderThumbnail();
        }
        
        // Use the shared capture method
        return await captureModelImageForSystem(window.profileManager.currentSystem, 800, 800);
        
    } catch (error) {
        console.warn('Could not capture thumbnail:', error);
        return getPlaceholderThumbnail();
    }
}


function captureModelImageForSystem(system, captureWidth = 800, captureHeight = 800) {
    return new Promise((resolve) => {
        isCapturingThumbnail = true;
        // Store current state
        const wasPrintMode = isPrintMode;
        const wasOrthographic = !isPerspectiveView;
        const originalCameraSettings = storeCameraSettings();
        const originalTextStyles = prepareForScreenshot();
        
        // Enter print mode if not already
        if (!isPrintMode) {
            // Use the existing TAB key handler to enter print mode
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(keydownEvent);
        }
        
        // Ensure we're in orthographic view
        if (isPerspectiveView) {
            switchCamera();
        }
        
        // Set consistent camera positioning using the system's method
        system.setConsistentCameraForCapture();
        
        // Force multiple renders to ensure everything is drawn
        globalRenderer.render(globalScene, globalCurrentCamera);
        if (css2dRenderer.domElement.style.display !== 'none') {
            css2dRenderer.render(globalScene, globalCurrentCamera);
        }
        
        setTimeout(() => {
            globalRenderer.render(globalScene, globalCurrentCamera);
            if (css2dRenderer.domElement.style.display !== 'none') {
                css2dRenderer.render(globalScene, globalCurrentCamera);
            }
            
            setTimeout(() => {
                globalRenderer.render(globalScene, globalCurrentCamera);
                if (css2dRenderer.domElement.style.display !== 'none') {
                    css2dRenderer.render(globalScene, globalCurrentCamera);
                }
                
                // Wait a bit longer for CSS2D elements to position
                setTimeout(() => {
                    globalRenderer.render(globalScene, globalCurrentCamera);
                    if (css2dRenderer.domElement.style.display !== 'none') {
                        css2dRenderer.render(globalScene, globalCurrentCamera);
                    }
                    
                    // Take screenshot of the sandbox element
                    html2canvas(sandbox, {
                        backgroundColor: '#ffffff',
                        useCORS: true,
                        allowTaint: true,
                        scale: 1,
                        logging: false,
                        width: sandbox.offsetWidth,
                        height: sandbox.offsetHeight,
                        scrollX: 0,
                        scrollY: 0
                    }).then(canvas => {
                        // Create final canvas at desired resolution
                        const finalCanvas = document.createElement('canvas');
                        finalCanvas.width = captureWidth;
                        finalCanvas.height = captureHeight;
                        const finalCtx = finalCanvas.getContext('2d');
                        
                        // Fill with white background
                        finalCtx.fillStyle = '#ffffff';
                        finalCtx.fillRect(0, 0, captureWidth, captureHeight);
                        
                        // Calculate how to fit the captured content into square format
                        const sourceAspect = canvas.width / canvas.height;
                        const targetAspect = captureWidth / captureHeight;
                        
                        let drawWidth, drawHeight, drawX, drawY;
                        
                        if (sourceAspect > targetAspect) {
                            drawHeight = captureHeight;
                            drawWidth = drawHeight * sourceAspect;
                            drawX = (captureWidth - drawWidth) / 2;
                            drawY = 0;
                        } else {
                            drawWidth = captureWidth;
                            drawHeight = drawWidth / sourceAspect;
                            drawX = 0;
                            drawY = (captureHeight - drawHeight) / 2;
                        }
                        
                        // Enable high-quality scaling
                        finalCtx.imageSmoothingEnabled = true;
                        finalCtx.imageSmoothingQuality = 'high';
                        
                        // Draw the captured content, scaled and centered
                        finalCtx.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);
                        
                        const imageDataUrl = finalCanvas.toDataURL('image/png', 0.95);
                        
                        // Restore camera and previous state
                        restoreCameraSettings(originalCameraSettings);
                        restoreAfterScreenshot(originalTextStyles);
                        
                        if (!wasPrintMode && isPrintMode) {
                            // Use the existing TAB key handler to exit print mode
                            const keydownEvent = new KeyboardEvent('keydown', {
                                key: 'Tab',
                                bubbles: true,
                                cancelable: true
                            });
                            document.dispatchEvent(keydownEvent);
                        }
                        if (!wasOrthographic && !isPerspectiveView) {
                            switchCamera();
                        }
                        
                        console.log('Successfully captured sandbox screenshot');
                        isCapturingThumbnail = false;
                        resolve(imageDataUrl);
                        
                    }).catch(error => {
                        console.error('html2canvas failed:', error);
                        
                        // Fallback to basic WebGL capture
                        const fallbackCanvas = document.createElement('canvas');
                        fallbackCanvas.width = captureWidth;
                        fallbackCanvas.height = captureHeight;
                        const fallbackCtx = fallbackCanvas.getContext('2d');
                        
                        fallbackCtx.fillStyle = '#ffffff';
                        fallbackCtx.fillRect(0, 0, captureWidth, captureHeight);
                        
                        try {
                            // Try to draw the WebGL canvas at least
                            const sandboxRect = sandbox.getBoundingClientRect();
                            const scaleX = captureWidth / sandboxRect.width;
                            const scaleY = captureHeight / sandboxRect.height;
                            const scale = Math.min(scaleX, scaleY);
                            
                            const scaledWidth = sandboxRect.width * scale;
                            const scaledHeight = sandboxRect.height * scale;
                            const offsetX = (captureWidth - scaledWidth) / 2;
                            const offsetY = (captureHeight - scaledHeight) / 2;
                            
                            fallbackCtx.drawImage(
                                globalRenderer.domElement,
                                offsetX, offsetY, scaledWidth, scaledHeight
                            );
                        } catch (e) {
                            // If even that fails, draw placeholder
                            fallbackCtx.fillStyle = '#f0f0f0';
                            fallbackCtx.fillRect(0, 0, captureWidth, captureHeight);
                            fallbackCtx.fillStyle = '#666';
                            fallbackCtx.font = '24px Arial';
                            fallbackCtx.textAlign = 'center';
                            fallbackCtx.textBaseline = 'middle';
                            fallbackCtx.fillText('Model Preview', captureWidth/2, captureHeight/2);
                        }
                        
                        // Restore state
                        restoreAfterScreenshot(originalTextStyles);
                        restoreCameraSettings(originalCameraSettings);
                        if (!wasPrintMode && isPrintMode) {
                            // Use the existing TAB key handler to exit print mode
                            const keydownEvent = new KeyboardEvent('keydown', {
                                key: 'Tab',
                                bubbles: true,
                                cancelable: true
                            });
                            document.dispatchEvent(keydownEvent);
                        }
                        if (!wasOrthographic && !isPerspectiveView) switchCamera();
                        isCapturingThumbnail = false;
                        resolve(fallbackCanvas.toDataURL('image/png'));
                    });
                }, 10);
            }, 10);
        }, 10);
    });
}

// Global helper functions for screenshot preparation
function prepareForScreenshot() {
    const css2dElement = css2dRenderer.domElement;
    const originalStyles = {};
    
    if (css2dElement) {
        originalStyles.textRendering = css2dElement.style.textRendering;
        originalStyles.fontSmooth = css2dElement.style.webkitFontSmoothing;
        
        css2dElement.style.textRendering = 'optimizeLegibility';
        css2dElement.style.webkitFontSmoothing = 'antialiased';
        
        const textElements = css2dElement.querySelectorAll('div');
        textElements.forEach(el => {
            el.style.textRendering = 'optimizeLegibility';
            el.style.webkitFontSmoothing = 'antialiased';
        });
    }
    
    return originalStyles;
}

function restoreAfterScreenshot(originalStyles) {
    const css2dElement = css2dRenderer.domElement;
    if (css2dElement && originalStyles) {
        css2dElement.style.textRendering = originalStyles.textRendering || '';
        css2dElement.style.webkitFontSmoothing = originalStyles.fontSmooth || '';
    }
}

function storeCameraSettings() {
    return {
        position: globalOrthographicCamera.position.clone(),
        left: globalOrthographicCamera.left,
        right: globalOrthographicCamera.right,
        top: globalOrthographicCamera.top,
        bottom: globalOrthographicCamera.bottom,
        zoom: globalOrthographicCamera.zoom
    };
}

function restoreCameraSettings(settings) {
    globalOrthographicCamera.position.copy(settings.position);
    globalOrthographicCamera.left = settings.left;
    globalOrthographicCamera.right = settings.right;
    globalOrthographicCamera.top = settings.top;
    globalOrthographicCamera.bottom = settings.bottom;
    globalOrthographicCamera.zoom = settings.zoom;
    globalOrthographicCamera.updateProjectionMatrix();
    globalRenderer.render(globalScene, globalCurrentCamera);
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
    
    // Unlock profile buttons and reset line opacity
    setProfileButtonsLocked(false);
    $(".line").removeClass('opacity');
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
    
    // Unlock profile buttons when adding another extrusion
    setProfileButtonsLocked(false);
    $(".line").removeClass('opacity'); // Remove opacity from any lines
    
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
// Function to lock/unlock profile switching
function setProfileButtonsLocked(locked) {
    const profileButtons = [
        '#circular-profile-btn',
        '#pie-slice-profile-btn', 
        '#crescent-profile-btn',
        '#smile-profile-btn'
    ];
    
    profileButtons.forEach(buttonId => {
        const $button = $(buttonId);
        if (locked) {
            $button.prop('disabled', true);
            $button.css({
                'opacity': '0.5',
                'pointer-events': 'none',
                'cursor': 'not-allowed'
            });
        } else {
            $button.prop('disabled', false);
            $button.css({
                'opacity': '1',
                'pointer-events': 'auto',
                'cursor': 'pointer'
            });
        }
    });
}
$(document).on("click", ".edit", function(){
    clearEmptySliceHighlight();
    $("#next-step").addClass('hide-price');
    $("#final-details").css('display', 'none');
    $("#custom-menu").addClass('hide-price');
    
    const lineNumber = this.id;
    const $line = $(`#line${lineNumber}`);
    
    // Get profile ID from the line
    const profileId = $line.find('.line-title').attr('profileId');
    // Lock profile buttons during editing
    setProfileButtonsLocked(true);
    // Hide other lines and show editing state
    $(".line").not(`#line${lineNumber}`).addClass('opacity');
    $("#editing").css('display', 'flex');
    $("#now-editing").val(lineNumber);
    $(".update, .update-button").css('display', 'flex');
    $("#submit-container").css('display', 'none');
    
    // Switch to the correct profile
    switchToProfile(profileId);
    
    // Wait for profile to initialize, then populate data
    setTimeout(() => {
        populateDesignerFromLine(lineNumber);
    }, 500);
    
    // Handle expedite status
    if($(`#l${lineNumber}-expedite`).is(":checked")) {
        $("#reward-box").removeClass("hide-price");
        const expeditesRemaining = Number($("#reward-counter").val()) + 1;
        $("#reward-counter").val(expeditesRemaining);
        $("#expedites-remaining").text(expeditesRemaining);
        $("#apply-expedite").prop('checked', true).trigger('change');
    }
    
    // Update price display based on greenlight status
    $("#custom-quote").prop("checked", $(`#l${lineNumber}-greenlight`).is(":checked"));
    if($(`#l${lineNumber}-greenlight`).is(":checked")) {
        $("#price-block").css('display', 'none');
    } else {
        $("#price-block").css('display', 'flex');
    }
    
    const step = 'A quote line was edited';
    updateJourney(step);
  setTimeout(() => {
        if (window.profileManager.currentSystem instanceof CircularHolesSystem) {
            checkAndUpdateHoleDistribution();
        }
    }, 1000);
});

// Function to switch to the correct profile
function switchToProfile(profileId) {
    switch(parseInt(profileId)) {
        case 1: // Circular Holes
            if (!(window.profileManager.currentSystem instanceof CircularHolesSystem)) {
                document.getElementById('circular-profile-btn').click();
            }
            break;
        case 2: // Pie Slice
            if (!(window.profileManager.currentSystem instanceof PieSliceSystem)) {
                document.getElementById('pie-slice-profile-btn').click();
            }
            break;
        case 3: // Crescent
            if (!(window.profileManager.currentSystem instanceof CrescentSystem)) {
                document.getElementById('crescent-profile-btn').click();
            }
            break;
        case 4: // Smile
            if (!(window.profileManager.currentSystem instanceof SmileSystem)) {
                document.getElementById('smile-profile-btn').click();
            }
            break;
        default:
            console.warn('Unknown profile ID:', profileId);
            break;
    }
}

// Function to populate designer from line data
function populateDesignerFromLine(lineNumber) {
    const $line = $(`#line${lineNumber}`);
    const profileId = parseInt($line.find('.line-title').attr('profileId'));
    
    // Set common fields
    const unit = $(`#l${lineNumber}-unit`).val();
    const previousUnit = $("#unit").val();
    $("#unit").val(unit);
    if (unit !== previousUnit) {
        $("#unit").trigger('change', [previousUnit]);
    }
    
    // Set basic parameters
    $("#cylinder-diameter, #cylinder-diameter-input").val($(`#l${lineNumber}-od`).val());
    $("#length-2, #len-range").val($(`#l${lineNumber}-length`).val());
    $("#od-tol-2").val($(`#l${lineNumber}-od-tol`).val());
    $("#length-tol-2").val($(`#l${lineNumber}-length-tol`).val());
    
    // Set material and related fields
    $("#material-2").val($(`#l${lineNumber}-material`).val()).trigger('change');
    setTimeout(() => {
        $("#color-2").val($(`#l${lineNumber}-additive`).val());
        $("#colorant").val($(`#l${lineNumber}-color`).val());
    }, 300);
    
    // Set quantity
    const quantity = $(`#l${lineNumber}-quantity`).val();
    if (Number(quantity) > 2500) {
        $("#custom-quantity").css('display', 'block');
        $("#quantity-2").val('More');
        $("#custom-quantity").val(Number(quantity));
    } else {
        $("#quantity-2").val(quantity);
    }
    
    // Set shipping information
    setupShippingFromLine(lineNumber);
    
    // Set profile-specific data
    switch(profileId) {
        case 1: // Circular Holes
            populateCircularProfile(lineNumber);
            break;
        case 2: // Pie Slice
            populatePieSliceProfile(lineNumber);
            break;
        case 3: // Crescent
            populateCrescentProfile(lineNumber);
            break;
        case 4: // Smile
            populateSmileProfile(lineNumber);
            break;
    }
    
    // Set pricing information if not custom
    if (!$(`#l${lineNumber}-greenlight`).is(":checked")) {
        const leadtime = $(`#l${lineNumber}-leadtime`).val();
        const cert = $(`#l${lineNumber}-cert`).val();
        $(`#${leadtime}-price`).prop('checked', true).trigger('change');
        $(`#level-${cert}`).prop('checked', true);
    }
    
    // Trigger geometry update
    setTimeout(() => {
        $("#cylinder-diameter-input").trigger('change');
    }, 600);
}

// Setup shipping information from line
function setupShippingFromLine(lineNumber) {
    const $shippingElement = $(`#l${lineNumber}-shipping`);
    const account = $shippingElement.attr("account");
    const carrier = $shippingElement.attr("carrier");
    const method = $shippingElement.attr("method");
    
    if (account && account.length > 0) {
        $("#carrier-details").removeClass('hide-price');
        $("#view-carrier").text("I don't want to use my shipping account");
        $("#shipping-carrier").val(carrier).trigger('change');
        $("#shipping-account").val(account);
        $("#custom-method").val(method);
        $("#shipping-method").val($("#shipping-method option:first").val());
    } else {
        $("#carrier-details").addClass('hide-price');
        $("#view-carrier").text("Charge to your shipping account");
        $("#shipping-method").val(method);
        $("#shipping-account").val("");
        $("#custom-method").val($("#custom-method option:first").val());
        $("#shipping-carrier").val($("#shipping-carrier option:first").val());
    }
}

// Populate Circular Holes profile data
function populateCircularProfile(lineNumber) {
    const $holesContainer = $(`#l${lineNumber}-holes-container`);
    const $holeLayouts = $holesContainer.find('.hole-layout').slice(1); // Skip header
    
    // Check for central lumen
    const hasCentralLumen = $holeLayouts.first().find('.label').first().text() === 'Central Lumen';
    
    // Set the system state directly
    const system = window.profileManager.currentSystem;
    if (system instanceof CircularHolesSystem) {
        // Set the central lumen state directly on the system
        system.includeCentralLumen = hasCentralLumen;
        
        // Update UI to reflect the state
        $("#central-lumen-checkbox").prop('checked', hasCentralLumen);
        $("#hole-count").val($holeLayouts.length);
        
        // Show/hide inner diameter controls based on central lumen (though not used for circular holes)
        const innerDiameterGroup = document.getElementById('inner-diameter-group');
        if (innerDiameterGroup) {
            innerDiameterGroup.style.display = 'none'; // Always hidden for circular holes
        }
        
        // Regenerate holes with the correct count and central lumen setting
        system.regenerateHoles($holeLayouts.length);
        
        // Wait for regeneration to complete, then populate the data
        setTimeout(() => {
            populateCircularHoleDataFromLine($holeLayouts, system, lineNumber);
        }, 500);
    }
}

function populateCircularHoleDataFromLine($holeLayouts, system, lineNumber) {
    if (!(system instanceof CircularHolesSystem)) return;
    
    console.log('Populating hole data from line, system has', system.holes.length, 'holes');
    console.log('Line data has', $holeLayouts.length, 'hole layouts');
    
    // Get global distance from additional parameters
    const $line = $(`#line${lineNumber}`);
    const globalDistanceValue = extractAdditionalParam($line, 'Global Distance');
    const globalDistance = globalDistanceValue ? parseFloat(globalDistanceValue) : null;
    
    console.log('Found global distance from additional params:', globalDistance);
    
    // Map the line data to the regenerated holes
    $holeLayouts.each(function(lineIndex) {
        const $inputs = $(this).find('input');
        const label = $(this).find('.label').first().text();
        
        console.log(`Processing hole ${lineIndex}: ${label}`);
        
        if (label === 'Central Lumen') {
            // Central lumen should be holes[0] if includeCentralLumen is true
            const diameter = parseFloat($inputs.eq(0).val());
            if (system.holes[0] && system.holes[0].distance === 0) {
                system.holes[0].radius = diameter / 2;
                system.centralLumenRadius = diameter / 2;
                
                const innerDiameterSlider = document.getElementById('inner-diameter');
                const innerDiameterInput = document.getElementById('inner-diameter-input');
                if (innerDiameterSlider && innerDiameterInput) {
                    innerDiameterSlider.value = diameter.toFixed(3);
                    innerDiameterInput.value = diameter.toFixed(3);
                }
                
                system.updateSingleHole(0);
                console.log('Updated central lumen with diameter', diameter);
            }
        } else if ($inputs.length >= 2) {
            // Regular peripheral hole (diameter and angle)
            const diameter = parseFloat($inputs.eq(0).val());
            const angle = parseFloat($inputs.eq(1).val());
            
            // Calculate the correct system hole index
            let systemHoleIndex;
            if (system.includeCentralLumen) {
                systemHoleIndex = lineIndex; // lineIndex 0 is central, 1+ are peripheral
            } else {
                systemHoleIndex = lineIndex; // All holes are peripheral
            }
            
            console.log(`Mapping line hole ${lineIndex} to system hole ${systemHoleIndex}`);
            
            if (system.holes[systemHoleIndex] && system.holes[systemHoleIndex].distance !== 0) {
                const hole = system.holes[systemHoleIndex];
                hole.radius = diameter / 2;
                hole.angle = angle;
                
                // Use global distance if available, otherwise keep current distance
                const useDistance = globalDistance !== null ? globalDistance : hole.distance;
                hole.distance = useDistance;
                
                const { x, y } = system.polarToCartesian(angle, useDistance);
                hole.x = x;
                hole.y = y;
                
                system.updateSingleHole(systemHoleIndex);
                console.log(`Updated peripheral hole ${systemHoleIndex} with diameter ${diameter}, angle ${angle}, distance ${useDistance}`);
            }
        }
    });
    
    // Update global distance controls if we found a global distance
    if (globalDistance !== null) {
        const globalDistanceSlider = document.getElementById('global-distance');
        const globalDistanceInput = document.getElementById('global-distance-input');
        if (globalDistanceSlider) globalDistanceSlider.value = globalDistance.toFixed(4);
        if (globalDistanceInput) globalDistanceInput.value = globalDistance.toFixed(4);
    }
    
    // Final updates
    system.createCylinder();
    system.createHoleMarkers();
    system.createHoleUI();
    system.updateGlobalDistanceLimits();
    
    console.log('Finished populating hole data');
}

              
// Populate Pie Slice profile data
function populatePieSliceProfile(lineNumber) {
    const $holesContainer = $(`#l${lineNumber}-holes-container`);
    const $holeLayouts = $holesContainer.find('.hole-layout').slice(1); // Skip header
    const colors = ['Green', 'Blue', 'Red', 'Orange', 'Magenta', 'Cyan', 'Yellow', 'Purple', 'Light Green'];
    let sliceCount = 0;
    let hasCentralHole = false;
    const sliceAngles = [];
    
    // Parse the hole layouts to extract slice data
    $holeLayouts.each(function() {
        const label = $(this).find('.label').first().text();
        const value = $(this).find('input').first().val();
        
   const colorIndex = colors.findIndex(color => label.includes(color + ' Lumen'));
        if (colorIndex !== -1) {
            sliceCount++;
            const angleValue = parseFloat(value.replace('°', ''));
            sliceAngles.push(angleValue);
        } else if (label === 'Central Hole') {
            hasCentralHole = true;
            const centralDiameter = parseFloat(value);
            $("#inner-diameter, #inner-diameter-input").val(centralDiameter.toFixed(3));
        }
    });
    
    // Find additional parameters
    const $line = $(`#line${lineNumber}`);
    const septumThickness = extractAdditionalParam($line, 'Septum Thickness');
    const cornerRadius = extractAdditionalParam($line, 'Corner Radius');
    
    // Set up the pie slice system
    $("#central-lumen-checkbox").prop('checked', hasCentralHole);
    const totalCount = sliceCount + (hasCentralHole ? 1 : 0);
    $("#hole-count").val(totalCount);
    $("#apply-holes").click();
    
    setTimeout(() => {
        const system = window.profileManager.currentSystem;
        if (system instanceof PieSliceSystem) {
            // Set slice angles
            sliceAngles.forEach((angleDegrees, index) => {
                if (index < system.sliceCount) {
                    system.sliceAngles[index] = angleDegrees * Math.PI / 180;
                }
            });
            
            // Set additional parameters
            if (septumThickness) {
                system.septumThickness = parseFloat(septumThickness);
                $("#septum-thickness, #septum-thickness-input").val(septumThickness);
            }
            if (cornerRadius) {
                system.cornerRadius = parseFloat(cornerRadius);
            }
            
            system.updateGeometry();
            system.createSliceUI();
        }
    }, 800);
}

// Populate Crescent profile data
function populateCrescentProfile(lineNumber) {
    const $holesContainer = $(`#l${lineNumber}-holes-container`);
    const $holeLayouts = $holesContainer.find('.hole-layout').slice(1); // Skip header
    
    let circularDiameter = null;
    let wallMode = 'Even Wall';
    
    // Parse hole layouts
    $holeLayouts.each(function() {
        const label = $(this).find('.label').first().text();
        const value = $(this).find('input').first().val();
        
        if (label === 'Circular Lumen') {
            circularDiameter = parseFloat(value);
        } else if (label === 'Wall Mode') {
            wallMode = value;
        }
    });
    
    // Find additional parameters
    const $line = $(`#line${lineNumber}`);
    const septumThickness = extractAdditionalParam($line, 'Septum Thickness');
    const cornerRadius = extractAdditionalParam($line, 'Corner Radius');
    
    setTimeout(() => {
        const system = window.profileManager.currentSystem;
        if (system instanceof CrescentSystem) {
            // Set parameters
            if (circularDiameter) {
                system.circularDiameter = circularDiameter;
                $("#circular-radius, #circular-radius-input").val(circularDiameter.toFixed(3));
            }
            
            system.evenWallThickness = (wallMode === 'Even Wall');
            $("#even-wall-thickness-checkbox").prop('checked', system.evenWallThickness);
            
            if (septumThickness) {
                system.septumThickness = parseFloat(septumThickness);
                $("#crescent-septum-thickness, #crescent-septum-thickness-input").val(septumThickness);
            }
            if (cornerRadius) {
                system.crescentCornerRadius = parseFloat(cornerRadius);
                $("#crescent-corner-radius, #crescent-corner-radius-input").val(cornerRadius);
            }
            
            system.updateCylinderGeometry();
        }
    }, 800);
}

// Populate Smile profile data
function populateSmileProfile(lineNumber) {
    const $holesContainer = $(`#l${lineNumber}-holes-container`);
    const $holeLayouts = $holesContainer.find('.hole-layout').slice(1); // Skip header
    
    let semicircleRadius = null;
    const holeData = [];
    
    // Parse hole layouts
    $holeLayouts.each(function() {
        const label = $(this).find('.label').first().text();
        const $inputs = $(this).find('input');
        
        if (label === 'Smile Lumen') {
            semicircleRadius = parseFloat($inputs.first().val());
        } else if ($inputs.length >= 3) {
            // Circular hole
            const diameter = parseFloat($inputs.eq(0).val());
            const distance = parseFloat($inputs.eq(1).val());
            const angle = parseFloat($inputs.eq(2).val());
            holeData.push({ diameter, distance, angle });
        }
    });
    
    // Find additional parameters
    const $line = $(`#line${lineNumber}`);
    const cornerRadius = extractAdditionalParam($line, 'Corner Radius');
    
    // Set hole count (smile lumen + circular holes)
    $("#hole-count").val(holeData.length + 1);
    $("#apply-holes").click();
    
    setTimeout(() => {
        const system = window.profileManager.currentSystem;
        if (system instanceof SmileSystem) {
            // Set semicircle radius
            if (semicircleRadius) {
                system.semicircleRadius = semicircleRadius;
                $("#semicircle-radius, #semicircle-radius-input").val(semicircleRadius.toFixed(3));
            }
            
            // Set corner radius
            if (cornerRadius) {
                system.cornerRadius = parseFloat(cornerRadius);
                $("#smile-corner-radius, #smile-corner-radius-input").val(cornerRadius);
            }
            
            // Set hole data
            holeData.forEach((hole, index) => {
                if (system.holes[index]) {
                    system.holes[index].radius = hole.diameter / 2;
                    system.holes[index].distance = hole.distance;
                    system.holes[index].angle = hole.angle;
                    
                    const { x, y } = system.polarToCartesian(hole.angle, hole.distance);
                    system.holes[index].x = x;
                    system.holes[index].y = y;
                    
                    system.updateSingleHole(index);
                }
            });
            
            system.updateCylinderGeometry();
            system.createSmileHoleUI();
        }
    }, 800);
}

// Helper function to extract additional parameters
function extractAdditionalParam($line, paramName) {
    const $items = $line.find('.item');
    let value = null;
    
    $items.each(function() {
        const label = $(this).find('.label').text();
        if (label === paramName) {
            value = $(this).find('input').val();
            return false; // Break the loop
        }
    });
    
    return value;
}


async function update() {
    const line = $("#now-editing").val();
    const profileId = parseInt($(`#line${line} .line-title`).attr('profileId'));
    
    // Capture new thumbnail
    let thumbnailDataUrl;
    if (window.profileManager && window.profileManager.currentSystem) {
        thumbnailDataUrl = await captureCurrentSystemThumbnail();
    }
    
    // Update thumbnail
    const existingThumbnail = $(`#line${line} .model-thumbnail`);
    if (existingThumbnail.length > 0) {
        existingThumbnail.attr('src', thumbnailDataUrl);
    }
    
    // Update common fields
    updateCommonFields(line);
    
    // Update profile-specific data
    switch(profileId) {
        case 1: // Circular Holes
            updateCircularProfileData(line);
            break;
        case 2: // Pie Slice
            updatePieSliceProfileData(line);
            break;
        case 3: // Crescent
            updateCrescentProfileData(line);
            break;
        case 4: // Smile
            updateSmileProfileData(line);
            break;
    }
    
    // Update shipping and pricing
    updateShippingAndPricing(line);
    
    // Update expedite status
    updateExpediteStatus(line);
    
    // Reset UI state
    resetEditingState();
}

// Update common fields
function updateCommonFields(line) {
    $(`#l${line}-unit`).val($("#unit").val());
    $(`#line${line}`).find('.line-title').text(`Line ${line} (${$("#unit").val()})`);
    $(`#l${line}-od`).val($("#cylinder-diameter-input").val());
    $(`#l${line}-length`).val($("#length-2").val());
    $(`#l${line}-od-tol`).val($("#od-tol-2").val());
    $(`#l${line}-length-tol`).val($("#length-tol-2").val());
    $(`#l${line}-material`).val($("#material-2").val());
    $(`#l${line}-additive`).val($("#color-2").val());
    $(`#l${line}-color`).val($("#colorant").val());
    
    // Update quantity
    if ($("#quantity-2").val() == 'More') {
        $(`#l${line}-quantity`).val($("#custom-quantity").val());
    } else {
        $(`#l${line}-quantity`).val($("#quantity-2").val());
    }
}

// Update circular profile data
function updateCircularProfileData(line) {
    const system = window.profileManager.currentSystem;
    const profileData = getCircularProfileData(line);
    $(`#l${line}-holes-container`).html(profileData.holesHeader + profileData.holeTML);
    
    // Update additional parameters section (including global distance)
    updateAdditionalParamsInLine(line, profileData.additionalParams);
}

// Update pie slice profile data
function updatePieSliceProfileData(line) {
    const system = window.profileManager.currentSystem;
    const profileData = getPieSliceProfileData();
    $(`#l${line}-holes-container`).html(profileData.holesHeader + profileData.holeTML);
    
    // Update additional parameters section
    updateAdditionalParamsInLine(line, profileData.additionalParams);
}

// Update crescent profile data
function updateCrescentProfileData(line) {
    const system = window.profileManager.currentSystem;
    const profileData = getCrescentProfileData();
    $(`#l${line}-holes-container`).html(profileData.holesHeader + profileData.holeTML);
    
    // Update additional parameters section
    updateAdditionalParamsInLine(line, profileData.additionalParams);
}

// Update smile profile data
function updateSmileProfileData(line) {
    const system = window.profileManager.currentSystem;
    const profileData = getSmileProfileData();
    $(`#l${line}-holes-container`).html(profileData.holesHeader + profileData.holeTML);
    
    // Update additional parameters section
    updateAdditionalParamsInLine(line, profileData.additionalParams);
}

// Update additional parameters in line
function updateAdditionalParamsInLine(line, additionalParams) {
    if (!additionalParams || additionalParams.length === 0) return;
    
    // Find the additional params section and update it
    const $line = $(`#line${line}`);
    const $existingParams = $line.find('.item').filter(function() {
        const label = $(this).find('.label').text();
        return additionalParams.some(param => param.label === label);
    });
    
    // Remove existing additional params
    $existingParams.remove();
    
    // Add updated additional params
    const $col = $line.find('.col').first();
    additionalParams.forEach(param => {
        const paramHtml = `<div class="item"><p class="label">${param.label}</p><input class="quote-input" value="${param.value}" readonly></input></div>`;
        $col.append(paramHtml);
    });
}

// Update shipping and pricing
function updateShippingAndPricing(line) {
    let shipping, account, carrier;
    
    if ($("#shipping-carrier").val()) {
        shipping = $("#custom-method").val();
        account = $("#shipping-account").val();
        carrier = $("#shipping-carrier").val();
        $("#custom-carrier").val(carrier);
        $("#account-number").val(account);
    } else {
        shipping = $("#shipping-method").val();
        account = "";
        carrier = "";
    }
    
    $(`#l${line}-shipping`).val(shipping)
        .attr("account", account)
        .attr("method", shipping)
        .attr("carrier", carrier);
    
    // Update pricing if not custom
    if (!$("#custom-quote").is(":checked")) {
        $(`#l${line}-cert`).val($('input[data-name=cert]:checked').val());
        $(`#l${line}-price`).val($('#' + $('input[data-name=price]:checked').val()).val());
        $(`#l${line}-leadtime`).val($('input[data-name=price]:checked').val().replace('-price', ''));
    }
}

// Update expedite status
function updateExpediteStatus(line) {
    if ($("#apply-expedite").is(":checked")) {
        $(`#l${line}-expedite`).prop('checked', true);
        $(`#l${line}-expedite`).closest(".label").css('display', 'flex');
        const expeditesRemaining = Number($("#reward-counter").val()) - 1;
        $("#reward-counter").val(expeditesRemaining);
        $("#expedites-remaining").text(expeditesRemaining);
    } else {
        $(`#l${line}-expedite`).prop('checked', false);
        $(`#l${line}-expedite`).closest(".label").css('display', 'none');
    }
}

// Reset editing state
function resetEditingState() {
    $("#editing").css('display', 'none');
    $(".update, .update-button").css('display', 'none');
    $("#submit-container").css('display', 'flex');
    $("#price-block").css('display', 'none');
    $(`#l${$("#now-editing").val()}-greenlight`).prop("checked", $("#custom-quote").is(":checked"));
    
    // Unlock profile buttons
    setProfileButtonsLocked(false);
    
    storeHistory();
    updateTotal();
    if (user.model.expand.blanket_po) {
        updateBlanket();
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
