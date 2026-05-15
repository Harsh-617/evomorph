import { calculateFitness } from '../FitnessCalculator';

// GENERATION_TIME=15, so maxPossibleTorque = numJoints * maxTorque * 15 * 60
const baseStats = {
  maxX: 0,
  numJoints: 1,
  maxTorque: 200,
  cumulativeTorque: 0,
};

describe('calculateFitness', () => {
  // ─── Distance signal ─────────────────────────────────────────────────────────

  test('stationary creature with zero torque returns only efficiency bonus (10)', () => {
    // distanceScore=0, energyRatio=0, efficiencyBonus=10 → 10
    expect(calculateFitness({ ...baseStats, maxX: 0, cumulativeTorque: 0 })).toBe(10);
  });

  test('distance score uses 5x multiplier', () => {
    // maxX=10 → distanceScore=50; cumulativeTorque=0 → bonus=10; total=60
    expect(calculateFitness({ ...baseStats, maxX: 10, cumulativeTorque: 0 })).toBe(60);
  });

  test('further distance yields higher fitness', () => {
    const near = calculateFitness({ ...baseStats, maxX: 5, cumulativeTorque: 0 });
    const far  = calculateFitness({ ...baseStats, maxX: 20, cumulativeTorque: 0 });
    expect(far).toBeGreaterThan(near);
  });

  // ─── Efficiency bonus ────────────────────────────────────────────────────────

  test('zero torque usage gives maximum efficiency bonus of 10', () => {
    // distanceScore=50, efficiencyBonus=10 → 60; so bonus = total - distance = 10
    const total = calculateFitness({ ...baseStats, maxX: 10, cumulativeTorque: 0 });
    expect(total - 50).toBeCloseTo(10, 5);
  });

  test('higher cumulative torque reduces fitness', () => {
    const efficient = calculateFitness({ ...baseStats, maxX: 10, cumulativeTorque: 0 });
    const wasteful  = calculateFitness({ ...baseStats, maxX: 10, cumulativeTorque: 50000 });
    expect(efficient).toBeGreaterThan(wasteful);
  });

  // ─── Floor & edge cases ──────────────────────────────────────────────────────

  test('fitness never goes negative even with extreme torque waste', () => {
    // energyRatio ≈ 5.56, efficiencyBonus ≈ -45.6 → clamped to 0
    const fitness = calculateFitness({ ...baseStats, maxX: 0, cumulativeTorque: 999999 });
    expect(fitness).toBeGreaterThanOrEqual(0);
    expect(fitness).toBe(0);
  });

  // ─── Joint scaling ───────────────────────────────────────────────────────────

  test('more joints widen the energy budget, reducing penalty for same torque', () => {
    // numJoints=1: maxPossibleTorque=180000; numJoints=4: maxPossibleTorque=720000
    // same cumulativeTorque=1000 → 4-joint creature has lower energyRatio → higher bonus
    const oneJoint  = calculateFitness({ ...baseStats, maxX: 10, numJoints: 1, cumulativeTorque: 1000 });
    const fourJoints = calculateFitness({ ...baseStats, maxX: 10, numJoints: 4, cumulativeTorque: 1000 });
    expect(fourJoints).toBeGreaterThan(oneJoint);
  });
});
