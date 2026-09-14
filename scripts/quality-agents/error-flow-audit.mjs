import fs from "node:fs"
import path from "node:path"
import { lineNumberAt, listFiles, repoRelative } from "./fs-utils.mjs"

const cwd = process.cwd()
const outDir = readArg("--out-dir") ?? ".quality-reports"
const targetDir = path.join(cwd, "apps/api/src")
const files = listFiles(targetDir, [".ts"])
const findings = []

for (const file of files) {
  const content = fs.readFileSync(file, "utf8")
  pushMatches(content, file, /\b[\w$]+!\./g, "high", "Uso de non-null assertion con acceso inmediato; puede provocar crash en runtime.")
  pushMatches(content, file, /reply\.status\(500\)\.send\(\{\s*error:\s*String\(err\)\s*\}\)/g, "medium", "Se expone error crudo en respuesta HTTP 500.")
  pushMatches(
    content,
    file,
    /\.catch\s*\(\s*\(?\s*err\w*\s*\)?\s*=>\s*console\.error\s*\(/g,
    "medium",
    "Fallo async sin manejo centralizado de error.",
  )
}

const report = {
  agent: "error-flow-audit",
  description: "Detecta patrones de manejo de errores con riesgo operativo.",
  totalFindings: findings.length,
  findings,
}

fs.mkdirSync(outDir, { recursive: true })
const reportPath = path.join(outDir, "error-flow-audit.json")
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

console.log(`error-flow-audit: ${findings.length} findings`)
console.log(`report: ${repoRelative(cwd, reportPath)}`)

function pushMatches(content, file, regex, severity, message) {
  for (const match of content.matchAll(regex)) {
    findings.push({
      category: "error-handling",
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

