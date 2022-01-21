const h = document.createElement.bind(document)
const me = document.getElementById('__dev__')
const beforeME = me.previousElementSibling
const body = document.body
const ws = new WebSocket('ws://localhost:3000/ws')

let initialized = false

function init() {
  if (!initialized) {
    initialized = true
  } else {
    location.reload()
  }
}

function clear() {
  while (me.previousElementSibling !== beforeME)
    me.previousElementSibling.remove()
}

function updateIndex(posts) {
  for (const { title, link } of posts) {
    const a = Object.assign(h('a'), { href: link, textContent: title })
    const p = h('p')
    p.append(a)
    me.parentNode.insertBefore(p, me)
  }
}

function getDateString(date) {
  return date.toISOString().split('T')[0]
}

const template = document.createElement('template')
function updatePost(contents) {
  template.innerHTML = contents
  const node = template.content.cloneNode(true)
  me.parentNode.insertBefore(node, me)
}

function updateMeta({ title, date }) {
  if (title) {
    document.title = title
    document.querySelector('h2').textContent = title
  }
  if (date) {
    document.querySelector('time').textContent = getDateString(new Date(date))
  }
}

ws.addEventListener('message', event => {
  const { type, args } = JSON.parse(event.data)
  if (type === 'init') {
    init()
  } else if (type === 'update-index' && location.pathname === '/') {
    const { date, posts } = args
    clear()
    updateMeta({ date })
    updateIndex(posts)
  } else if (type === 'update-post') {
    const { name, title, date, contents } = args
    if (location.pathname === `/p/${name}.html`) {
      clear()
      updateMeta({ title, date })
      updatePost(contents)
    }
  }
})

ws.addEventListener('close', async () => {
  console.log('lose connection, polling...')
  while (true) {
    try {
      await fetch('/ping')
      break
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  init()
})
