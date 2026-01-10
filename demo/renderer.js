
// Escapes HTML
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Generates HTML for hashes
function renderHashes(hashes) {
    if (hashes?.data?.Hash) {
        let html = `<ul>`;
        Object.entries(hashes.data.Hash).forEach(([key, value]) => {
            html += `<li><strong>${key}</strong>: <code>${value}</code></li>`;
        });
        return html + "</ul>";
    }
    return JSON.stringify(hashes);
}

// Generates HTML for info
function renderInfo(info) {
    if (info?.data?.Info) {
        const str = info.data.Info.String;
        let html = `${str ? `<strong>${str}</strong>` : ""}<ul>`;
        Object.entries(info.data.Info).forEach(([key, value]) => {
            if (key != "String") html += `<li><strong>${key}</strong>: <code>${value}</code></li>`;
        });
        return html + "</ul>";
    }
    return JSON.stringify(info);
}

// Returns different text color for every type (https://github.com/horsicq/XScanEngine/blob/master/xscanengine.cpp#L1175) 
function getDetectedValueStyle(type) {
    type = type.toLowerCase().replaceAll("~", "").replaceAll("!", "");
    if ((type == "installer") || (type == "sfx") || (type == "archive")) {
        return "blue";
    } else if ((type == "protector") || (type == "apk obfuscator") || (type == "jar obfuscator") || (type == ".net obfuscator") || (type == ".net compressor") ||
        (type == "dongle protection") || (type == "joiner") || (type == "packer") || (type == "protection") || (type == "crypter") || (type == "cryptor")) {
        return "red";
    } else if ((type == "pe tool") || (type == "apk tool")) {
        return "green";
    } else if ((type == "operation system") || (type == "virtual machine") || (type == "platform") || (type == "dos extender")) {
        return "goldenrod";
    } else if (type == "format") {
        return "darkgreen";
    } else if ((type == "sign tool") || (type == "certificate") || (type == "licensing")) {
        return "darkmagenta";
    } else if (type == "language") {
        return "darkcyan";
    } else if ((type == "corrupted data") || (type == "personal data") || (type == "author")) {
        return "darkred";
    } else if ((type == "virus") || (type == "trojan") || (type == "malware")) {
        return "red";
    } else if ((type == "debug") || (type == "debug data")) {
        return "darkblue";
    }
    return null;
}

/*
{
    "info": "Universal, Data, Package",
    "name": "JVM",
    "string": "Virtual machine: JVM[Universal, Data, Package]",
    "type": "Virtual machine",
    "version": ""
}
*/
function renderDetectedTypeNode(node) {
    const color = getDetectedValueStyle(node.type);
    return `<li${color ? ` style="color: ${color};"` : ""}>${node.string}</li>`;
}

/*
{
    filetype": "JAR",
    info": "",
    offset": "0",
    parentfilepart": "Header",
    size": "0",
    values": [ ... ]
}
*/
function renderDetectedFiletypeNode(node) {
    let list = `<li><strong>${node.filetype}</strong><ul>`;
    if (node.values) {
        node.values.forEach(value => {
            list += renderDetectedNode(value);
        })
        return list + "</ul></li>";
    };
    return JSON.stringify(node);
}
// Detects node (with filetype or with type)
function renderDetectedNode(node) {
    if (node.filetype) {
        return renderDetectedFiletypeNode(node);
    } else if (node.type) {
        return renderDetectedTypeNode(node);
    }
    return JSON.stringify(node);
}
// Generates HTML for detects
function renderDetects(detects) {
    if (detects.detects) {
        detects = detects.detects;
        let html = `<ul>`;
        detects.forEach(detect => {
            html += renderDetectedNode(detect);
        });
        return html + "</ul>";
    }
    return JSON.stringify(detects);
}

// Generates HTML for entry point
function renderEntrypoint(entrypoint) {
    if (!entrypoint.error) {
        let html = `<ul>`;
        Object.entries(entrypoint).forEach(([key, value]) => {
            html += `<li><strong>${key}</strong>: <code>${value}</code></li>`;
        });
        return html + "</ul>";
    }
    return JSON.stringify(entrypoint);
}

// Generates HTML for strings and sets it in container
function renderStrings(strings, container) {
    let strIndex = 0;
    strings = strings.trim().split("\n").map(s => s.trim()).map(s => {
        const firstSpaceIndex = s.indexOf(" ");
        if (firstSpaceIndex === -1) {
            return null;
        }
        const offset = s.substring(0, firstSpaceIndex);
        const str = s.substring(firstSpaceIndex + 1);
        return { index: strIndex++, offset, str };
    });

    const searchInput = document.createElement("input");
    searchInput.placeholder = "Search";
    const stringsDiv = document.createElement("div");

    container.innerHTML = "";
    container.appendChild(searchInput);
    container.appendChild(stringsDiv);

    const genHTML = (list) => {
        let html = `<div style="max-height: 500px; overflow: auto;"><table><thead><tr>
        <th>#</th>
        <th>Offset</th>
        <th>String</th>
        </tr></thead><tbody>`;
        list.forEach(s => {
            if (s) {
                html += `<tr> <td>${s.index}</td> <td><code>${s.offset}</code></td> <td>${escapeHtml(s.str)}</td> </tr>`;
            }
        });
        return html + `</tbody></table></div>`
    }

    stringsDiv.innerHTML = genHTML(strings);

    searchInput.addEventListener("input", () => {
        const value = searchInput.value.toLowerCase();
        stringsDiv.innerHTML = genHTML(strings.filter(s => s ? (s.str.toLowerCase().includes(value)) : false));
    });
}

// From https://github.com/horsicq/Formats/blob/master/exec/xpe.cpp
function sectionCharacteristicToString(value) {
    const S_IMAGE_SCN_MEM_READ = 0x40000000, S_IMAGE_SCN_MEM_WRITE = 0x80000000, S_IMAGE_SCN_MEM_EXECUTE = 0x20000000;

    let result = "";
    if (value & S_IMAGE_SCN_MEM_READ) {
        result += "R";
    }
    if (value & S_IMAGE_SCN_MEM_WRITE) {
        result += "W";
    }
    if (value & S_IMAGE_SCN_MEM_EXECUTE) {
        result += "E";
    }
    return result;
}

// Generates HTML for sections
function renderSections(sections) {
    if (sections?.data?.IMAGE_SECTION_HEADER) {
        let html = `<table><thead><tr>
        <th>#</th>
        <th>Name</th>
        <th>Relative address</th>
        <th>Virtual size</th>
        <th>File offset</th>
        <th>Size</th>
        <th>Flags</th>
        </tr></thead><tbody>`;
        Object.entries(sections.data.IMAGE_SECTION_HEADER).forEach(([key, value]) => {
            html += `<tr>
            <td>${key}</td>
            <td>${escapeHtml(value.Name)}</td>
            <td><code>${value.VirtualAddress}</code></td>
            <td><code>${value.VirtualSize}</code></td>
            <td><code>${value.PointerToRawData}</code></td>
            <td><code>${value.SizeOfRawData}</code></td>
            <td>${sectionCharacteristicToString(parseInt(value.Characteristics, 16))}</td>
            </tr>`;
        });
        return html + `</tbody></table>`;
    }
    return JSON.stringify(sections);
}