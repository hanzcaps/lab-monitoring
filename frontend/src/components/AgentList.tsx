import React from 'react';
import { Activity, Wifi, WifiOff, Monitor, User, Cpu, HardDrive, Download, Upload } from 'lucide-react';
import { ProgressBar } from './MetricCard';
import { AgentMetrics } from '../types';
import { cn } from '../lib/utils';

interface AgentListProps {
  agents: { [id: string]: AgentMetrics };
  onSelectAgent: (agentId: string) => void;
}

interface AgentCardProps {
  agent: AgentMetrics;
  onClick: () => void;
}

// Helper to determine status color
const getStatusColor = (status: 'online' | 'offline') => {
  return status === 'online' ? 'bg-emerald-500' : 'bg-rose-500';
};

const getStatusBadge = (status: 'online' | 'offline') => {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
      status === 'online' 
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
        : "bg-rose-50 text-rose-700 border border-rose-200"
    )}>
      <span className={cn("w-2 h-2 rounded-full", getStatusColor(status))} />
      {status === 'online' ? 'Online' : 'Offline'}
    </div>
  );
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const cpuPercent = agent?.metrics?.cpu?.percent ?? 0;
  const ramPercent = agent?.metrics?.ram_percent ?? 0;
  const networkDown = agent?.network?.down_mbps ?? 0;
  const networkUp = agent?.network?.up_mbps ?? 0;

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer overflow-hidden group"
    >
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              agent.status === 'online' ? 'bg-emerald-100' : 'bg-rose-100'
            )}>
              <Monitor className={cn(
                "w-5 h-5",
                agent.status === 'online' ? 'text-emerald-600' : 'text-rose-600'
              )} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                {agent.id}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <User className="w-3 h-3" />
                <span>{agent.user}</span>
              </div>
            </div>
          </div>
          {getStatusBadge(agent.status)}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 space-y-4">
        {/* OS Info */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Monitor className="w-4 h-4 text-slate-400" />
          <span className="truncate">{agent.info?.os || 'Unknown OS'}</span>
        </div>

        {/* CPU Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>CPU</span>
            </div>
            <span className="font-semibold text-slate-900">{cpuPercent.toFixed(1)}%</span>
          </div>
          <ProgressBar value={cpuPercent} size="sm" />
        </div>

        {/* RAM Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span>RAM</span>
            </div>
            <span className="font-semibold text-slate-900">{ramPercent.toFixed(1)}%</span>
          </div>
          <ProgressBar value={ramPercent} size="sm" />
        </div>

        {/* Network Speed */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <span>Network</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-slate-500">↓</span>
              <span className="font-semibold text-slate-900">{networkDown.toFixed(1)} Mbps</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Upload className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-slate-500">↑</span>
              <span className="font-semibold text-slate-900">{networkUp.toFixed(1)} Mbps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AgentList: React.FC<AgentListProps> = ({ agents, onSelectAgent }) => {
  const agentEntries = Object.entries(agents);
  const onlineCount = agentEntries.filter(([_, agent]) => agent.status === 'online').length;
  const offlineCount = agentEntries.filter(([_, agent]) => agent.status === 'offline').length;

  if (agentEntries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
            <Activity className="w-8 h-8 text-slate-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            No Agents Connected
          </h2>
          <p className="text-slate-500 max-w-md">
            Waiting for monitoring agents to connect. Ensure the MQTT broker is running and agents are sending data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Monitor className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{agentEntries.length}</div>
              <div className="text-sm text-slate-500">Total Agents</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wifi className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{onlineCount}</div>
              <div className="text-sm text-slate-500">Online</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg">
              <WifiOff className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-600">{offlineCount}</div>
              <div className="text-sm text-slate-500">Offline</div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Connected Agents
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agentEntries.map(([id, agent]) => (
            <AgentCard 
              key={id} 
              agent={agent} 
              onClick={() => onSelectAgent(agent.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};