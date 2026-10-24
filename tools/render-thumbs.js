const { chromium } = require("playwright");
const path = require("path");
const slugs = ["swap-faces-live-calls", "ai-faceless-product-blueprint", "ai-faceless-youtube-business", "ai-for-business-and-marketing", "ai-trading-for-beginners", "ai-saas-business-blueprint"];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  for (let i = 0; i < slugs.length; i++) {
    await p.goto("file://" + path.join(__dirname, "thumbs.html") + "?i=" + i);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, "../public/assets/img/thumbs/" + slugs[i] + ".png") });
  }
  await b.close();
})();
