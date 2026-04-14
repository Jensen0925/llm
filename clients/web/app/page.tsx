'use client';

import { APP_NAME, type RequirementResult } from '@repo/contracts';
import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState(
    '用户注册时必须绑定手机号，密码至少8位',
  );
  const [helloMessage, setHelloMessage] = useState('');
  const [result, setResult] = useState<RequirementResult | null>(null);
  const [error, setError] = useState('');

  async function handleHello() {
    setError('');
    const res = await fetch('/api/hello');
    const data = (await res.json()) as { message: string };
    setHelloMessage(data.message);
  }

  async function handleSubmit() {
    setError('');
    setResult(null);

    const res = await fetch('/api/requirement/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!res.ok) {
      setError(`请求失败：${res.status}`);
      return;
    }

    const data = (await res.json()) as RequirementResult;
    setResult(data);
  }

  return (
    <main>
      <h1>Hello from {APP_NAME}</h1>

      <button onClick={handleHello}>调用 /hello</button>
      {helloMessage ? <p>{helloMessage}</p> : null}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
      />

      <button onClick={handleSubmit}>提取</button>

      {error ? <p>{error}</p> : null}
      <pre>{result ? JSON.stringify(result, null, 2) : ''}</pre>
    </main>
  );
}
