import { createApp, cookies, useCookies } from '../src/index.js';

const app = createApp();

app.use(cookies());

app.use(() => {
  const cookies = useCookies();

  if (!cookies.get('foo')) {
    cookies.set('foo', 'bar');
  }

  return new Response(`Cookie: ${cookies.get('foo')}`);
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
