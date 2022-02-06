import { fileURLToPath } from 'url'
import { existsSync, promises } from 'fs'
import { basename, dirname, resolve } from 'path'
import http from 'http'
import esbuild from 'esbuild'
import crypto from 'crypto'
import { indexHtmlTemplate, renderPost } from './collect.js'
import { renderMarkdown } from './render.js'

const __filename = fileURLToPath(new URL(import.meta.url))
const __dirname = dirname(__filename)

const client = resolve(__dirname, './client.js')

const scriptTag = '<script id="__dev__" type="module" src="/client"></script>'
const initialHTML = indexHtmlTemplate.join(scriptTag)

function notFound(res) {
  res.writeHead(404)
  res.end('Not Found')
}

const routes = {}
function route(url, handler) {
  routes[url] = handler
}

route('/', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(initialHTML)
})

route('/favicon.ico', async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'image/x-icon' })
  const where = resolve(__dirname, '../../favicon.ico')
  res.end(await promises.readFile(where))
})

route('/style.css', async (req, res) => {
  const { outputFiles } = await esbuild.build({
    entryPoints: ['./_src/style.css'],
    bundle: true,
    minify: true,
    sourcemap: 'inline',
    write: false,
    legalComments: 'none',
  })
  res.writeHead(200, { 'Content-Type': 'text/css' })
  res.end(outputFiles[0].contents)
})

route('/client', async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/javascript' })
  res.end(await promises.readFile(client, 'utf8'))
})

route('/ping', async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('pong')
})

export const server = http.createServer(async (req, res) => {
  const handler = routes[req.url]
  if (handler) return handler(req, res)

  const { pathname } = new URL(req.url, 'http://localhost')
  const name = basename(pathname, '.html')
  const path = resolve(__dirname, `../posts/${name}.md`)
  if (existsSync(path)) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    const data = await renderMarkdown(`_src/posts/${name}.md`)
    const html = renderPost({ ...data, contents: scriptTag })
    return res.end(html)
  }

  return notFound(res)
})

function acceptWS(key) {
  return crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
    .digest('base64')
}

let init
export function onInit(cb) {
  init = cb
}

let socket
server.on('upgrade', (req, res) => {
  if (req.headers['upgrade'] !== 'websocket') return notFound(res)
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptWS(req.headers['sec-websocket-key'])}`,
  ]
  res.write(headers.join('\r\n') + '\r\n\r\n')
  socket = res
  init && init()
})

export function sendUpdate(type, args) {
  if (!socket) return
  const json = JSON.stringify({ type, args })
  const length = Buffer.byteLength(json)
  if (length < 126) {
    const buffer = Buffer.alloc(2 + length)
    buffer.writeUInt8(0b10000001, 0)
    buffer.writeUInt8(length, 1)
    buffer.write(json, 2)
    socket.write(buffer)
  } else {
    const buffer = Buffer.alloc(2 + 2 + length)
    buffer.writeUInt8(0b10000001, 0)
    buffer.writeUInt8(126, 1)
    buffer.writeUInt16BE(length, 2)
    buffer.write(json, 4)
    socket.write(buffer)
  }
}
