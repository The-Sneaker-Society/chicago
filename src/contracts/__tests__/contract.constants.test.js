import { platformFee, contractStatus, statusToKey } from "../contract.constants.js";

describe("platformFee", () => {
  it("rate is 0.15", () => {
    expect(platformFee.rate).toBe(0.15);
  });
  it("is frozen", () => {
    expect(Object.isFrozen(platformFee)).toBe(true);
  });
  it("calc helper covers plan table", () => {
    const calc = (amount) => Math.round(amount * platformFee.rate * 100);
    expect(calc(75)).toBe(1125);
    expect(calc(200)).toBe(3000);
    expect(calc(500)).toBe(7500);
  });
  it("rounding edges", () => {
    const calc = (a) => Math.round(a * platformFee.rate * 100);
    expect(calc(33.33)).toBe(500);
    expect(calc(33.335)).toBe(500);
    expect(calc(0.01)).toBe(0);
    expect(calc(0)).toBe(0);
  });
  it("invariant fee > stripeFee for $75/$200/$500", () => {
    const stripeFee = (amt) => Math.round((amt * 0.029 + 0.30) * 100);
    const fee = (amt) => Math.round(amt * 0.15 * 100);
    [75, 200, 500].forEach((amt) => {
      expect(fee(amt)).toBeGreaterThan(stripeFee(amt));
    });
  });
  it("preserves 12 statuses + statusToKey", () => {
    expect(Object.keys(contractStatus).length).toBe(12);
    expect(statusToKey["PENDING_REVIEW"]).toBe("pendingReview");
    expect(statusToKey["COMPLETED"]).toBe("completed");
  });
});
