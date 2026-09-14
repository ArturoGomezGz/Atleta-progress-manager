import fs from "node:fs"
import path from "node:path"
import { lineNumberAt, listFiles, maskNonCode, repoRelative } from "./fs-utils.mjs"

const cwd = process.cwd()
const outDir = readArg("--out-dir") ?? ".quality-reports"
const targetDir = path.join(cwd, "apps/api/src")
const files = listFiles(targetDir, [".ts"])
const findings = []

for (const file of files) {
  const content = fs.readFileSync(file, "utf8")
  const code = maskNonCode(content)
  pushMatches(code, file, /[A-Za-z0-9_$\]\)\.]\s*!\s*(?:\.|\[)/g, "high", "Uso de non-null assertion con acceso inmediato; puede provocar crash en runtime.")
  pushMatches(
    code,
    file,
    /reply\.status\(\s*500\s*\)\.send\(\s*\{[\s\S]*?\berror\s*:\s*String\(\s*\w+\s*\)[\s\S]*?\}\s*\)/g,
    "medium",
    "Se expone error crudo en respuesta HTTP 500.",
  )
  pushMatches(
    code,
    file,
    /\.catch\s*\(\s*\(?\s*err\w*\s*\)?\s*=>\s*(?:console\.error\s*\(|\{[\s\S]{0,200}?console\.error\s*\()/g,
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
