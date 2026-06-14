import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Activity, Wifi, WifiOff, Clock, Monitor } from 'lucide-react';
import { AgentList, AgentDetail } from './components';
import { AgentMetrics, AgentState } from './types';
import { cn } from './lib/utils';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<AgentState>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to backend');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected from backend');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setConnected(false);
    });

    // Listen for agent metrics - store by agent id
    newSocket.on('agent-metrics', (data: AgentMetrics) => {
      console.log('[Socket] Received metrics from:', data.id);
      setAgents(prev => ({
        ...prev,
        [data.id]: data
      }));
    });

    // Listen for connection status
    newSocket.on('connection-status', (status) => {
      console.log('[Socket] Connection status:', status);
      setConnected(status.connected);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get the selected agent data
  const selectedAgent = selectedAgentId ? agents[selectedAgentId] : undefined;

  // Handle agent selection
  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    setSelectedAgentId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and title */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {selectedAgentId ? 'Agent Detail' : 'System Monitor'}
                </h1>
                <p className="text-xs text-slate-500">
                  {selectedAgentId 
                    ? `Monitoring: ${selectedAgentId}` 
                    : 'Multi-Agent Dashboard'}
                </p>
              </div>
            </div>

            {/* Right side - Time, Agent Count, and Connection status */}
            <div className="flex items-center gap-6">
              {/* Agent count badge (only show on dashboard view) */}
              {!selectedAgentId && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-700">
                  <Monitor className="w-4 h-4" />
                  <span>{Object.keys(agents).length} Agents</span>
                </div>
              )}

              {/* Current time */}
              <div className="hidden md:flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4" />
                <div>
                  <div className="font-medium">{formatTime(currentTime)}</div>
                  <div className="text-xs text-slate-400">{formatDate(currentTime)}</div>
                </div>
              </div>

              {/* Connection status */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                connected 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              )}>
                {connected ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Disconnected</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedAgentId ? (
          // Detail View - Show single agent dashboard
          <AgentDetail 
            agent={selectedAgent} 
            onBack={handleBackToDashboard}
          />
        ) : (
          // Summary View - Show all agents list
          Object.keys(agents).length > 0 ? (
            <AgentList 
              agents={agents} 
              onSelectAgent={handleSelectAgent}
            />
          ) : (
            /* No data state */
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <Activity className="w-8 h-8 text-slate-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Waiting for data...
                </h2>
                <p className="text-slate-500 max-w-md">
                  {connected 
                    ? "The dashboard is connected to the backend. Waiting for MQTT data from monitoring agents."
                    : "Cannot connect to the backend server. Please ensure the backend is running on port 3001."
                  }
                </p>
                {!connected && (
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div>
              System Monitor Dashboard v2.0
            </div>
            <div className="flex items-center gap-4">
              <span>Backend: {SOCKET_URL}</span>
              <span>Agents: {Object.keys(agents).length}</span>
              {selectedAgentId && (
                <span className="text-emerald-600 font-medium">
                  Viewing: {selectedAgentId}
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;