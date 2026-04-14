'use client';

import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState(
    '用户注册时必须绑定手机号，密码至少8位'
  );
  const [result, setResult] = useState<any>(null);

  async function handleSubmit() {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/requirement/extract`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      }
    );

    const data = await res.json();
    setResult(data);
  }

  return (
    <main>
      <h1>Requirement Extract Demo</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
      />

      <button onClick={handleSubmit}>提取</button>

      <pre>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
