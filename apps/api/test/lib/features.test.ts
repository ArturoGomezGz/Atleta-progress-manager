import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { activeFeatures, hasFeature } from "../../src/lib/features"

const user = { id: "u1", email: "coach@ejemplo.com" }
const KEYS = ["FEATURE_ALL_USERS", "FEATURE_TRAINING_PLANS_USERS", "FEATURE_SCHEDULED_SESSIONS_USERS", "FEATURE_MCP_USERS"]

describe("features", () => {
  afterEach(() => {
    for (const k of KEYS) delete process.env[k]
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
})
