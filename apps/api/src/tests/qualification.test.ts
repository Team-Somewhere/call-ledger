import assert from "node:assert";
import { describe, it } from "node:test";
import {
  calculateQualificationScore,
  isValidTransition,
} from "../services/creator-qualification.service";
import {
  isValidXUsername,
  normalizeXUsername,
} from "../services/creator-discovery.service";

describe("Creator Discovery & Qualification Tests", () => {
  it("should normalize and validate X handles correctly", () => {
    assert.strictEqual(normalizeXUsername("@SatoshiPulse"), "satoshipulse");
    assert.strictEqual(normalizeXUsername("  @VitalikButerin  "), "vitalikbuterin");

    assert.strictEqual(isValidXUsername("vitalik"), true);
    assert.strictEqual(isValidXUsername("@trader_1"), true);
    assert.strictEqual(isValidXUsername("toolongusernameexceedinglimit"), false);
    assert.strictEqual(isValidXUsername("bad!char$"), false);
  });

  it("should calculate qualification score with correct weights", () => {
    const score = calculateQualificationScore({
      signalClarity: 100, // 25
      tradingActivity: 100, // 15
      historicalTrackRecord: 100, // 25
      consistency: 100, // 15
      verifiability: 100, // 20
    });
    assert.strictEqual(score, 100);

    const score2 = calculateQualificationScore({
      signalClarity: 80, // 20
      tradingActivity: 60, // 9
      historicalTrackRecord: 80, // 20
      consistency: 60, // 9
      verifiability: 70, // 14
    });
    assert.strictEqual(score2, 72);
  });

  it("should enforce creator state workflow transitions", () => {
    assert.strictEqual(isValidTransition("DISCOVERED", "QUALIFIED"), true);
    assert.strictEqual(isValidTransition("DISCOVERED", "REJECTED"), true);
    assert.strictEqual(isValidTransition("QUALIFIED", "MONITORING"), true);
    assert.strictEqual(isValidTransition("MONITORING", "SUSPENDED"), true);
    assert.strictEqual(isValidTransition("REJECTED", "MONITORING"), false);
  });
});

