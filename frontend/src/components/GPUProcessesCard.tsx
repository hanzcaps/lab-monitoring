import React from 'react';
import { Cpu, Thermometer, Activity, HardDrive } from 'lucide-react';
import { MetricCard, ProgressBar } from './MetricCard';
import { AgentMetrics } from '../types';

interface GPUProcessesCardProps {
  data: AgentMetrics;
}

export const GPUProcessesCard: React.FC<GPUProcessesCardProps> = ({ data }) => {
  const gpus = data?.metrics?.gpu ?? [];
  const processes = data?.metrics?.top_processes ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* GPU Card */}
      <MetricCard 
        title="GPU" 
        icon={<Cpu className="w-5 h-5 text-slate-600" />}
      >
        {gpus && gpus.length > 0 ? (
          <div className="space-y-6">
            {gpus.map((gpu, index) => (
              <div key={index} className="space-y-4">
                {/* GPU Name */}
                <div className="text-lg font-semibold text-slate-900 truncate">
                  {gpu.name}
                </div>

                {/* GPU metrics */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Temperature */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Thermometer className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500 uppercase">Temp</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {/* iGPU doesn't expose temperature, show N/A for 0 or when is_igpu is true */}
                      {gpu.temperature === 0 ? "N/A" : `${gpu.temperature}°C`}
                    </div>
                  </div>

                  {/* Utilization */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500 uppercase">Usage</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {/* Always show utilization value, defaulting to 0 if undefined/null */}
                      {`${gpu.utilization ?? 0}%`}
                    </div>
                    <div className="mt-2">
                      <ProgressBar 
                        value={gpu.utilization ?? 0} 
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* GPU Memory (if available) */}
                {gpu.memory_total_gb !== undefined && gpu.memory_total_gb > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <HardDrive className="w-4 h-4 text-slate-400" />
                        <span>VRAM</span>
                        {gpu.is_igpu && (
                          <span className="text-xs bg-slate-200 px-2 py-0.5 rounded ml-1">Shared</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {gpu.memory_used_gb !== undefined && gpu.memory_used_gb > 0 
                          ? `${gpu.memory_used_gb.toFixed(1)} / ${gpu.memory_total_gb.toFixed(1)} GB`
                          : `${gpu.memory_total_gb.toFixed(1)} GB`}
                      </span>
                    </div>
                    {gpu.memory_used_gb !== undefined && gpu.memory_used_gb > 0 && gpu.memory_total_gb > 0 && (
                      <ProgressBar 
                        value={(gpu.memory_used_gb / gpu.memory_total_gb) * 100} 
                        size="sm"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <div className="text-center">
              <Cpu className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No GPU data available</p>
            </div>
          </div>
        )}
      </MetricCard>

      {/* Top Processes Card */}
      <MetricCard 
        title="Top Processes" 
        icon={<Activity className="w-5 h-5 text-slate-600" />}
      >
        {processes && processes.length > 0 ? (
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Process
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    CPU
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Memory
                  </th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process, index) => (
                  <tr 
                    key={index} 
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="text-sm font-medium text-slate-900 truncate max-w-[150px]">
                        {process.name}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="text-sm font-semibold text-slate-900">
                        {process.cpu.toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="text-sm font-semibold text-slate-900">
                        {process.mem.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No process data available</p>
            </div>
          </div>
        )}
      </MetricCard>
    </div>
  );
};