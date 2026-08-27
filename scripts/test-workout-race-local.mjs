// Integration test against the existing local Supabase only. Never accepts a
// remote DB URL. All fixture rows are uniquely named and removed in finally.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const docker = process.env.DOCKER_BIN || "/Applications/Docker.app/Contents/Resources/bin/docker";
const container = "supabase_db_supabase-local";
const runId = randomUUID();
const profileIds = [randomUUID(), randomUUID()];
const authIds = [randomUUID(), randomUUID()];
const blocIds = [randomUUID(), randomUUID()];
const groups = [`race-test-${runId}-a`, `race-test-${runId}-b`];
const owner = `Race Test ${runId}`;
const q = value => `'${String(value).replaceAll("'", "''")}'`;

function query(sql, onOutput, keepOpen = false) {
  let output = "", errors = "";
  const child = spawn(docker, ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { stdio: ["pipe", "pipe", "pipe"] });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.stdout.on("data", chunk => { output += chunk; onOutput?.(output); });
    child.stderr.on("data", chunk => { errors += chunk; });
    child.on("close", code => resolve({ code, output: output.trim(), errors }));
  });
  child.stdin.write(`SET statement_timeout = '10s';\n\\set VERBOSITY verbose\n${sql}\n`);
  done.finish = sql => child.stdin.end(`${sql}\n`);
  if (!keepOpen) child.stdin.end();
  return done;
}
async function ok(sql) {
  const result = await query(sql);
  assert.equal(result.code, 0, result.errors);
  return result.output;
}
function write(id, { group = 0, person = 0, date = "2099-08-01", note = "race fixture" } = {}) {
  return `SELECT public.upsert_ante_core_workout_log(${q(id)},${q(groups[group])},'2099-7',${q(owner)},${q(authIds[person])},${q(date)},'Gym',${q(note)},'https://example.test/race.jpg',now(),'photo',null,'','',null,null,null);`;
}
async function rejected(sql) {
  const result = await query(sql);
  assert.notEqual(result.code, 0, "third workout must be rejected");
  assert.match(result.errors, /PT409: Already logged 2 workouts for this date/);
}
const count = () => ok(`SELECT count(*) FROM ante_core.workout_logs WHERE profile_id = ${q(profileIds[0])} AND workout_date = '2099-08-01';`);

try {
  await ok(`BEGIN;
    ${profileIds.map((id, i) => `INSERT INTO ante_core.profiles(id,auth_user_id,email,display_name) VALUES(${q(id)},${q(authIds[i])},${q(`race-${runId}-${i}@local.test`)},${q(owner)});`).join("\n")}
    ${blocIds.map((id, i) => `INSERT INTO ante_core.blocs(id,legacy_group_key,name,invite_code) VALUES(${q(id)},${q(groups[i])},${q(groups[i])},${q(groups[i])});
      INSERT INTO ante_core.seasons(bloc_id,month_key,month_start,label,year,month_index,min_target,fine_amount,fee_model,currency,min_run_distance,distance_unit,time_zone)
      VALUES(${q(id)},'2099-7','2099-08-01','Race test',2099,7,12,20,'escalating','NOK',3,'km','Europe/Oslo');`).join("\n")}
    COMMIT;`);

  const first = `9900000000000001-${runId}`;
  const second = `9900000000000002-${runId}`;
  const third = `9900000000000003-${runId}`;
  await ok(write(first));

  // Force overlap: keep the second workout uncommitted while another
  // connection tries to claim the final slot in a DIFFERENT Bloc.
  let releaseReady;
  const ready = new Promise(resolve => { releaseReady = resolve; });
  const writer = query(`BEGIN; ${write(second)} SELECT 'holding';`, output => {
    if (output.includes("holding")) releaseReady();
  }, true);
  writer.then(releaseReady, releaseReady);
  await ready;
  const competitorName = `race-${runId}`;
  const competitor = query(`SET application_name = ${q(competitorName)}; ${write(third, { group: 1 })}`);
  let waitedForLock = false;
  try {
    // Observe the actual advisory-lock wait rather than relying on a sleep to
    // happen to overlap two requests on a particular machine.
    for (let attempt = 0; attempt < 40; attempt++) {
      waitedForLock = await ok(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = ${q(competitorName)} AND wait_event = 'advisory');`) === "t";
      if (waitedForLock) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } finally {
    writer.finish("COMMIT;");
    await Promise.all([writer, competitor]);
  }
  const [winner, loser] = await Promise.all([writer, competitor]);
  assert.equal(winner.code, 0, winner.errors);
  assert.ok(waitedForLock, "competing request must wait for the uncommitted writer's daily lock");
  assert.notEqual(loser.code, 0, "overlapping requests must not both take the last slot");
  assert.match(loser.errors, /PT409: Already logged 2 workouts for this date/);
  assert.equal(await count(), "2");

  // Copies and moderation/retries at the cap do not consume another slot.
  await ok(write(`${second}-copy`, { group: 1 }));
  await ok(write(second, { note: "updated at cap" }));
  assert.equal(await count(), "3"); // two sessions, three Bloc rows
  await rejected(write(third));
  await ok(write(third, { person: 1 })); // same name, different authenticated person
  await ok(write(third + "-tomorrow", { date: "2099-08-02" }));

  // Removing only one copy must not free a slot; removing the last does.
  await ok(`SELECT public.delete_ante_core_workout_log(${q(second)});`);
  await rejected(write(third));
  await ok(`SELECT public.delete_ante_core_workout_log(${q(`${second}-copy`)});`);
  await ok(write(`9900000000000004-${runId}`));

  // Same-ID retry is allowed, and a rollback does not leave a reserved slot.
  await ok(`BEGIN; ${write(`9900000000000005-${runId}`, { date: "2099-08-03" })} ROLLBACK;`);
  await ok(write(`9900000000000006-${runId}`, { date: "2099-08-03" }));
  await ok(write(`9900000000000007-${runId}`, { date: "2099-08-03" }));
  await rejected(write(`9900000000000008-${runId}`, { date: "2099-08-03" }));

  // An empty day's burst still admits only two distinct sessions.
  const burst = await Promise.all(Array.from({ length: 6 }, (_, i) => query(write(`991000000000000${i}-${runId}`, { date: "2099-08-04", group: i % 2 }))));
  assert.equal(burst.filter(result => result.code === 0).length, 2);
  for (const result of burst.filter(result => result.code !== 0)) {
    assert.match(result.errors, /PT409: Already logged 2 workouts for this date/);
  }

  // Preserve pre-existing over-limit history and allow its moderation/retries.
  await ok(`UPDATE ante_core.workout_logs SET workout_date = '2099-08-05' WHERE profile_id = ${q(profileIds[0])} AND workout_date IN ('2099-08-03','2099-08-04');`);
  await ok(write(`9900000000000006-${runId}`, { date: "2099-08-05", note: "legacy moderation" }));
  await rejected(write(`9920000000000001-${runId}`, { date: "2099-08-05" }));
  assert.equal(await ok(`SELECT count(*) FROM ante_core.workout_logs WHERE profile_id = ${q(profileIds[0])} AND workout_date = '2099-08-05';`), "4");
  const unidentified = await query(write(`9920000000000002-${runId}`, { date: "2099-08-06" }).replace(q(authIds[0]), "null"));
  assert.match(unidentified.errors, /PT400: A resolved profile is required/);
  assert.equal(await ok(`SELECT has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE') FROM pg_proc WHERE oid = 'public.upsert_ante_core_workout_log'::regproc;`), "f");
  console.log("Local Postgres workout race tests passed: observed lock contention, burst submissions, global cap, copies, retries, identity, dates, deletion, rollback, legacy history and RPC permissions.");
} finally {
  await ok(`BEGIN;
    DELETE FROM ante_core.blocs WHERE id IN (${blocIds.map(q).join(",")});
    DELETE FROM ante_core.profiles WHERE id IN (${profileIds.map(q).join(",")});
    COMMIT;`);
}
