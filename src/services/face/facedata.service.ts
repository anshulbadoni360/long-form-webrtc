import log from "../logger/log";
import { FaceDataModel } from "../../models/faceData.model";

export class FaceDataService {
  public static saveBatch(batch: any[]): void {
    if (Array.isArray(batch) && batch.length > 0) {
      FaceDataModel.insertMany(batch).catch((err) => {
        log.error("Error inserting faceData batch:", err);
      });
    }
  }

  public static fetchData(roomid: string, uuid: string) {
    return FaceDataModel.find({ roomid, uuid }).sort({ segment: "asc" });
  }

  public static fetchSession(roomid: string) {
    return FaceDataModel.find({ roomid });
  }
}
