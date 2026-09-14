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
  const templateExprStack = []
  let exprMode = "normal"
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
        templateExprStack.length = 0
        templateExprStack.push("root")
        exprMode = "normal"
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
      if (exprMode === "normal") {
        if (ch === "/" && next === "/") {
          exprMode = "line-comment"
          out += "  "
          i++
          continue
        }
        if (ch === "/" && next === "*") {
          exprMode = "block-comment"
          out += "  "
          i++
          continue
        }
        if (ch === "'") {
          exprMode = "single-quote"
          out += " "
          continue
        }
        if (ch === "\"") {
          exprMode = "double-quote"
          out += " "
          continue
        }
        if (ch === "`") {
          exprMode = "template-quote"
          out += " "
          continue
        }
        if (ch === "{") templateExprStack.push("brace")
        if (ch === "}") {
          const marker = templateExprStack.pop()
          out += ch
          if (marker === "template-hole") exprMode = "template-quote"
          if (templateExprStack.length === 0) {
            state = "template"
            exprMode = "normal"
          }
          continue
        }
        out += ch
        continue
      }

      if (exprMode === "line-comment") {
        if (ch === "\n") {
          out += "\n"
          exprMode = "normal"
        } else {
          out += " "
        }
        continue
      }

      if (exprMode === "block-comment") {
        out += ch === "\n" ? "\n" : " "
        if (ch === "*" && next === "/") {
          out += " "
          i++
          exprMode = "normal"
        }
        continue
      }

      if (ch === "\\") {
        out += " "
        if (i + 1 < input.length) {
          out += input[i + 1] === "\n" ? "\n" : " "
          i++
        }
        continue
      }

      if (exprMode === "template-quote" && ch === "$" && next === "{") {
        templateExprStack.push("template-hole")
        exprMode = "normal"
        out += "  "
        i++
        continue
      }

      out += ch === "\n" ? "\n" : " "
      if (exprMode === "single-quote" && ch === "'") exprMode = "normal"
      else if (exprMode === "double-quote" && ch === "\"") exprMode = "normal"
      else if (exprMode === "template-quote" && ch === "`") exprMode = "normal"
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
