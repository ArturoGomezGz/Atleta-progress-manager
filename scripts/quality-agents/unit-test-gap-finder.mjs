import fs from "node:fs"
import path from "node:path"
import { listFiles, repoRelative } from "./fs-utils.mjs"

const cwd = process.cwd()
const outDir = readArg("--out-dir") ?? ".quality-reports"
const criticalTargets = [
  "apps/api/src/routers/sessions.ts",
  "apps/api/src/routers/rms.ts",
  "apps/api/src/routers/teams.ts",
  "apps/api/src/trpc.ts",
  "apps/api/src/services/report-trigger.ts",
  "apps/api/src/services/ai-reports.ts",
]

const testRoots = [
  path.join(cwd, "apps/api/src"),
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

if (testFiles.length === 0) {
  findings.push({
    category: "testing",
    severity: "high",
    file: "apps/api",
    line: null,
    message: "No se detectaron archivos .test/.spec en API.",
    snippet: null,
  })
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
  const targetLeafDir = path.basename(path.dirname(targetNoExt))
  const fileName = path.basename(targetNoExt)
  const expectedSuffixes = [
    `/${targetLeafDir}/${fileName}`,
    `/src/${targetLeafDir}/${fileName}`,
    `/test/${targetLeafDir}/${fileName}`,
    `/tests/${targetLeafDir}/${fileName}`,
  ]

  return normalizedTests.some((testModule) => expectedSuffixes.some((suffix) => testModule.endsWith(suffix)))
}
