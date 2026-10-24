const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: path.join(__dirname, "rec"), size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();
  await p.goto("file://" + path.join(__dirname, "promo.html"));
  await p.waitForTimeout(21000);
  const v = p.video();
  await ctx.close();
  console.log(await v.path());
  await b.close();
})();
