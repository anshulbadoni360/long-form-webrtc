import { Instance } from "../../models/instances.model";
import log from "../logger/log";

class InstanceService {
  /**
   * Updates metric statistics (CPU, RAM, network) in the DB.
   */
  public async updateStats(ip: string, stats: Partial<{
    CPU: number;
    RAM: number;
    Upload: number;
    Download: number;
    Calls: number;
    Participants: number;
    occupied: boolean;
  }>) {
    try {
      await Instance.updateOne(
        { publicIP: ip },
        { $set: stats },
        { upsert: true }
      );
    } catch (error: any) {
      log.error(`[Instance] Failed to update metrics stats for ${ip}:`, error);
    }
  }
}

export const instanceService = new InstanceService();
export default instanceService;
