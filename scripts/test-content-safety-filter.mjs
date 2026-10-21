import assert from "node:assert/strict";
import { assertAllowedUserContent } from "../api/lift-log.js";

const accepts = value => assert.doesNotThrow(() => assertAllowedUserContent(value, "message"));
const rejects = value => assert.throws(
  () => assertAllowedUserContent(value, "message"),
  error => error?.status === 422 && /cannot be posted/i.test(error.message)
);

accepts("Great run today — nice work everyone.");
accepts("Meet at 18:30 near the gym?");
accepts(" ");
rejects("kys");
rejects("Please kill yourself");
rejects("That is a slur: faggot");
rejects("cunt");

console.log("Content-safety filter checks passed.");
