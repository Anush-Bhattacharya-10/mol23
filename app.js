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
  if (element) {
    viewer = $3Dmol.createViewer(element, { backgroundColor: "0x090d16" });
  }

  document.getElementById("renderBtn")?.addEventListener("click", handleSearch);
  document.getElementById("molInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mol = btn.getAttribute("data-mol");
      const input = document.getElementById("molInput");
      if (input) input.value = mol;
      fetchAndRenderMolecule(mol);
    });
  });

  const slider = document.getElementById("thicknessSlider");
  if (slider) {
    slider.addEventListener("input", (e) => {
      bondThickness = parseFloat(e.target.value);
      const valDisp = document.getElementById("thicknessVal");
      if (valDisp) valDisp.textContent = `${bondThickness.toFixed(2)} Å`;
      renderMoleculeStyle();
    });
  }

  document.getElementById("toggleOrbitalsBtn")?.addEventListener("click", () => {
    showOrbitals = !showOrbitals;
    const status = document.getElementById("orbitalStatus");
    if (status) {
      status.textContent = showOrbitals ? "ON" : "OFF";
      status.className = showOrbitals 
        ? "px-2 py-0.5 rounded text-[10px] bg-purple-900 text-purple-200 border border-purple-700 font-bold" 
        : "px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400";
    }
    renderMoleculeStyle();
  });

  document.getElementById("toggleSymmetryBtn")?.addEventListener("click", () => {
    showSymmetry = !showSymmetry;
    const status = document.getElementById("symmetryStatus");
    if (status) {
      status.textContent = showSymmetry ? "ON" : "OFF";
      status.className = showSymmetry 
        ? "px-2 py-0.5 rounded text-[10px] bg-cyan-900 text-cyan-200 border border-cyan-700 font-bold" 
        : "px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400";
    }
    renderMoleculeStyle();
  });

  document.getElementById("recenterBtn")?.addEventListener("click", () => {
    if (viewer) { viewer.zoomTo(); viewer.render(); }
  });

  document.getElementById("spinToggle")?.addEventListener("click", () => {
    isSpinning = !isSpinning;
    const spinStateEl = document.getElementById("spinState");
    if (spinStateEl) {
      spinStateEl.textContent = isSpinning ? "ON" : "OFF";
      spinStateEl.className = isSpinning ? "text-emerald-400 font-bold" : "text-cyan-400 font-bold";
    }
    if (viewer) viewer.spin(isSpinning ? "y" : false, 0.8);
  });

  document.getElementById("exportPngBtn")?.addEventListener("click", () => {
    if (!viewer) return;
    const imgData = viewer.png();
    const link = document.createElement("a");
    link.href = imgData;
    link.download = `${currentMolecule ? currentMolecule.formula : "molecule"}_3D.png`;
    link.click();
  });

  // Load Water on Start
  fetchAndRenderMolecule("H2O");
});

async function handleSearch() {
  const input = document.getElementById("molInput");
  const query = input ? input.value.trim() : "";
  if (query) await fetchAndRenderMolecule(query);
}

async function fetchAndRenderMolecule(query) {
  showLoader(true);
  
  try {
    // 1. Try fetching real 3D coordinates from PubChem API
    const response = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/SDF?record_type=3d`
    );

    if (!response.ok) throw new Error("Fallback to VSEPR Engine");

    const sdfData = await response.text();

    viewer.clear();
    viewer.addModel(sdfData, "sdf");
    currentMolecule = { formula: query, vectors: [] };

    renderMoleculeStyle();
    
    // Update HUD
    const molName = document.getElementById("molName");
    const molDetails = document.getElementById("molDetails");
    const hybridRes = document.getElementById("hybridRes");
    const geomRes = document.getElementById("geomRes");

    if (molName) molName.textContent = query.toUpperCase();
    if (molDetails) molDetails.textContent = `3D conformer structure loaded via PubChem.`;
    if (hybridRes) hybridRes.textContent = "3D Data";
    if (geomRes) geomRes.textContent = "Experimental";

  } catch (err) {
    // 2. Fallback to math VSEPR Engine if PubChem has no 3D record
    renderVseprFallback(query);
  } finally {
    showLoader(false);
  }
}

function renderVseprFallback(query) {
  const clean = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let central = "S", count = 6, ligand = "F";

  if (clean === "SF6") { central = "S"; ligand = "F"; count = 6; }
  else if (clean === "PCL5") { central = "P"; ligand = "CL"; count = 5; }
  else if (clean === "XEF4") { central = "XE"; ligand = "F"; count = 4; }
  else if (clean === "IF7") { central = "I"; ligand = "F"; count = 7; }

  const vectors = getVectorsForCount(count);
  const totalAtoms = 1 + count;

  let xyzData = `${totalAtoms}\n${query}\n`;
  xyzData += `${central}\t0.0\t0.0\t0.0\n`;
  for (let i = 0; i < count; i++) {
    const v = vectors[i];
    xyzData += `${ligand}\t${v[0]}\t${v[1]}\t${v[2]}\n`;
  }

  viewer.clear();
  viewer.addModel(xyzData, "xyz");
  currentMolecule = { formula: query, vectors };

  renderMoleculeStyle();

  document.getElementById("molName").textContent = query.toUpperCase();
  document.getElementById("molDetails").textContent = `VSEPR Math Coordinate Model`;
  document.getElementById("hybridRes").textContent = `${count}`;
  document.getElementById("geomRes").textContent = "Ideal VSEPR";
}

function getVectorsForCount(count) {
  if (count === 2) return [[1.2, 0, 0], [-1.2, 0, 0]];
  if (count === 3) return [[1.2, 0, 0], [-0.6, 1.04, 0], [-0.6, -1.04, 0]];
  if (count === 4) return [[0, 1.2, 0], [1.13, -0.4, 0], [-0.56, -0.4, 0.98], [-0.56, -0.4, -0.98]];
  if (count === 5) return [[0, 0, 1.5], [0, 0, -1.5], [1.3, 0, 0], [-0.65, 1.12, 0], [-0.65, -1.12, 0]];
  if (count === 6) return [[1.3, 0, 0], [-1.3, 0, 0], [0, 1.3, 0], [0, -1.3, 0], [0, 0, 1.3], [0, 0, -1.3]];
  return [[0, 0, 1.4], [0, 0, -1.4], [1.2, 0, 0], [0.37, 1.14, 0], [-0.97, 0.7, 0], [-0.97, -0.7, 0], [0.37, -1.14, 0]];
}

function renderMoleculeStyle() {
  if (!viewer) return;

  viewer.setStyle({}, {
    stick: { radius: bondThickness, colorscheme: "Jmol" },
    sphere: { scale: 0.28, colorscheme: "Jmol" }
  });

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

function showLoader(show) {
  const loader = document.getElementById("loader");
  if (!loader) return;
  if (show) loader.classList.remove("opacity-0", "pointer-events-none");
  else loader.classList.add("opacity-0", "pointer-events-none");
}