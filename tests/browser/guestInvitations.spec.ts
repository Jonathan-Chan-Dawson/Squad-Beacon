import { test, expect, type Page } from "@playwright/test";
import { Readable } from "node:stream";
import guestHandler from "../../server/guest/handler.cjs";
const { createHandler } = guestHandler;
const token = "A".repeat(43);
const origin = "https://guest.example";
const guest = "a1111111-1111-4111-8111-111111111111";
type State = { response: string | null; available: boolean; deadlineState: string; access: string; writes: number };

async function fixture(page: Page, options: Partial<State> = {}) {
  const state: State = { response: null, available: true, deadlineState: "open", access: "participate", writes: 0, ...options };
  const handler = createHandler({ env: { NODE_ENV: "test", SB_GUEST_ENABLED: "true", SB_PUBLIC_ORIGIN: origin, SUPABASE_URL: "https://backend.example", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", SB_GUEST_RATE_SECRET: "fixture-rate" }, backend: {
    rpc: async (name: string, values: any) => {
      if (name === "guest_preview") return state.available ? { state:state.deadlineState, kind:"beacon", title:"A quiet evening", description:"Bring a favorite book.", area_label:"Northside", starts_at:"2026-11-05T18:00:00Z", ends_at:"2026-11-05T19:00:00Z", timezone:"America/Chicago", access:state.access, verified:values.actor === guest, response: values.actor === guest ? state.response : null, approval_required:true, app_path:`/activity/${guest}`, calendar_id:guest } : { state:"unavailable" };
      if (name === "guest_respond") { state.writes++; state.response = values.payload.status === "going" ? "requested" : values.payload.status; return { response:state.response }; }
      return {};
    },
    auth: async (path: string, _body: any, bearer: string) => {
      if (path === "verify") return { access_token:"verified-session", refresh_token:"verified-refresh", user:{ id:guest,email_confirmed_at:"2026-10-28" } };
      if (path === "user" && bearer === "verified-session") return { id:guest,email_confirmed_at:"2026-10-28" };
      if (path === "otp") return {};
      throw new Error("Invalid fixture session");
    },
  } });
  await page.route(`${origin}/**`, async route => {
    const request = route.request();
    const req = Readable.from(request.postData() ? [request.postData()!] : []) as any;
    Object.assign(req,{ method:request.method(),url:request.url(),headers:await request.allHeaders() });
    const res = { statusCode:200,headers:{} as Record<string,string>,body:"",setHeader(name: string,value: string) { this.headers[name.toLowerCase()] = value; },end(body = "") { this.body=body; } };
    await handler(req,res);
    await route.fulfill({ status:res.statusCode,headers:res.headers,body:res.body });
  });
  return state;
}

test("new guest verifies, requests approval, returns and changes response", async ({ page, context }) => {
  const state = await fixture(page);
  await page.goto(`${origin}/g/${token}`);
  await expect(page.getByRole("heading",{ name:"A quiet evening" })).toBeVisible();
  await page.getByLabel("Email",{ exact:true }).fill("guest@example.com");
  await page.getByRole("button",{ name:"Email a verification code" }).click();
  await expect(page.getByLabel("Verification code")).toBeFocused();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByLabel("Your name").fill("Book Guest");
  await page.getByLabel("Date of birth").fill("1990-01-01");
  await page.getByRole("button",{ name:"Verify and continue" }).click();
  await expect(page.getByRole("button",{ name:"Going",exact:true })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find(c => c.name === "__Host-sb-guest")).toMatchObject({ httpOnly:true,secure:true,sameSite:"Lax" });
  await page.getByRole("button",{ name:"Going",exact:true }).click();
  await expect(page.getByRole("status").filter({ hasText:"Your response:" })).toHaveText("Your response: Pending organizer approval");
  expect(state.response).toBe("requested");
  await page.reload();
  await expect(page.getByText("Your response: Pending organizer approval")).toBeVisible();
  await page.getByRole("button",{ name:"Interested",exact:true }).click();
  await expect(page.getByText("Your response: Interested")).toBeVisible();
  expect(state.writes).toBe(2);
  await page.screenshot({ path:"test-results/guest-invitation-phone.png",fullPage:true });
  await page.getByRole("button",{ name:"Sign out of guest access" }).click();
  await expect(page.getByRole("button",{ name:"Email a verification code" })).toBeVisible();
});

test("invalid and revoked links disclose no event fields", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`${origin}/g/invalid`);
  await expect(page.getByRole("heading",{ name:"Invitation unavailable" })).toBeVisible();
  state.available = false;
  await page.goto(`${origin}/g/${token}`);
  await expect(page.getByRole("heading",{ name:"Invitation unavailable" })).toBeVisible();
  await expect(page.getByText("Northside")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
});

test.describe("Static invitation", () => {
test.use({ javaScriptEnabled: false });
test("preview-only pages work without JavaScript and retain safe social metadata", async ({ page }) => {
  await fixture(page,{ access:"preview" });
  await page.goto(`${origin}/g/${token}`);
  await expect(page.getByRole("heading",{ name:"A quiet evening" })).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content","A quiet evening");
  await expect(page.getByRole("button",{ name:"Email a verification code" })).toHaveCount(0);
  await expect(page.getByRole("link",{ name:"Add to calendar" })).toHaveAttribute("href",`${origin}/g/${token}/calendar.ics`);
});
});

test("cancelled invitation and reduced-motion mobile layout stay accessible", async ({ page }) => {
  await fixture(page,{ deadlineState:"cancelled" });
  await page.emulateMedia({ reducedMotion:"reduce" });
  await page.setViewportSize({ width:320,height:740 });
  await page.goto(`${origin}/g/${token}`);
  await expect(page.getByText("This Beacon was cancelled")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link",{ name:"Add to calendar" }).focus();
  await expect(page.getByRole("link",{ name:"Add to calendar" })).toBeFocused();
  await page.screenshot({ path:"test-results/guest-cancelled-reduced-motion.png",fullPage:true });
});
