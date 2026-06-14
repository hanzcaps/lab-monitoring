# System Monitor Dashboard

A real-time system monitoring dashboard that displays metrics from MQTT agents via a Python/Node.js backend bridge.

## Overview

This project consists of three main components:

1. **Python Agent** (`agent.py`) - Runs on target machines, collects system metrics, and publishes them via MQTT
2. **Backend** (`backend/`) - Connects to MQTT broker and forwards data to WebSocket/REST clients (available in Python and Node.js)
3. **React Frontend** (`frontend/`) - Real-time dashboard displaying system metrics

## Features

- Real-time CPU, RAM, GPU, Network, and Storage monitoring
- Clean, professional UI with Tailwind CSS
- Support for multiple agents (extensible)
- Responsive design
- Live connection status
- Process monitoring with top CPU/Memory consumers

## Prerequisites

- **For Python Backend:** Python 3.8+, pip
- **For Node.js Backend:** Node.js 18+
- **For Frontend:** Node.js 18+ (or just serve static files)
- **For Agent:** Python 3.8+
- **MQTT Broker:** (e.g., Mosquitto)

## Installation

### 1. Backend Setup

#### Option A: Python Backend (Recommended)

```bash
cd backend
pip install -r requirements.txt
```

Configure the MQTT broker URL via environment variables:
```bash
# Linux/Mac
export MQTT_BROKER_URL=192.168.1.11
export MQTT_BROKER_PORT=1883
export PORT=3001
python server.py

# Windows (Command Prompt)
set MQTT_BROKER_URL=192.168.1.11
set MQTT_BROKER_PORT=1883
set PORT=3001
python server.py
```

#### Option B: Node.js Backend

```bash
cd backend
npm install
```

Configure the MQTT broker URL via environment variable:
```bash
MQTT_BROKER_URL=mqtt://192.168.1.11:1883 npm start
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 3. Agent Setup

Install Python dependencies:
```bash
pip install psutil paho-mqtt pynvml pywin32
```

Run the agent:
```bash
python agent.py
```

## Project Structure

```
system-monitor-dashboard/
├── backend/
│   ├── package.json
│   ├── server.js          # Node.js: Express + Socket.IO + MQTT bridge
│   ├── server.py          # Python: FastAPI + WebSockets + MQTT bridge
│   ├── requirements.txt    # Python dependencies
│   └── .gitignore
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── types/         # TypeScript interfaces
│   │   ├── lib/           # Utilities
│   │   ├── App.tsx        # Main application
│   │   ├── main.tsx       # Entry point
│   │   └── index.css      # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── .gitignore
├── agent.py               # Python MQTT agent
└── README.md
```

## Configuration

### Backend Environment Variables

- `PORT` - Server port (default: 3001)
- `MQTT_BROKER_URL` - MQTT broker host/IP (default: 192.168.1.11)
- `MQTT_BROKER_PORT` - MQTT broker port (default: 1883)

### Python Backend API Endpoints

- `GET /health` - Health check and connection status
- `GET /api/agents` - List all registered agents
- `GET /api/agents/{agent_id}` - Get specific agent data
- `POST /api/agents/{agent_id}/command` - Execute command on agent
- `GET /api/metrics/summary` - Get summary of all agents metrics
- `WS ws://{host}:{port+1}` - WebSocket for real-time updates

### Frontend Environment Variables

- `VITE_SOCKET_URL` - Backend WebSocket URL (default: http://localhost:3001)

## MQTT Topics

- **Agent publishes to:** `lab/monitoring/{HOSTNAME}`
- **Backend subscribes to:** `lab/monitoring/#`

## JSON Payload Format

```json
{
  "id": "HOSTNAME",
  "status": "online",
  "user": "username",
  "time": "14:30:00",
  "info": {
    "uptime": "2h 30m",
    "os": "Windows 10",
    "cpu_name": "Intel Core i7"
  },
  "network": {
    "down_mbps": 12.5,
    "traffic_in_gb": 1.2,
    "latency_ms": 15,
    "iface": "eth0",
    "ip": "192.168.1.20",
    "mac": "00:1A:2B:3C:4D:5E"
  },
  "metrics": {
    "cpu": {
      "percent": 45,
      "threads": 16,
      "cores": 8,
      "ghz": 3.2,
      "max_ghz": 4.5
    },
    "ram_percent": 60,
    "ram": {
      "used_gb": 8.5,
      "total_gb": 16.0
    },
    "storage": {
      "total_gb": 500,
      "used_gb": 250,
      "free_gb": 250,
      "percent": 50
    },
    "gpu": [
      {
        "name": "NVIDIA RTX 3060",
        "temperature": 65,
        "utilization": 30
      }
    ],
    "top_processes": [
      {
        "name": "chrome.exe",
        "cpu": 12.5,
        "mem": 5.2
      }
    ],
    "top_files": []
  }
}
```

## Running the Application

1. Start the MQTT broker (if not already running)

2. Start the backend:

   **Python Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python server.py
   ```

   **Node.js Backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```

3. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Run the Python agent on target machines:
   ```bash
   python agent.py
   ```
5. Open browser to `http://localhost:3000`

## License

MIT