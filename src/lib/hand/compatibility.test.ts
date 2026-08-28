import { describe, expect, it } from "vitest";
import { classifyHandCompatibility } from "./compatibility";

describe("classifyHandCompatibility", () => {
  it("keeps the verified 0.6 adapter mutation-capable", () => {
    const result = classifyHandCompatibility("hand 0.6.0");
    expect(result).toMatchObject({
      mode: "supported",
      contract: "legacy-0.6",
      mutationsAllowed: true,
    });
  });

  it("recognizes the 0.7 transition contract", () => {
    const result = classifyHandCompatibility("hand version 0.7.3");
    expect(result).toMatchObject({
      mode: "supported",
      contract: "transition-0.7",
      mutationsAllowed: true,
    });
  });

  it("fails closed for 0.8 until the adapter is verified", () => {
    const result = classifyHandCompatibility("hand 0.8.0");
    expect(result).toMatchObject({
      mode: "warning",
      contract: "v0.8-unadapted",
      mutationsAllowed: false,
    });
  });

  it("fails closed when a version cannot be parsed", () => {
    const result = classifyHandCompatibility("development build");
    expect(result.mutationsAllowed).toBe(false);
    expect(result.contract).toBe("unknown");
  });

  it("rejects pre-0.6 contracts", () => {
    const result = classifyHandCompatibility("hand 0.5.9");
    expect(result.mode).toBe("unsupported");
    expect(result.mutationsAllowed).toBe(false);
  });
});
