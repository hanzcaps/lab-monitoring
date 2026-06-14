import psutil
import time
import socket
import json
import platform
import getpass
import subprocess
import os
import paho.mqtt.client as mqtt
from datetime import datetime
from threading import Lock
import shlex

# GPU Monitoring imports
try:
    import pynvml
    PYNVML_AVAILABLE = True
except:
    PYNVML_AVAILABLE = False

try:
    import win32com.client
    WIN32_AVAILABLE = True
except:
    WIN32_AVAILABLE = False

# GPU name patterns for detection
NVIDIA_PATTERNS = ['nvidia', 'geforce', 'quadro', 'tesla', 'rtx', 'gtx']
AMD_PATTERNS = ['amd', 'radeon', 'rx ', 'vega', 'firepro']
INTEL_PATTERNS = ['intel', 'uhd graphics', 'iris', 'hd graphics', 'xe']

def _detect_gpu_type(gpu_name):
    """Detect GPU type from name string."""
    name_lower = gpu_name.lower()
    for pattern in NVIDIA_PATTERNS:
        if pattern in name_lower:
            return "NVIDIA"
    for pattern in AMD_PATTERNS:
        if pattern in name_lower:
            return "AMD"
    for pattern in INTEL_PATTERNS:
        if pattern in name_lower:
            return "Intel"
    return "Unknown"

def _is_nvidia_gpu(gpu_name):
    """Check if GPU name indicates NVIDIA GPU."""
    return _detect_gpu_type(gpu_name) == "NVIDIA"

def _get_gpu_info_powershell_videocontroller():
    """Get GPU info using PowerShell Get-CimInstance (more reliable than WMI COM)."""
    gpus = []
    try:
        ps_cmd = """
        $ErrorActionPreference = "Stop"
        $gpus = Get-CimInstance -ClassName Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion, VideoProcessor
        $result = @()
        foreach ($gpu in $gpus) {
            $ramGB = 0
            if ($gpu.AdapterRAM -gt 0) {
                $ramGB = [math]::Round($gpu.AdapterRAM / 1GB, 2)
            }
            $result += @{
                name = $gpu.Name
                adapter_ram_gb = $ramGB
                driver_version = $gpu.DriverVersion
                video_processor = $gpu.VideoProcessor
            }
        }
        $result | ConvertTo-Json -Depth 5
        """
        result = subprocess.run(
            ['powershell', '-Command', ps_cmd],
            capture_output=True, text=True, timeout=10,
            startupinfo=subprocess.STARTUPINFO()
        )
        if result.returncode == 0 and result.stdout.strip():
            import json as json_mod
            gpu_data = json_mod.loads(result.stdout.strip())
            if isinstance(gpu_data, dict):
                gpu_data = [gpu_data]
            if isinstance(gpu_data, list):
                for gpu in gpu_data:
                    try:
                        gpus.append({
                            "name": str(gpu.get('name', '')),
                            "type": _detect_gpu_type(str(gpu.get('name', ''))),
                            "temperature": 0,
                            "utilization": 0,
                            "memory_util": 0,
                            "memory_used_gb": 0,
                            "memory_total_gb": float(gpu.get('adapter_ram_gb', 0)),
                            "driver_version": str(gpu.get('driver_version', 'N/A'))
                        })
                    except Exception:
                        continue
    except Exception as e:
        print(f"[Debug] PowerShell VideoController failed: {e}")
    return gpus

def _get_gpu_utilization_powershell():
    """Get GPU utilization via Windows Performance Counters."""
    utilization_map = {}
    try:
        ps_cmd = """
        $ErrorActionPreference = "SilentlyContinue"
        try {
            $counters = Get-Counter -Counter "\\GPU Engine\\*utilization" -ErrorAction Stop
            foreach ($sample in $counters.CounterSamples) {
                $path = $sample.Path
                if ($path -match "enginetotal_utilization_percentage") {
                    $value = [math]::Round($sample.CookedValue, 1)
                    utilization_map[$path] = $value
                }
            }
        } catch {
            # Performance counters not available
        }
        """
        subprocess.run(
            ['powershell', '-Command', ps_cmd],
            capture_output=True, text=True, timeout=5,
            startupinfo=subprocess.STARTUPINFO()
        )
    except Exception:
        pass
    return utilization_map

def _get_gpu_info_windows_powershell_combined():
    """Combined approach: Get GPU info and utilization via PowerShell."""
    gpus = []
    try:
        ps_cmd = """
        $ErrorActionPreference = "SilentlyContinue"
        $gpus = Get-CimInstance -ClassName Win32_VideoController
        $utilization = @{}
        
        # Try to get GPU utilization from performance counters
        try {
            $counterData = Get-Counter -Counter "\\GPU Engine\\*enginetotal_utilization_percentage" -ErrorAction Stop
            foreach ($sample in $counterData.CounterSamples) {
                $path = $sample.Path
                if ($path -match ".*") {
                    $value = [math]::Round($sample.CookedValue, 1)
                    $utilization["any"] = $value
                    break
                }
            }
        } catch {}
        
        $result = @()
        foreach ($gpu in $gpus) {
            $ramGB = 0
            if ($gpu.AdapterRAM -gt 0) {
                $ramGB = [math]::Round($gpu.AdapterRAM / 1GB, 2)
            }
            
            $util = 0
            if ($utilization.ContainsKey("any")) {
                $util = $utilization["any"]
            }
            
            $result += [PSCustomObject]@{
                name = $gpu.Name
                adapter_ram_gb = $ramGB
                driver_version = $gpu.DriverVersion
                utilization = $util
            }
        }
        $result | ConvertTo-Json -Depth 3
        """
        result = subprocess.run(
            ['powershell', '-Command', ps_cmd],
            capture_output=True, text=True, timeout=15,
            startupinfo=subprocess.STARTUPINFO()
        )
        if result.returncode == 0 and result.stdout.strip():
            import json as json_mod
            gpu_data = json_mod.loads(result.stdout.strip())
            if isinstance(gpu_data, dict):
                gpu_data = [gpu_data]
            if isinstance(gpu_data, list):
                for gpu in gpu_data:
                    try:
                        name = str(gpu.get('name', ''))
                        gpus.append({
                            "name": name,
                            "type": _detect_gpu_type(name),
                            "temperature": 0,
                            "utilization": float(gpu.get('utilization', 0)),
                            "memory_util": 0,
                            "memory_used_gb": 0,
                            "memory_total_gb": float(gpu.get('adapter_ram_gb', 0)),
                            "driver_version": str(gpu.get('driver_version', 'N/A'))
                        })
                    except Exception:
                        continue
    except Exception as e:
        print(f"[Debug] PowerShell combined failed: {e}")
    return gpus

def _get_gpu_info_windows_wmic():
    """Fallback using WMIC command."""
    gpus = []
    try:
        result = subprocess.run(
            ['wmic', 'path', 'win32_VideoController', 'get', 'name,/format:value'],
            capture_output=True, text=True, timeout=10,
            startupinfo=subprocess.STARTUPINFO()
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('Name='):
                    name = line[5:].strip()
                    if name:
                        gpus.append({
                            "name": name,
                            "type": _detect_gpu_type(name),
                            "temperature": 0,
                            "utilization": 0,
                            "memory_util": 0,
                            "memory_used_gb": 0,
                            "memory_total_gb": 0
                        })
    except Exception as e:
        print(f"[Debug] WMIC failed: {e}")
    return gpus

def _get_gpu_info_linux_lspci():
    """Get GPU info on Linux using lspci."""
    gpus = []
    try:
        result = subprocess.run(
            ['lspci', '-v'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            output = result.stdout
            # Parse VGA compatible controllers
            current_device = {}
            for line in output.split('\n'):
                line_stripped = line.strip()
                if 'VGA compatible controller' in line or '3D controller' in line:
                    if current_device.get('name'):
                        gpus.append(current_device)
                    # Extract device name
                    parts = line.split(': ', 2)
                    name = parts[2].strip() if len(parts) > 2 else "Unknown GPU"
                    # Clean up the name (remove extra info in parentheses)
                    if ' rev ' in name:
                        name = name.split(' rev ')[0].strip()
                    current_device = {
                        "name": name,
                        "type": _detect_gpu_type(name),
                        "temperature": 0,
                        "utilization": 0,
                        "memory_util": 0,
                        "memory_used_gb": 0,
                        "memory_total_gb": 0
                    }
                elif line_stripped.startswith('Kernel driver in use:') and current_device:
                    current_device['driver'] = line_stripped.split(': ', 1)[1].strip()
            if current_device.get('name'):
                gpus.append(current_device)
    except Exception as e:
        print(f"[Debug] lspci failed: {e}")
    return gpus

def _get_gpu_info_linux_lshw():
    """Get GPU info on Linux using lshw."""
    gpus = []
    try:
        result = subprocess.run(
            ['lshw', '-C', 'display'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            output = result.stdout
            current_device = None
            for line in output.split('\n'):
                line_stripped = line.strip()
                if line_stripped.startswith('*-display'):
                    if current_device:
                        gpus.append(current_device)
                    current_device = {
                        "name": "Unknown GPU",
                        "type": "Unknown",
                        "temperature": 0,
                        "utilization": 0,
                        "memory_util": 0,
                        "memory_used_gb": 0,
                        "memory_total_gb": 0
                    }
                elif line_stripped.startswith('product:') and current_device:
                    name = line_stripped.split(':', 1)[1].strip().strip('"')
                    current_device['name'] = name
                    current_device['type'] = _detect_gpu_type(name)
                elif line_stripped.startswith('vendor:') and current_device:
                    vendor = line_stripped.split(':', 1)[1].strip().strip('"')
                    if current_device['type'] == "Unknown":
                        current_device['type'] = _detect_gpu_type(vendor)
                elif line_stripped.startswith('memory:') and current_device:
                    # Try to parse memory size
                    mem_str = line_stripped.split(':', 1)[1].strip()
                    try:
                        # Parse sizes like "256MiB", "2GiB", etc.
                        mem_str_lower = mem_str.lower()
                        if 'gib' in mem_str_lower:
                            size_gb = float(mem_str_lower.replace('gib', ''))
                            current_device['memory_total_gb'] = size_gb
                        elif 'mib' in mem_str_lower:
                            size_mb = float(mem_str_lower.replace('mib', ''))
                            current_device['memory_total_gb'] = round(size_mb / 1024, 2)
                    except ValueError:
                        pass
            if current_device and current_device.get('name') != "Unknown GPU":
                gpus.append(current_device)
    except Exception as e:
        print(f"[Debug] lshw failed: {e}")
    return gpus

def _get_intel_gpu_utilization_linux():
    """Try to get Intel iGPU utilization from sysfs (requires kernel support)."""
    try:
        # Try reading from drm sysfs for Intel i915 driver
        card_dirs = ['/sys/class/drm/card0', '/sys/class/drm/card1']
        for card_dir in card_dirs:
            if os.path.exists(card_dir):
                # Check if it's an Intel GPU
                device_dir = os.path.join(card_dir, 'device')
                vendor_file = os.path.join(device_dir, 'vendor')
                if os.path.exists(vendor_file):
                    try:
                        with open(vendor_file, 'r') as f:
                            vendor = f.read().strip().lower()
                            # Intel vendor ID is 0x8086
                            if '0x8086' in vendor or '8086' in vendor:
                                # Try to read GPU utilization
                                # Note: This requires specific kernel configurations
                                act_freq_file = os.path.join(device_dir, 'gt_act_freq_mhz')
                                if os.path.exists(act_freq_file):
                                    try:
                                        with open(act_freq_file, 'r') as f:
                                            freq = int(f.read().strip())
                                            # If frequency > 0, assume some utilization
                                            if freq > 0:
                                                return min(freq / 1000.0, 100)  # Rough estimate
                                    except (IOError, ValueError):
                                        pass
                    except (IOError, OSError):
                        pass
    except Exception:
        pass
    return 0

def _get_amd_gpu_info_linux():
    """Get AMD GPU info from sysfs."""
    gpus = []
    try:
        # AMD GPUs are typically at /sys/class/drm/card*/device/
        for card_num in range(4):
            card_dir = f'/sys/class/drm/card{card_num}'
            device_dir = os.path.join(card_dir, 'device')
            if not os.path.exists(device_dir):
                continue
            
            vendor_file = os.path.join(device_dir, 'vendor')
            if not os.path.exists(vendor_file):
                continue
            
            try:
                with open(vendor_file, 'r') as f:
                    vendor = f.read().strip().lower()
                    # AMD vendor ID is 0x1002
                    if '0x1002' in vendor or '1002' in vendor:
                        name = "AMD GPU"
                        # Try to get device name
                        device_file = os.path.join(device_dir, 'device')
                        if os.path.exists(device_file):
                            with open(device_file, 'r') as f:
                                device_id = f.read().strip()
                                name = f"AMD Radeon ({device_id})"
                        
                        utilization = 0
                        # Try to read GPU utilization from hwmon
                        hwmon_dir = os.path.join(device_dir, 'hwmon')
                        if os.path.exists(hwmon_dir):
                            for entry in os.listdir(hwmon_dir):
                                utilization_file = os.path.join(hwmon_dir, entry, 'gpu_usage_percent')
                                if os.path.exists(utilization_file):
                                    try:
                                        with open(utilization_file, 'r') as f:
                                            utilization = int(f.read().strip())
                                    except (IOError, ValueError):
                                        pass
                        
                        gpus.append({
                            "name": name,
                            "type": "AMD",
                            "temperature": 0,
                            "utilization": utilization,
                            "memory_util": 0,
                            "memory_used_gb": 0,
                            "memory_total_gb": 0
                        })
            except (IOError, OSError):
                continue
    except Exception as e:
        print(f"[Debug] AMD sysfs detection failed: {e}")
    return gpus

# --- KONFIGURASI ---
HOSTNAME = socket.gethostname()
TOPIC = f"lab/monitoring/{HOSTNAME}"
BROKER_URL = "192.168.110.16"
PORT = 1883
PING_TARGET = "8.8.8.8"

def get_cpu_name():
    """Get CPU name in a bulletproof way across platforms"""
    if platform.system() == "Windows":
        try:
            import winreg
            # Access the Windows Registry to get the exact CPU name
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            cpu_name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            return cpu_name.strip()
        except Exception as e:
            print(f"[Warning] Failed to read Registry CPU name: {e}")
            pass
    elif platform.system() == "Linux":
        try:
            import subprocess
            output = subprocess.check_output("cat /proc/cpuinfo | grep 'model name' | uniq", shell=True, text=True).strip()
            return output.split(':')[1].strip()
        except Exception:
            pass
            
    # Fallback
    fallback_name = platform.processor()
    return fallback_name if fallback_name else "Unknown CPU"

# Ambil Spek CPU Sekali Saja (Statik)
CPU_THREADS = psutil.cpu_count(logical=True)
CPU_CORES = psutil.cpu_count(logical=False)
CPU_NAME = get_cpu_name()

# Initialize GPU monitoring
def init_gpu_monitoring():
    """Initialize GPU monitoring for NVIDIA GPUs"""
    if PYNVML_AVAILABLE:
        try:
            pynvml.nvmlInit()
            return True
        except:
            return False
    return False

GPU_INITIALIZED = init_gpu_monitoring()

def get_gpu_info():
    """Get GPU information for all GPUs (NVIDIA, AMD, Intel) with robust fallback chain."""
    gpus = []
    system = platform.system()
    
    # ============================================================
    # 1. NVIDIA GPU detection via pynvml (PRESERVED - BEST METHOD)
    # ============================================================
    if GPU_INITIALIZED:
        try:
            device_count = pynvml.nvmlDeviceGetCount()
            for i in range(device_count):
                try:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                    name = pynvml.nvmlDeviceGetName(handle)
                    if isinstance(name, bytes):
                        name = name.decode('utf-8')
                    
                    # Get memory info
                    memory_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                    memory_used_gb = round(memory_info.used / (1024**3), 2)
                    memory_total_gb = round(memory_info.total / (1024**3), 2)
                    
                    # Get temperature
                    try:
                        temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                    except Exception:
                        temperature = 0
                    
                    # Get utilization
                    try:
                        utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
                        gpu_util = utilization.gpu
                        memory_util = utilization.memory
                    except Exception:
                        gpu_util = 0
                        memory_util = 0
                    
                    gpus.append({
                        "name": name,
                        "type": "NVIDIA",
                        "temperature": temperature,
                        "utilization": gpu_util,
                        "memory_util": memory_util,
                        "memory_used_gb": memory_used_gb,
                        "memory_total_gb": memory_total_gb
                    })
                except Exception as e:
                    print(f"[Debug] Error getting NVIDIA GPU {i}: {e}")
        except Exception as e:
            print(f"[Debug] Error enumerating NVIDIA GPUs: {e}")
    
    # ============================================================
    # 2. WINDOWS: AMD/Intel iGPU detection with multiple fallbacks
    # ============================================================
    if system == "Windows":
        # Track which GPU names we've already captured
        captured_names = {gpu["name"].lower() for gpu in gpus}
        
        # --- Method 2a: WMI via win32com.client (original method) ---
        if WIN32_AVAILABLE:
            try:
                wmi = win32com.client.GetObject("winmgmts:")
                gpu_list = wmi.InstancesOf("Win32_VideoController")
                
                for gpu in gpu_list:
                    gpu_name = gpu.Name
                    # Skip if already captured by pynvml
                    if gpu_name.lower() in captured_names:
                        continue
                    
                    # Get adapter RAM
                    adapter_ram = gpu.AdapterRAM
                    memory_total_gb = round(adapter_ram / (1024**3), 1) if adapter_ram else 0
                    
                    # Get driver version
                    driver_version = getattr(gpu, 'DriverVersion', None) or "N/A"
                    
                    # Check if this is an iGPU (shared memory)
                    is_igpu = False
                    if memory_total_gb < 1.0 or memory_total_gb == 0:
                        is_igpu = True
                        # Calculate shared VRAM as 50% of system RAM
                        try:
                            total_ram = psutil.virtual_memory().total
                            memory_total_gb = round((total_ram * 0.5) / (1024**3), 1)
                        except Exception:
                            memory_total_gb = 2.0  # Safe fallback value
                    
                    # Try to get GPU utilization from Performance Counters
                    utilization = 0
                    try:
                        # Use WMI Performance Counters for GPU utilization
                        perf_class = "Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine"
                        perf_instances = wmi.InstancesOf(perf_class)
                        max_util = 0
                        for instance in perf_instances:
                            try:
                                # Look for 3D engine utilization
                                name_attr = getattr(instance, 'Name', '')
                                if 'engtype_3D' in str(name_attr).lower():
                                    util_value = getattr(instance, 'UtilizationPercentage', 0)
                                    if util_value > max_util:
                                        max_util = util_value
                            except Exception:
                                continue
                        # Cap at 100%
                        utilization = min(int(max_util), 100)
                    except Exception as e:
                        print(f"[Debug] GPU Performance Counters failed: {e}")
                    
                    gpu_entry = {
                        "name": gpu_name,
                        "type": _detect_gpu_type(gpu_name),
                        "temperature": 0,
                        "utilization": utilization,
                        "memory_util": 0,
                        "memory_used_gb": 0,
                        "memory_total_gb": memory_total_gb,
                        "is_igpu": is_igpu,
                        "driver_version": driver_version
                    }
                    gpus.append(gpu_entry)
                    captured_names.add(gpu_name.lower())
            except Exception as e:
                print(f"[Debug] WMI COM failed: {e}")
        
        # --- Method 2b: PowerShell Get-CimInstance (fallback if WMI failed or no GPUs found) ---
        if not gpus or (WIN32_AVAILABLE and len(gpus) == 0):
            try:
                ps_gpus = _get_gpu_info_windows_powershell_combined()
                for gpu in ps_gpus:
                    if gpu["name"].lower() not in captured_names:
                        gpus.append(gpu)
                        captured_names.add(gpu["name"].lower())
            except Exception as e:
                print(f"[Debug] PowerShell combined failed: {e}")
        
        # --- Method 2c: PowerShell VideoController only (simpler fallback) ---
        if not gpus:
            try:
                ps_gpus = _get_gpu_info_powershell_videocontroller()
                for gpu in ps_gpus:
                    if gpu["name"].lower() not in captured_names:
                        gpus.append(gpu)
                        captured_names.add(gpu["name"].lower())
            except Exception as e:
                print(f"[Debug] PowerShell VideoController failed: {e}")
        
        # --- Method 2d: WMIC command (last resort for Windows) ---
        if not gpus:
            try:
                wmic_gpus = _get_gpu_info_windows_wmic()
                for gpu in wmic_gpus:
                    if gpu["name"].lower() not in captured_names:
                        gpus.append(gpu)
                        captured_names.add(gpu["name"].lower())
            except Exception as e:
                print(f"[Debug] WMIC failed: {e}")
    
    # ============================================================
    # 3. LINUX: AMD/Intel GPU detection
    # ============================================================
    elif system == "Linux":
        captured_names = {gpu["name"].lower() for gpu in gpus}
        
        # --- Method 3a: lspci (most reliable, doesn't require root) ---
        try:
            lspci_gpus = _get_gpu_info_linux_lspci()
            for gpu in lspci_gpus:
                if gpu["name"].lower() not in captured_names:
                    gpus.append(gpu)
                    captured_names.add(gpu["name"].lower())
        except Exception as e:
            print(f"[Debug] lspci failed: {e}")
        
        # --- Method 3b: lshw (more detailed, may require sudo) ---
        if not gpus:
            try:
                lshw_gpus = _get_gpu_info_linux_lshw()
                for gpu in lshw_gpus:
                    if gpu["name"].lower() not in captured_names:
                        gpus.append(gpu)
                        captured_names.add(gpu["name"].lower())
            except Exception as e:
                print(f"[Debug] lshw failed: {e}")
        
        # --- Method 3c: AMD sysfs detection (for AMD GPUs) ---
        try:
            amd_gpus = _get_amd_gpu_info_linux()
            for gpu in amd_gpus:
                if gpu["name"].lower() not in captured_names:
                    gpus.append(gpu)
                    captured_names.add(gpu["name"].lower())
        except Exception as e:
            print(f"[Debug] AMD sysfs failed: {e}")
        
        # --- Update Intel iGPU utilization if detected ---
        if gpus:
            for gpu in gpus:
                if gpu["type"] == "Intel" and gpu["utilization"] == 0:
                    try:
                        util = _get_intel_gpu_utilization_linux()
                        if util > 0:
                            gpu["utilization"] = round(util, 1)
                    except Exception:
                        pass
    
    # ============================================================
    # 4. Clean up: Remove 'driver_version' key if present (not in standard format)
    # ============================================================
    for gpu in gpus:
        if "driver_version" in gpu:
            del gpu["driver_version"]
    
    return gpus

def get_active_interface_via_ping():
    print("[*] Mencari interface aktif dengan akses internet...")
    is_windows = platform.system() == "Windows"
    addrs = psutil.net_if_addrs()
    
    for intf, addr_list in addrs.items():
        if intf.lower() in ['lo', 'loopback', 'localhost']: continue
            
        for addr in addr_list:
            if addr.family == socket.AF_INET:
                ip_address = addr.address
                try:
                    if is_windows:
                        cmd = ["ping", "-n", "1", "-w", "500", "-S", ip_address, PING_TARGET]
                    else:
                        cmd = ["ping", "-c", "1", "-W", "1", "-I", intf, PING_TARGET]
                    
                    startupinfo = None
                    if is_windows:
                        startupinfo = subprocess.STARTUPINFO()
                        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    
                    subprocess.check_output(cmd, startupinfo=startupinfo, stderr=subprocess.STDOUT)
                    print(f"    [+] Terpilih: {intf} ({ip_address})")
                    return intf
                except: continue
    return list(addrs.keys())[0] if addrs else "eth0"

INTERFACE_NAME = get_active_interface_via_ping()

def get_interface_ip_mac(interface_name):
    """Get the IP address and MAC address for the given interface."""
    addrs = psutil.net_if_addrs()
    ip_address = None
    mac_address = None
    if interface_name in addrs:
        for addr in addrs[interface_name]:
            if addr.family == socket.AF_INET and not ip_address:
                ip_address = addr.address
            if addr.family == psutil.AF_LINK and not mac_address:
                mac_address = addr.address
    return ip_address or "N/A", mac_address or "N/A"

def get_top_processes(limit=5):
    """Get top processes by CPU usage."""
    processes = []
    try:
        for proc in psutil.process_iter(['name', 'cpu_percent', 'memory_percent']):
            try:
                pinfo = proc.info
                if pinfo['name'] and pinfo['cpu_percent']:
                    processes.append((pinfo['name'], round(pinfo['cpu_percent'], 1), round(pinfo['memory_percent'] or 0, 1)))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        processes.sort(key=lambda x: x[1], reverse=True)
    except:
        pass
    return [{"name": p[0], "cpu": p[1], "mem": p[2]} for p in processes[:limit]]

def get_largest_files(limit=5):
    """Get largest files from common locations."""
    files = []
    search_paths = []
    is_windows = platform.system() == "Windows"
    if is_windows:
        search_paths = [os.path.join(os.environ.get('USERPROFILE', 'C:\\Users\\Public'), 'Desktop'),
                       os.path.join(os.environ.get('USERPROFILE', 'C:\\Users\\Public'), 'Documents'),
                       os.path.join(os.environ.get('USERPROFILE', 'C:\\Users\\Public'), 'Downloads')]
    else:
        search_paths = [os.path.expanduser('~/Desktop'),
                       os.path.expanduser('~/Documents'),
                       os.path.expanduser('~/Downloads')]
    try:
        for path in search_paths:
            if os.path.exists(path):
                for root, dirs, filenames in os.walk(path, topdown=True):
                    dirs[:] = [d for d in dirs if not d.startswith('.') and not d.startswith('$')]
                    if len(files) >= limit * 3:
                        break
                    for f in filenames[:100]:
                        try:
                            fpath = os.path.join(root, f)
                            if os.path.isfile(fpath) and not os.path.islink(fpath):
                                size = os.path.getsize(fpath)
                                if size > 1024 * 1024:  # > 1MB
                                    files.append((fpath, size))
                        except:
                            continue
                    if len(files) >= limit * 3:
                        break
        files.sort(key=lambda x: x[1], reverse=True)
    except:
        pass
    return [{"name": os.path.basename(f[0]), "path": f[0], "size_mb": round(f[1] / (1024 * 1024), 1)} for f in files[:limit]]

# --- FUNGSI METRIK ---
def get_uptime():
    try:
        uptime_seconds = time.time() - psutil.boot_time()
        return f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m"
    except: return "N/A"

def get_latency(host):
    try:
        is_windows = platform.system() == "Windows"
        cmd = ["ping", "-n" if is_windows else "-c", "1", "-w" if is_windows else "-W", "1", host]
        startupinfo = None
        if is_windows:
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        output = subprocess.check_output(cmd, startupinfo=startupinfo, stderr=subprocess.STDOUT, universal_newlines=True)
        if "time=" in output:
            val = output.split("time=")[1].split("ms")[0].strip()
            return int(float(val))
    except: return 999
    return 0

def get_net_usage(interface):
    try:
        net_io = psutil.net_io_counters(pernic=True)
        if interface in net_io:
            return net_io[interface].bytes_recv, net_io[interface].bytes_sent
    except: pass
    return 0, 0

# ==================== COMMAND EXECUTION HANDLER ====================
# Whitelist command - hanya command ini yang diizinkan
# Format: Windows command (with Linux fallback)
# Dynamic parameters: {process_name}, {url}, {file_path}
ALLOWED_COMMANDS = {
    # Info commands (existing)
    'tasklist': 'tasklist' if platform.system() == 'Windows' else 'ps aux',
    'ipconfig': 'ipconfig' if platform.system() == 'Windows' else 'ifconfig',
    'whoami': 'whoami',
    'systeminfo': 'systeminfo' if platform.system() == 'Windows' else 'uname -a',
    
    # Power commands
    'shutdown': 'shutdown /s /t 30 /c "Dimatikan oleh Admin" /f' if platform.system() == 'Windows' else 'shutdown -h +1',
    'restart': 'shutdown /r /t 30 /c "Direstart oleh Admin" /f' if platform.system() == 'Windows' else 'shutdown -r +1',
    'cancel_shutdown': 'shutdown /a' if platform.system() == 'Windows' else 'shutdown -c',
    
    # Process commands
    'taskkill': 'taskkill /IM {process_name} /F' if platform.system() == 'Windows' else 'killall {process_name}',
    
    # Screen control
    'lock_screen': 'rundll32.exe user32.dll,LockWorkStation' if platform.system() == 'Windows' else 'loginctl lock-session',
    
    # Maintenance commands
    'clear_temp': 'del /q/f/s %TEMP%\\*' if platform.system() == 'Windows' else 'rm -rf /tmp/*',
    'flush_dns': 'ipconfig /flushdns' if platform.system() == 'Windows' else 'resolvectl flush-caches',
    
    # Interactive commands
    'open_url': 'start {url}' if platform.system() == 'Windows' else 'xdg-open {url}',
    
    # File operations
    'delete_file': 'del /f /q "{file_path}"' if platform.system() == 'Windows' else 'rm -f "{file_path}"',
}

command_lock = Lock()

def execute_command(command_name, timeout=10, params=None):
    """
    Execute whitelisted command dengan timeout
    
    Args:
        command_name: nama command dari whitelist
        timeout: timeout dalam detik (default 10)
        params: dict parameter tambahan untuk command (misal process_name untuk taskkill)
    
    Returns:
        dict dengan status dan output/error
    """
    if command_name not in ALLOWED_COMMANDS:
        return {
            "status": "error",
            "error": f"Command '{command_name}' tidak ada di whitelist",
            "output": ""
        }
    
    try:
        with command_lock:  # Prevent concurrent execution
            cmd_template = ALLOWED_COMMANDS[command_name]
            params = params or {}
            
            # Define allowed parameter types for each command
            allowed_params = {
                'taskkill': ['process_name'],
                'open_url': ['url'],
                'delete_file': ['file_path'],
            }
            
            # Validate required parameters based on command type
            required_params = []
            if '{process_name}' in cmd_template:
                required_params.append('process_name')
            if '{url}' in cmd_template:
                required_params.append('url')
            if '{file_path}' in cmd_template:
                required_params.append('file_path')
            
            for param in required_params:
                if param not in params:
                    return {
                        "status": "error",
                        "error": f"Parameter '{param}' diperlukan untuk command {command_name}",
                        "output": ""
                    }
            
            # Security: Only allow string substitution for known parameters
            # and validate/sanitize input values
            cmd = cmd_template
            for key, value in params.items():
                placeholder = '{' + key + '}'
                if placeholder in cmd:
                    # Convert to string and basic sanitization
                    str_value = str(value)
                    
                    # Additional validation for specific parameter types
                    if key == 'url':
                        # Basic URL validation - only allow http/https
                        if not (str_value.startswith('http://') or str_value.startswith('https://')):
                            return {
                                "status": "error",
                                "error": "Invalid URL format. Only http:// and https:// allowed.",
                                "output": ""
                            }
                        # Block dangerous characters
                        if any(c in str_value for c in ['&', '|', ';', '`', '$', '(', ')', '<', '>', '\n', '\r']):
                            return {
                                "status": "error",
                                "error": "URL contains invalid characters",
                                "output": ""
                            }
                    
                    if key == 'file_path':
                        # Block path traversal attempts
                        if '..' in str_value:
                            return {
                                "status": "error",
                                "error": "Path traversal not allowed",
                                "output": ""
                            }
                        # Block shell metacharacters
                        if any(c in str_value for c in ['&', '|', ';', '`', '$', '(', ')', '<', '>', '\n', '\r']):
                            return {
                                "status": "error",
                                "error": "File path contains invalid characters",
                                "output": ""
                            }
                    
                    if key == 'process_name':
                        # Block shell metacharacters
                        if any(c in str_value for c in ['&', '|', ';', '`', '$', '(', ')', '<', '>', '\n', '\r', '/', '\\']):
                            return {
                                "status": "error",
                                "error": "Process name contains invalid characters",
                                "output": ""
                            }
                    
                    cmd = cmd.replace(placeholder, str_value)
            
            is_windows = platform.system() == 'Windows'
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                shell=is_windows
            )
            
            output = result.stdout if result.stdout else result.stderr
            
            return {
                "status": "success",
                "output": output,
                "error": result.stderr if result.returncode != 0 else ""
            }
    
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "error": f"Command timeout setelah {timeout} detik",
            "output": ""
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "output": ""
        }

def on_command_message(client, userdata, msg):
    """
    Handler untuk command dari backend via MQTT
    Topic: lab/command/{HOSTNAME}
    """
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        command_name = payload.get('command')
        request_id = payload.get('request_id', 'unknown')
        
        print(f"[*] Command diterima: {command_name} (ID: {request_id})")
        
        # Extract additional parameters (e.g. process_name for taskkill)
        params = payload.get('params', {})
        
        # Execute command dengan timeout 10 detik
        result = execute_command(command_name, timeout=10, params=params)
        
        # Siapkan response
        response = {
            "hostname": HOSTNAME,
            "request_id": request_id,
            "command": command_name,
            "timestamp": datetime.now().isoformat(),
            "result": result
        }
        
        # Publish hasil ke topic response
        response_topic = f"lab/command/result/{HOSTNAME}"
        client.publish(response_topic, json.dumps(response))
        print(f"[✓] Hasil command dipublikasi ke {response_topic}")
        
    except json.JSONDecodeError as e:
        print(f"[!] Error parsing command payload: {e}")
    except Exception as e:
        print(f"[!] Error handling command: {e}")

# --- SETUP MQTT ---
# Support paho-mqtt v1.x dan v2.x
def on_connect(client, userdata, connect_flags, rc, properties=None):
    if rc == 0:
        print(f"[✓] MQTT Terhubung ke {BROKER_URL}:{PORT}")
        # Subscribe ke command topic
        command_topic = f"lab/command/{HOSTNAME}"
        client.subscribe(command_topic)
        print(f"[✓] Subscribe ke {command_topic}")
    else:
        print(f"[✗] MQTT Gagal dengan kode {rc}")

def on_disconnect(client, userdata, disconnect_flags, rc, properties=None):
    if rc != 0:
        print(f"[!] Putus koneksi tidak terduga. Kode: {rc}")

def on_publish(client, userdata, mid, reason_code=None, properties=None):
    pass

try:
    from paho.mqtt.enums import CallbackAPIVersion
    client = mqtt.Client(callback_api_version=CallbackAPIVersion.VERSION2)
except (ImportError, AttributeError):
    client = mqtt.Client()

client.on_connect = on_connect
client.on_disconnect = on_disconnect
client.on_publish = on_publish
# Setup message callback untuk command topic
client.message_callback_add(f"lab/command/{HOSTNAME}", on_command_message)
client.will_set(TOPIC, json.dumps({"id": HOSTNAME, "status": "offline"}), retain=True)

# ==================== GRACEFUL SHUTDOWN ====================
import signal, sys

running = True  # Flag untuk stop while loop

def shutdown(signum=None, frame=None):
    global running
    print(f"\n[!] Shutting down agent '{HOSTNAME}'...")
    running = False  # Stop while loop, cleanup dilakukan setelah loop

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

mqtt_connected = False
try:
    print(f"[*] Menghubungkan ke broker MQTT {BROKER_URL}:{PORT}...")
    client.connect(BROKER_URL, PORT, 60)
    client.loop_start()
    mqtt_connected = True
except socket.gaierror as e:
    print(f"[✗] Kesalahan DNS/Jaringan: Tidak bisa resolve {BROKER_URL} - {e}")
except ConnectionRefusedError as e:
    print(f"[✗] Koneksi Ditolak: Broker {BROKER_URL}:{PORT} tidak menerima koneksi - {e}")
except TimeoutError as e:
    print(f"[✗] Koneksi Timeout: Broker {BROKER_URL}:{PORT} tidak merespons - {e}")
except Exception as e:
    print(f"[✗] Kesalahan MQTT: {type(e).__name__}: {e}")

old_rx, old_tx = get_net_usage(INTERFACE_NAME)
last_time = time.time()

# Pre-calc ip/mac once (could also refresh each loop if network changes)
IP_ADDRESS, MAC_ADDRESS = get_interface_ip_mac(INTERFACE_NAME)

# Caching timers & values for high-frequency millisecond updates (0.1s / 100ms)
# Separates fast-changing metrics (CPU, RAM, network speed) from slow-changing ones
last_latency_time = 0
last_storage_time = 0
last_processes_time = 0
last_files_time = 0
last_gpu_time = 0
last_freq_time = 0

cached_latency = 0
cached_storage_total = 0
cached_storage_used = 0
cached_storage_free = 0
cached_storage_percent = 0
cached_processes = []
cached_files = []
cached_gpu_info = []
cached_current_ghz = 0
cached_max_ghz = 0

# Set target refresh interval (e.g. 0.1s for millisecond real-time responsiveness)
REFRESH_INTERVAL = 0.1

while running:
    try:
        current_time = time.time()
        elapsed = current_time - last_time
        last_time = current_time

        # Fast metric: Network RX/TX usage
        current_rx_bytes, current_tx_bytes = get_net_usage(INTERFACE_NAME)
        down_mbps = ((current_rx_bytes - old_rx) * 8 / (1024 * 1024)) / elapsed if elapsed > 0 else 0
        up_mbps = ((current_tx_bytes - old_tx) * 8 / (1024 * 1024)) / elapsed if elapsed > 0 else 0
        old_rx, old_tx = current_rx_bytes, current_tx_bytes

        # Fast metric: RAM Virtual Memory
        mem = psutil.virtual_memory()

        # Slow metric: Latency (Ping) - Refresh every 5 seconds to avoid overhead
        if current_time - last_latency_time >= 5.0:
            cached_latency = get_latency(PING_TARGET)
            last_latency_time = current_time

        # Slow metric: Storage - Refresh every 10 seconds to avoid disk wear
        if current_time - last_storage_time >= 10.0:
            storage_total = 0
            storage_used = 0
            storage_free = 0

            if platform.system() == "Windows":
                for part in psutil.disk_partitions(all=False):
                    fstype = (part.fstype or "").lower()
                    if fstype in {"tmpfs", "devtmpfs"}:
                        continue
                    if not part.mountpoint:
                        continue
                    try:
                        usage = psutil.disk_usage(part.mountpoint)
                        storage_total += usage.total
                        storage_used += usage.used
                        storage_free += usage.free
                    except Exception:
                        continue
            else:
                for part in psutil.disk_partitions(all=False):
                    fstype = (part.fstype or "").lower()
                    if fstype in {"tmpfs", "devtmpfs", "proc", "sysfs", "cgroup", "cgroup2", "overlay"}:
                        continue
                    if not part.mountpoint:
                        continue
                    try:
                        usage = psutil.disk_usage(part.mountpoint)
                        storage_total += usage.total
                        storage_used += usage.used
                        storage_free += usage.free
                    except Exception:
                        continue

            cached_storage_percent = (storage_used / storage_total * 100.0) if storage_total > 0 else 0
            cached_storage_total = storage_total
            cached_storage_used = storage_used
            cached_storage_free = storage_free
            last_storage_time = current_time

        # Medium metric: CPU Frequency - Refresh every 1.0 second
        if current_time - last_freq_time >= 1.0:
            freq = psutil.cpu_freq()
            cached_current_ghz = round(freq.current / 1000, 2) if freq else 0
            cached_max_ghz = round(freq.max / 1000, 2) if freq else 0
            last_freq_time = current_time

        # Medium metric: GPU Info - Refresh every 1.0 second
        if current_time - last_gpu_time >= 1.0:
            cached_gpu_info = get_gpu_info()
            last_gpu_time = current_time

        # Medium metric: Top Processes - Refresh every 2.0 seconds
        if current_time - last_processes_time >= 2.0:
            cached_processes = get_top_processes(5)
            last_processes_time = current_time

        # Ultra-slow metric: Top Largest Files - Refresh every 30.0 seconds to prevent 100% Disk Usage
        if current_time - last_files_time >= 30.0:
            cached_files = get_largest_files(5)
            last_files_time = current_time

        payload = {
            "id": HOSTNAME, "status": "online", "user": getpass.getuser(),
            "time": datetime.now().strftime("%H:%M:%S"),
            "info": {
                "uptime": get_uptime(),
                "os": f"{platform.system()} {platform.release()}",
                "cpu_name": CPU_NAME
            },
            "network": {
                "down_mbps": round(max(0, down_mbps), 2),
                "up_mbps": round(max(0, up_mbps), 2),
                "traffic_in_gb": round(current_rx_bytes / (1024**3), 2),
                "latency_ms": cached_latency,
                "iface": INTERFACE_NAME,
                "ip": IP_ADDRESS,
                "mac": MAC_ADDRESS
            },
            "metrics": {
                "cpu": {
                    "percent": int(psutil.cpu_percent()),
                    "threads": CPU_THREADS,
                    "cores": CPU_CORES,
                    "ghz": cached_current_ghz,
                    "max_ghz": cached_max_ghz
                },
                "ram_percent": int(mem.percent),
                "ram": {
                    "used_gb": round(mem.used / (1024**3), 2),
                    "total_gb": round(mem.total / (1024**3), 1)
                },
                "storage": {
                    "total_gb": round(cached_storage_total / (1024**3), 1),
                    "used_gb": round(cached_storage_used / (1024**3), 1),
                    "free_gb": round(cached_storage_free / (1024**3), 1),
                    "percent": round(cached_storage_percent, 1)
                },
                "gpu": cached_gpu_info,
                "top_processes": cached_processes,
                "top_files": cached_files
            }
        }

        if not running:
            break  # Keluar sebelum sempat publish online lagi
        if mqtt_connected or client.is_connected():
            client.publish(TOPIC, json.dumps(payload), retain=True)
        else:
            print(f"[!] MQTT tidak terhubung, skip publish")
        print(f"[{payload['time']}] CPU: {payload['metrics']['cpu']['percent']}% | RAM: {payload['metrics']['ram_percent']}% | Net: {payload['network']['down_mbps']} Mbps")
    except Exception as e: print(f"Err: {e}")
    time.sleep(REFRESH_INTERVAL)

# ==================== CLEANUP SETELAH LOOP BERHENTI ====================
print("[*] Loop berhenti, mengirim status offline...")
try:
    offline_payload = json.dumps({"id": HOSTNAME, "status": "offline"})
    if client.is_connected():
        info = client.publish(TOPIC, offline_payload, retain=True)
        info.wait_for_publish(timeout=3)
        print("[✓] Status offline berhasil dikirim")
    else:
        print("[!] MQTT sudah disconnect, skip publish offline")
except Exception as e:
    print(f"[!] Gagal kirim offline: {e}")
finally:
    client.loop_stop()
    client.disconnect()
    print("[✓] Agent berhenti.")
    sys.exit(0)