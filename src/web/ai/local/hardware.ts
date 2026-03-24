// Hardware detection — detects RAM, CPU, GPU capabilities for model recommendations.
// Uses os module + system commands only. Does NOT import node-llama-cpp here —
// initializing the native runtime at detection time crashes Bun (segfault in Vulkan init).
// GPU backend type (cuda/vulkan/metal) is determined later when the model is loaded.

import { totalmem, freemem, cpus } from "node:os";

export interface HardwareInfo {
  totalRamGB: number;
  availableRamGB: number;
  cpu: { name: string; cores: number; arch: string };
  gpu: { name: string; vramGB?: number } | null;
}

// Detect hardware capabilities using only OS APIs and system commands.
export async function detectHardware(): Promise<HardwareInfo> {
  const totalRamGB = Math.round((totalmem() / (1024 ** 3)) * 10) / 10;
  const availableRamGB = Math.round((freemem() / (1024 ** 3)) * 10) / 10;

  const cpuInfo = cpus();
  const cpu = {
    name: cpuInfo[0]?.model || "Unknown CPU",
    cores: cpuInfo.length,
    arch: process.arch,
  };

  // Detect GPU via system commands (no native library initialization)
  let gpu: HardwareInfo["gpu"] = null;

  if (process.platform === "win32") {
    gpu = await detectGpuWindows();
  } else if (process.platform === "darwin") {
    gpu = await detectGpuMac();
  } else {
    gpu = await detectGpuLinux();
  }

  return { totalRamGB, availableRamGB, cpu, gpu };
}

// Windows: PowerShell + nvidia-smi
async function detectGpuWindows(): Promise<HardwareInfo["gpu"]> {
  try {
    // Get GPU name via PowerShell
    const proc = Bun.spawn(
      ["powershell", "-NoProfile", "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    const name = stdout.trim().split("\n")[0]?.trim();
    if (!name) return null;

    // Parse VRAM from name if present (e.g. "Intel(R) Arc(TM) 140T GPU (16GB)")
    let vramGB: number | undefined;
    const vramMatch = name.match(/\((\d+)\s*GB\)/i);
    if (vramMatch) {
      vramGB = parseInt(vramMatch[1]);
    }

    // For NVIDIA GPUs, try nvidia-smi for accurate VRAM
    if (name.toLowerCase().includes("nvidia") || name.toLowerCase().includes("geforce")) {
      try {
        const smiProc = Bun.spawn(
          ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
          { stdout: "pipe", stderr: "pipe" }
        );
        const smiOut = await new Response(smiProc.stdout).text();
        await smiProc.exited;
        const parts = smiOut.trim().split(",").map((s) => s.trim());
        if (parts[1]) {
          vramGB = Math.round(parseInt(parts[1]) / 1024 * 10) / 10;
        }
      } catch {
        // nvidia-smi not available
      }
    }

    return { name, vramGB };
  } catch {
    return null;
  }
}

// macOS: system_profiler
async function detectGpuMac(): Promise<HardwareInfo["gpu"]> {
  try {
    const proc = Bun.spawn(
      ["system_profiler", "SPDisplaysDataType", "-detailLevel", "mini"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    // Parse chipset/model name
    const chipMatch = stdout.match(/Chipset Model:\s*(.+)/i);
    const name = chipMatch?.[1]?.trim();
    if (!name) return null;

    // Parse VRAM
    let vramGB: number | undefined;
    const vramMatch = stdout.match(/VRAM.*?:\s*(\d+)\s*(MB|GB)/i);
    if (vramMatch) {
      const val = parseInt(vramMatch[1]);
      vramGB = vramMatch[2] === "GB" ? val : Math.round(val / 1024 * 10) / 10;
    }

    return { name, vramGB };
  } catch {
    return null;
  }
}

// Linux: lspci + nvidia-smi
async function detectGpuLinux(): Promise<HardwareInfo["gpu"]> {
  try {
    const proc = Bun.spawn(
      ["lspci"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    // Find VGA or 3D controller line
    const gpuLine = stdout.split("\n").find((l) =>
      /VGA|3D|Display/i.test(l)
    );
    if (!gpuLine) return null;

    // Extract GPU name (after the colon)
    const nameMatch = gpuLine.match(/:\s*(.+)/);
    const name = nameMatch?.[1]?.trim();
    if (!name) return null;

    // Try nvidia-smi for VRAM
    let vramGB: number | undefined;
    try {
      const smiProc = Bun.spawn(
        ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
        { stdout: "pipe", stderr: "pipe" }
      );
      const smiOut = await new Response(smiProc.stdout).text();
      await smiProc.exited;
      const val = parseInt(smiOut.trim());
      if (val > 0) vramGB = Math.round(val / 1024 * 10) / 10;
    } catch {
      // nvidia-smi not available
    }

    return { name, vramGB };
  } catch {
    return null;
  }
}

// One-line hardware summary for UI display
export function summarizeHardware(hw: HardwareInfo): string {
  const parts = [`${hw.totalRamGB} GB RAM`, `${hw.cpu.cores} cores`];
  if (hw.gpu) {
    if (hw.gpu.vramGB) {
      parts.push(`${hw.gpu.name} ${hw.gpu.vramGB} GB`);
    } else {
      parts.push(hw.gpu.name);
    }
  } else {
    parts.push("CPU only");
  }
  return parts.join(", ");
}
