import React from 'react';
import { Server, User, Clock, Cpu, Monitor, Network } from 'lucide-react';
import { MetricCard, StatRow } from './MetricCard';
import { AgentMetrics } from '../types';

interface ServerInfoCardProps {
  data: AgentMetrics;
}

export const ServerInfoCard: React.FC<ServerInfoCardProps> = ({ data }) => {
  return (
    <MetricCard 
      title="System Information" 
      icon={<Server className="w-5 h-5 text-slate-600" />}
      status={data?.status}
    >
      <div className="space-y-1">
        <StatRow 
          label="Hostname" 
          value={data?.id ?? 'N/A'} 
          icon={<Server className="w-4 h-4" />}
        />
        <StatRow 
          label="User" 
          value={data?.user ?? 'N/A'} 
          icon={<User className="w-4 h-4" />}
        />
        <StatRow 
          label="IP Address" 
          value={data?.network?.ip ?? 'N/A'} 
          icon={<Network className="w-4 h-4" />}
        />
        <StatRow 
          label="Operating System" 
          value={data?.info?.os ?? 'N/A'} 
          icon={<Monitor className="w-4 h-4" />}
        />
        <StatRow 
          label="Uptime" 
          value={data?.info?.uptime ?? 'N/A'} 
          icon={<Clock className="w-4 h-4" />}
        />
        <StatRow 
          label="CPU" 
          value={data?.info?.cpu_name || 'Unknown CPU'} 
          icon={<Cpu className="w-4 h-4" />}
        />
      </div>
    </MetricCard>
  );
};
