const GENERATION_TIME = 15.0;

export function calculateFitness(stats: {
  maxX: number;
  timeUpright: number;
  cumulativeTorque: number;
  headGroundTime: number;
  numJoints: number;
  maxTorque: number;
}): number {
  const maxX = stats.maxX;

  const uprightFraction = stats.timeUpright / GENERATION_TIME;
  const uprightBonus = uprightFraction * 25;

  const maxPossibleTorque = stats.numJoints * stats.maxTorque * GENERATION_TIME * 60;
  const energyRatio = stats.cumulativeTorque / Math.max(maxPossibleTorque, 1);
  const energyPenalty = energyRatio * 30;

  const headTouchFraction = Math.min(stats.headGroundTime / GENERATION_TIME, 1.0);
  const headTouchPenalty = headTouchFraction * 5.0;

  return Math.max(0, maxX + uprightBonus - energyPenalty - headTouchPenalty);
}
