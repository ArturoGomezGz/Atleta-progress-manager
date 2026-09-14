import fs from "node:fs"
import path from "node:path"

export function listFiles(rootDir, extensions) {
  const out = []
  walk(rootDir, out, new Set(extensions))
  return out
}

function walk(dir, out, extensions) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, out, extensions)
      continue
    }
    if (extensions.has(path.extname(entry.name))) out.push(fullPath)
  }
}

export function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length
}

export function repoRelative(cwd, filePath) {
  return path.relative(cwd, filePath).replaceAll("\\", "/")
}

