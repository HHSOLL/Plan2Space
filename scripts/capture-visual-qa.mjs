import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function capture(page, outputPath) {
  await page.screenshot({
    path: outputPath,
    fullPage: true
  });
}

async function go(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
}

async function clickByText(page, text) {
  const locator = page.getByRole("button", { name: text });
  await locator.first().click({ timeout: 15000 });
  await page.waitForTimeout(900);
}

async function fillLogin(page, email, password) {
  await go(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(1800);
}

async function main() {
  const baseUrl = getArg("baseUrl", "http://127.0.0.1:3100");
  const outputDir = getArg("outDir", path.join(process.cwd(), "docs/evidence/visual-qa/2026-04-11"));
  const projectId = getArg("projectId", "");
  const liveToken = getArg("liveToken", "");
  const expiredToken = getArg("expiredToken", "");
  const email = getArg("email", "");
  const password = getArg("password", "");

  if (!projectId || !liveToken || !expiredToken || !email || !password) {
    throw new Error("Missing required args: projectId/liveToken/expiredToken/email/password");
  }

  await ensureDir(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1440, height: 960 }
  });
  const page = await context.newPage();

  try {
    await go(page, "/studio/create");
    await capture(page, path.join(outputDir, "01-studio-create.png"));

    await go(page, "/studio/builder");
    await capture(page, path.join(outputDir, "02-builder-step1.png"));

    await clickByText(page, "3");
    await capture(page, path.join(outputDir, "03-builder-step3-openings.png"));

    await clickByText(page, "4");
    await capture(page, path.join(outputDir, "04-builder-step4-style.png"));

    await fillLogin(page, email, password);

    await go(page, `/project/${projectId}`);
    await capture(page, path.join(outputDir, "05-editor-top-view.png"));

    await clickByText(page, "Walk");
    await capture(page, path.join(outputDir, "06-editor-walk-view.png"));

    await clickByText(page, "Share");
    await capture(page, path.join(outputDir, "07-editor-share-modal.png"));

    await go(page, `/shared/${liveToken}`);
    await capture(page, path.join(outputDir, "08-shared-top-view.png"));

    await clickByText(page, "Walk");
    await capture(page, path.join(outputDir, "09-shared-walk-hotspots.png"));

    await go(page, "/community");
    await capture(page, path.join(outputDir, "10-community.png"));

    await go(page, "/gallery");
    await capture(page, path.join(outputDir, "11-gallery.png"));

    await go(page, `/shared/${expiredToken}`);
    await capture(page, path.join(outputDir, "12-shared-expired.png"));
  } finally {
    await context.close();
    await browser.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    captures: [
      "01-studio-create.png",
      "02-builder-step1.png",
      "03-builder-step3-openings.png",
      "04-builder-step4-style.png",
      "05-editor-top-view.png",
      "06-editor-walk-view.png",
      "07-editor-share-modal.png",
      "08-shared-top-view.png",
      "09-shared-walk-hotspots.png",
      "10-community.png",
      "11-gallery.png",
      "12-shared-expired.png"
    ]
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, outputDir }, null, 2));
}

main().catch((error) => {
  console.error(`[capture-visual-qa] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
