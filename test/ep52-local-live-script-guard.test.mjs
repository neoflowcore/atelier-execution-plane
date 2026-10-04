import test from "node:test";import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("local live qualification script never declares final P20/P21 without external provider evidence",async()=>{const s=await readFile(new URL("../scripts/run-local-live-qualification.mjs",import.meta.url),"utf8");assert.match(s,/finalP20GatePass:false/);assert.match(s,/finalP21GatePass:false/);assert.match(s,/VMWARE_LOCAL_REPEATABILITY:"DEFERRED_PROVIDER_LIVE_WORK"/);assert.match(s,/PROVIDER_SHADOW_CANARY:"PENDING_PROVIDER_LIVE"/)});
