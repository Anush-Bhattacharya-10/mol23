let viewer = null;
let bondThickness = 0.14;
let isSpinning = false;
let currentMolecule = null;

// Feature States
let showOrbitals = false;
let showSymmetry = false;

// Periodic Table Valence Data
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

    // Slider Event Listener
    const slider = document.getElementById("thicknessSlider");
    slider.addEventListener("input", (e) => {
        bondThickness = parseFloat(e.target.value);
        document.getElementById("thicknessVal").textContent = `${bondThickness.toFixed(2)} Å`;
        renderMolecule();
    });

    // Tab Switching Logic
    document.getElementById("tab3D").addEventListener("click", () => switchTab("3D"));
    document.getElementById("tabHybrid").addEventListener("click", () => switchTab("Hybrid"));

    // Toggles
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

    // Export High-Res PNG
    document.getElementById("exportPngBtn").addEventListener("click", () => {
        if (!viewer) return;
        const imgData = viewer.png();
        const link = document.createElement("a");
        link.href = imgData;
        link.download = `${currentMolecule ? currentMolecule.formula : "molecule"}_3D.png`;
        link.click();
    });

    // Load Default
    processMolecule("SF6");
});

function switchTab(tab) {
    const container3D = document.getElementById("view3DContainer");
    const containerHybrid = document.getElementById("viewHybridContainer");
    const btn3D = document.getElementById("tab3D");
    const btnHybrid = document.getElementById("tabHybrid");

    if (tab === "3D") {
        container3D.classList.remove("hidden");
        containerHybrid.classList.add("hidden");
        containerHybrid.classList.remove("flex");

        btn3D.className = "view-tab active flex-1 py-2 rounded-lg text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/80 transition flex items-center justify-center gap-2";
        btnHybrid.className = "view-tab flex-1 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 border border-transparent transition flex items-center justify-center gap-2";
    } else {
        container3D.classList.add("hidden");
        containerHybrid.classList.remove("hidden");
        containerHybrid.classList.add("flex");

        btnHybrid.className = "view-tab active flex-1 py-2 rounded-lg text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/80 transition flex items-center justify-center gap-2";
        btn3D.className = "view-tab flex-1 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 border border-transparent transition flex items-center justify-center gap-2";
    }
}

async function handleSearch() {
    const query = document.getElementById("molInput").value.trim();
    if (query) await processMolecule(query);
}

function processMolecule(formulaStr) {
    showLoader(true);

    try {
        const parsed = parseFormula(formulaStr);
        const vsepr = solveVSEPR(parsed.central, parsed.ligand, parsed.count, parsed.netCharge);
        currentMolecule = { formula: formulaStr, ...parsed, ...vsepr };

        // Update HUD
        document.getElementById("molName").textContent = formulaStr.toUpperCase();
        document.getElementById("molDetails").textContent = `AX${vsepr.bonded}E${vsepr.lonePairs} Notation • Steric No: ${vsepr.stericNumber}`;
        document.getElementById("hybridRes").textContent = vsepr.hybridization;
        document.getElementById("geomRes").textContent = vsepr.geometryName;

        renderMolecule();
        renderHybridizationDiagrams();
    } catch (err) {
        document.getElementById("molName").textContent = "Parse Error";
        document.getElementById("molDetails").textContent = "Unsupported formula format. Try SF6, PCl5, XeF4, IF7, CH4, or NH3.";
    } finally {
        showLoader(false);
    }
}

function parseFormula(input) {
    let clean = input.trim();
    let netCharge = 0;
    if (clean.includes("+")) netCharge = 1;
    if (clean.includes("-")) netCharge = -1;
    clean = clean.replace(/[^A-Za-z0-9]/g, "");

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

    if (tokens.length === 0) throw new Error("Invalid formula");

    let centralIndex = 0;
    if (tokens[0].element === "H" && tokens.length > 1) centralIndex = 1;

    const centralToken = tokens[centralIndex];
    const ligandToken = tokens[centralIndex === 0 ? 1 : 0] || { element: "H", count: 0 };

    return { central: centralToken.element, ligand: ligandToken.element, count: ligandToken.count, netCharge };
}

function solveVSEPR(central, ligand, count, netCharge = 0) {
    const normCentral = central.charAt(0).toUpperCase() + central.slice(1).toLowerCase();
    const normLigand = ligand.charAt(0).toUpperCase() + ligand.slice(1).toLowerCase();

    const vValence = VALENCE_ELECTRONS[normCentral] || 6;
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
        geometryName = lonePairs === 0 ? "Trigonal Planar" : "Bent"; hybridization = "sp²";
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

    return { bonded: count, lonePairs, stericNumber, geometryName, hybridization, vectors, central: normCentral, ligand: normLigand, vValence };
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
        stick: { radius: bondThickness, colorscheme: "Jmol" },
        sphere: { scale: 0.28, colorscheme: "Jmol" }
    });

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

// Render Interactive Step-by-Step Orbital Boxes
function renderHybridizationDiagrams() {
    if (!currentMolecule) return;

    document.getElementById("hybridCentralTitle").textContent = currentMolecule.central;
    document.getElementById("hybridMolTitle").textContent = currentMolecule.formula.toUpperCase();

    const valence = currentMolecule.vValence;
    const steric = currentMolecule.stericNumber;

    // Ground State Rendering
    const groundBoxEl = document.getElementById("groundOrbitalBoxes");
    groundBoxEl.innerHTML = "";

    // Render s-orbital (2 electrons if valence >= 2)
    const sElectrons = Math.min(2, valence);
    groundBoxEl.appendChild(createBox("s", sElectrons === 2 ? "↑↓" : (sElectrons === 1 ? "↑" : "")));

    // Render p-orbitals
    const pValence = Math.max(0, valence - 2);
    const pArrows = ["", "", ""];
    for (let i = 0; i < Math.min(6, pValence); i++) {
        const idx = i % 3;
        pArrows[idx] = pArrows[idx] === "↑" ? "↑↓" : "↑";
    }
    pArrows.forEach((arr) => groundBoxEl.appendChild(createBox("p", arr)));

    // Step 2 & 3: Excited and Hybridized States
    document.getElementById("hybridTypeLabel").textContent = `${steric} Equivalent ${currentMolecule.hybridization} Hybrid Orbitals`;

    const excitedBoxEl = document.getElementById("excitedOrbitalBoxes");
    const hybridBoxEl = document.getElementById("hybridOrbitalBoxes");
    excitedBoxEl.innerHTML = "";
    hybridBoxEl.innerHTML = "";

    // Unpair all valence electrons into individual boxes for bonding
    for (let i = 0; i < Math.max(steric, valence); i++) {
        const symbol = i < valence ? (i < currentMolecule.lonePairs ? "↑↓" : "↑") : "";
        excitedBoxEl.appendChild(createBox(`e${i+1}`, symbol));
    }

    for (let i = 0; i < steric; i++) {
        const symbol = i < currentMolecule.lonePairs ? "↑↓" : "↑";
        hybridBoxEl.appendChild(createBox(currentMolecule.hybridization, symbol, true));
    }
}

function createBox(label, arrows, isHybrid = false) {
    const container = document.createElement("div");
    container.className = "flex flex-col items-center gap-1";

    const box = document.createElement("div");
    box.className = isHybrid
        ? "orbital-box border-cyan-400 bg-cyan-950/40 text-cyan-300"
        : "orbital-box";
    box.textContent = arrows;

    const lbl = document.createElement("span");
    lbl.className = "text-[10px] font-mono text-slate-500 uppercase";
    lbl.textContent = label;

    container.appendChild(box);
    container.appendChild(lbl);
    return container;
}

function showLoader(show) {
    const loader = document.getElementById("loader");
    if (show) loader.classList.remove("opacity-0", "pointer-events-none");
    else loader.classList.add("opacity-0", "pointer-events-none");
}