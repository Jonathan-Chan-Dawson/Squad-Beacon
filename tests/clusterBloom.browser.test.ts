import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Use the shipped DOM renderer/policy; fixture faces isolate geometry from map tile networking.
test("bloom counts, direct exploration, reduced motion and phone layouts", async () => {
  const bundle = await build({
    stdin: {
      contents: `
    import {webConstellation} from './src/features/maps/webConstellation';
    import {nativePresentation} from './src/features/maps/nativeMapPresentation';
    window.renderBloom=(count,mode,dark,friends=11,prominent=false)=>{
      const members=[...Array.from({length:count},(_,i)=>({id:'beacon:'+i,kind:'beacon',latitude:41.88,longitude:-87.64,category:'Social'})),...Array.from({length:friends},(_,i)=>({id:'person:'+i,kind:'person',latitude:41.88+Math.sin(i*2.4)*.0001,longitude:-87.64+Math.cos(i*2.4)*.0001}))];
      const presentation=nativePresentation({id:'fixture',latitude:41.88,longitude:-87.64,members},mode,{},new Set(['beacon:0']),prominent);
      return webConstellation(presentation,{
        ink:dark?'#eef5f3':'#163830',surface:dark?'#192e29':'#ffffff',line:dark?'#456157':'#c5d8d0',ownership:'#168c80',categoryColor:()=> '#26b39d',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
        open:(section)=>{window.opened=(window.opened||0)+1;window.section=section;},
        member:(point,full=false)=>{
          const button=document.createElement('button');button.setAttribute('aria-label',point.id);button.onclick=()=>window.selected=point.id;
          const face=document.createElement('span');face.textContent=['\\u2615','\\u26bd','\\ud83c\\udfae'][Number(point.id.split(':')[1])%3];face.style.cssText='position:relative;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:'+(full?40:32)+'px;height:'+(full?40:32)+'px;flex-shrink:0;border-radius:50%;background:white;border:2px solid #26b39d;font-size:20px;';
          button.style.cssText='border:0;background:transparent;padding:0;display:flex;flex-direction:column;align-items:center;';button.append(face);
          if(point.id==='beacon:0'){const star=document.createElement('span');star.textContent='\\u2605';star.style.cssText='position:absolute;right:-3px;bottom:-2px;border-radius:50%;background:#168c80;color:white;font-size:10px;width:12px;height:12px;';face.append(star);}return button;
        }
      }).node;
    };`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
  });
  const browser = await chromium.launch({
    channel: process.platform === "win32" ? "chrome" : undefined,
  });
  await mkdir(".expo/cluster-bloom-qa", { recursive: true });
  try {
    for (const width of [320, 375, 430])
      for (const dark of [false, true]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        await page.setContent(
          `<body style="margin:0;background:${dark ? "#10211c" : "#e8f1ed"};color:${dark ? "white" : "#163830"};font:12px system-ui"><main style="display:grid;grid-template-columns:repeat(2,1fr);gap:28px 2px;padding:16px 4px"></main></body>`,
        );
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page.evaluate(
          ({ dark }) => {
            for (const mode of ["stack", "swarm", "atmosphere", "micro"])
              for (const [count, friends] of [
                [1, 0],
                [1, 2],
                [0, 12],
                [0, 2],
                [2, 2],
                [2, 25],
                [2, 7],
                [7, 18],
                [20, 5],
                [40, 60],
                [40, 0],
                [3, 11],
                [5, 11],
                [20, 11],
              ]) {
                const cell = document.createElement("section");
                cell.dataset.mode = mode;
                cell.dataset.count = String(count);
                cell.dataset.friends = String(friends);
                cell.style.cssText =
                  "height:142px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;";
                const label = document.createElement("small");
                label.textContent = mode + " " + count + "B / " + friends + "F";
                cell.append(
                  label,
                  (window as any).renderBloom(count, mode, dark, friends),
                );
                document.querySelector("main")!.append(cell);
              }
          },
          { dark },
        );
        const dense = page.locator(
          'section[data-mode="swarm"][data-count="20"][data-friends="11"]',
        );
        assert.equal(
          await dense.getByTestId("map-cluster-count").textContent(),
          "11 · 20",
        );
        assert.equal(await dense.getByTestId("map-cluster-count").count(), 1);
        assert.equal(
          await dense
            .locator('[data-count-kind="friends"]')
            .getAttribute("data-count-value"),
          "11",
        );
        assert.equal(
          await dense
            .locator('[data-count-kind="beacons"]')
            .getAttribute("data-count-value"),
          "20",
        );
        assert.equal(
          await dense.locator("[data-count-content] svg").count(),
          2,
        );

        assert.equal(
          await dense.getByTestId("cluster-friend-count").count(),
          0,
        );
        assert.equal(
          await dense.getByTestId("map-constellation-overflow").count(),
          0,
        );
        assert.equal(
          await dense.getByTestId("cluster-friend-satellite").count(),
          0,
        );
        assert.equal(await dense.locator(".map-petal-item").count(), 7);
        for (const tier of ["atmosphere", "micro"]) {
          assert.equal(
            await page
              .locator(
                `section[data-mode="${tier}"] [data-testid="cluster-friend-satellite"]`,
              )
              .count(),
            0,
          );
          const friends = page.locator(
            `section[data-mode="${tier}"][data-count="0"][data-friends="2"]`,
          );
          assert.equal(
            await friends.getByTestId("cluster-friend-count").textContent(),
            "2",
          );
          assert.equal(
            await friends.locator(".map-petal-item:visible").count(),
            0,
          );
        }
        const microDense = page.locator(
          'section[data-mode="micro"][data-count="20"][data-friends="11"]',
        );
        assert.equal(
          await microDense.getByTestId("map-cluster-count").textContent(),
          "20",
        );
        assert.equal(
          await microDense.locator('[data-count-kind="friends"]').count(),
          0,
        );
        assert.match(
          (await microDense
            .getByTestId("map-cluster-count")
            .getAttribute("aria-label"))!,
          /11 nearby friends.*20 Beacons/,
        );
        await page.evaluate(
          ({ dark }) => {
            const host = document.createElement("div");
            host.id = "micro-friends-mode";
            host.append(
              (window as any).renderBloom(40, "micro", dark, 60, true),
            );
            document.querySelector("main")!.append(host);
          },
          { dark },
        );
        const friendsMode = page.locator("#micro-friends-mode");
        assert.equal(
          await friendsMode.getByTestId("map-cluster-count").textContent(),
          "60 · 40",
        );
        assert.equal(
          await friendsMode.locator("[data-count-content] svg").count(),
          2,
        );
        await friendsMode.evaluate((node) => node.remove());
        const fitting = page.locator(
          'section[data-mode="swarm"][data-count="20"][data-friends="5"]',
        );
        assert.equal(
          await fitting.getByTestId("cluster-friend-satellite").count(),
          0,
        );
        assert.equal(
          await fitting.getByTestId("map-cluster-count").textContent(),
          "5 · 20",
        );
        const beaconOnly = page.locator(
          'section[data-mode="swarm"][data-count="40"][data-friends="0"]',
        );
        assert.equal(
          await beaconOnly.getByTestId("map-cluster-count").textContent(),
          "40",
        );
        assert.equal(
          await beaconOnly.locator('[data-count-kind="friends"]').count(),
          0,
        );
        assert.equal(
          await page
            .locator("[data-count-content]")
            .evaluateAll(
              (nodes) =>
                nodes.filter(
                  (node) =>
                    node.getBoundingClientRect().width >
                    node.parentElement!.clientWidth,
                ).length,
            ),
          0,
        );
        assert.equal(
          await page
            .locator(
              'section[data-mode="micro"][data-count="20"][data-friends="11"] .map-petal-item',
            )
            .count(),
          2,
        );
        assert.equal(
          await page.locator("section").evaluateAll(
            (nodes) =>
              nodes.filter((node) => {
                const r = node.getBoundingClientRect();
                return r.left < 0 || r.right > innerWidth;
              }).length,
          ),
          0,
        );
        await page.screenshot({
          path: `.expo/cluster-bloom-qa/blooms-${width}-${dark ? "dark" : "light"}.png`,
          fullPage: true,
        });
        const small = page.locator(
          'section[data-mode="swarm"][data-count="3"] [data-testid="map-constellation"]',
        );
        const first = small.locator('[data-member-id="beacon:0"]');
        await first.dispatchEvent("click");
        assert.equal(await small.getAttribute("data-expanded"), "true");
        assert.equal(
          await first.evaluate(
            (node) => (node as HTMLElement).style.transition,
          ),
          "",
        );
        await first.dispatchEvent("click");
        assert.equal(
          await page.evaluate(() => (window as any).selected),
          "beacon:0",
        );
        await small.dispatchEvent("keydown", { key: "Escape" });
        assert.equal(await small.getAttribute("data-expanded"), null);
        await small.getByTestId("map-cluster-count").click();
        assert.equal(await page.evaluate(() => (window as any).opened), 1);
        assert.equal(
          await page.evaluate(() => (window as any).section),
          "Friends",
        );
        await dense
          .getByTestId("map-constellation")
          .dispatchEvent("keydown", { key: "Enter" });
        assert.equal(await page.evaluate(() => (window as any).opened), 2);
        const microSmall = page.locator(
          'section[data-mode="micro"][data-count="5"] [data-testid="map-constellation"]',
        );
        assert.equal(
          await microSmall.locator(".map-petal-item:visible").count(),
          2,
        );
        await microSmall
          .locator(".map-petal-item:visible")
          .first()
          .dispatchEvent("click");
        assert.equal(
          await microSmall.locator(".map-petal-item:visible").count(),
          5,
        );
        assert.equal(
          await microSmall.getByTestId("map-cluster-count").textContent(),
          "11",
        );
        assert.equal(
          await microSmall.getByTestId("map-cluster-count").isVisible(),
          true,
        );
        await microSmall
          .locator('[data-member-id="beacon:4"]')
          .dispatchEvent("click");
        assert.equal(
          await page.evaluate(() => (window as any).selected),
          "beacon:4",
        );
        const iconSmall = page.locator(
          'section[data-mode="swarm"][data-count="2"][data-friends="2"] [data-testid="map-constellation"]',
        );
        assert.equal(
          await iconSmall.getByTestId("cluster-friend-satellite").count(),
          2,
        );
        assert.equal(
          await iconSmall.getByTestId("map-cluster-count").isVisible(),
          false,
        );
        await iconSmall
          .locator('[data-member-id="beacon:0"]')
          .dispatchEvent("click");
        assert.equal(
          await iconSmall.getByTestId("map-cluster-count").isVisible(),
          true,
        );
        assert.equal(
          await iconSmall
            .getByTestId("cluster-friend-satellite")
            .first()
            .isVisible(),
          false,
        );
        await iconSmall.getByTestId("map-cluster-count").click();
        assert.equal(
          await page.evaluate(() => (window as any).section),
          "Friends",
        );
        // Final compact capture at a real phone viewport, including friend-only groups.
        await page.locator("section").evaluateAll((nodes) => {
          for (const node of nodes) {
            const section = node as HTMLElement;
            const count = Number(section.dataset.count),
              friends = Number(section.dataset.friends);
            section.style.display =
              section.dataset.mode === "stack" &&
              ((count === 1 && friends === 0) ||
                (count === 1 && friends === 2) ||
                (count === 2 && friends === 7) ||
                (count === 7 && friends === 18) ||
                (count === 20 && friends === 11) ||
                (count === 0 && friends === 12))
                ? "flex"
                : "none";
          }
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        const friendOnly = page.locator(
          'section[data-mode="stack"][data-count="0"]',
        );
        assert.equal(
          await friendOnly.getByTestId("cluster-friend-count").textContent(),
          "12",
        );
        await friendOnly.getByTestId("cluster-friend-count").click();
        assert.equal(
          await page.evaluate(() => (window as any).section),
          "Friends",
        );
        const viewportErrors = await page
          .locator(
            '[data-testid="cluster-friend-satellite"]:visible,[data-testid="cluster-friend-count"]:visible,[data-testid="map-cluster-count"]:visible',
          )
          .evaluateAll(
            (nodes) =>
              nodes.filter((node) => {
                const r = node.getBoundingClientRect();
                return r.left < 0 || r.right > innerWidth;
              }).length,
          );
        assert.equal(viewportErrors, 0);
        await page.screenshot({
          path: `.expo/cluster-bloom-qa/count-cleanup-${width}-${dark ? "dark" : "light"}.png`,
        });
        await page.close();
      }
  } finally {
    await browser.close();
  }
});
