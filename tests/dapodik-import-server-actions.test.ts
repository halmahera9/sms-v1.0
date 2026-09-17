import assert from "node:assert/strict";
import test from "node:test";

test("Dapodik import action module loads", async () => {
  const module = await import(
    "../src/platform/actions/dapodik-import"
  );

  assert.equal(typeof module.importDapodikAction, "function");
});
