import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { session, user } from "./auth"

// ─── Servidor de autorización OAuth 2.1 (conector MCP) ─────────────────────────
//
// Tablas que pide @better-auth/oauth-provider@1.6.9 (ver su `schema` en
// dist/index.mjs). Los nombres de export (`oauthClient`, `oauthAccessToken`,
// `oauthRefreshToken`, `oauthConsent`) son los modelos que el plugin busca en el
// drizzleAdapter, y las propiedades JS son sus nombres de campo: no renombrar.
// Los ids son text porque better-auth genera ids string. Los `string[]` van como
// text[] (el adapter de pg soporta arrays nativos) y `json` como jsonb.
// El plugin guarda los tokens hasheados (y los client secrets cifrados, por usar
// `disableJwtPlugin`). Ver docs/mcp.md.

export const oauthClient = pgTable("oauth_client", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  disabled: boolean("disabled").default(false),
  skipConsent: boolean("skip_consent"),
  enableEndSession: boolean("enable_end_session"),
  subjectType: text("subject_type"),
  scopes: text("scopes").array(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  name: text("name"),
  uri: text("uri"),
  icon: text("icon"),
  contacts: text("contacts").array(),
  tos: text("tos"),
  policy: text("policy"),
  softwareId: text("software_id"),
  softwareVersion: text("software_version"),
  softwareStatement: text("software_statement"),
  redirectUris: text("redirect_uris").array().notNull(),
  postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
  grantTypes: text("grant_types").array(),
  responseTypes: text("response_types").array(),
  public: boolean("public"),
  type: text("type"),
  requirePKCE: boolean("require_pkce"),
  referenceId: text("reference_id"),
  metadata: jsonb("metadata"),
})

export const oauthRefreshToken = pgTable("oauth_refresh_token", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  revoked: timestamp("revoked"),
  authTime: timestamp("auth_time"),
  scopes: text("scopes").array().notNull(),
})

export const oauthAccessToken = pgTable("oauth_access_token", {
  id: text("id").primaryKey(),
  // Hash del token (SHA-256 base64url sin el prefijo `atl_oat_`); el MCP lo busca por aquí
  token: text("token").unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  refreshId: text("refresh_id").references(() => oauthRefreshToken.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  scopes: text("scopes").array().notNull(),
})

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("oauth_consent_user_client_idx").on(t.userId, t.clientId)],
)

// ─── Tokens personales (PAT) del conector MCP ─────────────────────────────────
//
// Para clientes sin OAuth (Claude Code con --header, mcp-remote, scripts). El token
// `atl_pat_…` se muestra una sola vez: aquí solo queda su SHA-256 (hex) y un prefijo
// corto para reconocerlo en la lista. Los gestiona el router `mcp` (Paquete B).

export const mcpPersonalToken = pgTable(
  "mcp_personal_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    scopes: text("scopes").array().notNull(),
    // null = no expira
    expiresAt: timestamp("expires_at"),
    // Se actualiza como mucho cada 5 minutos
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("mcp_personal_token_user_idx").on(t.userId)],
)
