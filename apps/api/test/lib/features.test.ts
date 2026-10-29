import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { activeFeatures, hasFeature } from "../../src/lib/features"
import { readRailwayFlag, setRailwayFlagReader } from "../../src/lib/railway-flags"

const user = { id: "u1", email: "coach@ejemplo.com" }
const KEYS = ["FEATURE_ALL_USERS", "FEATURE_TRAINING_PLANS_USERS", "FEATURE_SCHEDULED_SESSIONS_USERS", "FEATURE_MCP_USERS"]

describe("features", () => {
  afterEach(() => {
    for (const k of KEYS) delete process.env[k]
    setRailwayFlagReader()
  })

  it("training_plans requiere scheduled_sessions", () => {
    process.env.FEATURE_TRAINING_PLANS_USERS = "coach@ejemplo.com"
    assert.equal(hasFeature(user, "training_plans"), false)
    process.env.FEATURE_SCHEDULED_SESSIONS_USERS = "*"
    assert.equal(hasFeature(user, "training_plans"), true)
  })

  it("mcp se activa por allowlist (correo o id) o con FEATURE_ALL_USERS", () => {
    assert.equal(hasFeature(user, "mcp"), false)
    process.env.FEATURE_MCP_USERS = "U1"
    assert.equal(hasFeature(user, "mcp"), true)
    delete process.env.FEATURE_MCP_USERS
    process.env.FEATURE_ALL_USERS = "coach@ejemplo.com"
    assert.ok(activeFeatures(user).includes("mcp"))
    assert.ok(activeFeatures(user).includes("training_plans"))
  })

  describe("Railway Feature Flags", () => {
    it("sin Railway configurado (SDK sin iniciar) devuelve undefined y manda el entorno", () => {
      assert.equal(readRailwayFlag("mcp", user), undefined)
      assert.equal(hasFeature(user, "mcp"), false)
      process.env.FEATURE_MCP_USERS = "*"
      assert.equal(hasFeature(user, "mcp"), true)
    })

    it("true en Railway activa aunque el entorno esté vacío", () => {
      setRailwayFlagReader((key) => key === "mcp")
      assert.equal(hasFeature(user, "mcp"), true)
    })

    it("false en Railway apaga aunque el entorno lo permita", () => {
      process.env.FEATURE_ALL_USERS = "*"
      setRailwayFlagReader((key) => (key === "mcp" ? false : undefined))
      assert.equal(hasFeature(user, "mcp"), false)
      assert.equal(hasFeature(user, "groups"), true)
    })

    it("undefined o error del lector cae al entorno", () => {
      process.env.FEATURE_MCP_USERS = "coach@ejemplo.com"
      setRailwayFlagReader(() => undefined)
      assert.equal(hasFeature(user, "mcp"), true)
      setRailwayFlagReader(() => {
        throw new Error("boom")
      })
      assert.equal(hasFeature(user, "mcp"), true)
      assert.equal(hasFeature(user, "groups"), false)
    })

    it("las dependencias se siguen exigiendo con valores de Railway", () => {
      setRailwayFlagReader((key) => key === "training_plans")
      assert.equal(hasFeature(user, "training_plans"), false)
      setRailwayFlagReader((key) => key === "training_plans" || key === "scheduled_sessions")
      assert.equal(hasFeature(user, "training_plans"), true)
    })

    it("pasa id, correo en minúsculas y env en el contexto", () => {
      const seen: unknown[] = []
      setRailwayFlagReader((name, ctx) => {
        seen.push({ name, ctx })
        return true
      })
      process.env.RAILWAY_ENVIRONMENT_NAME = "testing"
      hasFeature({ id: "u1", email: "Coach@Ejemplo.com" }, "mcp")
      delete process.env.RAILWAY_ENVIRONMENT_NAME
      hasFeature(user, "mcp")
      assert.deepEqual(seen, [
        { name: "mcp", ctx: { key: "u1", email: "coach@ejemplo.com", env: "testing" } },
        { name: "mcp", ctx: { key: "u1", email: "coach@ejemplo.com", env: "local" } },
      ])
    })
  })
})
