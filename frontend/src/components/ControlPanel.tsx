import React, { useState } from 'react';
import { 
  Power, 
  RotateCcw, 
  XCircle, 
  Lock, 
  Trash2, 
  Globe, 
  Terminal,
  AlertTriangle,
  CheckCircle,
  Monitor,
  Cpu,
  Wifi
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { AgentMetrics } from '../types';

interface ControlPanelProps {
  agent: AgentMetrics;
}

// Command types for type safety
type CommandType = 
  | 'shutdown' 
  | 'restart' 
  | 'cancel_shutdown' 
  | 'lock_screen' 
  | 'clear_temp' 
  | 'flush_dns' 
  | 'taskkill' 
  | 'open_url'
  | 'delete_file';

interface CommandPayload {
  command: CommandType;
  params?: Record<string, string>;
}

interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ agent }) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({ show: false, title: '', message: '', onConfirm: () => {} });
  
  // Form states for interactive commands
  const [processName, setProcessName] = useState('');
  const [urlInput, setUrlInput] = useState('');

  // Add toast notification
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Show confirmation dialog
  const showConfirmation = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    danger: boolean = false
  ) => {
    setConfirmDialog({ show: true, title, message, onConfirm, danger });
  };

  // Send command to agent
  const sendCommand = async (payload: CommandPayload) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        addToast('success', `Command "${payload.command}" sent successfully!`);
      } else {
        addToast('error', result.error || 'Failed to send command');
      }
    } catch (error) {
      addToast('error', 'Network error: Could not connect to server');
    }
  };

  // Power commands with confirmation
  const handleShutdown = () => {
    showConfirmation(
      'Shutdown System',
      'Are you sure you want to shut down this computer? This will close all applications and turn off the system.',
      () => sendCommand({ command: 'shutdown' }),
      true
    );
  };

  const handleRestart = () => {
    showConfirmation(
      'Restart System',
      'Are you sure you want to restart this computer? This will close all applications and restart the system.',
      () => sendCommand({ command: 'restart' }),
      true
    );
  };

  const handleCancelShutdown = () => {
    sendCommand({ command: 'cancel_shutdown' });
  };

  // Maintenance commands
  const handleLockScreen = () => {
    showConfirmation(
      'Lock Screen',
      'Are you sure you want to lock the screen on this computer?',
      () => sendCommand({ command: 'lock_screen' }),
      false
    );
  };

  const handleClearTemp = () => {
    showConfirmation(
      'Clear Temporary Files',
      'This will delete all files in the system temp directory. Continue?',
      () => sendCommand({ command: 'clear_temp' }),
      true
    );
  };

  const handleFlushDNS = () => {
    sendCommand({ command: 'flush_dns' });
  };

  // Interactive commands
  const handleKillProcess = () => {
    if (!processName.trim()) {
      addToast('error', 'Please enter a process name');
      return;
    }

    showConfirmation(
      'Kill Process',
      `Are you sure you want to forcefully terminate the process "${processName}"?`,
      () => {
        sendCommand({ 
          command: 'taskkill', 
          params: { process_name: processName.trim() } 
        });
        setProcessName('');
      },
      true
    );
  };

  const handleOpenUrl = () => {
    if (!urlInput.trim()) {
      addToast('error', 'Please enter a URL');
      return;
    }

    // Basic URL validation
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    sendCommand({ 
      command: 'open_url', 
      params: { url } 
    });
    setUrlInput('');
  };

  return (
    <div className="relative">
      <MetricCard 
        title="Terminal & Control Panel" 
        icon={<Terminal className="w-5 h-5 text-slate-600" />}
      >
        <div className="space-y-6">
          {/* POWER Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Power className="w-4 h-4 text-rose-500" />
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Power Control
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleShutdown}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 border border-rose-200 transition-colors font-medium text-sm"
              >
                <Power className="w-4 h-4" />
                Shutdown
              </button>
              <button
                onClick={handleRestart}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors font-medium text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </button>
              <button
                onClick={handleCancelShutdown}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors font-medium text-sm"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>

          {/* MAINTENANCE Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Maintenance
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleLockScreen}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors font-medium text-sm"
              >
                <Lock className="w-4 h-4" />
                Lock Screen
              </button>
              <button
                onClick={handleClearTemp}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors font-medium text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Clear Temp
              </button>
              <button
                onClick={handleFlushDNS}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors font-medium text-sm"
              >
                <Wifi className="w-4 h-4" />
                Flush DNS
              </button>
            </div>
          </div>

          {/* INTERACTIVE Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-purple-500" />
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Interactive
              </h4>
            </div>
            <div className="space-y-3">
              {/* Kill Process */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={processName}
                  onChange={(e) => setProcessName(e.target.value)}
                  placeholder="Process name (e.g., chrome.exe)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleKillProcess}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors font-medium text-sm whitespace-nowrap"
                >
                  <XCircle className="w-4 h-4" />
                  Kill Process
                </button>
              </div>

              {/* Open URL */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="URL (e.g., https://google.com)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleOpenUrl}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors font-medium text-sm whitespace-nowrap"
                >
                  <Globe className="w-4 h-4" />
                  Open URL
                </button>
              </div>
            </div>
          </div>
        </div>
      </MetricCard>

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`px-6 py-4 ${confirmDialog.danger ? 'bg-rose-50' : 'bg-amber-50'} border-b border-slate-200`}>
              <div className="flex items-center gap-3">
                {confirmDialog.danger ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
                <h3 className="text-lg font-semibold text-slate-900">
                  {confirmDialog.title}
                </h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-slate-600">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, show: false });
                }}
                className={`px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors ${
                  confirmDialog.danger 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right duration-300 ${
              toast.type === 'success' 
                ? 'bg-emerald-500 text-white' 
                : toast.type === 'error' 
                ? 'bg-rose-500 text-white' 
                : 'bg-slate-800 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Export the handleDeleteFile function type for use in other components
export type { CommandPayload, CommandType };