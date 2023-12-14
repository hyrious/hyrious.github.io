import fs from 'fs'
import c from 'chalk'
import { apStyleTitleCase } from 'ap-style-title-case'
import { slug } from 'github-slugger'

const ARGV = process.argv.slice(2)

const input = ARGV.join(' ')
if (!input) {
  console.log(c.bgWhiteBright.black('Usage:'), 'new <title>')
  process.exit(0)
}

if (/^[-a-z]+$/.test(input)) {
  const title = apStyleTitleCase(input.replace(/-/g, ' '))
  makeFile(input, title)
} else {
  const id = slug(input)
  makeFile(id, input)
}

function makeFile(id: string, title: string, date = new Date()) {
  const file = `posts/${id}.md`
  const content = `---
title: ${title}
date: ${date.toISOString().slice(0, 10)}
---

Hello, world!
`
  fs.writeFileSync(file, content)
  console.log(c.green('new'), file)
}
