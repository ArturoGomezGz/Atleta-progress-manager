import fs from "node:fs"
import path from "node:path"
import { listFiles, repoRelative } from "./fs-utils.mjs"

const cwd = process.cwd()
const outDir = readArg("--out-dir") ?? ".quality-reports"
const configPath = readArg("--config") ?? "scripts/quality-agents/config/critical-targets.json"
const criticalTargets = JSON.parse(fs.readFileSync(path.join(cwd, configPath), "utf8"))

const testRoots = [
  path.join(cwd, "apps/api/test"),
  path.join(cwd, "apps/api/tests"),
]

const testFiles = testRoots.flatMap((root) => listFiles(root, [".ts", ".tsx", ".js", ".jsx"]))
  .filter((f) => /\.test\.|\.spec\./.test(path.basename(f)))

const findings = []
const normalizedTestModules = testFiles.map((f) => normalizeTestModulePath(repoRelative(cwd, f)))

for (const target of criticalTargets) {
  const related = hasRelatedTest(target, normalizedTestModules)
  if (!related) {
    const fileName = path.basename(target, path.extname(target))
    findings.push({
      category: "testing",
      severity: "high",
      file: target,
      line: null,
      message: `Archivo crítico sin pruebas unitarias asociadas (${fileName}).`,
      snippet: null,
    })
  }
}

const report = {
  agent: "unit-test-gap-finder",
  description: "Detecta huecos de pruebas unitarias en módulos críticos.",
  totalFindings: findings.length,
  findings,
  metadata: {
    totalTestFiles: testFiles.length,
    testFiles: testFiles.map((f) => repoRelative(cwd, f)),
  },
}

fs.mkdirSync(outDir, { recursive: true })
const reportPath = path.join(outDir, "unit-test-gap-finder.json")
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

console.log(`unit-test-gap-finder: ${findings.length} findings`)
console.log(`report: ${repoRelative(cwd, reportPath)}`)

function readArg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function normalizeTestModulePath(relPath) {
  return relPath
    .replace(/\.(test|spec)\.[^.]+$/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/\/+/g, "/")
}

function hasRelatedTest(targetPath, normalizedTests) {
  const targetNoExt = targetPath.replace(/\.[^.]+$/, "")
  const expected = expectedTestModulePaths(targetNoExt)
  return normalizedTests.some((testModule) => expected.has(testModule))
}

function expectedTestModulePaths(targetNoExt) {
  const p = path.posix
  const expected = new Set()
  expected.add(targetNoExt)

  const targetDir = p.dirname(targetNoExt)
  const fileName = p.basename(targetNoExt)
  expected.add(p.join(targetDir, "__tests__", fileName))

  if (targetNoExt.startsWith("apps/api/src/")) {
    const suffix = targetNoExt.slice("apps/api/src/".length)
    const suffixDir = p.dirname(suffix)
    for (const root of ["test", "tests"]) {
      expected.add(`apps/api/${root}/${suffix}`)
      expected.add(
        `apps/api/${root}/${suffixDir === "." ? "__tests__" : `${suffixDir}/__tests__`}/${fileName}`.replace(/\/+/g, "/"),
      )
    }
  }

  return expected
}
