import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../api/lift-log.js", import.meta.url), "utf8");

[
  "async function deleteUserStorageFiles(userId, options = {})",
  "client.storage.from(bucket).list(safeUserId",
  "client.storage.from(bucket).remove(paths)",
  "async function deleteSupabaseAuthUser(userId, options = {})",
  "client.auth.admin.deleteUser(String(userId || \"\"))"
].forEach(fragment => {
  assert.ok(api.includes(fragment), `account-deletion implementation is missing: ${fragment}`);
});

const deletionStart = api.indexOf('if (payload?.action === "delete-account")');
const deletionEnd = api.indexOf('if (payload?.action === "repair-display-name")', deletionStart);
assert.ok(deletionStart >= 0 && deletionEnd > deletionStart, "account-deletion handler must have a bounded source block");
const deletionHandler = api.slice(deletionStart, deletionEnd);

const storageCleanupAt = deletionHandler.indexOf("await deleteUserStorageFiles(auth.user.id, { throwOnError: true });");
const profileDeleteAt = deletionHandler.indexOf("await deleteProfileFromCanonical(auth.user.id, { throwOnError: true });");
const statePersistAt = deletionHandler.indexOf("const readableState = await persistAndScopeReadableStateForUser");
const authDeleteAt = deletionHandler.indexOf("await deleteSupabaseAuthUser(auth.user.id, { throwOnError: true });");

assert.ok(storageCleanupAt >= 0, "account deletion must remove user-scoped photos");
assert.ok(profileDeleteAt > storageCleanupAt, "profile deletion must follow storage cleanup");
assert.ok(statePersistAt > profileDeleteAt, "app state must persist after canonical profile deletion");
assert.ok(authDeleteAt > statePersistAt, "Supabase Auth identity must be deleted after app-state writes complete");

console.log("Account-deletion release contract checks passed.");
