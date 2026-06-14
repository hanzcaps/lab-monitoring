import React from 'react';
import { Download, Upload, Wifi, HardDrive, Activity } from 'lucide-react';
import { MetricCard, MetricValue, ProgressBar, StatRow } from './MetricCard';
import { AgentMetrics } from '../types';

interface NetworkStorageCardProps {
  data: AgentMetrics;
}

export const NetworkStorageCard: React.FC<NetworkStorageCardProps> = ({ data }) => {
  const network = data?.network;
  const storage = data?.metrics?.storage;
  const storagePercent = storage?.percent ?? 0;
  const storageColor = storagePercent > 85 ? 'text-rose-600' : storagePercent > 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Network Card */}
      <MetricCard 
        title="Network" 
        icon={<Wifi className="w-5 h-5 text-slate-600" />}
      >
        <div className="space-y-6">
          {/* Download and Upload speeds */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Download className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">
                  {(network?.down_mbps ?? 0).toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Mbps Down</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">
                  {(network?.up_mbps ?? 0).toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Mbps Up</div>
              </div>
            </div>
          </div>

          {/* Network stats */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <StatRow 
              label="Interface" 
              value={network?.iface ?? 'N/A'} 
              icon={<Wifi className="w-4 h-4" />}
            />
            <StatRow 
              label="IP Address" 
              value={network?.ip ?? 'N/A'} 
              icon={<Activity className="w-4 h-4" />}
            />
            <StatRow 
              label="Latency" 
              value={`${network?.latency_ms ?? 0} ms`} 
              icon={<Activity className="w-4 h-4" />}
            />
            <StatRow 
              label="Traffic" 
              value={`${(network?.traffic_in_gb ?? 0).toFixed(2)} GB`} 
              icon={<Upload className="w-4 h-4" />}
            />
          </div>
        </div>
      </MetricCard>

      {/* Storage Card */}
      <MetricCard 
        title="Storage" 
        icon={<HardDrive className="w-5 h-5 text-slate-600" />}
      >
        <div className="space-y-6">
          {/* Main storage percentage */}
          <div className="flex items-center justify-between">
            <MetricValue 
              value={storagePercent.toFixed(1)}
              suffix="%"
              label="Used"
              color={storageColor}
              size="lg"
            />
            
            {/* Storage used/total display */}
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">
                {(storage?.used_gb ?? 0).toFixed(0)} <span className="text-slate-400 text-lg">/</span> {(storage?.total_gb ?? 0).toFixed(0)}
              </div>
              <div className="text-sm text-slate-500 uppercase tracking-wide">GB</div>
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar 
            value={storagePercent} 
            showLabel 
            size="md"
          />

          {/* Storage details */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Used</div>
              <div className="text-lg font-semibold text-slate-900">{(storage?.used_gb ?? 0).toFixed(0)} GB</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Free</div>
              <div className="text-lg font-semibold text-emerald-600">{(storage?.free_gb ?? 0).toFixed(0)} GB</div>
            </div>
          </div>
        </div>
      </MetricCard>
    </div>
  );
};