import { describe, expect, it } from "vitest"

import { getETLDPlusOne } from "../domain"

describe("domain", () => {
  it("extracts eTLD+1 from common URLs", () => {
    expect(getETLDPlusOne("https://twitter.com/home")).toBe("twitter.com")
    expect(getETLDPlusOne("https://api.twitter.com/v2/x")).toBe("twitter.com")
    expect(getETLDPlusOne("https://foo.bar.twitter.com")).toBe("twitter.com")
    expect(getETLDPlusOne("https://www.google.co.uk/")).toBe("google.co.uk")
  })

  it("returns null for non-public suffixes", () => {
    expect(getETLDPlusOne("http://localhost:3000/")).toBeNull()
    expect(getETLDPlusOne("https://127.0.0.1/")).toBeNull()
  })

  it("returns null for invalid inputs", () => {
    expect(getETLDPlusOne("")).toBeNull()
    expect(getETLDPlusOne("not a url")).toBeNull()
  })
})
