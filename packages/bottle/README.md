# 微框架

> 🧪 未发布

将 React Hooks 的写法带到服务器。

## 使用

```ts
import { createApp, cookies, useCookies } from '@zhengxs/bottle';

const app = createApp();

app.use(cookies());

app.use(function () {
  const cookies = useCookies();

  if (!cookies.get('foo')) {
    cookies.set('foo', 'bar');
  }

  return new Response(`Cookie: ${cookies.get('foo')}`);
});

app.listen(3000, function () {
  console.log('Server is running on http://localhost:3000');
});
```

## License

MIT
