import { describe, expect, it } from "vitest";
import { canonicalHashLocation } from "../../src/app/bootstrap/hash-location";
describe("static-host deep links", () => {
  it("keeps route search valid when a document has its own query", () => {
    expect(
      canonicalHashLocation(
        "https://example.com/chess-builder/?source=mail&view=map#/pve?view=army",
      ),
    ).toBe("/chess-builder/#/pve?view=army&source=mail");
  });
  it("preserves legacy links, encoded item ids and nested anchors", () => {
    expect(canonicalHashLocation("https://example.com/#archive")).toBe(
      "/#/history",
    );
    expect(
      canonicalHashLocation(
        "https://example.com/#/collection?item=a%26b#target",
      ),
    ).toBe("/#/collection?item=a%26b#target");
  });
  it("is idempotent and supplies the default route on cold startup", () => {
    const canonical = canonicalHashLocation(
      "https://example.com/chess-builder/",
    );
    expect(canonical).toBe("/chess-builder/#/play");
    expect(canonicalHashLocation(`https://example.com${canonical}`)).toBe(
      canonical,
    );
  });
});
