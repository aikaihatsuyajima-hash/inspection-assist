import { beforeAll, describe, expect, it } from "vitest";

describe("memory scan API integration", () => {
  let recordScan: typeof import("./firestore").recordScan;
  let readContainer: typeof import("./firestore").readContainer;
  beforeAll(async () => {
    process.env.DATA_BACKEND = "memory";
    ({ recordScan, readContainer } = await import("./firestore"));
  });
  it("increments known scans, replays idempotently, and preserves rapid follow-up scans", async () => {
    const warehouse = "integration";
    const date = "2099-01-01";
    const container = "10563560";
    const barcode = (await readContainer(warehouse, date, container)).items[0].barcode;
    const first = { idempotencyKey: "integration-first", barcode, quantity: 1 };
    const replay = await recordScan(warehouse, date, container, first, "test");
    expect(replay.container?.items[0].actual).toBe(1);
    expect((await recordScan(warehouse, date, container, first, "test")).replayed).toBe(true);
    await recordScan(warehouse, date, container, { idempotencyKey: "integration-second", barcode }, "test");
    const afterTwo = await readContainer(warehouse, date, container);
    expect(afterTwo.items[0].actual).toBe(2);
    await expect(recordScan(warehouse, date, container, { idempotencyKey: "integration-unknown", barcode: "9999999999999" }, "test")).resolves.toMatchObject({ ok: true });
    const afterUnknown = await readContainer(warehouse, date, container);
    expect(afterUnknown.items[0].actual).toBe(2);
    expect(afterUnknown.unknownCount).toBe(1);
  });
});
