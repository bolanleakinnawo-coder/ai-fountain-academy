#!/bin/bash
cd "$(dirname "$0")"
echo "Starting AI Fountain Academy preview at http://localhost:3000 ..."
(sleep 2 && open http://localhost:3000) &
npx --yes serve public -l 3000
