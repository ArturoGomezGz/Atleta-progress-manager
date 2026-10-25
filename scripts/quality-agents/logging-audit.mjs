import fs from "node:fs"
import path from "node:path"
import { lineNumberAt, listFiles, maskNonCode, repoRelative } from "./fs-utils.mjs"

const cwd = process.cwd()
const outDir = readArg("--out-dir") ?? ".quality-reports"
const targetDirs = ["apps/api/src", "apps/web/src"].map((p) => path.join(cwd, p))
const files = targetDirs.flatMap((dir) => listFiles(dir, [".ts", ".tsx", ".js", ".jsx"]))
const findings = []
// Scripts CLI de administración: su salida a consola es la interfaz con el operador, no logging de servicio.
const exclusions = JSON.parse(
  fs.readFileSync(path.join(cwd, "scripts/quality-agents/config/logging-audit-exclusions.json"), "utf8"),
)
const consoleExcludeFiles = new Set(exclusions.consoleExcludeFiles ?? [])

for (const file of files) {
  const content = fs.readFileSync(file, "utf8")
  const code = maskNonCode(content)
  const lines = code.split("\n")
  if (!consoleExcludeFiles.has(repoRelative(cwd, file))) {
    pushMatches(
      code,
      file,
      /console\.(error|warn|info|log)\s*\(/g,
      "medium",
      "Evitar console.*; usar logger estructurado con contexto.",
      // Un error boundary de React (componentDidCatch) en cliente no tiene logger estructurado: console.error es el uso correcto.
      (match) => !/\bcomponentDidCatch\s*\(/.test(lines[lineNumberAt(code, match.index ?? 0) - 1] ?? ""),
    )
  }
  pushMatches(
    code,
    file,
    /\.catch\s*\(\s*\(?\s*err\w*\s*\)?\s*=>\s*(?:console\.error\s*\(|\{[\s\S]{0,200}?console\.error\s*\()/g,
    "high",
    "Fallo async con console.error sin trazabilidad de request/correlation ID.",
    // `main().catch(...)` de nivel superior del proceso: no hay request ni correlation ID que propagar.
    (match) => !/\bmain\s*\(\s*\)\s*$/.test(code.slice(0, match.index ?? 0)),
  )
}

const report = {
  agent: "logging-audit",
  description: "Detecta logging no estructurado y fallos async poco trazables.",
  totalFindings: findings.length,
  findings,
}

fs.mkdirSync(outDir, { recursive: true })
const reportPath = path.join(outDir, "logging-audit.json")
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

console.log(`logging-audit: ${findings.length} findings`)
console.log(`report: ${repoRelative(cwd, reportPath)}`)

function pushMatches(content, file, regex, severity, message, keep = () => true) {
  for (const match of content.matchAll(regex)) {
    if (!keep(match)) continue
    findings.push({
      category: "logging",
      severity,
      file: repoRelative(cwd, file),
      line: lineNumberAt(content, match.index ?? 0),
      message,
      snippet: match[0],
    })
  }
}

function readArg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
