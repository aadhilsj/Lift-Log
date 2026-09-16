import assert from "node:assert/strict";
import { isMissingStorageBucketResponse, parseFeroStorageReference } from "../api/lift-log.js";
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
  "",
  "cached public Storage references must wait for an authenticated state refresh"
);
assert.equal(
  resolveStorageImageUrl("fero-storage://profile-photos/user/photo.jpg"),
  "",
  "durable private storage references must never be sent directly to the browser"
);
const signedUrl = "http://127.0.0.1:54321/storage/v1/object/sign/profile-photos/user/photo.jpg?token=example";
assert.equal(
  resolveStorageImageUrl(signedUrl),
  signedUrl,
  "server-issued signed URLs can be rendered directly"
);
assert.equal(
  resolveStorageImageUrl("http://127.0.0.1:54321/not-storage/photo.jpg"),
  "http://127.0.0.1:54321/not-storage/photo.jpg"
);
assert.equal(
  resolveStorageImageUrl("https://example.com/storage/v1/object/public/profile-photos/user/photo.jpg"),
  "https://example.com/storage/v1/object/public/profile-photos/user/photo.jpg"
);
assert.deepEqual(
  parseFeroStorageReference("fero-storage://workout-photos/user/photo.jpg"),
  { bucket: "workout-photos", path: "user/photo.jpg" }
);
assert.equal(parseFeroStorageReference("fero-storage://workout-photos/../secret.jpg"), null);
assert.equal(parseFeroStorageReference("fero-storage://not-a-photo-bucket/user/photo.jpg"), null);

console.log("Profile photo storage response tests passed.");
