# --- Stage 1. Builds DIE.

FROM i386/debian:bullseye AS builder

RUN apt-get update && \
    apt-get install -y \
        qtbase5-dev \
        qtscript5-dev \
        qttools5-dev-tools \
        libqt5svg5-dev \
        git \
        lsb-release \
        wget \
        build-essential && \
    rm -rf /var/lib/apt/lists/*

# Clones DIE
RUN git clone --recursive --branch 3.10 https://github.com/horsicq/DIE-engine.git

WORKDIR /DIE-engine

# Builds diec. It may fail to build the GUI version (die), so the script may exit with code 2, it suppresses this error
RUN bash -x build_dpkg.sh || true
RUN test -f build/release/diec

# Copy diec & all libs to /build
RUN mkdir /build && \
    cp build/release/diec /build/diec && \
    ldd /build/diec | awk 'NF == 4 { system("cp " $3 " /build") }' && \
    rm /build/libc.so.6 /build/libpthread.so.0 /build/libdl.so.2 /build/libgcc_s.so.1 /build/libm.so.6 && \
    cp -r Detect-It-Easy/db Detect-It-Easy/db_extra /build

COPY scripts/run_diec.sh /build

# --- Stage 2. Builds Buildroot.

FROM debian:bullseye AS buildroot

# Copy v86 buildroot board config into image
COPY ./buildroot-v86 /buildroot-v86
COPY --from=builder /build /buildroot-v86/board/v86/rootfs_overlay/die_build

RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get -y install bc build-essential bzr cpio cvs git unzip wget libc6:i386 libncurses5-dev libssl-dev rsync file && \
    wget -c https://github.com/buildroot/buildroot/archive/refs/tags/2025.11.tar.gz && \
    tar axf 2025.11.tar.gz && \
    mv /buildroot-2025.11 /buildroot

ENV FORCE_UNSAFE_CONFIGURE=1

# Builds Buildroot, licenses, and caches some directories
WORKDIR /buildroot
RUN --mount=type=cache,target=/root/.buildroot-ccache \
    --mount=type=cache,target=/buildroot/dl \
    set -e; \
    make BR2_EXTERNAL=/buildroot-v86 v86_defconfig && \
    make legal-info && \
    make -j$(nproc) && \
    mkdir licenses && \
    cp -r output/legal-info/host-licenses/ output/legal-info/licenses/ output/legal-info/buildroot.config licenses && \
    cp -r output/images /build && \
    tar -czf /build/licenses.tar.gz licenses

# --- Stage 3. Builds initial state.

FROM node:bullseye AS initial-state

WORKDIR /v86

RUN wget -c https://github.com/copy/v86/releases/download/latest/v86.wasm && \
    wget -c https://github.com/copy/v86/releases/download/latest/libv86.js && \
    wget -c https://github.com/copy/v86/raw/refs/heads/master/bios/seabios.bin && \
    wget -c https://github.com/copy/v86/raw/refs/heads/master/bios/vgabios.bin

COPY --from=buildroot /build/rootfs.cpio /build/bzImage /build/licenses.tar.gz /v86

RUN apt-get update && \
    apt-get install -y zstd && \
    gzip rootfs.cpio

# Builds initial state
COPY scripts/nodejs_state.js /v86

# Compresses initial state
RUN node nodejs_state.js && \
    zstd -19 buildroot-state.bin && \
    rm rootfs.cpio.gz bzImage buildroot-state.bin nodejs_state.js

# --- Stage 4. Exports compressed initial state.

FROM scratch AS export
COPY --from=initial-state /v86 .
