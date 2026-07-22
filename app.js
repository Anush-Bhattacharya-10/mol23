let viewer = null;
let currentStyle = "ballAndStick";
let isSpinning = false;
let currentModel = null;

// Built-in VSEPR coordinate generator for hypervalent & fallback molecules
const GEOMETRY_TEMPLATES = {
    // Octahedral (sp3d2) - e.g., SF6
    SF6: {
        central: { elem: "S", x: 0.0, y: 0.0, z: 0.0 },
        ligands: [
            { elem: "F", x: 1.56, y: 0.0, z: 0.0 },
            { elem: "F", x: -1.56, y: 0.0, z: 0.0 },
            { elem: "F", x: 0.0, y: 1.56, z: 0.0 },
            { elem: "F", x: 0.0, y: -1.56, z: 0.0 },
            { elem: "F", x: 0.0, y: 0.0, z: 1.56 },
            { elem: "F", x: 0.0, y: 0.0, z: -1.56 }
        ],
        title: "Sulfur Hexafluoride (SF₆)",
        geometry: "Octahedral (sp³d²)",
        weight: "146.06 g/mol"
    },
    // Trigonal Bipyramidal (sp3d) - e.g., PCl5
    PCL5: {
        central: { elem: "P", x: 0.0, y: 0.0, z: 0.0 },
        ligands: [
            { elem: "Cl", x: 0.0, y: 0.0, z: 2.04 },   // Axial
            { elem: "Cl", x: 0.0, y: 0.0, z: -2.04 },  // Axial
            { elem: "Cl", x: 2.02, y: 0.0, z: 0.0 },   // Equatorial
            { elem: "Cl", x: -1.01, y: 1.75, z: 0.0 }, // Equatorial
            { elem: "Cl", x: -1.01, y: -1.75, z: 0.0 } // Equatorial
        ],
        title: "Phosphorus Pentachloride (PCl₅)",
        geometry: "Trigonal Bipyramidal (sp³d)",
        weight: "208.24 g/mol"
    },
    // Square Planar (sp3d2) - e.g., XeF4
    XEF4: {
        central: { elem: "Xe", x: 0.0, y: 0.0, z: 0.0 },
        ligands: [
            { elem: "F", x: 1.95, y: 0.0, z: 0.0 },
            { elem: "F", x: -1.95, y: 0.0, z: 0.0 },
            { elem: "F", x: 0.0, y: 1.95, z: 0.0 },
            { elem: "F", x: 0.0, y: -1.95, z: 0.0 }
        ],
        title: "Xenon Tetrafluoride (XeF₄)",
        geometry: "Square Planar (sp³d²)",
        weight: "207.29 g/mol"
    },
    // Trigonal Planar (sp2) - e.g., BF3
    BF3: {
        central: { elem: "B", x: 0.0, y: 0.0, z: 0.0 },
        ligands: [
            { elem: "F", x: 1.30, y: 0.0, z: 0.0 },
            { elem: "F", x: -0.65, y: 1.13, z: 0.0 },
            { elem: "F", x: -0.65, y: -1.13, z: 0.0 }
        ],
        title: "Boron Trifluoride (BF₃)",
        geometry: "Trigonal Planar (sp²)",
        weight: "67.81 g/mol"
    }
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
            fetchAndRenderMolecule(mol);
        });
    });

    document.querySelectorAll(".style-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".style-btn").forEach((b) => {
                b.classList.remove("active", "border-cyan-500", "bg-cyan-950/60", "text-cyan-300");
                b.classList.add("border-slate-700", "bg-slate-900/60", "text-slate-400");
            });

            const selected = e.currentTarget;
            selected.classList.add("active", "border-cyan-500", "bg-cyan-950/60", "text-cyan-300");
            selected.classList.remove("border-slate-700", "bg-slate-900/60", "text-slate-400");

            currentStyle = selected.getAttribute("data-style");
            applyStyle();
        });
    });

    document.getElementById("recenterBtn").addEventListener("click", () => {
        if (viewer) {
            viewer.zoomTo();
            viewer.render();
        }
    });

    document.getElementById("spinToggle").addEventListener("click", () => {
        isSpinning = !isSpinning;
        const spinStateEl = document.getElementById("spinState");
        if (isSpinning) {
            viewer.spin("y", 0.8);
            spinStateEl.textContent = "ON";
            spinStateEl.className = "text-emerald-400 font-bold";
        } else {
            viewer.spin(false);
            spinStateEl.textContent = "OFF";
            spinStateEl.className = "text-cyan-400 font-bold";
        }
    });

    fetchAndRenderMolecule("CH4");
});

async function handleSearch() {
    const query = document.getElementById("molInput").value.trim();
    if (query) {
        await fetchAndRenderMolecule(query);
    }
}

async function fetchAndRenderMolecule(query) {
    showLoader(true);
    const cleanKey = query.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // CHECK FALLBACK VSEPR TEMPLATES FIRST FOR HYPERVALENT MOLECULES
    if (GEOMETRY_TEMPLATES[cleanKey]) {
        renderLocalTemplate(GEOMETRY_TEMPLATES[cleanKey]);
        showLoader(false);
        return;
    }

    // ELSE FETCH FROM PUBCHEM API
    try {
        const sdfResponse = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/SDF?record_type=3d`
        );

        if (!sdfResponse.ok) throw new Error("3D Conformer unavailable.");

        const sdfData = await sdfResponse.text();

        const metaResponse = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/Title,MolecularWeight/JSON`
        );
        let metaData = null;
        if (metaResponse.ok) {
            const metaJson = await metaResponse.json();
            metaData = metaJson.PropertyTable.Properties[0];
        }

        viewer.clear();
        currentModel = viewer.addModel(sdfData, "sdf");

        applyStyle();
        viewer.zoomTo();
        if (isSpinning) viewer.spin("y", 0.8);
        viewer.render();

        document.getElementById("molName").textContent = metaData?.Title || query.toUpperCase();
        document.getElementById("molDetails").textContent = `3D conformer structure loaded via PubChem.`;
        document.getElementById("atomCount").textContent = currentModel.selectedAtoms({}).length || "--";
        document.getElementById("molWeight").textContent = metaData?.MolecularWeight ? `${metaData.MolecularWeight} g/mol` : "--";
        document.getElementById("sourceBadge").textContent = "PubChem 3D";

    } catch (error) {
        document.getElementById("molName").textContent = "Structure Not Found";
        document.getElementById("molDetails").textContent = `Could not fetch 3D coordinates for "${query}". Try CH4, H2O, NH3, or hypervalent examples like SF6, PCl5, XeF4, BF3.`;
        document.getElementById("atomCount").textContent = "--";
        document.getElementById("molWeight").textContent = "--";
    } finally {
        showLoader(false);
    }
}

// Convert JSON VSEPR Templates into XYZ format for 3Dmol.js
function renderLocalTemplate(template) {
    const atomCount = 1 + template.ligands.length;
    let xyzData = `${atomCount}\n${template.title}\n`;
    xyzData += `${template.central.elem}\t${template.central.x}\t${template.central.y}\t${template.central.z}\n`;

    template.ligands.forEach((lig) => {
        xyzData += `${lig.elem}\t${lig.x}\t${lig.y}\t${lig.z}\n`;
    });

    viewer.clear();
    currentModel = viewer.addModel(xyzData, "xyz");

    applyStyle();
    viewer.zoomTo();
    if (isSpinning) viewer.spin("y", 0.8);
    viewer.render();

    document.getElementById("molName").textContent = template.title;
    document.getElementById("molDetails").textContent = `Geometry: ${template.geometry}`;
    document.getElementById("atomCount").textContent = atomCount;
    document.getElementById("molWeight").textContent = template.weight;
    document.getElementById("sourceBadge").textContent = "VSEPR Engine";
}

function applyStyle() {
    if (!viewer) return;

    viewer.setStyle({}, {});

    if (currentStyle === "ballAndStick") {
        viewer.setStyle({}, {
            stick: { radius: 0.14, colorscheme: "Jmol" },
            sphere: { scale: 0.28, colorscheme: "Jmol" }
        });
    } else if (currentStyle === "spacefill") {
        viewer.setStyle({}, {
            sphere: { scale: 0.9, colorscheme: "Jmol" }
        });
    } else if (currentStyle === "stick") {
        viewer.setStyle({}, {
            stick: { radius: 0.22, colorscheme: "Jmol" }
        });
    }

    viewer.render();
}

function showLoader(show) {
    const loader = document.getElementById("loader");
    if (show) {
        loader.classList.remove("opacity-0", "pointer-events-none");
    } else {
        loader.classList.add("opacity-0", "pointer-events-none");
    }
}