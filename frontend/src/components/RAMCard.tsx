import React from 'react';
import { HardDrive } from 'lucide-react';
import { MetricCard, MetricValue, ProgressBar } from './MetricCard';
import { AgentMetrics } from '../types';

interface RAMCardProps {
  data: AgentMetrics;
}

export const RAMCard: React.FC<RAMCardProps> = ({ data }) => {
  const ramPercent = data?.metrics?.ram_percent ?? 0;
  const ramColor = ramPercent > 85 ? 'text-rose-600' : ramPercent > 70 ? 'text-amber-600' : 'text-emerald-600';
  const usedGb = data?.metrics?.ram?.used_gb ?? 0;
  const totalGb = data?.metrics?.ram?.total_gb ?? 0;

  return (
    <MetricCard 
      title="Memory Usage" 
      icon={<HardDrive className="w-5 h-5 text-slate-600" />}
    >
      <div className="space-y-6">
        {/* Main RAM percentage */}
        <div className="flex items-center justify-between">
          <MetricValue 
            value={ramPercent}
            suffix="%"
            label="RAM Usage"
            color={ramColor}
            size="lg"
          />
          
          {/* Memory used/total display */}
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">
              {usedGb.toFixed(1)} <span className="text-slate-400 text-lg">/</span> {totalGb.toFixed(1)}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide">GB Used</div>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar 
          value={ramPercent} 
          showLabel 
          size="md"
        />

        {/* Memory details */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Used</div>
            <div className="text-lg font-semibold text-slate-900">{usedGb.toFixed(1)} GB</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total</div>
            <div className="text-lg font-semibold text-slate-900">{totalGb.toFixed(1)} GB</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Free</div>
            <div className="text-lg font-semibold text-emerald-600">{(totalGb - usedGb).toFixed(1)} GB</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Available</div>
            <div className="text-lg font-semibold text-slate-900">{(100 - ramPercent).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </MetricCard>
  );
};