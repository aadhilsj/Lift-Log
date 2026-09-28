import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { createPushDeviceHandler } from "../api/push-devices.js";
import { apnsProviderToken, buildApnsRequest, sendTestPush } from "../server/push.js";

const userId=randomUUID();
const deviceId=randomUUID();
const registrationId=randomUUID();
const token="a".repeat(64);
const env={ SUPABASE_URL:"https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY:"test-server-key", PUSH_REGISTRATION_ENABLED:"true" };
const calls=[];
let authStatus=200;
let authThrows=false;
const fetchImpl=async (url, options) => {
  calls.push({ url, options });
  if (url.endsWith("/auth/v1/user")) {
    if (authThrows) throw new Error("offline");
    return new Response(JSON.stringify({ id:userId }), { status:authStatus });
  }
  return new Response("", { status:200 });
};
const handler=createPushDeviceHandler({ env, fetchImpl });
const request=async (body, headers={ authorization:"Bearer test-access-token", origin:"capacitor://localhost" }, method="POST", target=handler) => {
  const res={ headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.code=code;return this;},json(data){this.data=data;return this;},end(){return this;} };
  await target({ method,headers,body },res);
  return res;
};

const registered=await request({ action:"register", deviceId,token,environment:"production", userId:randomUUID() });
assert.equal(registered.code,200);
assert.equal(registered.headers["Access-Control-Allow-Origin"],"capacitor://localhost");
assert.equal(JSON.parse(calls.at(-1).options.body).p_auth_user_id,userId,"Use verified identity, never payload ID");
assert.equal(calls.at(-1).options.headers.Authorization,"Bearer test-server-key");
assert.equal(registered.data.token,undefined,"Never return tokens");
await request({ action:"revoke",deviceId,userId:randomUUID() });
assert.equal(JSON.parse(calls.at(-1).options.body).p_auth_user_id,userId);
assert.ok(calls.at(-1).url.endsWith("/revoke_fero_push_device"));
assert.equal((await request({ action:"register",deviceId,token,environment:"staging" })).code,400);
assert.equal((await request({ action:"register",deviceId,token:"abc",environment:"production" })).code,400);
assert.equal((await request({ action:"revoke",deviceId },{})).code,401);
assert.equal((await request({ action:"revoke",deviceId },{authorization:"Bearer local-dev:abc"})).code,401);
assert.equal((await request({}, {origin:"https://attacker.example"})).code,403);
assert.equal((await request({}, {}, "GET")).code,405);
assert.equal((await request({}, {origin:"capacitor://localhost"}, "OPTIONS")).code,204);
assert.equal((await request("not-json")).code,400);
const streamRequest=async (value) => {
  const req={ method:"POST",headers:{authorization:"Bearer test-access-token"},async *[Symbol.asyncIterator](){yield Buffer.from(value);} };
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
  await handler(req,res);
  return res;
};
assert.equal((await streamRequest(JSON.stringify({action:"revoke",deviceId}))).code,200,"Local Node server accepts streamed JSON");
assert.equal((await streamRequest("x".repeat(4097))).code,413,"Streamed request size is bounded");
authStatus=401;
assert.equal((await request({ action:"revoke",deviceId })).code,401);
authStatus=503;
assert.equal((await request({ action:"revoke",deviceId })).code,503,"Outage must not masquerade as invalid session");
authThrows=true;
assert.equal((await request({ action:"revoke",deviceId })).code,503);
assert.equal((await request({}, {}, "POST",createPushDeviceHandler({env:{}}))).code,503);
assert.equal((await request({}, {}, "POST",createPushDeviceHandler({env:{...env,SANDBOX_BLOB_FILE:"sandbox.json"}}))).code,503);

const { privateKey,publicKey }=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
const signingEnv={ APNS_KEY_ID:"ABCDEFGHIJ", APNS_TEAM_ID:"SMR55A2M96", APNS_PRIVATE_KEY:privateKey.export({type:"pkcs8",format:"pem"}) };
const now=Date.now();
const jwt=apnsProviderToken(signingEnv,now);
const [header,claims,signature]=jwt.split(".");
assert.deepEqual(JSON.parse(Buffer.from(header,"base64url")),{alg:"ES256",kid:"ABCDEFGHIJ"});
assert.deepEqual(JSON.parse(Buffer.from(claims,"base64url")),{iss:"SMR55A2M96",iat:Math.floor(now/1000)});
assert.ok(verify("sha256",Buffer.from(`${header}.${claims}`),{key:publicKey,dsaEncoding:"ieee-p1363"},Buffer.from(signature,"base64url")));
assert.equal(apnsProviderToken(signingEnv,now+1000),jwt,"Reuse provider JWT instead of generating per push");
assert.notEqual(apnsProviderToken(signingEnv,now+21*60*1000),jwt,"Renew JWT before Apple's one-hour limit");
assert.throws(()=>apnsProviderToken({}),/Set APNS/);
const device={ device_id:deviceId, registration_id:registrationId,token,environment:"production" };
const production=buildApnsRequest(device,jwt);
assert.equal(production.origin,"https://api.push.apple.com");
assert.equal(buildApnsRequest({...device,environment:"sandbox"},jwt).origin,"https://api.sandbox.push.apple.com");
assert.equal(production.headers["apns-topic"],"com.aadhilsj.fero");
assert.equal(production.headers["apns-push-type"],"alert");
assert.equal(JSON.parse(production.payload).aps.badge,undefined,"No badge policy in plumbing");

for (const status of [200,410,429,403,503,0]) {
  const recorded=[];
  const result=await sendTestPush(userId,{
    env:signingEnv,
    rpc:async (name,args) => {
      if(name==="list_fero_push_devices") return [device];
      recorded.push(args);
    },
    transport:async () => {
      if (!status) throw new Error("offline");
      return {status,reason:status===410?"Unregistered":null,timestamp:status===410?now:null};
    }
  });
  assert.equal(result.results[0].accepted,status===200);
  assert.equal(result.results[0].retryable,status===0||status===429||status===503);
  assert.equal(recorded[0].p_registration_id,registrationId,"Delayed result scoped to exact registration");
  assert.ok(!JSON.stringify(result).includes(token),"No token in diagnostics");
}

let native=false;
let platform="ios";
let permission="prompt";
let missing=false;
let pluginFails=false;
let registrationFails=false;
const pluginCalls=[];
const posts=[];
const storage=new Map();
const listeners=new Map();
const context=createContext({
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  crypto:{randomUUID},setTimeout,clearTimeout,console
});
const core=new SyntheticModule(["Capacitor"],function(){this.setExport("Capacitor",{
  isNativePlatform:()=>native,getPlatform:()=>platform,isPluginAvailable:()=>!missing
});},{context});
const plugin=new SyntheticModule(["PushNotifications"],function(){this.setExport("PushNotifications",{
  checkPermissions:async()=>{if(pluginFails)throw Error("missing");pluginCalls.push("check");return {receive:permission};},
  requestPermissions:async()=>{pluginCalls.push("prompt");permission="granted";return {receive:permission};},
  addListener:async(name,callback)=>{listeners.set(name,callback);return {remove:async()=>listeners.delete(name)};},
  register:async()=>{pluginCalls.push("register");if(registrationFails)listeners.get("registrationError")({error:"no valid aps-environment entitlement"});else listeners.get("registration")({value:token});},
  unregister:async()=>{pluginCalls.push("unregister");}
});},{context});
let session={userId,accessToken:"test-access"};
const api=new SyntheticModule(["getCurrentAuthSession","postApi"],function(){
  this.setExport("getCurrentAuthSession",async()=>session);
  this.setExport("postApi",async(action,body,options)=>{posts.push({action,body,options});return {ok:true};});
},{context});
const client=new SourceTextModule(await readFile(new URL("../src/lib/pushNotifications.js",import.meta.url),"utf8"),{context,initializeImportMeta:meta=>{meta.env={};}});
await client.link(name=>name==="@capacitor/core"?core:name==="@capacitor/push-notifications"?plugin:api);
await client.evaluate();
assert.equal((await client.namespace.syncPushRegistration()).status,"unsupported");
assert.equal(pluginCalls.length,0,"Web never touches native plugin");
native=true;platform="android";
assert.equal((await client.namespace.syncPushRegistration()).status,"unsupported");
platform="ios";missing=true;
assert.equal((await client.namespace.syncPushRegistration()).status,"unsupported");
missing=false;
assert.equal((await client.namespace.syncPushRegistration()).status,"prompt");
assert.equal(posts.length,0,"Launch must not ask permission or register an unconsented installation");
assert.equal((await client.namespace.requestPushPermissionFromUserAction()).status,"explicit-action-required");
assert.equal(pluginCalls.includes("prompt"),false);
assert.equal((await client.namespace.requestPushPermissionFromUserAction({userInitiated:true})).status,"registered");
assert.equal(pluginCalls.filter(call=>call==="prompt").length,1);
permission="granted";
assert.equal((await client.namespace.syncPushRegistration()).status,"registered");
registrationFails=true;
const postsBeforeMissingEntitlement=posts.length;
assert.deepEqual(JSON.parse(JSON.stringify(await client.namespace.syncPushRegistration())),{ok:false,status:"registration-failed"},"Missing entitlement returns a safe status, never throws");
assert.equal(posts.length,postsBeforeMissingEntitlement,"Failed native registration stores no token");
assert.equal(listeners.size,0,"Missing-entitlement failure cleans up listeners");
registrationFails=false;
assert.equal(posts.at(-1).body.environment,"production");
const installation=posts.at(-1).body.deviceId;
await client.namespace.syncPushRegistration();
assert.equal(posts.at(-1).body.deviceId,installation,"Keep one stable installation across registrations");
assert.equal(listeners.size,0,"Clean up registration listeners");
await client.namespace.revokePushRegistration();
assert.equal(posts.at(-1).action,"revoke");
assert.equal(pluginCalls.at(-1),"unregister");
permission="denied";
assert.equal((await client.namespace.requestPushPermissionFromUserAction({userInitiated:true})).status,"denied");
assert.equal(pluginCalls.filter(call=>call==="prompt").length,1,"Denial must never prompt again");
await client.namespace.syncPushRegistration();
assert.equal(posts.at(-1).action,"revoke","System permission revocation disables the stored token");
session={...session,localDevOtp:true};
assert.equal((await client.namespace.syncPushRegistration()).status,"signed-out");
session={...session,localDevOtp:false};pluginFails=true;
assert.equal((await client.namespace.syncPushRegistration()).status,"unavailable");
console.log("Push foundation checks passed: server identity/security, APNs signing/routing/results, web/missing-plugin safety, stable devices, renewal and revocation. No live notifications sent.");
