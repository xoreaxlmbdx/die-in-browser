let detectItEasy = null;

// Converts file to Uint8Array
function fileToUint8Array(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const uint8Array = new Uint8Array(reader.result);
            resolve(uint8Array);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

// Setups upload
function setupUpload() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");

    // On file input click
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) analyzeFile(file);
    });

    // Drag & Drop
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) analyzeFile(file);
    });

    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());
}

function getDieFlags() {
    const flags = [];
    if (document.getElementById("opt-recursive").checked) flags.push("r");
    if (document.getElementById("opt-deep").checked) flags.push("d");
    if (document.getElementById("opt-heuristic").checked) flags.push("u");
    if (document.getElementById("opt-aggressive").checked) flags.push("g");
    if (document.getElementById("opt-alltypes").checked) flags.push("a");
    return flags.join("");
}

// It's called in analyzeFile
function analyzeFileTemplateWithCallback(fileName) {
    const uploadSection = document.getElementById("upload-section");
    const analysisSection = document.getElementById("analysis-section");

    const detectsStage = document.getElementById("detects-content"),
        infoStage = document.getElementById("info-content"),
        hashesStage = document.getElementById("hashes-content"),
        entropyStage = document.getElementById("entropy-content"),
        stringsStage = document.getElementById("strings-content"),
        entrypointStage = document.getElementById("entrypoint-content"),
        sectionsStage = document.getElementById("sections-content"); 
    
    document.getElementById("file-name").textContent = fileName;

    uploadSection.style.display = "none";
    analysisSection.style.display = "block";

    // Start timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
        document.getElementById("elapsed-time").textContent = elapsedSeconds;
    }, 100);

    let completedStages = 0;

    document.getElementById("entrypoint-stage").style.display = "block"

    // renderDetects, renderInfo, renderHashes are from renderer.js
    const callback = (type, res) => {
        switch (type) {
            case "detects":
                detectsStage.innerHTML = renderDetects(res);
                completedStages++;
                break;
            case "info":
                infoStage.innerHTML = renderInfo(res);
                completedStages++;
                break;
            case "hashes":
                hashesStage.innerHTML = renderHashes(res);
                completedStages++;
                break;
            case "entropy":
                entropyStage.innerHTML = `<code>${res.data ? res.data.Entropy : ""}</code>`;
                completedStages++;
                break;
            case "strings":
                renderStrings(res, stringsStage);
                completedStages++;
                break;
            case "entrypoint":
                if (res) {
                    entrypointStage.innerHTML = renderEntrypoint(res);
                } else {
                    document.getElementById("entrypoint-stage").style.display = "none";
                }
                completedStages++;
                break;
            case "sections":
                if (res) {
                    sectionsStage.innerHTML = renderSections(res);
                } else {
                    document.getElementById("sections-stage").style.display = "none";
                }
                completedStages++;
                break;
        }

        // If analysis is done
        if (completedStages == 7) {
            clearInterval(timerInterval);
            document.getElementById("again-btn").style.display = "block";
        }
    };

    return callback;
}

// Analyses file
function analyzeFile(file) {
    if (detectItEasy) {
        fileToUint8Array(file).then(bytes => {
            const cb = analyzeFileTemplateWithCallback(file.name);
            detectItEasy.createFileAndAnalyze(bytes, getDieFlags(), cb);
        })
    }
}

window.onload = () => {
    const uploadSection = document.getElementById("upload-section");
    const analysisSection = document.getElementById("analysis-section");
    const emulatorDownloadProgress = document.getElementById("emulator-download-progress");
    const fileInput = document.getElementById("file-input");

    const spinner = `<div class="spinner"></div>`;

    // Button "Analyze another"
    document.getElementById("again-btn").onclick = () => {
        analysisSection.style.display = "none";
        uploadSection.style.display = "block";
        document.getElementById("detects-content").innerHTML = spinner;
        document.getElementById("info-content").innerHTML = spinner;
        document.getElementById("hashes-content").innerHTML = spinner;
        document.getElementById("entropy-content").innerHTML = spinner;
        document.getElementById("strings-content").innerHTML = spinner;
        document.getElementById("entrypoint-content").innerHTML = spinner;
        document.getElementById("sections-content").innerHTML = spinner;
    };

    // Creating emulator
    detectItEasy = window.DIE = new DIEInBrowser({
        wasm_path: "v86.wasm",
        bios: {
            url: "seabios.bin",
        },
        vga_bios: {
            url: "vgabios.bin",
        },
        initial_state: {
            url: "v86state.bin.zst"
        },
    });

    // On download progress
    detectItEasy.emulator.add_listener("download-progress", (e) => {
        const percent = Math.round((e.loaded / (!e.total ? e.loaded : e.total)) * 100);
        emulatorDownloadProgress.textContent = `File ${e.file_name} (${e.file_index + 1}/${e.file_count}): ${percent}%`;
    });
    // On download error
    detectItEasy.emulator.add_listener("download-error", (e) => {
        emulatorDownloadProgress.textContent = `Loading ${e.file_name} failed. Check your connection and reload the page to try again.`;
    });

    // Emulator ready
    detectItEasy.emulator.add_listener("emulator-ready", () => {
        emulatorDownloadProgress.textContent = "";
        uploadSection.style.opacity = "1";
        uploadSection.style.pointerEvents = "auto";
        fileInput.disabled = false;
        setupUpload();
    });
}
