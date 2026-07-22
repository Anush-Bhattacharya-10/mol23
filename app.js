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
// Full Valence Electrons Map for Main Group Elements
const VALENCE_ELECTRONS = {
    H: 1, Li: 1, Na: 1, K: 1,
    Be: 2, Mg: 2, Ca: 2,
    B: 3, Al: 3, Ga: 3,
    C: 4, Si: 4, Ge: 4,
    N: 5, P: 5, As: 5, Sb: 5,
    O: 6, S: 6, Se: 6, Te: 6,
    F: 7, Cl: 7, Br: 7, I: 7,
    He: 8, Ne: 8, Ar: 8, Kr: 8, Xe: 8, Rn: 8
};

function parseFormula(input) {
    // Clean string: remove spaces, brackets, charges
    let clean = input.trim();

    // Handle charges if present, e.g., [NH4]+ or SO4(2-)
    let netCharge = 0;
    if (clean.includes("+")) netCharge = 1;
    if (clean.includes("-")) netCharge = -1;
    clean = clean.replace(/[^A-Za-z0-9]/g, "");

    // Match all chemical tokens: Element symbol + optional count
    const tokenRegex = /([A-Z][a-z]?)(\d*)/g;
    const tokens = [];
    let match;

    while ((match = tokenRegex.exec(clean)) !== null) {
        if (match[1]) {
            tokens.push({
                element: match[1],
                count: match[2] ? parseInt(match[2], 10) : 1
            });
        }
    }

    if (tokens.length === 0) {
        throw new Error("Invalid formula");
    }

    // Single atom input (e.g., "Xe" or "O")
    if (tokens.length === 1) {
        return { central: tokens[0].element, ligand: "H", count: 0, netCharge };
    }

    // For multi-atom molecules:
    // Central atom is usually the FIRST element (e.g. SF6 -> S, PCl5 -> P, XeF4 -> Xe)
    // Exception: In hydrogen-first formulas like H2O or H2S, the second element is central.
    let centralIndex = 0;
    if (tokens[0].element === "H" && tokens.length > 1) {
        centralIndex = 1;
    }

    const centralToken = tokens[centralIndex];
    const ligandToken = tokens[centralIndex === 0 ? 1 : 0];

    return {
        central: centralToken.element,
        ligand: ligandToken.element,
        count: ligandToken.count,
        netCharge
    };
}

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

function processMolecule(formulaStr) {
    showLoader(true);

    // Clear any existing vibration loop
    if (vibrationInterval) {
        clearInterval(vibrationInterval);
        isVibrating = false;
        document.getElementById("vibrationStatus").textContent = "OFF";
        document.getElementById("vibrationStatus").className = "px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400";
    }

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

function solveVSEPR(central, ligand, count, netCharge = 0) {
    // Normalize element symbol casing (e.g., "cl" -> "Cl")
    const normCentral = central.charAt(0).toUpperCase() + central.slice(1).toLowerCase();
    const normLigand = ligand.charAt(0).toUpperCase() + ligand.slice(1).toLowerCase();

    const vValence = VALENCE_ELECTRONS[normCentral] || 6;

    // Total valence on central atom adjusting for net charge
    const availableValence = vValence - netCharge;
    const lonePairs = Math.max(0, Math.floor((availableValence - count) / 2));
    const stericNumber = count + lonePairs;

    let geometryName = "Unknown";
    let hybridization = "sp";
    let vectors = [];

    if (stericNumber <= 2) {
        geometryName = "Linear"; hybridization = "sp";
        vectors = [[1.5, 0, 0], [-1.5, 0, 0]];
    } else if (stericNumber === 3) {
        geometryName = lonePairs === 0 ? "Trigonal Planar" : "Bent";
        hybridization = "sp²";
        vectors = [[1.5, 0, 0], [-0.75, 1.3, 0], [-0.75, -1.3, 0]];
    } else if (stericNumber === 4) {
        geometryName = lonePairs === 0 ? "Tetrahedral" : (lonePairs === 1 ? "Trigonal Pyramidal" : "Bent");
        hybridization = "sp³";
        vectors = [[0, 1.5, 0], [1.41, -0.5, 0], [-0.7, -0.5, 1.22], [-0.7, -0.5, -1.22]];
    } else if (stericNumber === 5) {
        geometryName = lonePairs === 0 ? "Trigonal Bipyramidal" : (lonePairs === 1 ? "Seesaw" : (lonePairs === 2 ? "T-Shaped" : "Linear"));
        hybridization = "sp³d";
        vectors = [[0, 0, 1.8], [0, 0, -1.8], [1.5, 0, 0], [-0.75, 1.3, 0], [-0.75, -1.3, 0]];
    } else if (stericNumber === 6) {
        geometryName = lonePairs === 0 ? "Octahedral" : (lonePairs === 1 ? "Square Pyramidal" : "Square Planar");
        hybridization = "sp³d²";
        vectors = [[1.5, 0, 0], [-1.5, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [0, 0, 1.5], [0, 0, -1.5]];
    } else if (stericNumber >= 7) {
        geometryName = "Pentagonal Bipyramidal"; hybridization = "sp³d³";
        vectors = [[0, 0, 1.6], [0, 0, -1.6], [1.4, 0, 0], [0.43, 1.33, 0], [-1.13, 0.82, 0], [-1.13, -0.82, 0], [0.43, -1.33, 0]];
    }

    return { bonded: count, lonePairs, stericNumber, geometryName, hybridization, vectors, central: normCentral, ligand: normLigand };
}

function renderMolecule() {
    if (!currentMolecule || !viewer) return;
    viewer.clear();

    const totalAtoms = 1 + currentMolecule.bonded;
    let xyzData = `${totalAtoms}\n${currentMolecule.formula}\n`;
    xyzData += `${currentMolecule.central}\t0.0\t0.0\t0.0\n`;

    for (let i = 0; i < currentMolecule.bonded; i++) {
        const v = currentMolecule.vectors[i] || [1.0, 0, 0];
        xyzData += `${currentMolecule.ligand}\t${v[0]}\t${v[1]}\t${v[2]}\n`;
    }

    viewer.addModel(xyzData, "xyz");

    viewer.setStyle({}, {
        stick: { radius: 0.14, colorscheme: "Jmol" },
        sphere: { scale: 0.28, colorscheme: "Jmol" }
    });

    // Render Lone Pair Orbitals
    if (showOrbitals && currentMolecule.lonePairs > 0) {
        for (let i = currentMolecule.bonded; i < currentMolecule.vectors.length; i++) {
            const v = currentMolecule.vectors[i];
            viewer.addSphere({
                center: { x: v[0] * 0.7, y: v[1] * 0.7, z: v[2] * 0.7 },
                radius: 0.65,
                color: "purple",
                opacity: 0.45
            });
        }
    }

    // Render Symmetry Plane
    if (showSymmetry) {
        viewer.addBox({
            center: { x: 0, y: 0, z: 0 },
            dimensions: { w: 4.5, h: 4.5, d: 0.02 },
            color: "cyan",
            opacity: 0.35
        });
    }

    viewer.zoomTo();
    if (isSpinning) viewer.spin("y", 0.8);
    viewer.render();
}

function toggleVibrationalMode() {
    if (vibrationInterval) clearInterval(vibrationInterval);

    if (isVibrating) {
        let step = 0;
        vibrationInterval = setInterval(() => {
            step += 0.2;
            const factor = Math.sin(step) * 0.12;
            if (viewer && currentMolecule) {
                const model = viewer.getModel();
                if (model) {
                    const atoms = model.selectedAtoms({});
                    for (let i = 0; i < currentMolecule.bonded; i++) {
                        const orig = currentMolecule.vectors[i];
                        const atom = atoms[i + 1];
                        if (atom && orig) {
                            atom.x = orig[0] * (1 + factor);
                            atom.y = orig[1] * (1 + factor);
                            atom.z = orig[2] * (1 + factor);
                        }
                    }
                    viewer.render();
                }
            }
        }, 50);
    } else {
        renderMolecule();
    }
}

function showLoader(show) {
    const loader = document.getElementById("loader");
    if (show) loader.classList.remove("opacity-0", "pointer-events-none");
    else loader.classList.add("opacity-0", "pointer-events-none");
}