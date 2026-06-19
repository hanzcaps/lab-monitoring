/**
 * Lab Monitoring Dashboard - Backend Bridge
 * Connects to MQTT broker via WebSocket and forwards metrics to Socket.IO clients
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');

// Configuration
const PORT = process.env.PORT || 3001;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'ws://ws-mqtt.ajojing.my.id:9002';
const MQTT_TOPIC = 'lab/monitoring/#';
const MQTT_COMMAND_TOPIC = 'lab/command';

// Initialize Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve built frontend (React dashboard)
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Fallback: serve index.html for all non-API routes (SPA support)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mqttConnected: mqttClient?.connected || false,
    connectedClients: io?.engine?.clientsCount || 0
  });
});

// ==================== CLIENT CONTROL API ====================
// POST /api/agents/:id/command
// Send a command to a specific agent via MQTT
app.post('/api/agents/:id/command', (req, res) => {
  const agentId = req.params.id;
  const { command, params = {} } = req.body;

  // Validate request
  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Command is required and must be a string'
    });
  }

  // Check MQTT connection
  if (!mqttClient || !mqttClient.connected) {
    return res.status(503).json({
      success: false,
      error: 'MQTT broker is not connected'
    });
  }

  // Generate unique request ID
  const request_id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Prepare MQTT payload
  const payload = {
    command,
    request_id,
    params,
    timestamp: new Date().toISOString()
  };

  // Publish to agent-specific command topic
  const topic = `${MQTT_COMMAND_TOPIC}/${agentId}`;

  try {
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
      if (err) {
        console.error(`[API] Failed to publish command to ${topic}:`, err.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to send command to agent'
        });
      }

      console.log(`[API] Command '${command}' sent to agent '${agentId}' (Request ID: ${request_id})`);

      // Return success (fire and forget)
      res.status(200).json({
        success: true,
        message: 'Command sent successfully',
        request_id,
        agent_id: agentId,
        command,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error(`[API] Error sending command:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error while sending command'
    });
  }
});
// ==================== END CLIENT CONTROL API ====================

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// MQTT client connection
let mqttClient = null;

function connectMQTT() {
  console.log(`[MQTT] Connecting to broker: ${MQTT_BROKER_URL}`);
  
  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `lab-monitor-backend-${Date.now()}`,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    rejectUnauthorized: false
  });

  mqttClient.on('connect', () => {
    console.log(`[MQTT] ✓ Connected to broker: ${MQTT_BROKER_URL}`);
    
    // Subscribe to monitoring topics
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
      if (err) {
        console.error(`[MQTT] ✗ Failed to subscribe to ${MQTT_TOPIC}:`, err.message);
      } else {
        console.log(`[MQTT] ✓ Subscribed to topic: ${MQTT_TOPIC}`);
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`[MQTT] Message received from ${topic}:`, {
        id: payload.id,
        status: payload.status,
        cpu: payload.metrics?.cpu?.percent,
        ram: payload.metrics?.ram_percent
      });

      // Emit to all connected WebSocket clients
      io.emit('agent-metrics', payload);
    } catch (error) {
      console.error(`[MQTT] Error parsing message from ${topic}:`, error.message);
    }
  });

  mqttClient.on('error', (error) => {
    console.error(`[MQTT] ✗ Error:`, error.message);
  });

  mqttClient.on('disconnect', () => {
    console.log(`[MQTT] ✗ Disconnected from broker`);
  });

  mqttClient.on('reconnect', () => {
    console.log(`[MQTT] Attempting to reconnect...`);
  });

  mqttClient.on('offline', () => {
    console.log(`[MQTT] ✗ Client is offline`);
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.IO] ✓ Client connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] ✗ Client disconnected: ${socket.id} (${reason})`);
  });

  socket.on('error', (error) => {
    console.error(`[Socket.IO] ✗ Error for client ${socket.id}:`, error.message);
  });

  // Send current connection status to new client
  socket.emit('connection-status', {
    connected: true,
    mqttConnected: mqttClient?.connected || false,
    timestamp: new Date().toISOString()
  });
});

// Start server
function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] ✓ Backend server running on port ${PORT}`);
    console.log(`[Server] ✓ Health check: http://localhost:${PORT}/health`);
    console.log(`[Server] ✓ WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`[Server] ✓ Command API: POST http://localhost:${PORT}/api/agents/:id/command`);
  });

  // Connect to MQTT broker
  connectMQTT();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Received SIGTERM, shutting down gracefully...');
  if (mqttClient) mqttClient.end();
  server.close(() => {
    console.log('[Server] ✓ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] Received SIGINT, shutting down gracefully...');
  if (mqttClient) mqttClient.end();
  server.close(() => {
    console.log('[Server] ✓ Server closed');
    process.exit(0);
  });
});

// Start the application
startServer();