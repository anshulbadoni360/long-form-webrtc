import os from "node:os";
import instanceService from "./instance.service";
import log from "../logger/log";
import { monetRooms } from "../room/room.service";

class MetricsService {
  private timeoutId: NodeJS.Timeout | null = null;
  private currentIp: string = "";
  private isRunning: boolean = false;

  public get publicIp(): string {
    return this.currentIp;
  }

  public set publicIp(ip: string) {
    this.currentIp = ip;
  }

  private currentStats = {
    CPU: 0,
    RAM: 0,
    occupied: false,
    Calls: 0,
    Participants: 0,
  };

  private lastPersisted = {
    CPU: -999,
    RAM: -999,
    occupied: false,
  };

  // Only write to the DB if CPU or RAM fluctuations exceed 10%
  private readonly METRIC_THRESHOLD = 10;

  public cpuThreshold = Number(process.env.CPU_THRESHOLD) || 80;
  public ramThreshold = Number(process.env.RAM_THRESHOLD) || 80;

  public get state() {
    const rooms = Object.values(monetRooms);
    this.currentStats.Calls = rooms.filter((r: any) => r?.State?.active).length;
    this.currentStats.Participants = rooms.reduce(
      (sum: number, r: any) => sum + (r?.noActiveParticipants || 0),
      0,
    );

    return this.currentStats;
  }

  public async startMonitoring(publicIp?: string) {
    if (publicIp) {
      this.currentIp = publicIp;
    } else if (process.env.PUBLIC_IP) {
      this.currentIp = process.env.PUBLIC_IP;
    } else {
      try {
        const res = await fetch("https://api.ipify.org");
        if (res.ok) {
          this.currentIp = (await res.text()).trim();
        } else {
          this.currentIp = "127.0.0.1";
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`[Metrics] Failed to resolve public IP dynamically, defaulting to 127.0.0.1: ${message}`);
        this.currentIp = "127.0.0.1";
      }
    }
    this.isRunning = true;

    log.info(`[Metrics] Starting server metrics tracking for IP: ${this.currentIp}`);
    this.loop();
  }

  public stopMonitoring() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    log.info(`[Metrics] Stopped server metrics monitoring.`);
  }

  private async loop() {
    if (!this.isRunning) return;

    await this.processMetrics();

    // Check active call counts in this instance
    const activeCalls = Object.values(monetRooms).filter(
      (room: any) => room && room.State && room.State.active,
    ).length;

    // 15 seconds if active meetings are running, otherwise scale down to 60 seconds
    const nextIntervalMs = activeCalls > 0 ? 15000 : 60000;

    this.timeoutId = setTimeout(() => this.loop(), nextIntervalMs);
  }

  private getRamUsagePercentage(): number {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return Math.round((used / total) * 100);
  }

  private getCpuAverage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const timeType in cpu.times) {
        totalTick += (cpu.times as any)[timeType];
      }
      totalIdle += cpu.times.idle;
    }

    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length,
    };
  }

  private getCpuLoadPercentage(): Promise<number> {
    return new Promise((resolve) => {
      const start = this.getCpuAverage();

      setTimeout(() => {
        const end = this.getCpuAverage();
        const idleDiff = end.idle - start.idle;
        const totalDiff = end.total - start.total;

        if (totalDiff === 0) {
          return resolve(0);
        }

        const usagePercentage = (1 - idleDiff / totalDiff) * 100;
        resolve(Math.round(usagePercentage));
      }, 1000);
    });
  }

  private async processMetrics() {
    try {
      const cpu = await this.getCpuLoadPercentage();
      const ram = this.getRamUsagePercentage();
      const occupied = cpu > this.cpuThreshold || ram > this.ramThreshold;

      // Update in-memory state cache
      this.currentStats.CPU = cpu;
      this.currentStats.RAM = ram;
      this.currentStats.occupied = occupied;

      // Worthiness Check: Verify if metrics have shifted significantly
      const occupiedFlipped = occupied !== this.lastPersisted.occupied;
      const cpuShifted =
        Math.abs(cpu - this.lastPersisted.CPU) > this.METRIC_THRESHOLD;
      const ramShifted =
        Math.abs(ram - this.lastPersisted.RAM) > this.METRIC_THRESHOLD;

      if (occupiedFlipped || cpuShifted || ramShifted) {
        log.info(
          `[Metrics] Change detected. Updating DB stats - CPU: ${cpu}%, RAM: ${ram}%, Occupied: ${occupied}`,
        );

        await instanceService.updateStats(this.currentIp, {
          CPU: cpu,
          RAM: ram,
          occupied,
        });

        // Cache the newly persisted values
        this.lastPersisted = {
          CPU: cpu,
          RAM: ram,
          occupied,
        };
      } else {
        log.info(
          `[Metrics] Stats stable (CPU: ${cpu}%, RAM: ${ram}%). Skipping database write.`,
        );
      }
    } catch (error: any) {
      log.error(`[Metrics] Failed to execute metrics collection:`, error);
    }
  }
}

export const metricsService = new MetricsService();
export default metricsService;
