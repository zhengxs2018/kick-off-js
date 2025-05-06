import { createApp } from '../src/index.js'

const app = createApp()

app.use(() => {
  return new Response('Hello World')
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
