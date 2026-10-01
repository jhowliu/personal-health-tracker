#!/usr/bin/env bash
# Build the API image here (the VPS has 1 CPU / 1 GB), ship it over SSH and restart it.
# Run from the repo root: ops/deploy.sh
set -euo pipefail

REMOTE=${REMOTE:-wendy@194.195.127.196}
REMOTE_DIR=${REMOTE_DIR:-pht}

# The image tag names a commit; mark it when backend/ has changes the commit doesn't.
TAG=$(git rev-parse --short HEAD)
git diff --quiet HEAD -- backend || TAG="$TAG-dirty"

docker buildx build --platform linux/amd64 -t "pht-api:$TAG" -t pht-api:latest --load backend
docker save "pht-api:$TAG" pht-api:latest | gzip | ssh "$REMOTE" 'gunzip | docker load'
scp docker-compose.prod.yml "$REMOTE:$REMOTE_DIR/docker-compose.yml"
ssh "$REMOTE" "cd $REMOTE_DIR && PHT_TAG=$TAG docker-compose up -d && docker image prune -f >/dev/null"

echo "Deployed pht-api:$TAG. Roll back with: ssh $REMOTE 'cd $REMOTE_DIR && PHT_TAG=<old-tag> docker-compose up -d'"
