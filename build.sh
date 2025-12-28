#!/bin/sh
set -e

DOCKER_BUILDKIT=1 docker build -t die-in-browser --output=./build .