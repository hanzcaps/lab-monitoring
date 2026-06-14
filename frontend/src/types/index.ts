export interface CPUMetrics {
  percent: number;
  threads: number;
  cores: number;
  ghz: number;
  max_ghz: number;
}

export interface RAMMetrics {
  used_gb: number;
  total_gb: number;
}

export interface StorageMetrics {
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface GPUMetrics {
  name: string;
  temperature: number;
  utilization: number;
  type?: string;
  memory_util?: number;
  memory_used_gb?: number;
  memory_total_gb?: number;
  driver_version?: string;
  is_igpu?: boolean; // True if this is an integrated GPU using shared memory
}

export interface ProcessInfo {
  name: string;
  cpu: number;
  mem: number;
}

export interface FileInfo {
  name: string;
  path: string;
  size_mb: number;
}

export interface NetworkMetrics {
  down_mbps: number;
  up_mbps: number;
  traffic_in_gb: number;
  latency_ms: number;
  iface: string;
  ip: string;
  mac: string;
}

export interface SystemInfo {
  uptime: string;
  os: string;
  cpu_name: string;
}

export interface AgentMetrics {
  id: string;
  status: 'online' | 'offline';
  user: string;
  time: string;
  info: SystemInfo;
  network: NetworkMetrics;
  metrics: {
    cpu: CPUMetrics;
    ram_percent: number;
    ram: RAMMetrics;
    storage: StorageMetrics;
    gpu: GPUMetrics[];
    top_processes: ProcessInfo[];
    top_files: FileInfo[];
  };
}

export interface AgentState {
  [hostname: string]: AgentMetrics;
}