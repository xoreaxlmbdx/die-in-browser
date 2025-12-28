import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import { V86 } from "./libv86.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

// Creating emulator
var emulator = new V86({
    wasm_path: path.join(__dirname, "v86.wasm"),
    bios: { url: path.join(__dirname, "seabios.bin") },
    vga_bios: { url: path.join(__dirname, "vgabios.bin") },
    autostart: true,
    memory_size: 512 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    initrd: { url: path.join(__dirname, "rootfs.cpio.gz") },
    bzimage: { url: path.join(__dirname, "bzImage") },
    filesystem: {}
});

console.log("Booting");

let serial_text = "";
let booted = false;

// Listening for serial output
emulator.add_listener("serial0-output-byte", function(byte) {
    const c = String.fromCharCode(byte);
    process.stdout.write(c);

    serial_text += c;

    if (!booted && serial_text.endsWith("~ # ")) {
        booted = true;

        console.log("Booted");

        emulator.serial0_send("cd /die_build;sync;echo 3 >/proc/sys/vm/drop_caches\n");

        // Saving state
        setTimeout(async function () {
            const s = await emulator.save_state();

            fs.writeFile("./buildroot-state.bin", new Uint8Array(s), function(e) {
                if(e) throw e;
                console.log("Saved");
                emulator.destroy();
            });
        }, 1000);
    }
});