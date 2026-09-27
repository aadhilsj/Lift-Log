import assert from "node:assert/strict";
import { isMissingStorageBucketResponse } from "../api/lift-log.js";
import { resolveStorageImageUrl } from "../src/lib/appState.js";

assert.equal(isMissingStorageBucketResponse(404, ""), true);
assert.equal(
  isMissingStorageBucketResponse(
    400,
    JSON.stringify({ statusCode: "404", error: "Bucket not found", message: "Bucket not found" })
  ),
  true,
  "local Supabase wraps a missing bucket in HTTP 400"
);
assert.equal(
  isMissingStorageBucketResponse(400, JSON.stringify({ statusCode: "400", message: "Invalid request" })),
  false
);
assert.equal(isMissingStorageBucketResponse(500, "not json"), false);

const localProfilePhotoUrl = "http://127.0.0.1:54321/storage/v1/object/public/profile-photos/user/photo.jpg";
assert.equal(
  resolveStorageImageUrl(localProfilePhotoUrl),
  `/api/lift-log?image=${encodeURIComponent(localProfilePhotoUrl)}`,
  "LAN previews must load local Storage images through the same-origin API proxy"
);
assert.equal(
  resolveStorageImageUrl("http://127.0.0.1:54321/not-storage/photo.jpg"),
  "http://127.0.0.1:54321/not-storage/photo.jpg"
);
assert.equal(
  resolveStorageImageUrl("https://example.com/storage/v1/object/public/profile-photos/user/photo.jpg"),
  "https://example.com/storage/v1/object/public/profile-photos/user/photo.jpg"
);

console.log("Profile photo storage response tests passed.");
