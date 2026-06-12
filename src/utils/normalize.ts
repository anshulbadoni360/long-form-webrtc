import fs from "node:fs";
import log from "../services/logger/log";

export async function readBase64File(
  filePath: string,
  retries = 5,
  delay = 100,
): Promise<string | false> {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          const content = fs.readFileSync(filePath);
          return Buffer.from(content).toString("base64");
        }
      }
    } catch (e) {
      // Ignore read locks or errors when a writer is active
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

export const resolvePublicIp = async (): Promise<string> => {
  if (process.env.PUBLIC_IP) {
    return process.env.PUBLIC_IP.trim();
  }

  try {
    const res = await fetch("https://api.ipify.org");
    if (res.ok) {
      const ip = (await res.text()).trim();
      log.info(`[IpResolver] Resolved public IP dynamically: ${ip}`);
      return ip;
    }
  } catch (err: any) {
    log.error(
      `[IpResolver] Dynamic IP resolution failed: ${err.message || err}`,
    );
  }

  log.warn(
    "[IpResolver] IP resolution failed. Defaulting to loopback 127.0.0.1",
  );
  return "127.0.0.1";
};

export const formatIpToRoute = (ip: string): string => {
  return ip.replaceAll(".", "_");
};
