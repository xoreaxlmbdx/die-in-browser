class DIEInBrowser {
    static SHARED_FILE_NAME = "file.bin";
    static DIE_BASE_COMMAND = "./run_diec.sh -C db_extra";

    constructor(config) {
        // Creating emulator
        this.emulator = window.emulator = new V86({
            memory_size: 512 * 1024 * 1024,
            vga_memory_size: 8 * 1024 * 1024,
            autostart: true,
            filesystem: {},
            disable_keyboard: true,
            disable_mouse: true,
            ...config
        });
    }

    runCommand(command, callback) {
        // Sending command
        emulator.serial0_send(command + "\n");

        // Creating temporary serial output listener

        let buffer = "";

        const serialOutputListener = (byte) => {
            const char = String.fromCharCode(byte);
            buffer += char;

            // Checking if there's sh marker
            if (buffer.endsWith("# ")) {
                // Return only program output
                callback(buffer.split(/\r?\n/).slice(1, -1).join("\n"));
                this.emulator.remove_listener("serial0-output-byte", serialOutputListener);
            }
        };

        this.emulator.add_listener("serial0-output-byte", serialOutputListener);
    }

    createFileAndAnalyze(bytes, flags, callback) {
        const sharedName = DIEInBrowser.SHARED_FILE_NAME;
        this.emulator.create_file(sharedName, bytes).then(() => {
            this.analyzeFile(`/mnt/${sharedName}`, flags, callback);
        });
    }

    analyzeAdditionalInfo(path, methodsList, callback) {
        // Entry point (PE)
        if (methodsList.includes("IMAGE_NT_HEADERS")) {
            this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} ${path} -j -S "IMAGE_NT_HEADERS"`, imageNtHeaders => {
                try {
                    imageNtHeaders = JSON.parse(imageNtHeaders);
                    let baseAddress = "", entrypoint = "";
                    if (imageNtHeaders?.data?.IMAGE_NT_HEADERS?.IMAGE_OPTIONAL_HEADER?.AddressOfEntryPoint) {
                        entrypoint = imageNtHeaders.data.IMAGE_NT_HEADERS.IMAGE_OPTIONAL_HEADER.AddressOfEntryPoint;
                    }
                    if (imageNtHeaders?.data?.IMAGE_NT_HEADERS?.IMAGE_OPTIONAL_HEADER?.ImageBase) {
                        baseAddress = imageNtHeaders.data.IMAGE_NT_HEADERS.IMAGE_OPTIONAL_HEADER.ImageBase;
                    }
                    imageNtHeaders = {
                        "Base address": baseAddress,
                        "Entry point": entrypoint
                    };
                } catch (e) {
                    imageNtHeaders = {
                        error: String(e),
                        raw: imageNtHeaders
                    };
                }
                callback("entrypoint", imageNtHeaders);
                // Sections (PE)
                if (methodsList.includes("IMAGE_SECTION_HEADER")) {
                    this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} ${path} -j -S "IMAGE_SECTION_HEADER"`, imageSectionHeader => {
                        try {
                            imageSectionHeader = JSON.parse(imageSectionHeader.slice(imageSectionHeader.indexOf("{")).trimStart());
                        } catch (e) {
                            imageSectionHeader = {
                                error: String(e),
                                raw: imageSectionHeader
                            };
                        }
                        callback("sections", imageSectionHeader);
                    });
                }
            });
        }

        // Entry point (ELF)
        if (methodsList.includes("Elf_Ehdr")) {
            this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} ${path} -j -S "Elf_Ehdr"`, elfEhdr => {
                try {
                    elfEhdr = JSON.parse(elfEhdr);
                    if (elfEhdr?.data?.Elf_Ehdr?.entry) {
                        elfEhdr = {
                            "Entry point": elfEhdr.data.Elf_Ehdr.entry
                        };
                    }
                } catch (e) {
                    elfEhdr = {
                        error: String(e),
                        raw: elfEhdr
                    };
                }
                callback("entrypoint", elfEhdr);
            });
        }
    }

    analyzeFile(path, flags, callback) {
        // Finds additional diec methods
        this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} ${path} -m`, methodsRaw => {
            const methodsList = methodsRaw.split("\n").slice(5).map(s => s.trim());

            // If there are no sections in file (only in PE format)
            if (!methodsList.includes("IMAGE_SECTION_HEADER")) {
                callback("sections", null);
            }
            // If there are no entrypoints in file
            if (!methodsList.includes("IMAGE_NT_HEADERS") && !methodsList.includes("Elf_Ehdr")) {
                callback("entrypoint", null);
            }

            // Detects
            this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} -bj${flags} ${path}`, detects => {
                try {
                    detects = JSON.parse(detects.slice(detects.indexOf("{")).trimStart());
                } catch (e) {
                    detects = {
                        error: String(e),
                        raw: detects
                    };
                }
                callback("detects", detects);

                // Info
                this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} -ij ${path}`, info => {
                    try {
                        info = JSON.parse(info);
                    } catch (e) {
                        info = {
                            error: String(e),
                            raw: info
                        };
                    }
                    callback("info", info);

                    // Hashes
                    this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} -j -S "Hash" ${path}`, hashes => {
                        try {
                            hashes = JSON.parse(hashes);
                        } catch (e) {
                            hashes = {
                                error: String(e),
                                raw: hashes
                            };
                        }
                        callback("hashes", hashes);

                        // Entropy
                        this.runCommand(`${DIEInBrowser.DIE_BASE_COMMAND} -j -S "Entropy" ${path}`, entropy => {
                            try {
                                entropy = JSON.parse(entropy);
                            } catch (e) {
                                entropy = {
                                    error: String(e),
                                    raw: entropy
                                };
                            }
                            callback("entropy", entropy);

                            // Strings
                            this.runCommand(`strings -t x ${path} | base64`, strings => {
                                callback("strings", atob(strings))

                                // Analyze additional info in binary
                                this.analyzeAdditionalInfo(path, methodsList, callback);
                            });
                        });
                    });
                });
            });
        });
    }
}
