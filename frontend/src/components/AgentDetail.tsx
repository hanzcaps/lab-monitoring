import React, { useState, useCallback } from 'react';
import { ArrowLeft, Activity, Trash2, AlertTriangle, CheckCircle, XCircle, HardDrive } from 'lucide-react';
import { 
  ServerInfoCard, 
  CPUCard, 
  RAMCard, 
  NetworkStorageCard, 
  GPUProcessesCard,
  ControlPanel
} from './index';
import { MetricCard } from './MetricCard';
import { AgentMetrics, FileInfo } from '../types';

interface AgentDetailProps {
  agent: AgentMetrics | undefined;
  onBack: () => void;
}

// Confirmation dialog state type
interface ConfirmDialogState {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  file?: FileInfo;
}

// Toast notification type
interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

// Top Files Card component with delete functionality
const TopFilesCard: React.FC<{ 
  files: FileInfo[]; 
  onDeleteFile: (file: FileInfo) => void;
}> = ({ files, onDeleteFile }) => {
  const formatFileSize = (sizeMb: number) => {
    if (sizeMb >= 1024) {
      return `${(sizeMb / 1024).toFixed(2)} GB`;
    }
    return `${sizeMb.toFixed(1)} MB`;
  };

  if (!files || files.length === 0) {
    return (
      <MetricCard 
        title="Top Largest Files" 
        icon={<HardDrive className="w-5 h-5 text-slate-600" />}
      >
        <div className="flex items-center justify-center h-40 text-slate-400">
          <div className="text-center">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No large files found</p>
          </div>
        </div>
      </MetricCard>
    );
  }

  return (
    <MetricCard 
      title="Top Largest Files" 
      icon={<HardDrive className="w-5 h-5 text-slate-600" />}
    >
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                File Name
              </th>
              <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Size
              </th>
              <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-16">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map((file, index) => (
              <tr 
                key={index} 
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group"
              >
                <td className="py-3 px-3">
                  <div className="text-sm font-medium text-slate-900 truncate max-w-[200px]" title={file.path}>
                    {file.name}
                  </div>
                </td>
                <td className="py-3 px-3 text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatFileSize(file.size_mb)}
                  </div>
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => onDeleteFile(file)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MetricCard>
  );
};

export const AgentDetail: React.FC<AgentDetailProps> = ({ agent, onBack }) => {
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
            <Activity className="w-8 h-8 text-slate-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Agent Not Found
          </h2>
          <p className="text-slate-500 mb-4">
            The selected agent is no longer available or data has not been received.
          </p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Add toast notification
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Send command to agent
  const sendCommand = useCallback(async (command: string, params?: Record<string, string>) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command, params }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        addToast('success', `Command "${command}" sent successfully!`);
      } else {
        addToast('error', result.error || 'Failed to send command');
      }
    } catch (error) {
      addToast('error', 'Network error: Could not connect to server');
    }
  }, [agent.id, addToast]);

  // Handle file deletion
  const handleDeleteFile = useCallback((file: FileInfo) => {
    setConfirmDialog({
      show: true,
      title: 'Delete File',
      message: `Are you sure you want to permanently delete "${file.name}"? This action cannot be undone.`,
      onConfirm: () => {
        sendCommand('delete_file', { file_path: file.path });
      },
      file,
    });
  }, [sendCommand]);

  // Close confirmation dialog
  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, show: false }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Back Button & Agent Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">Back to Dashboard</span>
        </button>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <h2 className="text-lg font-semibold text-slate-900">{agent.id}</h2>
            <p className="text-sm text-slate-500">{agent.user} • {agent.info?.os}</p>
          </div>
          <div className={
            agent.status === 'online' 
              ? "w-3 h-3 bg-emerald-500 rounded-full animate-pulse" 
              : "w-3 h-3 bg-rose-500 rounded-full"
          } />
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="space-y-6">
        {/* Top row - System Info & CPU */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ServerInfoCard data={agent} />
          </div>
          
          {/* CPU Card */}
          <div className="lg:col-span-2">
            <CPUCard data={agent} />
          </div>
        </div>

        {/* Second row - RAM & Network/Storage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RAMCard data={agent} />
          
          {/* Network & Storage */}
          <NetworkStorageCard data={agent} />
        </div>

        {/* Third row - GPU & Processes */}
        <GPUProcessesCard data={agent} />

        {/* Fourth row - Control Panel & Top Files */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Control Panel */}
          <ControlPanel agent={agent} />
          
          {/* Top Files with delete functionality */}
          <TopFilesCard 
            files={agent.metrics?.top_files ?? []} 
            onDeleteFile={handleDeleteFile}
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-rose-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
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
                onClick={closeConfirmDialog}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirmDialog();
                }}
                className="px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-medium text-sm transition-colors"
              >
                Delete
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