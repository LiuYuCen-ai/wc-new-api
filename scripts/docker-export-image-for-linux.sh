#!/usr/bin/env bash
# Build current-repo New API (default + classic frontend + Go) and export a tar for Linux.
#
# Usage (from repository root, same directory as Dockerfile):
#   chmod +x scripts/docker-export-image-for-linux.sh
#   ./scripts/docker-export-image-for-linux.sh [output.tar]
#
# Default output: ./new-api-local-docker.tar
#
# Transfer + run on Linux (needs docker-compose.yml + docker-compose.from-tar.yml on server):
#   scp new-api-local-docker.tar docker-compose.yml docker-compose.from-tar.yml user@host:~/
#   ssh user@host 'docker load -i new-api-local-docker.tar && docker compose -p newapi -f docker-compose.yml -f docker-compose.from-tar.yml up -d'
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGE_TAG="${IMAGE_TAG:-new-api:latest}"
OUTPUT_TAR="${1:-${ROOT}/new-api-local-docker.tar}"

echo "==> Building ${IMAGE_TAG} from ${ROOT}/Dockerfile (can take several minutes)"
docker build -t "${IMAGE_TAG}" -f Dockerfile .

echo "==> Saving image to ${OUTPUT_TAR}"
docker save -o "${OUTPUT_TAR}" "${IMAGE_TAG}"

echo "==> Done."
echo "    Image tag: ${IMAGE_TAG}"
echo "    Tar file:  ${OUTPUT_TAR}"
echo ""
echo "Next on Linux: docker load -i $(basename "${OUTPUT_TAR}")"
echo "Then: docker compose -p newapi -f docker-compose.yml -f docker-compose.from-tar.yml up -d"
