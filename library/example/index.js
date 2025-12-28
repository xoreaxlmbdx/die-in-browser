let detectItEasy = null;

function example1() {
    // Run command
    document.getElementById("commandRunBtn").onclick = () => {
        const input = document.getElementById("commandInput").value;
        // Running command
        detectItEasy.runCommand(input, output => {
            document.getElementById("commandOutput").value = output;
        });
    };
}

function example2() {
    // Run diec command
    document.getElementById("diecRunBtn").onclick = () => {
        const input = document.getElementById("diecInput").value;
        // It is possible that we may be not in /die_build
        detectItEasy.runCommand("cd /die_build", () => {
            document.getElementById("diecOutput").value = "Running ...";
            // run_diec.sh runs diec with its libraries
            detectItEasy.runCommand(`./run_diec.sh ${input}`, output => {
                document.getElementById("diecOutput").value = output;
            });
        });
    };
}

function example3() {
    // On file input click
    document.getElementById("fileInput").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) analyzeFile(file);
    });
}

// Full file analysis

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

function getDieFlags() {
    const flags = [];
    if (document.getElementById("opt-recursive").checked) flags.push("r");
    if (document.getElementById("opt-deep").checked) flags.push("d");
    if (document.getElementById("opt-heuristic").checked) flags.push("u");
    if (document.getElementById("opt-aggressive").checked) flags.push("g");
    if (document.getElementById("opt-alltypes").checked) flags.push("a");
    return flags.join("");
}

function analyzeFile(file) {
    if (detectItEasy) {
        document.getElementById("analysesResults").innerHTML = "";
        
        alert("Starting analysis");
        fileToUint8Array(file).then(bytes => {
            detectItEasy.createFileAndAnalyze(bytes, getDieFlags(), (type, res) => {
                const div = document.createElement("div");
                div.textContent = type;
                div.appendChild(document.createElement("br"));
                const textArea = document.createElement("textarea");
                textArea.rows = "20";
                textArea.cols = "100";
                
                if (typeof res === 'object') {
                    textArea.value = JSON.stringify(res, null, "\t");
                } else {
                    textArea.value = res;
                }

                div.appendChild(textArea);
                document.getElementById("analysesResults").appendChild(div);
            });
        });
    }
}

window.onload = () => {
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
            url: "buildroot-state.bin.zst"
        },
    });

    const loadingDiv = document.getElementById("loading");
    const mainSection = document.getElementById("main");

    detectItEasy.emulator.add_listener("download-progress", (e) => {
        const percent = Math.round((e.loaded / (!e.total ? e.loaded : e.total)) * 100);
        loadingDiv.textContent = `File ${e.file_name} (${e.file_index + 1}/${e.file_count}): ${percent}%`;
    });
    // On download error
    detectItEasy.emulator.add_listener("download-error", (e) => {
        loadingDiv.textContent = `Loading ${e.file_name} failed. Check your connection and reload the page to try again.`;
    });

    // Emulator ready
    detectItEasy.emulator.add_listener("emulator-ready", () => {
        mainSection.style.display = "block";
    });

    example1();
    example2();
    example3();
}