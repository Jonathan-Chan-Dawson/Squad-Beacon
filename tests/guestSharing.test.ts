import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const { renderPage, hashToken, newToken, tokenPattern, ics, card } = require("../server/guest/presentation.cjs");
const { createHandler, configuration } = require("../server/guest/handler.cjs");
const id = "a1111111-1111-4111-8111-111111111111";
const token = newToken();
const env = { SB_GUEST_ENABLED: "true", SB_PUBLIC_ORIGIN: "https://guest.example", SUPABASE_URL: "https://backend.example", SUPABASE_SERVICE_ROLE_KEY: "server-secret", SB_GUEST_RATE_SECRET: "rate-secret", NODE_ENV: "test" };
const preview = { state: "open", kind: "beacon", title: "An evening together", description: "Bring a book.", access: "participate", starts_at: "2026-11-05T18:00:00Z", ends_at: "2026-11-05T19:00:00Z", timezone: "America/Chicago", calendar_id: id, app_path: `/activity/${id}`, area_label: "Downtown", seat_count: 1, capacity_limit: 4 };

async function invoke({ method = "GET", path = `/g/${token}`, body, headers = {}, backend, testEnv = env }: {
  method?: string; path?: string; body?: unknown; headers?: Record<string,string>; backend?: any; testEnv?: Record<string,string>;
} = {}) {
  const request = Readable.from(body === undefined ? [] : [typeof body === "string" ? body : JSON.stringify(body)]) as any;
  Object.assign(request, { method, url: path, headers: { ...(method === "POST" ? { origin: env.SB_PUBLIC_ORIGIN, "content-type": "application/json", "x-sb-guest": "1" } : {}), ...headers } });
  const result = { statusCode: 200, headers: {} as Record<string,string>, body: "", setHeader(name: string,value: string) { this.headers[name.toLowerCase()] = value; }, end(value = "") { this.body = value; } };
  await createHandler({ env: testEnv, backend: backend || { rpc: async () => preview } })(request,result);
  return result;
}

test("invitation tokens have 256-bit entropy, a fixed URL-safe representation and one-way hashes", () => {
  const tokens = Array.from({ length: 100 }, () => newToken());
  assert.equal(new Set(tokens).size, 100);
  for (const value of tokens) { assert.match(value,tokenPattern); assert.match(hashToken(value),/^[a-f0-9]{64}$/); assert.notEqual(hashToken(value),value); }
});
test("guest origin rejects credentials, insecure transport, paths and query strings", () => {
  for (const origin of ["http://guest.example","https://u:p@guest.example","https://guest.example/app","https://guest.example/?key=secret"]) assert.throws(() => configuration({ ...env, SB_PUBLIC_ORIGIN:origin }));
});
test("server-rendered metadata is escaped and includes no guest response or private profile", () => {
  const html = renderPage({ ...preview, title: '"><script>alert(1)</script>', description: "<img onerror=alert(1)>", verified: true, response: "requested", email:"secret@example.com", latitude: 45, roster:["Private member"] },{ origin:env.SB_PUBLIC_ORIGIN,token,nonce:"nonce" });
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("secret@example.com")); assert.ok(!html.includes("Private member"));
  assert.match(html,/Pending organizer approval/); assert.match(html,/og:title/);
  assert.ok(!html.match(/<meta[^>]*Pending organizer approval/));
  assert.match(html,/aria-live="polite"/); assert.match(html,/prefers-reduced-motion/);
});
test("unavailable pages suppress details, previews, calendar and app links", () => {
  const html = renderPage({ ...preview, state:"unavailable" },{ origin:env.SB_PUBLIC_ORIGIN,token,nonce:"nonce" });
  assert.ok(!html.includes(preview.title)); assert.ok(!html.includes(preview.area_label));
  assert.ok(!html.includes("og:image")); assert.ok(!html.includes("calendar.ics")); assert.ok(!html.includes("/activity/"));
});
test("preview-only, cancelled and ended invitations offer no verification or response forms", () => {
  for (const data of [{ ...preview,access:"preview" },{ ...preview,state:"cancelled" },{ ...preview,state:"ended" }]) {
    const html = renderPage(data,{ origin:env.SB_PUBLIC_ORIGIN,token,nonce:"nonce" });
    assert.ok(!html.includes('id="email-form"')); assert.ok(!html.includes('id="response-form"'));
  }
});
test("full invitations preserve existing Going responses but disable new Going", () => {
  const render = (response: string | null) => renderPage({ ...preview,state:"full",verified:true,response },{ origin:env.SB_PUBLIC_ORIGIN,token,nonce:"nonce" });
  assert.match(render(null),/value="going" disabled/); assert.ok(!/value="going" disabled/.test(render("going")));
});
test("ICS has stable identity, UTC instants, escaped content and byte-safe folding", () => {
  const data = { ...preview,title:"🎉".repeat(80), description:"Text\nATTENDEE:someone@example.com", status:"cancelled" };
  const calendar = ics(data);
  assert.match(calendar,/DTSTART:20261105T180000Z/); assert.match(calendar,new RegExp(`UID:${id}@squadbeacon`));
  assert.match(calendar,/STATUS:CANCELLED/); assert.ok(!calendar.includes("\r\nATTENDEE:"));
  for (const line of calendar.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(ics({ ...data,state:"unavailable" }),null); assert.equal(ics({ ...data,kind:"vote" }),null);
});
test("QR flyer contains a real QR matrix and sanitized labels", async () => {
  const svg = await card({ ...preview,title:"<script>" },`${env.SB_PUBLIC_ORIGIN}/g/${token}`,true);
  assert.match(svg,/<path/); assert.match(svg,/&lt;script&gt;/); assert.ok(!svg.includes("<script>"));
});

test("rendered flyers independently decode to the exact invitation and authorized child URLs", async () => {
  const { Resvg } = require("@resvg/resvg-js");
  const decode = require("jsqr");
  for (const suffix of ["",`?target=${id}`]) {
    const url=`${env.SB_PUBLIC_ORIGIN}/g/${token}${suffix}`;
    const rendered=new Resvg(await card(preview,url,true),{background:"white"}).render();
    const result=decode(new Uint8ClampedArray(rendered.pixels),rendered.width,rendered.height);
    assert.equal(result?.data,url);
  }
});
test("GET passes only a token hash and adds no-store and restrictive security headers", async () => {
  const calls: any[] = [];
  const result = await invoke({ backend: { rpc:async (name: string,args: any) => { calls.push([name,args]); return preview; } } });
  assert.equal(result.statusCode,200); assert.equal(calls[0][1].link_hash,hashToken(token));
  assert.equal(calls[0][1].actor,null); assert.ok(!JSON.stringify(calls).includes(token));
  assert.equal(result.headers["cache-control"],"private, no-store, max-age=0");
  assert.match(result.headers["content-security-policy"],/frame-ancestors 'none'/);
  assert.equal(result.headers["referrer-policy"],"no-referrer");
});
test("invalid links never reach the backend", async () => {
  const result = await invoke({ path:"/g/invalid", backend:{ rpc:async () => { throw new Error("must not be called"); } } });
  assert.equal(result.statusCode,404); assert.match(result.body,/Invitation unavailable/);
});
test("unconfigured deployments fail closed", async () => {
  const result = await invoke({ testEnv:{} }); assert.equal(result.statusCode,503);
  assert.ok(!result.body.includes("server-secret"));
});
test("cross-origin, missing custom headers and unsupported content types cannot mutate", async () => {
  for (const [headers,status] of [[{ origin:"https://attacker.example" },403],[{ "x-sb-guest":"" },403],[{ "content-type":"text/plain" },415]] as const) {
    const result = await invoke({ method:"POST",body:{ action:"send-code",token,email:"a@example.com" },headers,backend:{ rpc:async () => { throw new Error("must not be called"); } } });
    assert.equal(result.statusCode,status);
  }
});
test("oversized and malformed request bodies are rejected", async () => {
  assert.equal((await invoke({ method:"POST",body:"not-json" })).statusCode,400);
  assert.equal((await invoke({ method:"POST",body:{ action:"send-code",token,content:"x".repeat(9000) } })).statusCode,413);
});
test("unverified clients cannot supply another guest actor", async () => {
  const calls: string[] = [];
  const result = await invoke({ method:"POST",body:{ action:"respond",token,actor:id,request:id,command:"rsvp",payload:{ status:"going" } },backend:{ rpc:async (name: string) => { calls.push(name); return preview; } } });
  assert.equal(result.statusCode,401); assert.deepEqual(calls,["guest_preview"]);
});
test("guest identity comes from Auth verification, not request body; tokens go only into HttpOnly cookies", async () => {
  const calls: any[] = [];
  const session = { access_token:"private-access",refresh_token:"private-refresh",user:{ id,email_confirmed_at:"2026-10-28T00:00:00Z" } };
  const result = await invoke({ method:"POST",body:{ action:"verify",token,email:"a@example.com",code:"123456",name:"Guest",birth:"1990-01-01",actor:"forged" },backend:{ rpc:async (name: string,args: any) => { calls.push([name,args]); return name === "guest_preview" ? preview : {}; },auth:async () => session } });
  assert.equal(result.statusCode,200);
  assert.equal(calls.find(c => c[0] === "guest_identity")[1].actor,id);
  assert.match(result.headers["set-cookie"],/Secure; HttpOnly; SameSite=Lax/);
  assert.ok(!result.body.includes("private-access")); assert.ok(!result.body.includes("private-refresh"));
  const rate = calls.find(c => c[0] === "guest_auth_limit")[1]; assert.ok(!JSON.stringify(rate).includes("a@example.com"));
});
test("expired email verification cannot create a guest identity", async () => {
  const result = await invoke({ method:"POST",body:{ action:"verify",token,email:"a@example.com",code:"123456",name:"Guest",birth:"1990-01-01" },backend:{ rpc:async () => preview,auth:async () => ({ user:{ id,email_confirmed_at:null } }) } });
  assert.equal(result.statusCode,401); assert.ok(!result.headers["set-cookie"]);
});
test("verified returning guest writes as its session actor and forwards idempotency key", async () => {
  let mutation: any;
  const cookie = Buffer.from(JSON.stringify({ access_token:"session",refresh_token:"refresh" })).toString("base64url");
  const result = await invoke({ method:"POST",headers:{ cookie:`__Host-sb-guest=${cookie}` },body:{ action:"respond",token,request:id,command:"rsvp",payload:{ status:"going" },actor:"forged" },backend:{ auth:async () => ({ id,email_confirmed_at:"yes" }),rpc:async (name: string,args: any) => { if (name === "guest_respond") { mutation=args; return { response:"requested" }; } return preview; } } });
  assert.equal(result.statusCode,200); assert.equal(mutation.actor,id); assert.equal(mutation.request,id);
  assert.equal(JSON.parse(result.body).response,"requested");
});
test("member sharing requires verified member bearer rather than a guest cookie", async () => {
  const result = await invoke({ method:"POST",body:{ action:"share",target:id,kind:"beacon",command:"enable" } });
  assert.equal(result.statusCode,401);
});
test("sharing generates its token on the server and stores only the hash", async () => {
  let args: any;
  const result = await invoke({ method:"POST",headers:{ authorization:"Bearer member.jwt" },body:{ action:"share",target:id,kind:"beacon",command:"enable",actor:"forged",settings:{ access:"preview" } },backend:{ auth:async () => ({ id,email_confirmed_at:"yes" }),rpc:async (_: string,values: any) => { args=values;return { enabled:true }; } } });
  const link = JSON.parse(result.body).url;
  const raw = link.split("/").at(-1);
  assert.equal(args.actor,id); assert.equal(args.new_hash,hashToken(raw)); assert.ok(!JSON.stringify(args).includes(raw));
});
test("revoked invitations deny writes before verification or mutation", async () => {
  const result = await invoke({ method:"POST",body:{ action:"send-code",token,email:"a@example.com" },backend:{ rpc:async () => ({ state:"unavailable" }),auth:async () => { throw new Error("must not send mail"); } } });
  assert.equal(result.statusCode,404);
});
test("backend failure never leaks diagnostic strings or secrets", async () => {
  const result = await invoke({ backend:{ rpc:async () => { throw new Error("private SQL details server-secret"); } } });
  assert.equal(result.statusCode,503);assert.ok(!result.body.includes("private SQL details"));assert.ok(!result.body.includes("server-secret"));
});
test("calendar and flyer routes do not depend on guest sessions", async () => {
  for (const format of ["calendar.ics","flyer.svg"]) {
    const result = await invoke({ path:`/g/${token}/${format}` });
    assert.equal(result.statusCode,200);assert.match(result.headers["content-disposition"],/attachment/);
  }
});

test("PNG social cards have standard image dimensions and omit guest-specific projections", async()=>{
  const response=await invoke({path:`/g/${token}/card.png`});
  assert.equal(response.headers['content-type'],'image/png');
  const png=Buffer.from(response.body);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
});
test("domain association files require actual configured credentials and matching origins",async()=>{
  const fingerprint=Array(32).fill('AA').join(':');
  const configured={...env,APPLE_TEAM_ID:'ABC1234567',ANDROID_APP_LINK_FINGERPRINTS:fingerprint};
  assert.equal((await invoke({path:'/.well-known/apple-app-site-association'})).statusCode,404);
  const apple=await invoke({path:'/.well-known/apple-app-site-association',testEnv:configured});
  assert.equal(apple.statusCode,200);assert.equal(JSON.parse(apple.body).applinks.details[0].appID,'ABC1234567.com.squadbeacon.app');
  const android=await invoke({path:'/.well-known/assetlinks.json',testEnv:configured});assert.equal(JSON.parse(android.body)[0].target.sha256_cert_fingerprints[0],fingerprint);
  assert.equal((await invoke({path:'/.well-known/assetlinks.json',testEnv:{...configured,EXPO_PUBLIC_GUEST_ORIGIN:'https://different.example'}})).statusCode,404);
});
test("claiming requires both sessions and ignores forged identity fields",async()=>{
  const cookie=Buffer.from(JSON.stringify({access_token:'guest.session',refresh_token:'refresh'})).toString('base64url');
  const guest='c3333333-3333-4333-8333-333333333333';let mutation:any;
  const backend={auth:async(_:string,_body:any,bearer:string)=>({id:bearer==='member.session'?id:guest,email_confirmed_at:'yes'}),rpc:async(name:string,args:any)=>{mutation={name,args};return{eligible:1};}};
  const denied=await invoke({method:'POST',body:{action:'claim',command:'confirm',guest_id:guest,member_id:id},backend});assert.equal(denied.statusCode,401);
  const response=await invoke({method:'POST',headers:{cookie:`__Host-sb-guest=${cookie}`,authorization:'Bearer member.session'},body:{action:'claim',command:'preview',guest_id:id,member_id:guest},backend});
  assert.equal(response.statusCode,200);assert.equal(mutation.name,'guest_claim');assert.deepEqual(mutation.args,{guest_id:guest,member_id:id,command:'preview'});
});
test("nested target requests preserve parent authorization and validate target syntax",async()=>{
  let args:any;
  const response=await invoke({path:`/g/${token}?target=${id}`,backend:{rpc:async(_:string,value:any)=>{args=value;return preview;}}});
  assert.equal(response.statusCode,200);assert.equal(args.link_hash,hashToken(token));assert.equal(args.target,id);
  assert.match(response.body,new RegExp(`calendar\\.ics\\?target=${id}`));
  assert.equal((await invoke({path:`/g/${token}?target=invalid`})).statusCode,404);
});
