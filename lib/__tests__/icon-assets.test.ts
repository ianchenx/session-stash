import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const projectRoot = resolve(__dirname, "..", "..")

describe("development extension icons", () => {
  it("includes development-specific icon assets so plasmo keeps the orange logo in dev builds", () => {
    for (const file of [
      "assets/icon.development.png",
      "assets/icon16.development.png",
      "assets/icon32.development.png",
      "assets/icon48.development.png",
      "assets/icon128.development.png"
    ]) {
      expect(existsSync(resolve(projectRoot, file))).toBe(true)
    }
  })
})
