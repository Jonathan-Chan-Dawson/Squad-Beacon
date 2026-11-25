import { expect, test } from "@playwright/test";
import { startDemoFromEntry } from "./demoEntry";
import { mockOnboardingAccount } from "./onboardingAccount";

test("measure repeatable Map gestures on the existing demo", async ({ page }, info) => {
  test.skip(!process.env.SB_MEASURE_MAP, "Run explicitly to collect local performance samples.");
  test.setTimeout(90_000);
  await mockOnboardingAccount(page, { signedOut: true });
  await page.route(/.*(?:cartocdn\.com|basemaps\.carto\.com).*/, (route) => route.abort());
  await page.goto("/auth/sign-in");
  const start = Date.now();
  await startDemoFromEntry(page);
  const map = page.locator(".leaflet-container").first();
  await expect(map.locator(".leaflet-marker-icon").first()).toBeAttached();
  const timeToMarkersMs = Date.now() - start;
  const bounds = (await map.boundingBox())!;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * 0.57 };
  await page.screenshot({ path: info.outputPath("map-before-gestures.png"), animations: "disabled" });
  await page.evaluate(() => {
    const frames: number[] = [];
    let prior = performance.now();
    let peakMarkers = 0;
    let frame: number;
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) longTasks.push(entry.duration);
    });
    observer.observe({ type: "longtask" });
    function sample(time: number) {
      frames.push(time - prior);
      prior = time;
      if (frames.length % 8 === 0)
        peakMarkers = Math.max(peakMarkers, document.querySelectorAll(".leaflet-marker-icon").length);
      frame = requestAnimationFrame(sample);
    }
    frame = requestAnimationFrame(sample);
    Object.assign(window, {
      finishMapMeasurement: () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        frames.sort((a, b) => a - b);
        return {
          frameSamples: frames.length,
          frameP95Ms: frames[Math.ceil(frames.length * 0.95) - 1],
          longTasks: longTasks.length,
          longestTaskMs: Math.max(0, ...longTasks),
          peakMarkers,
        };
      },
    });
  });
  for (const direction of [1, -1, 1, -1]) {
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + direction * 100, center.y - direction * 60, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, direction * 250);
    await page.evaluate(() => new Promise<void>((resolve) => {
      let count = 0;
      function sample() {
        if (++count === 26) resolve();
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }));
  }
  const gestures = await page.evaluate(() => {
    const measurement = window as Window & { finishMapMeasurement?: () => object };
    return measurement.finishMapMeasurement?.();
  });
  const result = JSON.stringify({ timeToMarkersMs, ...gestures });
  console.log(result);
  await info.attach("map-performance.json", { body: result, contentType: "application/json" });
});
