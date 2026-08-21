import { createApp, cookies, session, useSession } from '../src/index.js';

const app = createApp();

app.use(cookies());
app.use(session());

app.use(() => {
  const session = useSession();

  session.views ??= 0;
  session.views++;

  return new Response(`Hello World! You have visited this page ${session.views} times.`);
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
