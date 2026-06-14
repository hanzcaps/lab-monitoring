import React from 'react';
import { cn } from '../lib/utils';

interface MetricCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  status?: 'online' | 'offline';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  icon,
  children,
  className,
  status
}) => {
  return (
    <div className={cn("card relative", className)}>
      {status && (
        <div className="absolute top-4 right-4">
          <div 
            className={cn(
              "status-indicator",
              status === 'online' ? 'status-online' : 'status-offline'
            )}
          />
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        {icon && (
          <div className="p-2 bg-slate-100 rounded-lg">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold text-slate-900">
          {title}
        </h3>
      </div>
      
      {children}
    </div>
  );
};

interface MetricValueProps {
  value: string | number;
  label: string;
  suffix?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MetricValue: React.FC<MetricValueProps> = ({
  value,
  label,
  suffix,
  color = 'text-slate-900',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  };

  return (
    <div className="flex flex-col">
      <div className={cn("font-bold tracking-tight", sizeClasses[size], color)}>
        {value}{suffix && <span className="text-lg ml-1">{suffix}</span>}
      </div>
      <div className="text-sm font-medium text-slate-500 uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
};

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  color = 'bg-emerald-500',
  showLabel = false,
  size = 'md'
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const getColorClass = (pct: number) => {
    if (pct > 85) return 'bg-rose-500';
    if (pct > 70) return 'bg-amber-500';
    return color;
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full">
      <div className={cn("progress-bar", sizeClasses[size])}>
        <div 
          className={cn("progress-fill", getColorClass(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>{value.toFixed(1)}%</span>
          <span>{max}%</span>
        </div>
      )}
    </div>
  );
};

interface StatRowProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export const StatRow: React.FC<StatRowProps> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
    <div className="flex items-center gap-2 text-sm text-slate-600">
      {icon && <span className="text-slate-400">{icon}</span>}
      {label}
    </div>
    <div className="text-sm font-semibold text-slate-900">{value}</div>
  </div>
);