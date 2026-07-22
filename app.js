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
  if (slider) {
    slider.addEventListener("input", (e) => {
      bondThickness = parseFloat(e.target.value);
      document.getElementById("thicknessVal").textContent = `${bondThickness.toFixed(2)} Å`;
      renderMolecule();
    });
  }

  // Tab Switching Logic
  document.getElementById("tab3D").addEventListener("click", () => switchTab("3D"));
  document.getElementById("tabHybrid").addEventListener("click", () => switchTab("Hybrid"));

  // Feature Toggles
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
  processMolecule("H2O");
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
    document.getElementById("molDetails").textContent = "Unsupported formula format. Try H2O, CO2, SF6, PCl5, XeF4, IF7, CH4, or NH3.";
  } finally {
    showLoader(false);
  }
}

// Fixed Formula Parser (Normalizes Casing for element lookup & bonding)
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
      const rawElem = match[1];
      const normElem = rawElem.charAt(0).toUpperCase() + rawElem.slice(1).toLowerCase();
      tokens.push({
        element: normElem,
        count: match[2] ? parseInt(match[2], 10) : 1
      });
    }
  }

  if (tokens.length === 0) throw new Error("Invalid formula");

  // Determine Central Atom
  let centralIndex = 0;
  if (tokens[0].element === "H" && tokens.length > 1) {
    centralIndex = 1; // H2O, H2S -> O or S is central
  }

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
    vectors = [[1.2, 0, 0], [-1.2, 0, 0]];
  } else if (stericNumber === 3) {
    geometryName = lonePairs === 0 ? "Trigonal Planar" : "Bent"; hybridization = "sp²";
    vectors = [[1.2, 0, 0], [-0.6, 1.04, 0], [-0.6, -1.04, 0]];
  } else if (stericNumber === 4) {
    geometryName = lonePairs === 0 ? "Tetrahedral" : (lonePairs === 1 ? "Trigonal Pyramidal" : "Bent");
    hybridization = "sp³";
    vectors = [[0, 1.2, 0], [1.13, -0.4, 0], [-0.56, -0.4, 0.98], [-0.56, -0.4, -0.98]];
  } else if (stericNumber === 5) {
    geometryName = lonePairs === 0 ? "Trigonal Bipyramidal" : (lonePairs === 1 ? "Seesaw" : (lonePairs === 2 ? "T-Shaped" : "Linear"));
    hybridization = "sp³d";
    vectors = [[0, 0, 1.5], [0, 0, -1.5], [1.3, 0, 0], [-0.65, 1.12, 0], [-0.65, -1.12, 0]];
  } else if (stericNumber === 6) {
    geometryName = lonePairs === 0 ? "Octahedral" : (lonePairs === 1 ? "Square Pyramidal" : "Square Planar");
    hybridization = "sp³d²";
    vectors = [[1.3, 0, 0], [-1.3, 0, 0], [0, 1.3, 0], [0, -1.3, 0], [0, 0, 1.3], [0, 0, -1.3]];
  } else if (stericNumber >= 7) {
    geometryName = "Pentagonal Bipyramidal"; hybridization = "sp³d³";
    vectors = [[0, 0, 1.4], [0, 0, -1.4], [1.2, 0, 0], [0.37, 1.14, 0], [-0.97, 0.7, 0], [-0.97, -0.7, 0], [0.37, -1.14, 0]];
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

  // Style Balls and Sticks
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
      dimensions: { w: 4.0, h: 4.0, d: 0.02 },
      color: "cyan",
      opacity: 0.35
    });
  }

  viewer.zoomTo();
  if (isSpinning) viewer.spin("y", 0.8);
  viewer.render();
}

// Clear, Pedagogical Hybridization Diagrams
// Clean, Formatted Hybridization Diagrams Renderer
function renderHybridizationDiagrams() {
  if (!currentMolecule) return;

  document.getElementById("hybridCentralTitle").textContent = currentMolecule.central;
  document.getElementById("hybridMolTitle").textContent = currentMolecule.formula.toUpperCase();
  document.getElementById("hybridTypeBadge").textContent = `${currentMolecule.hybridization} Hybridized`;

  const valence = currentMolecule.vValence;
  const steric = currentMolecule.stericNumber;

  // Step 1: Ground State
  document.getElementById("groundConfigLabel").textContent = 
    `Central atom ${currentMolecule.central} has ${valence} valence electrons in its ground shell.`;

  const groundBoxEl = document.getElementById("groundOrbitalBoxes");
  groundBoxEl.innerHTML = "";
  
  const sElectrons = Math.min(2, valence);
  groundBoxEl.appendChild(createBox("s orbital", sElectrons === 2 ? "↑↓" : (sElectrons === 1 ? "↑" : "")));

  const pValence = Math.max(0, valence - 2);
  const pArrows = ["", "", ""];
  for (let i = 0; i < Math.min(6, pValence); i++) {
    const idx = i % 3;
    pArrows[idx] = pArrows[idx] === "↑" ? "↑↓" : "↑";
  }
  pArrows.forEach((arr, idx) => groundBoxEl.appendChild(createBox(`p${['x','y','z'][idx]}`, arr)));

  // Step 2: Excited State
  document.getElementById("excitedConfigLabel").textContent = 
    valence < steric 
      ? `Promoting electron pairs into higher orbitals to generate ${steric} bonding positions.` 
      : `Unpairing electrons into distinct orbitals for covalent overlap.`;

  const excitedBoxEl = document.getElementById("excitedOrbitalBoxes");
  excitedBoxEl.innerHTML = "";
  for (let i = 0; i < Math.max(steric, valence); i++) {
    const symbol = i < valence ? (i < currentMolecule.lonePairs ? "↑↓" : "↑") : "";
    excitedBoxEl.appendChild(createBox(`Orbital ${i+1}`, symbol));
  }

  // Step 3: Hybridized State
  document.getElementById("hybridTypeLabel").textContent = 
    `Forms ${steric} equivalent ${currentMolecule.hybridization} lobes (${currentMolecule.bonded} bonding + ${currentMolecule.lonePairs} lone pairs).`;

  const hybridBoxEl = document.getElementById("hybridOrbitalBoxes");
  hybridBoxEl.innerHTML = "";
  for (let i = 0; i < steric; i++) {
    const isLone = i < currentMolecule.lonePairs;
    const symbol = isLone ? "↑↓" : "↑";
    const badgeType = isLone ? "LONE PAIR" : "BONDING";
    hybridBoxEl.appendChild(createBox(currentMolecule.hybridization, symbol, true, badgeType));
  }
}

function createBox(label, arrows, isHybrid = false, badgeType = "") {
  const container = document.createElement("div");
  container.className = "flex flex-col items-center gap-1.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 shadow-sm hover:border-slate-700 transition min-w-[70px]";

  const box = document.createElement("div");
  
  if (arrows === "↑↓") { // Lone Pair
    box.className = "w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-600/80 flex items-center justify-center font-mono font-black text-purple-300 text-sm shadow-inner";
  } else if (arrows === "↑") { // Single Bonding Electron
    box.className = "w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/80 flex items-center justify-center font-mono font-black text-cyan-300 text-sm shadow-inner";
  } else { // Empty Orbital
    box.className = "w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono text-slate-600 text-xs";
  }
  
  box.textContent = arrows || "—";

  const lbl = document.createElement("span");
  lbl.className = "text-[10px] font-mono text-slate-400 uppercase text-center font-semibold tracking-wide";
  lbl.textContent = label;

  container.appendChild(box);
  container.appendChild(lbl);

  if (badgeType) {
    const typeTag = document.createElement("span");
    typeTag.className = badgeType === "LONE PAIR" 
      ? "text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/60"
      : "text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60";
    typeTag.textContent = badgeType;
    container.appendChild(typeTag);
  }

  return container;
}
// Period 2 elements CANNOT expand their octet (Steric Number cannot exceed 4)
const PERIOD_2_ELEMENTS = ["BE", "B", "C", "N", "O", "F"];

if (PERIOD_2_ELEMENTS.includes(normCentral.toUpperCase()) && stericNumber > 4) {
  throw new Error(`${normCentral} is a Period 2 element and cannot expand its octet beyond 4 bonds (no d-orbitals).`);
}
function createBox(label, arrows, isHybrid = false) {
  const container = document.createElement("div");
  container.className = "flex flex-col items-center gap-1";

  const box = document.createElement("div");
  box.className = isHybrid 
    ? "orbital-box border-cyan-400 bg-cyan-950/40 text-cyan-300 min-w-[50px] text-xs px-1"
    : "orbital-box min-w-[42px] text-xs px-1";
  box.textContent = arrows;

  const lbl = document.createElement("span");
  lbl.className = "text-[10px] font-mono text-slate-400 uppercase text-center";
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