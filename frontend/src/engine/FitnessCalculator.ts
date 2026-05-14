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
  const uprightBonus = uprightFraction * 50;

  const maxPossibleTorque = stats.numJoints * stats.maxTorque * GENERATION_TIME * 60;
  const energyRatio = stats.cumulativeTorque / Math.max(maxPossibleTorque, 1);
  const energyPenalty = energyRatio * 30;

  const headTouchPenalty = stats.headGroundTime > 0.5 ? maxX * 0.9 : 0;

  return Math.max(0, maxX + uprightBonus - energyPenalty - headTouchPenalty);
}
