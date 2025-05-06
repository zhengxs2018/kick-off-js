import { createApp, redirect } from '../src/index.js'

const app = createApp()

app.use(() => {
  redirect('https://baidu.com', 302)
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
