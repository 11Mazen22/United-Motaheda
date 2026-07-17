#!/bin/bash
set -e

# Start ollama server in background
ollama serve &
SERVER_PID=$!

# Wait for server to start
sleep 10

# Pull the requested model with conservative settings
OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_CONTEXT_LENGTH=2048 ollama pull neural-chat

# Keep container running
wait $SERVER_PID
