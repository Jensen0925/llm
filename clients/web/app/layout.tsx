import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LLM Requirement Extract",
  description: "Requirement extraction demo powered by LangChain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
