import assert from "node:assert/strict";
import test from "node:test";

test("Dapodik actions expose import and preview", async () => {
  const module = await import("../src/platform/actions/dapodik-import");

  assert.equal(typeof module.importDapodikAction, "function");
  assert.equal(typeof module.previewDapodikAction, "function");
});
