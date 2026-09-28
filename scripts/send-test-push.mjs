import { sendTestPush } from "../server/push.js";

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: npm run push:test -- <your Supabase Auth user ID>");
  process.exitCode=1;
} else {
  try {
    const result = await sendTestPush(userId);
    console.log(JSON.stringify(result, null, 2));
    if (!result.deviceCount || result.results.some(row => !row.accepted)) process.exitCode=1;
  } catch {
    // Crypto/network errors can include secret inputs. Keep terminal output generic.
    console.error("Test push failed. Check the server APNS_* settings and device registration; no credentials were printed.");
    process.exitCode=1;
  }
}
