// 'load_file' from https://github.com/copy/v86/blob/fc6ffc1734bc223436813692ab431578b906f32a/src/lib.js#L608, modified.
async function load_file(filename, options, n_tries) {
    const http = new XMLHttpRequest();

    const abort = () => http.abort();

    if (options.signal) {
        if (options.signal.aborted) return;
        options.signal.addEventListener("abort", abort, { once: true });
    }

    http.open(options.method || "get", filename, true);

    if (options.as_json) {
        http.responseType = "json";
    }
    else {
        http.responseType = "arraybuffer";
    }

    if (options.headers) {
        const header_names = Object.keys(options.headers);

        for (let i = 0; i < header_names.length; i++) {
            const name = header_names[i];
            http.setRequestHeader(name, options.headers[name]);
        }
    }

    if (options.range) {
        const start = options.range.start;
        const end = start + options.range.length - 1;
        http.setRequestHeader("Range", "bytes=" + start + "-" + end);
        http.setRequestHeader("X-Accept-Encoding", "identity");

        // Abort if server responds with complete file in response to range
        // request, to prevent downloading large files from broken http servers
        http.onreadystatechange = () => {
            if (http.status === 200) {
                console.error("Server sent full file in response to ranged request, aborting", { filename });
                http.abort();
            }
        };
    }

    http.onload = (e) => {
        if (options.signal) options.signal.removeEventListener("abort", abort);

        if (http.readyState === 4) {
            if (http.status !== 200 && http.status !== 206) {
                console.error("Loading the image " + filename + " failed (status %d)", http.status);
                if (http.status >= 500 && http.status < 600) {
                    retry();
                }
            }
            else if (http.response) {
                if (options.range) {
                    const enc = http.getResponseHeader("Content-Encoding");
                    if (enc && enc !== "identity") {
                        console.error("Server sent Content-Encoding in response to ranged request", { filename, enc });
                    }
                }
                options.done && options.done(http.response, http);
            }
        }
    };

    http.onerror = (e) => {
        if (options.signal) options.signal.removeEventListener("abort", abort);

        console.error("Loading the image " + filename + " failed", e);
        retry();
    };

    if (options.progress) {
        http.onprogress = (progress) => {
            options.progress({
                filename, progress
            });
        };
    }

    http.send(null);

    const retry = () => {
        const number_of_tries = n_tries || 0;
        const timeout = [1, 1, 2, 3, 5, 8, 13, 21][number_of_tries] || 34;
        setTimeout(() => {
            load_file(filename, options, number_of_tries + 1);
        }, 1000 * timeout);
    }
};

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

// Formats bytes to KBs or MBs
function formatBytes(bytes) {
    if (bytes < 1024 * 1024) {
        const kb = bytes / 1024;
        return `${kb.toFixed(2)} KB`;
    } else {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    }
}

async function decompressBytesGzip(bytes) {
    const blob = new Blob([bytes]);
    const ds = new DecompressionStream("gzip");
    const decompressedStream = blob.stream().pipeThrough(ds);
    return await (await new Response(decompressedStream).blob()).bytes();
}