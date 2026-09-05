import { signatureConfig } from "../shipping.constants.js";

jest.mock("shippo", () => ({ Shippo: jest.fn() }));
jest.mock("../../stripe/config.js", () => ({ stripe: {} }));
jest.mock("../../config/redis.js", () => ({
  get: jest.fn(),
  setex: jest.fn(),
}));

import redis from "../../config/redis.js";
import { shippingService } from "../shipping.service.js";

const T = signatureConfig.threshold;

describe("signatureApplies", () => {
  it("explicit true/false always wins", () => {
    expect(shippingService.signatureApplies({ declaredMarketValue: 50 }, true)).toBe(true);
    expect(shippingService.signatureApplies({ declaredMarketValue: 5000 }, false)).toBe(false);
  });

  it("auto-requires at/over threshold with no persisted choice", () => {
    expect(
      shippingService.signatureApplies({ declaredMarketValue: T }, undefined)
    ).toBe(true);
    expect(
      shippingService.signatureApplies({ declaredMarketValue: T - 1 }, undefined)
    ).toBe(false);
  });

  it("honors persisted true below threshold once a carrier is set", () => {
    expect(
      shippingService.signatureApplies(
        { declaredMarketValue: T - 1, shippingCarrier: "USPS Ground", signatureRequired: true },
        undefined
      )
    ).toBe(true);
  });

  it("honors persisted false above threshold once a carrier is set", () => {
    expect(
      shippingService.signatureApplies(
        { declaredMarketValue: T + 100, shippingCarrier: "USPS Ground", signatureRequired: false },
        undefined
      )
    ).toBe(false);
  });

  it("ignores persisted false before any carrier choice (threshold applies)", () => {
    // Fresh docs carry the Mongoose default (false) — it must not pose as
    // an explicit opt-out and kill the auto-require.
    expect(
      shippingService.signatureApplies(
        { declaredMarketValue: T + 100, signatureRequired: false },
        undefined
      )
    ).toBe(true);
  });

  it("treats persisted null like unset (threshold applies)", () => {
    expect(
      shippingService.signatureApplies(
        { declaredMarketValue: T + 100, shippingCarrier: "USPS Ground", signatureRequired: null },
        undefined
      )
    ).toBe(true);
  });
});

describe("matchCachedChoice signature binding", () => {
  const option = { inboundRateId: "in_1", outboundRateId: "out_1" };

  beforeEach(() => jest.clearAllMocks());

  it("rejects a signature flip on the same rate ids", async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ options: [option], withSignature: true, quotedAt: Date.now() })
    );
    await expect(
      shippingService.matchCachedChoice("c1", "in_1", "out_1", true)
    ).resolves.toEqual(option);
    await expect(
      shippingService.matchCachedChoice("c1", "in_1", "out_1", false)
    ).resolves.toBeNull();
  });

  it("allows legacy cache entries with no withSignature", async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ options: [option], quotedAt: Date.now() })
    );
    await expect(
      shippingService.matchCachedChoice("c1", "in_1", "out_1", false)
    ).resolves.toEqual(option);
  });
});
