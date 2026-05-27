#!/bin/bash

# --- Color Definitions ---
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}[1/3] Checking Node.js environment...${NC}"

# Check if node command exists
if ! command -v node &> /dev/null; then
  echo -e "${RED}[ERROR] Node.js is not installed.${NC}"
else
  NODE_VERSION=$(node -v)
fi

# If node version is not v24, try loading nvm and switching
if [[ $NODE_VERSION != v24* ]]; then
  echo -e "${CYAN}Node version is $NODE_VERSION. Looking for NVM...${NC}"
  
  # Try loading NVM from default directories
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    nvm use 24
  elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
    . "/usr/local/opt/nvm/nvm.sh"
    nvm use 24
  fi
  
  NODE_VERSION=$(node -v 2>/dev/null)
  
  if [[ $NODE_VERSION != v24* ]]; then
    echo -e "${RED}[FATAL] Node.js 24 is required. Please run 'nvm install 24' or switch to Node 24 manualy.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}[SUCCESS] Using Node.js: $NODE_VERSION${NC}"

# Start Database
echo -e "${CYAN}[2/3] Booting up database container...${NC}"
docker compose up -d

# TRAP Ctrl+C (SIGINT) to automatically kill background Node processes and turn off docker
trap 'echo -e "\n${RED}[SHUTDOWN] Stopping development servers and containers...${NC}"; kill $(jobs -p) 2>/dev/null; docker compose down; exit' INT

echo -e "${CYAN}[3/3] Launching servers concurrently...${NC}"

# Run backend
npm run start:dev --prefix server &

# Run frontend
npm run dev --prefix client &

# Wait for all background jobs to finish (keeps script running)
wait
