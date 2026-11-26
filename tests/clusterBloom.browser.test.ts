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
    import {miniAvatarSvg} from './src/features/profile/avatarArt';
    window.renderBloom=(count,mode,dark,friends=11,prominent=false,owned=true)=>{
      const members=[...Array.from({length:count},(_,i)=>({id:'beacon:'+i,kind:'beacon',latitude:41.88,longitude:-87.64,category:['Social','Gaming','Fitness','Creative'][i%4]})),...Array.from({length:friends},(_,i)=>({id:'person:'+i,kind:'person',latitude:41.88+Math.sin(i*2.4)*.0001,longitude:-87.64+Math.cos(i*2.4)*.0001}))];
      const presentation=nativePresentation({id:'fixture',latitude:41.88,longitude:-87.64,members},mode,{},new Set(owned?['beacon:0']:[]),prominent);
      return webConstellation(presentation,{
        ink:dark?'#eef5f3':'#163830',surface:dark?'#192e29':'#ffffff',line:dark?'#456157':'#c5d8d0',categoryColor:(category)=>({Social:'#26b39d',Gaming:'#fba65d',Fitness:'#69a9ff',Creative:'#b68bff'}[category]),
        friendAvatar:(point)=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(miniAvatarSvg(Number(point.id.split(':')[1])+13)),
        beaconState:(point)=>owned&&point.id==='beacon:0'?{ owned:true }:undefined,
        open:(section)=>{window.opened=(window.opened||0)+1;window.section=section;},
        member:(point)=>{
          const button=document.createElement('button');button.setAttribute('aria-label',point.id);button.onclick=()=>window.selected=point.id;
          const face=document.createElement('span');face.textContent=['\\u2615','\\u26bd','\\ud83c\\udfae'][Number(point.id.split(':')[1])%3];face.style.cssText='position:relative;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:50%;background:white;border:2px solid #26b39d;font-size:20px;';
          button.style.cssText='border:0;background:transparent;padding:0;display:flex;flex-direction:column;align-items:center;';button.append(face);
          if(owned&&point.id==='beacon:0'){const star=document.createElement('span');star.textContent='\\u2605';star.style.cssText='position:absolute;right:-3px;bottom:-2px;border-radius:50%;background:#168c80;color:white;font-size:10px;width:12px;height:12px;';face.append(star);}return button;
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
          { waitUntil: "domcontentloaded", timeout: 60_000 },
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
        const testCell = (mode: string, beacons: number, friends: number) =>
          page.locator(`section[data-mode="${mode}"][data-count="${beacons}"][data-friends="${friends}"]`);
        for (const mode of ["stack", "swarm", "atmosphere", "micro"]) {
          const dense = testCell(mode, 20, 11);
          const pill = dense.getByTestId("map-cluster-count");
          assert.equal(await pill.count(), 1);
          assert.equal(await pill.textContent(), "11 · 20");
          assert.match((await pill.getAttribute("aria-label")) ?? "", /11 nearby friends.*20 Beacons/);
          assert.ok((await pill.boundingBox())!.width >= 50);
          const near = mode === "stack" || mode === "swarm";
          assert.equal(await dense.getByTestId("map-cluster-projector").count(), Number(near));
          assert.equal(await dense.getByTestId("map-beacon-projector").count(), 0);
          const petals = dense.locator(".map-petal-item");
          const star = dense.locator('[data-signal-kind="stellar"]');
          const peeks = dense.getByTestId("cluster-friend-satellite");
          if (mode === "stack" || mode === "swarm") {
            assert.equal(await petals.count(), 3);
            assert.equal(await star.count(), 0);
            assert.ok(await peeks.count() <= 2);
            assert.equal(await peeks.locator("img").count(), await peeks.count());
          } else {
            assert.equal(await petals.count(), 0);
            assert.equal(await peeks.count(), 0);
            assert.equal(await dense.getByTestId("cluster-circle-shadow").count(), 0);
            assert.equal(await star.count(), 1);
            const facets = await star.locator("[data-relationship]").evaluateAll(items => items.map(item => item.getAttribute("data-relationship")));
            assert.ok(facets.length >= 1 && facets.length <= (mode === "micro" ? 2 : 3));
            assert.equal(new Set(facets).size, facets.length);
          }
          const before = await page.evaluate(() => (window as any).opened ?? 0);
          await pill.dispatchEvent("click");
          assert.equal(await page.evaluate(() => (window as any).opened), before + 1);
          const friends = testCell(mode, 0, 12).getByTestId("map-cluster-count");
          assert.equal(await friends.textContent(), "12");
          assert.equal(await testCell(mode, 0, 12).getByTestId("map-cluster-projector").count(), 0);
          await friends.dispatchEvent("click");
          assert.equal(await page.evaluate(() => (window as any).section), "Friends");

          const standalone = testCell(mode, 1, 0);
          assert.equal(await standalone.getByTestId("map-cluster-count").count(), 0);
          assert.equal(await standalone.getByTestId("map-beacon-projector").count(), Number(near));
          assert.equal(await standalone.getByTestId("beacon-marker-beam").count(), Number(mode === "swarm" || mode === "atmosphere"));
          assert.equal(await dense.getByTestId("beacon-marker-beam").count(), 0);
          const pin = standalone.getByRole("button", { name: "beacon:0" });
          assert.equal((await pin.boundingBox())!.width, 44);
          await pin.dispatchEvent("click");
          assert.equal(await page.evaluate(() => (window as any).selected), "beacon:0");
        }
        assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
        await page.screenshot({
          path: `.expo/cluster-bloom-qa/${width}-${dark ? "dark" : "light"}.png`,
          fullPage: true,
          animations: "disabled",
        });
        await page.close();
      }
  } finally {
    await browser.close();
  }
});
