let biosArrayBuffer = null, stateArrayBuffer = null, wasmArrayBuffer = null;

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

// It's called in analyzeFile
function analyzeFileTemplateWithCallback(fileName) {
    const uploadSection = document.getElementById("upload-section");
    const analysisSection = document.getElementById("analysis-section");
    const againBtn = document.getElementById("again-btn");

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

    // Starts a timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
        document.getElementById("elapsed-time").textContent = elapsedSeconds;
    }, 100);

    let completedStages = 0, isEntrypointPE = false;

    // render... functions are from renderer.js
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
                entropyStage.innerHTML = renderEntropy(res);
                completedStages++;
                break;
            case "strings":
                renderStrings(res, stringsStage);
                completedStages++;
                break;
            case "entrypointPE":
                if (res) {
                    entrypointStage.innerHTML = renderEntrypoint(res);
                    isEntrypointPE = true;
                }
                completedStages++;
                break;
            case "entrypointELF":
                if (res) {
                    entrypointStage.innerHTML = renderEntrypoint(res);
                } else if (!isEntrypointPE) {
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
        if (completedStages == 8) {
            clearInterval(timerInterval);
            againBtn.style.display = "block";
        }
    };

    return callback;
}

const analysisTypes = ["detects", "info", "entropy", "sections", "entrypointPE", "entrypointELF", "hashes", "strings"];

function createAnalysisWorker(type, bytes) {
    const worker = new Worker("analysisWorker.js");
    worker.postMessage({
        type,
        data: {
            flags: getDieFlags(),
            bytes,
            biosBytes: biosArrayBuffer,
            stateBytes: stateArrayBuffer,
            wasmBytes: wasmArrayBuffer
        }
    });
    return worker;
}

// Parallel analysis (faster, all stages run together)
function parallelAnalysis(cb, bytes) {
    // Creating a worker with V86 instance for each analysis type, so we don't need to wait much and we can terminate the worker easily
    analysisTypes.forEach(type => {
        const worker = createAnalysisWorker(type, bytes);

        worker.onmessage = (e) => {
            const data = e.data;
            if (data.type === "finished") {
                worker.terminate();
            } else {
                cb(data.type, data.data);
            }
        };
    });
}

// Sequential analysis (slower, stages run one by one)
function sequentialAnalysis(cb, bytes) {
    let typesArr = analysisTypes;

    const analysisProcessCallback = () => {
        if (typesArr.length != 0) {
            const type = typesArr.shift();

            const worker = createAnalysisWorker(type, bytes);

            worker.onmessage = (e) => {
                const data = e.data;
                if (data.type === "finished") {
                    worker.terminate();
                    analysisProcessCallback();
                } else {
                    cb(data.type, data.data);
                }
            };
        }
    };

    analysisProcessCallback();
}

// Analyses file
function analyzeFile(file) {
    fileToUint8Array(file).then(bytes => {
        const cb = analyzeFileTemplateWithCallback(file.name);

        if (document.querySelector('input[name="analysis"]:checked').value === "parallel") {
            parallelAnalysis(cb, bytes);
        } else {
            sequentialAnalysis(cb, bytes);
        }
    });
}

// Shows download progress
function showDownloadProgress(e) {
    const emulatorDownloadProgress = document.getElementById("emulator-download-progress");
    const progress = e.progress;
    if (progress.target.status === 200) {
        const percent = Math.round((progress.loaded / progress.total) * 100);

        const loadedStr = formatBytes(progress.loaded);
        const totalStr = formatBytes(progress.total);

        document.getElementById("download-progress-big").innerHTML = `File <strong>${e.filename}</strong>`
        document.getElementById("download-progress-small").innerHTML = `${percent}% (${loadedStr} / ${totalStr})`
        document.getElementById("download-progress-bar").style.width = `${percent}%`;
    } else {
        emulatorDownloadProgress.innerHTML = `Loading <strong>${e.filename}</strong> failed. Check your connection and reload the page to try again.`;
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

        document.getElementById("sections-stage").style.display = "block";
        document.getElementById("entrypoint-stage").style.display = "block";

        document.getElementById("again-btn").style.display = "none";
        document.getElementById("detects-content").innerHTML = spinner;
        document.getElementById("info-content").innerHTML = spinner;
        document.getElementById("hashes-content").innerHTML = spinner;
        document.getElementById("entropy-content").innerHTML = spinner;
        document.getElementById("strings-content").innerHTML = spinner;
        document.getElementById("entrypoint-content").innerHTML = spinner;
        document.getElementById("sections-content").innerHTML = spinner;
    };

    // Loads files
    load_file("v86.wasm.gz", {
        done: wasmBytes => {
            load_file("seabios.bin", {
                done: biosBytes => {
                    load_file("v86state.bin.zst", {
                        done: stateBytes => {
                            // Decompressing v86.wasm
                            decompressBytesGzip(wasmBytes).then(wasmBytes => {
                                emulatorDownloadProgress.style.display = "none";
                                uploadSection.style.opacity = "1";
                                uploadSection.style.pointerEvents = "auto";
                                fileInput.disabled = false;
                                setupUpload();

                                biosArrayBuffer = biosBytes;
                                stateArrayBuffer = stateBytes;
                                wasmArrayBuffer = wasmBytes;
                            });
                        },
                        progress: showDownloadProgress
                    })
                },
                progress: showDownloadProgress
            })
        },
        progress: showDownloadProgress
    })
}
