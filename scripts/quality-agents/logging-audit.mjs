import fs from "node:fs"
import path from "node:path"
import { lineNumberAt, listFiles, repoRelative } from "./fs-utils.mjs"

const cwd = process.cwd()
const outDir = readArg("--out-dir") ?? ".quality-reports"
const targetDirs = ["apps/api/src", "apps/web/src"].map((p) => path.join(cwd, p))
const files = targetDirs.flatMap((dir) => listFiles(dir, [".ts", ".tsx", ".js", ".jsx"]))
const findings = []

for (const file of files) {
  const content = fs.readFileSync(file, "utf8")
  pushMatches(content, file, /console\.(error|warn|info|log)\s*\(/g, "medium", "Evitar console.*; usar logger estructurado con contexto.")
  pushMatches(
    content,
    file,
    /\.catch\s*\(\s*\(?\s*err\w*\s*\)?\s*=>\s*console\.error\s*\(/g,
    "high",
    "Fallo async con console.error sin trazabilidad de request/correlation ID.",
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

function pushMatches(content, file, regex, severity, message) {
  for (const match of content.matchAll(regex)) {
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

