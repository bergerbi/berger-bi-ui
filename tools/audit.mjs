// Headless rule check of starter.html: every screen x sizes x light/dark/CEO.
// Runs bbi-audit.js in a real browser and fails (exit 1) on any finding.
//   CI:     npm i playwright@1.49.1 && npx playwright install chromium && node tools/audit.mjs
//   local:  npm i --no-save playwright-core@1.49.1 && BBI_CHANNEL=msedge node tools/audit.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let pw;
try { pw = await import("playwright"); } catch { pw = await import("playwright-core"); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = path.join(root, "skills", "berger-bi-ui");
const page0 = pathToFileURL(path.join(skill, "starter.html")).href;
const auditJs = fs.readFileSync(path.join(skill, "bbi-audit.js"), "utf8");

const matrix = [
  [1440, 900, ""], [1920, 1080, ""], [1440, 900, "?dark"], [1920, 1080, "?ceo"],
  [1440, 900, "?ceo"], [1024, 768, ""], [390, 844, ""],
];
const browser = await pw.chromium.launch(process.env.BBI_CHANNEL ? { channel: process.env.BBI_CHANNEL } : {});
let bad = 0;
for (const [w, h, q] of matrix) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(page0 + q);
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: auditJs });
  const screens = await page.$$eval(".tabs a[data-screen]", as => as.map(a => a.dataset.screen));
  for (const s of screens) {
    await page.evaluate(sc => document.querySelector(`.tabs a[data-screen="${sc}"]`).click(), s);
    await page.waitForTimeout(350);
    const found = await page.evaluate(() => window.BBIaudit());
    const tag = `${w}x${h}${q || ""} #${s}`;
    if (found.length || errors.length) {
      bad++;
      console.log(`FAIL ${tag}`);
      found.forEach(f => console.log(`   ${f.rule} | ${f.where} | ${f.detail}`));
      errors.forEach(e => console.log(`   page error: ${e}`));
      errors.length = 0;
    } else console.log(`ok   ${tag}`);
  }
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
