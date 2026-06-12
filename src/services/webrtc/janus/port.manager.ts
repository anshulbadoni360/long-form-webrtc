import log from "../../logger/log";

export class PortManager {
  private currentPort: number;
  private readonly startPort: number;
  private readonly endPort: number;
  private readonly activePorts: Set<number> = new Set();

  constructor(startPort = 2000, endPort = 65535) {
    this.startPort = startPort;
    this.endPort = endPort;
    this.currentPort = startPort;
  }

  /**
   * Acquires a free port.
   */
  public acquirePort(): number {
    const originalPort = this.currentPort;

    while (this.activePorts.has(this.currentPort)) {
      this.currentPort++;
      if (this.currentPort > this.endPort) {
        this.currentPort = this.startPort; // Wrap around
      }
      if (this.currentPort === originalPort) {
        throw new Error("No free ports available in the allocated range.");
      }
    }

    const acquired = this.currentPort;
    this.activePorts.add(acquired);
    log.info(`[PortManager] Acquired port ${acquired}. Active ports count: ${this.activePorts.size}`);

    // Increment current port pointer for next allocation
    this.currentPort++;
    if (this.currentPort > this.endPort) {
      this.currentPort = this.startPort;
    }

    return acquired;
  }

  /**
   * Releases a port back to the available pool.
   */
  public releasePort(port: number): void {
    if (this.activePorts.delete(port)) {
      log.info(`[PortManager] Released port ${port}. Active ports count: ${this.activePorts.size}`);
    } else {
      log.warn(`[PortManager] Attempted to release port ${port} which was not tracked as active.`);
    }
  }

  /**
   * Gets the list of currently active ports.
   */
  public getActivePorts(): number[] {
    return Array.from(this.activePorts);
  }
}
