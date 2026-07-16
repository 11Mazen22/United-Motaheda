#!/bin/bash
set -e

# Start ollama server in background
ollama serve &
SERVER_PID=$!

# Wait for server to start
sleep 10

# Pull neural-chat model
ollama pull neural-chat

# Keep container running
wait $SERVER_PID
