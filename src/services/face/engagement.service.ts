import { FaceReaderResponse, FDConstants } from "../../types/face/face.types";

export class EngagementService {
  private static getNewValue(
    data: number,
    upperLimit: number,
    lowerLimit: number,
    maxPoint: number,
    minPoint: number,
  ): number {
    if (upperLimit === lowerLimit) return minPoint;
    return Math.min(
      Math.max(
        ((data - lowerLimit) * (maxPoint - minPoint)) /
          (upperLimit - lowerLimit) +
          minPoint,
        minPoint,
      ),
      maxPoint,
    );
  }

  public static calculateEngagement(
    speaking: number,
    webcam: number,
    screen: number,
    confidence: number,
    arousal: number,
    pitch: number,
    yaw: number,
    modifier: number,
  ): number {
    return Math.min(
      Math.max(
        speaking +
          webcam +
          screen +
          confidence +
          arousal +
          pitch +
          yaw +
          modifier,
        0,
      ),
      100,
    );
  }

  public static calculateParticipantMetrics(
    json: FaceReaderResponse,
    constants: FDConstants,
    speaking: number,
    webcamStatus: number,
    screenStatus: number,
  ) {
    let emoData = {
        Happy: 0,
        Sad: 0,
        Disgusted: 0,
        Surprised: 0,
        Scared: 0,
        Angry: 0,
        Neutral: 0,
      },
      yaw = 0,
      pitch = 0,
      arousal = 0,
      confidence = 0,
      newYaw = constants.yaw.min,
      newPitch = constants.pitch.min,
      newArousal = constants.arousal.min,
      newConfidence = constants.confidence.min,
      valence = 0,
      mood_score = 0,
      engaged = 0,
      attention = 0,
      confusion = 0;

    if (json.FacialExpressions) {
      if (json.FacialExpressions.BasicEmotions)
        emoData = json.FacialExpressions.BasicEmotions;
      arousal = json.FacialExpressions.Arousal || 0;
    }

    newArousal = this.getNewValue(
      arousal,
      constants.arousalUpper,
      constants.arousalLower,
      constants.arousal.max,
      constants.arousal.min,
    );

    if (json.HeadOrientation) {
      yaw = json.HeadOrientation[1] || 0;
      pitch = json.HeadOrientation[0] || 0;
      newYaw = this.getNewValue(
        Math.abs(yaw) * -1,
        constants.absYawUpper,
        constants.absYawLower,
        constants.yaw.max,
        constants.yaw.min,
      );
      newPitch = this.getNewValue(
        Math.abs(pitch) * -1,
        constants.absPitchUpper,
        constants.absPitchLower,
        constants.pitch.max,
        constants.pitch.min,
      );
    }

    confidence = json.Confidence || 0;
    newConfidence = this.getNewValue(
      confidence,
      constants.confUpper,
      constants.confLower,
      constants.confidence.max,
      constants.confidence.min,
    );

    const { Happy, Sad, Angry, Disgusted } = emoData;
    valence = Happy - Math.max(Sad, Angry, Disgusted);

    if (valence < 0) {
      mood_score = 50 - (Math.abs(valence) / 2) * 100;
    } else if (valence > 0) {
      mood_score = (valence / 2) * 100 + 50;
    } else {
      mood_score = 20;
    }
    if (mood_score > 100) mood_score = 100;

    engaged = this.calculateEngagement(
      speaking * constants.speaking,
      webcamStatus * constants.webcam,
      screenStatus * constants.screenShare,
      newConfidence,
      newArousal,
      newPitch,
      newYaw,
      constants.engagementModifier,
    );

    attention = json.FacialExpressions ? Happy * 100 : 0;

    if (json.ActionUnits) {
      const au: Record<string, number> = {};
      json.ActionUnits.forEach((unit) => {
        au[unit.Name] = unit.Value;
      });
      const brow = (au.AU1 || 0) + (au.AU4 || 0);
      const lip = (au.AU23 || 0) + (au.AU24 || 0) + (au.AU14 || 0);
      const happiness = (au.AU6 || 0) + (au.AU12 || 0);
      confusion =
        Math.max(0, Math.min(1, (brow + lip) / 5 - happiness / 2)) * 100;
    }

    return {
      valence,
      mood_score,
      engagement: engaged,
      attention,
      confusion,
      arousal,
    };
  }
}
