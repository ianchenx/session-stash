#!/usr/bin/env node
// Render popup / sidepanel / options against a mocked chrome.* and snap PNGs
// into assets/screenshots/. Run with `node scripts/screenshots/capture.mjs`.
import { createReadStream, statSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const ROOT = resolve(HERE, "../..")
const BUILD_DIR = join(ROOT, "build", "chrome-mv3-prod")
const OUT_DIR = join(ROOT, "assets", "screenshots")
const MOCK_SCRIPT = await readFile(join(HERE, "mock-chrome.js"), "utf8")

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
}

function startServer() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0])
      const filePath = join(BUILD_DIR, urlPath === "/" ? "index.html" : urlPath)
      if (!filePath.startsWith(BUILD_DIR)) {
        res.writeHead(403).end()
        return
      }
      try {
        const stat = statSync(filePath)
        if (!stat.isFile()) throw new Error("not a file")
        res.writeHead(200, {
          "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
          "Content-Length": stat.size
        })
        createReadStream(filePath).pipe(res)
      } catch {
        res.writeHead(404).end()
      }
    })
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address()
      resolveServer({ server, port })
    })
  })
}

const SCENARIOS = [
  {
    name: "popup",
    entry: "popup.html",
    viewport: { width: 360, height: 440 },
    wait: async (page) => {
      await page.waitForSelector("text=Research sandbox", { timeout: 10_000 })
    }
  },
  {
    name: "sidepanel",
    entry: "sidepanel.html",
    viewport: { width: 420, height: 820 },
    wait: async (page) => {
      await page.waitForSelector("text=Pick a site", { timeout: 10_000 })
      await page.waitForSelector("text=chatgpt.com", { timeout: 10_000 })
      await page.waitForSelector("text=stripe.com", { timeout: 10_000 })
    }
  },
  {
    name: "options",
    entry: "options.html",
    viewport: { width: 720, height: 1000 },
    wait: async (page) => {
      await page.waitForSelector("text=Cloudflare KV", { timeout: 10_000 })
      // Let the Card body render lock-policy toggles etc.
      await page.waitForSelector("text=Master password", { timeout: 10_000 })
    }
  }
]

async function capture(baseUrl, scenario) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: 2,
    colorScheme: "light"
  })
  await context.addInitScript({ content: MOCK_SCRIPT })
  const page = await context.newPage()
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[${scenario.name}]`, msg.text())
  })
  page.on("pageerror", (err) => console.error(`[${scenario.name}]`, err))

  const url = `${baseUrl}/${scenario.entry}?scenario=${scenario.name}`
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await scenario.wait(page)
  // Wait for every <img> to finish loading (or error out) so favicons are in.
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true })
              img.addEventListener("error", resolve, { once: true })
            })
        )
    )
  )
  // Let sonner / shadow / layout settle
  await page.waitForTimeout(500)

  const outPath = join(OUT_DIR, `${scenario.name}.png`)
  const fullPage = scenario.name === "options"
  await page.screenshot({ path: outPath, fullPage, omitBackground: false })
  console.log("  → wrote", outPath)

  await browser.close()
}

async function main() {
  const { server, port } = await startServer()
  const baseUrl = `http://127.0.0.1:${port}`
  console.log("serving", BUILD_DIR, "on", baseUrl)

  try {
    for (const scenario of SCENARIOS) {
      console.log("capturing", scenario.name)
      await capture(baseUrl, scenario)
    }
  } finally {
    server.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
