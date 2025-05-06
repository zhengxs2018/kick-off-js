import { useContext } from '../app/context.js'

export function redirect(location: string, code = 302) {
  const ctx = useContext()

  ctx.respond = true

  ctx.res.writeHead(code, { location })
  ctx.res.end()
}
