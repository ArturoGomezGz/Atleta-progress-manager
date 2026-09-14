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

export function maskNonCode(input) {
  let out = ""
  let state = "normal"
  let templateExpressionDepth = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]
    if (state === "normal") {
      if (ch === "/" && next === "/") {
        state = "line-comment"
        out += "  "
        i++
      } else if (ch === "/" && next === "*") {
        state = "block-comment"
        out += "  "
        i++
      } else if (ch === "'") {
        state = "single-quote"
        out += " "
      } else if (ch === "\"") {
        state = "double-quote"
        out += " "
      } else if (ch === "`") {
        state = "template"
        out += " "
      } else {
        out += ch
      }
      continue
    }

    if (state === "line-comment") {
      if (ch === "\n") {
        state = "normal"
        out += "\n"
      } else {
        out += " "
      }
      continue
    }

    if (state === "block-comment") {
      if (ch === "*" && next === "/") {
        state = "normal"
        out += "  "
        i++
      } else {
        out += ch === "\n" ? "\n" : " "
      }
      continue
    }

    if ((state === "single-quote" || state === "double-quote" || state === "template") && ch === "\\") {
      out += " "
      if (i + 1 < input.length) {
        out += input[i + 1] === "\n" ? "\n" : " "
        i++
      }
      continue
    }

    if (state === "template") {
      if (ch === "$" && next === "{") {
        state = "template-expression"
        templateExpressionDepth = 1
        out += "${"
        i++
        continue
      }
      if (ch === "`") {
        state = "normal"
        out += " "
      } else {
        out += ch === "\n" ? "\n" : " "
      }
      continue
    }

    if (state === "template-expression") {
      if (ch === "{") templateExpressionDepth += 1
      if (ch === "}") templateExpressionDepth -= 1
      out += ch
      if (templateExpressionDepth === 0) state = "template"
      continue
    }

    if (
      (state === "single-quote" && ch === "'")
      || (state === "double-quote" && ch === "\"")
      || (state === "template" && ch === "`")
    ) {
      state = "normal"
      out += " "
      continue
    }

    out += ch === "\n" ? "\n" : " "
  }
  return out
}
