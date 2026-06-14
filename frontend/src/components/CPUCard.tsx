import React from 'react';
import { Cpu, Zap, Activity, Thermometer } from 'lucide-react';
import { MetricCard, MetricValue, ProgressBar } from './MetricCard';
import { AgentMetrics } from '../types';

interface CPUCardProps {
  data: AgentMetrics;
}

export const CPUCard: React.FC<CPUCardProps> = ({ data }) => {
  const cpuPercent = data?.metrics?.cpu?.percent ?? 0;
  const cpuColor = cpuPercent > 85 ? 'text-rose-600' : cpuPercent > 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <MetricCard 
      title="CPU Usage" 
      icon={<Cpu className="w-5 h-5 text-slate-600" />}
    >
      <div className="space-y-6">
        {/* Main CPU percentage with circular visualization */}
        <div className="flex items-center justify-between">
          <MetricValue 
            value={cpuPercent}
            suffix="%"
            label="CPU Usage"
            color={cpuColor}
            size="lg"
          />
          
          {/* Circular progress indicator using SVG */}
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={cpuPercent > 85 ? '#f43f5e' : cpuPercent > 70 ? '#f59e0b' : '#10b981'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${cpuPercent * 2.51} 251`}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-slate-900">{cpuPercent}%</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar 
          value={cpuPercent} 
          showLabel 
          size="md"
        />

        {/* CPU specs */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">Cores:</span>
            <span className="font-semibold text-slate-900">{data?.metrics?.cpu?.cores ?? 0}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">Threads:</span>
            <span className="font-semibold text-slate-900">{data?.metrics?.cpu?.threads ?? 0}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Thermometer className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">Current:</span>
            <span className="font-semibold text-slate-900">{data?.metrics?.cpu?.ghz ?? 0} GHz</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">Max:</span>
            <span className="font-semibold text-slate-900">{data?.metrics?.cpu?.max_ghz ?? 0} GHz</span>
          </div>
        </div>
      </div>
    </MetricCard>
  );
};