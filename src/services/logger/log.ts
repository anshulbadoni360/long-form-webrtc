import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export class Log {
  private readonly filePath: string;

  constructor(filePath = process.env.LOG_FILE_PATH || "logs/app.log") {
    this.filePath = filePath;
  }

  private formatLog(message: string): string {
    return `[${new Date().toISOString()}] ${message}`;
  }

  private async write(
    message: string,
    consoleMethod: "log" | "warn" | "error" = "log",
  ): Promise<void> {
    console[consoleMethod](message);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${message}\n`, "utf8");
  }

  public async info(message: string): Promise<void> {
    await this.write(this.formatLog(message), "log");
  }

  public async warn(message: string): Promise<void> {
    await this.write(this.formatLog(`WARN: ${message}`), "warn");
  }

  public async error(message: string, error?: unknown): Promise<void> {
    const errorSuffix = error
      ? `, ${error instanceof Error ? error.message : String(error)}`
      : "";
    await this.write(
      this.formatLog(`ERROR: ${message}${errorSuffix}`),
      "error",
    );
  }
}

export default new Log();
