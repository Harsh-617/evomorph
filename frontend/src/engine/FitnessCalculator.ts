import { GENERATION_TIME } from './SimulationLoop';

export function calculateFitness(stats: {
  maxX: number;
  cumulativeTorque: number;
  numJoints: number;
  maxTorque: number;
}): number {
  const distanceScore = stats.maxX * 5;

  const maxPossibleTorque = stats.numJoints * stats.maxTorque * GENERATION_TIME * 60;
  const energyRatio = stats.cumulativeTorque / Math.max(maxPossibleTorque, 1);
  const efficiencyBonus = (1 - energyRatio) * 10;

  return Math.max(0, distanceScore + efficiencyBonus);
}
