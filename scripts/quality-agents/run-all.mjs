import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const cwd = process.cwd()
const outDir = readArg("--out-dir") ?? ".quality-reports"
const strict = process.argv.includes("--strict")
const agents = [
  { script: "logging-audit.mjs", report: "logging-audit.json" },
  { script: "error-flow-audit.mjs", report: "error-flow-audit.json" },
  { script: "unit-test-gap-finder.mjs", report: "unit-test-gap-finder.json" },
]

fs.mkdirSync(outDir, { recursive: true })

for (const agent of agents) {
  const result = spawnSync("node", [path.join("scripts/quality-agents", agent.script), "--out-dir", outDir], {
    cwd,
    stdio: "inherit",
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const reports = agents.map((agent) => {
  const reportPath = path.join(cwd, outDir, agent.report)
  return JSON.parse(fs.readFileSync(reportPath, "utf8"))
})

const allFindings = reports.flatMap((r) => r.findings ?? [])
const severityCount = allFindings.reduce((acc, finding) => {
  acc[finding.severity] = (acc[finding.severity] ?? 0) + 1
  return acc
}, {})

const summary = {
  generatedAt: new Date().toISOString(),
  totalFindings: allFindings.length,
  severityCount,
  reports: reports.map((r) => ({
    agent: r.agent,
    totalFindings: r.totalFindings,
    description: r.description,
  })),
}

const summaryPath = path.join(cwd, outDir, "summary.json")
const markdownPath = path.join(cwd, outDir, "summary.md")
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
fs.writeFileSync(markdownPath, toMarkdown(summary, reports))

console.log(`quality-agents: ${summary.totalFindings} findings`)
console.log(`summary: ${path.relative(cwd, summaryPath)}`)

if (strict && summary.totalFindings > 0) process.exit(2)

function toMarkdown(summary, reports) {
  const lines = [
    "# Quality Agents Report",
    "",
    `Generated at: ${summary.generatedAt}`,
    "",
    `Total findings: **${summary.totalFindings}**`,
    "",
    "## Findings by severity",
    "",
    `- high: ${summary.severityCount.high ?? 0}`,
    `- medium: ${summary.severityCount.medium ?? 0}`,
    `- low: ${summary.severityCount.low ?? 0}`,
    "",
    "## Agent breakdown",
    "",
  ]

  for (const report of reports) {
    lines.push(`### ${report.agent} (${report.totalFindings})`, "")
    if (!report.findings?.length) {
      lines.push("- Sin hallazgos", "")
      continue
    }

    for (const finding of report.findings.slice(0, 20)) {
      lines.push(
        `- [${finding.severity}] \`${finding.file}${finding.line ? `:${finding.line}` : ""}\` — ${finding.message}`,
      )
      if (finding.snippet) {
        lines.push(`  - snippet: \`${normalizeSnippet(finding.snippet)}\``)
      }
    }
    if (report.findings.length > 20) {
      lines.push(`- ... ${report.findings.length - 20} hallazgos adicionales`)
    }
    lines.push("")
  }
  return `${lines.join("\n")}\n`
}

function readArg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function normalizeSnippet(snippet) {
  return String(snippet).replace(/\s+/g, " ").trim().replaceAll("`", "'")
}
