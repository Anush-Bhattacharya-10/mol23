let viewer = null;
let currentStyle = "ballAndStick";
let isSpinning = false;
let currentMolecule = null;

// Feature States
let showOrbitals = false;
let showSymmetry = false;
let isVibrating = false;
let vibrationInterval = null;

// Periodic Table Valence Data
const VALENCE_ELECTRONS = {
    H: 1, F: 7, CL: 7, BR: 7, I: 7, O: 6, S: 6, SE: 6, N: 5, P: 5, AS: 5, C: 4, SI: 4, B: 3, XE: 8, KR: 8
};

document.addEventListener("DOMContentLoaded", () => {
    const element = document.getElementById("viewer");
    viewer = $3Dmol.createViewer(element, { backgroundColor: "0x090d16" });

    document.getElementById("renderBtn").addEventListener("click", handleSearch);
    document.getElementById("molInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSearch();
    });

    document.querySelectorAll(".preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const mol = btn.getAttribute("data-mol");
            document.getElementById("molInput").value = mol;
            processMolecule(mol);
        });
    });

    // Toggles for v2 Features
    document.getElementById("toggleOrbitalsBtn").addEventListener("click", () => {
        showOrbitals = !showOrbitals;
        document.getElementById("orbitalStatus").textContent = showOrbitals ? "ON" : "OFF";
        document.getElementById("orbitalStatus").className = showOrbitals ? "px-2 py-0.5 rounded text-[10px] bg-purple-900 text-purple-200 border border-purple-700 font-bold" : "px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400";
        renderMolecule();
    });

    document.getElementById("toggleSymmetryBtn").addEventListener("click", () => {
        showSymmetry = !showSymmetry;
        document.getElementById("symmetryStatus").textContent = showSymmetry ? "ON" : "OFF";
        document.getElementById("symmetryStatus").className = showSymmetry ? "px-2 py-0.5 rounded text-[10px] bg-cyan-900 text-cyan-200 border border-cyan-700 font-bold" : "px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400";
        renderMolecule();
    });

    document.getElementById("toggleVibrationBtn").addEventListener("click", () => {
        isVibrating = !isVibrating;
        document.getElementById("vibrationStatus").textContent = isVibrating ? "ON" : "OFF";
        document.getElementById("vibrationStatus").className = isVibrating ? "px-2 py-0.5 rounded text-[10px] bg-emerald-900 text-emerald-200 border border-emerald-700 font-bold" : "px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400";
        toggleVibrationalMode();
    });

    document.getElementById("recenterBtn").addEventListener("click", () => {
        if (viewer) { viewer.zoomTo(); viewer.render(); }
    });

    document.getElementById("spinToggle").addEventListener("click", () => {
        isSpinning = !isSpinning;
        const spinStateEl = document.getElementById("spinState");
        spinStateEl.textContent = isSpinning ? "ON" : "OFF";
        spinStateEl.className = isSpinning ? "text-emerald-400 font-bold" : "text-cyan-400 font-bold";
        viewer.spin(isSpinning ? "y" : false, 0.8);
    });

    // Load default
    processMolecule("SF6");
});

async function handleSearch() {
    const query = document.getElementById("molInput").value.trim();
    if (query) await processMolecule(query);
}

// Universal Chemical Formula Parser & VSEPR Solver
function processMolecule(formulaStr) {
    showLoader(true);
    try {
        const parsed = parseFormula(formulaStr);
        const vsepr = solveVSEPR(parsed.central, parsed.ligand, parsed.count);
        currentMolecule = { formula: formulaStr, ...parsed, ...vsepr };

        // Update HUD
        document.getElementById("molName").textContent = formulaStr.toUpperCase();
        document.getElementById("molDetails").textContent = `AX${vsepr.bonded}E${vsepr.lonePairs} Notation • Steric No: ${vsepr.stericNumber}`;
        document.getElementById("hybridRes").textContent = vsepr.hybridization;
        document.getElementById("geomRes").textContent = vsepr.geometryName;

        renderMolecule();
    } catch (err) {
        document.getElementById("molName").textContent = "Parse Error";
        document.getElementById("molDetails").textContent = "Unsupported formula format. Try SF6, PCl5, XeF4, IF7, CH4, or NH3.";
    } finally {
        showLoader(false);
    }
}

function parseFormula(input) {
    const regex = /([A-Z][a-z]?)(?:([A-Z][a-z]?))?(\d*)?/;
    const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Basic Regex match for Central + Ligand + Count
    const matches = clean.match(/^([A-Z][a-z]?)([A-Z][a-z]?)(\d*)$/);
    if (!matches) {
        if (clean === "CH4") return { central: "C", ligand: "H", count: 4 };
        if (clean === "NH3") return { central: "N", ligand: "H", count: 3 };
        if (clean === "H2O") return { central: "O", ligand: "H", count: 2 };
        return { central: "S", ligand: "F", count: 6 }; // Default fallback
    }

    const central = matches[1];
    const ligand = matches[2] || "H";
    const count = parseInt(matches[3] || "1", 10);
    return { central, ligand, count };
}

function solveVSEPR(central, ligand, count) {
    const vValence = VALENCE_ELECTRONS[central] || 6;
    const lContribution = 1; // Monovalent ligands
    const totalValence = vValence + (count * lContribution);
    const lonePairs = Math.max(0, Math.floor((vValence - count) / 2));
    const stericNumber = count + lonePairs;

    let geometryName = "Unknown";
    let hybridization = "sp";
    let vectors = [];

    // Generate 3D Vectors for Steric Numbers 2 to 7
    if (stericNumber === 2) { // Linear
        geometryName = "Linear"; hybridization = "sp";
        vectors = [[1.5, 0, 0], [-1.5, 0, 0]];
    } else if (stericNumber === 3) { // Trigonal Planar
        geometryName = "Trigonal Planar"; hybridization = "sp²";
        vectors = [[1.5, 0, 0], [-0.75, 1.3, 0], [-0.75, -1.3, 0]];
    } else if (stericNumber === 4) { // Tetrahedral
        geometryName = lonePairs === 0 ? "Tetrahedral" : (lonePairs === 1 ? "Trigonal Pyramidal" : "Bent");
        hybridization = "sp³";
        vectors = [[0, 1.5, 0], [1.41, -0.5, 0], [-0.7, -0.5, 1.22], [-0.7, -0.5, -1.22]];
    } else if (stericNumber === 5) { // Trigonal Bipyramidal
        geometryName = lonePairs === 0 ? "Trigonal Bipyramidal" : (lonePairs === 2 ? "T-Shaped" : "Linear");
        hybridization = "sp³d";
        vectors = [[0, 0, 1.8], [0, 0, -1.8], [1.5, 0, 0], [-0.75, 1.3, 0], [-0.75, -1.3, 0]];
    } else if (stericNumber === 6) { // Octahedral
        geometryName = lonePairs === 0 ? "Octahedral" : (lonePairs === 2 ? "Square Planar" : "Square Pyramidal");
        hybridization = "sp³d²";
        vectors = [[1.5, 0, 0], [-1.5, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [0, 0, 1.5], [0, 0, -1.5]];
    } else if (stericNumber === 7) { // Pentagonal Bipyramidal
        geometryName = "Pentagonal Bipyramidal"; hybridization = "sp³d³";
        vectors = [[0, 0, 1.6], [0, 0, -1.6], [1.4, 0, 0], [0.43, 1.33, 0], [-1.13, 0.82, 0], [-1.13, -0.82, 0], [0.43, -1.33, 0]];
    }

    return { bonded: count, lonePairs, stericNumber, geometryName, hybridization, vectors };
}

function renderMolecule() {
    if (!currentMolecule || !viewer) return;
    viewer.clear();

    // 1. Build XYZ Format String for 3Dmol
    const totalAtoms = 1 + currentMolecule.bonded;
    let xyzData = `${totalAtoms}\n${currentMolecule.formula}\n`;
    xyzData += `${currentMolecule.central}\t0.0\t0.0\t0.0\n`;

    for (let i = 0; i < currentMolecule.bonded; i++) {
        const v = currentMolecule.vectors[i] || [1.0, 0, 0];
        xyzData += `${currentMolecule.ligand}\t${v[0]}\t${v[1]}\t${v[2]}\n`;
    }

    viewer.addModel(xyzData, "xyz");

    // 2. Apply Ball & Stick Styles
    viewer.setStyle({}, {
        stick: { radius: 0.14, colorscheme: "Jmol" },
        sphere: { scale: 0.28, colorscheme: "Jmol" }
    });

    // 3. Render Lone Pair Orbitals (Isosurfaces)
    if (showOrbitals && currentMolecule.lonePairs > 0) {
        for (let i = currentMolecule.bonded; i < currentMolecule.vectors.length; i++) {
            const v = currentMolecule.vectors[i];
            viewer.addSphere({
                center: { x: v[0] * 0.7, y: v[1] * 0.7, z: v[2] * 0.7 },
                radius: 0.65,
                color: "purple",
                alpha: 0.45
            });
        }
    }

    // 4. Render 3D Symmetry Plane (Reflection Plane σ)
    if (showSymmetry) {
        viewer.addCustom({
            draw: [
                { action: "Plane", center: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, size: 3.5, color: "cyan", alpha: 0.25 }
            ]
        });
    }

    viewer.zoomTo();
    if (isSpinning) viewer.spin("y", 0.8);
    viewer.render();
}

// Real-time Vibrational Mode Mode Simulation
function toggleVibrationalMode() {
    if (isVibrating) {
        let step = 0;
        vibrationInterval = setInterval(() => {
            step += 0.2;
            const scale = 1 + Math.sin(step) * 0.08;
            if (viewer) {
                const model = viewer.getModel();
                if (model) {
                    const atoms = model.selectedAtoms({});
                    atoms.forEach((atom) => {
                        if (atom.elem !== currentMolecule.central) {
                            atom.x *= scale;
                            atom.y *= scale;
                            atom.z *= scale;
                        }
                    });
                    viewer.render();
                }
            }
        }, 50);
    } else {
        clearInterval(vibrationInterval);
        renderMolecule();
    }
}

function showLoader(show) {
    const loader = document.getElementById("loader");
    if (show) loader.classList.remove("opacity-0", "pointer-events-none");
    else loader.classList.add("opacity-0", "pointer-events-none");
}