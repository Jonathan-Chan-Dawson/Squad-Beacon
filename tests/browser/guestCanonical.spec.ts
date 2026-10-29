import { test, expect, type BrowserContext } from "@playwright/test";
import { Readable } from "node:stream";
import guestHandler from "../../server/guest/handler.cjs";
import guestPresentation from "../../server/guest/presentation.cjs";
import { guestDatabase, guestIds as ids } from "../guestDatabase";

const origin = "https://guest.example";
const { hashToken, newToken } = guestPresentation;

test("real canonical database: verified outsider, approval, returning access and revocation", async ({ browser }) => {
  const fixture = await guestDatabase();
  const token = newToken();
  const target = await fixture.beacon(true,2);
  await fixture.share(target,hashToken(token));
  await fixture.role("service_role");
  const handler = guestHandler.createHandler({ env: { SB_GUEST_ENABLED:"true",SB_PUBLIC_ORIGIN:origin,SUPABASE_URL:"https://backend.example",SUPABASE_SERVICE_ROLE_KEY:"fixture-service",SB_GUEST_RATE_SECRET:"fixture-rate",NODE_ENV:"test" },backend: {
    // SQL runs the complete ordered migration history; only the external email
    // provider/Auth transport is substituted in this local browser acceptance.
    rpc: async (name: string,values: any) => {
      const args: Record<string,string[]> = {
        guest_preview:["link_hash","actor"], guest_auth_limit:["rate_key","command"],
        guest_identity:["actor","display_name","birth"], guest_respond:["link_hash","actor","command","payload","request"],
        guest_attendance:["actor","target","participant","command"],
      };
      if (!args[name]) throw new Error(`Unexpected RPC ${name}`);
      return fixture.rpc(name,args[name].map(key=>values[key]));
    },
    auth: async (path: string,body: any,bearer: string) => {
      if (path === "otp") return {};
      if (path === "verify" && body.token === "123456") return { access_token:"guest.session",refresh_token:"guest.refresh",user:{ id:ids.guest,email_confirmed_at:"2026-10-28" } };
      if (path === "user" && ["guest.session","host.session"].includes(bearer)) return { id:bearer === "host.session" ? ids.host : ids.guest,email_confirmed_at:"2026-10-28" };
      throw new Error("Unverified fixture session");
    },
  } });
  const route = async (context: BrowserContext) => context.route(`${origin}/**`,async route => {
    const request=route.request();
    const req=Readable.from(request.postData() ? [request.postData()!] : []) as any;
    Object.assign(req,{ method:request.method(),url:request.url(),headers:await request.allHeaders() });
    const res={statusCode:200,headers:{} as Record<string,string>,body:"",setHeader(name: string,value: string){this.headers[name.toLowerCase()]=value;},end(body=""){this.body=body;}};
    await handler(req,res); await route.fulfill({ status:res.statusCode,headers:res.headers,body:res.body });
  });
  const context=await browser.newContext({ viewport:{width:390,height:844} });
  try {
    await route(context);
    const page=await context.newPage();
    await page.goto(`${origin}/g/${token}`);
    await expect(page.getByRole("heading",{name:"Shared invitation"})).toBeVisible();
    await expect(page.getByText("SECRET VENUE")).toHaveCount(0);
    await page.getByLabel("Email",{exact:true}).fill("outsider@example.com");
    await page.getByRole("button",{name:"Email a verification code"}).click();
    await page.getByLabel("Verification code").fill("123456");
    await page.getByLabel("Your name").fill("Outside Reader");
    await page.getByLabel("Date of birth").fill("1990-01-01");
    await page.getByRole("button",{name:"Verify and continue"}).click();
    await page.getByRole("button",{name:"Going",exact:true}).click();
    await expect(page.getByText("Your response: Pending organizer approval")).toBeVisible();
    const pending=await fixture.rpc("guest_attendance",[ids.host,target,null,"read"]);
    expect(pending.guests).toEqual([expect.objectContaining({ id:ids.guest,name:"Outside Reader",response:"requested" })]);
    await fixture.rpc("guest_attendance",[ids.host,target,ids.guest,"approve"]);
    await page.reload();
    await expect(page.getByText("Your response: Going")).toBeVisible();
    await expect(page.getByText("2 / 2 confirmed places")).toBeVisible();
    await page.getByRole("button",{name:"Decline",exact:true}).click();
    await expect(page.getByText("Your response: Declined")).toBeVisible();
    await page.reload();
    await expect(page.getByText("1 / 2 confirmed places")).toBeVisible();
    await fixture.rpc("guest_share_manage",[ids.host,"revoke","beacon",target,{},null]);
    await page.reload();
    await expect(page.getByRole("heading",{name:"Invitation unavailable"})).toBeVisible();
    await expect(page.getByText("Bring a book")).toHaveCount(0);
  } finally { await context.close(); await fixture.db.close(); }
});
