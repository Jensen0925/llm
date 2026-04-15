import fs from 'node:fs/promises';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const workspaceRoot = path.resolve(process.cwd(), 'workspace');

function safePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/');

  if (!normalized || path.isAbsolute(normalized)) {
    throw new Error('路径必须是 workspace/ 下的相对路径');
  }

  const resolved = path.resolve(workspaceRoot, normalized);
  const relativeToRoot = path.relative(workspaceRoot, resolved);

  if (
    relativeToRoot.startsWith('..') ||
    path.isAbsolute(relativeToRoot) ||
    normalized.startsWith('../')
  ) {
    throw new Error('禁止访问 workspace/ 目录外的文件');
  }

  return resolved;
}

async function readWorkspaceFile(relativePath: string) {
  const filePath = safePath(relativePath);
  return fs.readFile(filePath, 'utf8');
}

async function writeWorkspaceFile(relativePath: string, content: string) {
  const filePath = safePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

export const queryOrderTool = tool(
  async ({ orderId }: { orderId: string }) => {
    const relativePath = path.posix.join('orders', `${orderId}.json`);
    const content = await readWorkspaceFile(relativePath);

    return {
      orderId,
      path: relativePath,
      order: JSON.parse(content),
    };
  },
  {
    name: 'query_order',
    description: '根据订单号查询 workspace/orders/{orderId}.json 中的订单详情',
    schema: z.object({
      orderId: z.string().min(1),
    }),
  },
);

export const queryProductTool = tool(
  async ({ productId }: { productId: string }) => {
    const relativePath = path.posix.join('products', `${productId}.json`);
    const content = await readWorkspaceFile(relativePath);

    return {
      productId,
      path: relativePath,
      product: JSON.parse(content),
    };
  },
  {
    name: 'query_product',
    description: '根据商品 ID 查询 workspace/products/{productId}.json 中的商品详情',
    schema: z.object({
      productId: z.string().min(1),
    }),
  },
);

export const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    const content = await readWorkspaceFile(filePath);

    return {
      path: filePath,
      content,
    };
  },
  {
    name: 'read_file',
    description: '读取 workspace/ 下指定相对路径文件内容，例如 policies/return-policy.md',
    schema: z.object({
      filePath: z.string().min(1),
    }),
  },
);

export const writeFileTool = tool(
  async ({ filePath, content }: { filePath: string; content: string }) => {
    const resolvedPath = await writeWorkspaceFile(filePath, content);

    return {
      path: filePath,
      bytes: Buffer.byteLength(content, 'utf8'),
      savedTo: resolvedPath,
    };
  },
  {
    name: 'write_file',
    description: '将内容写入 workspace/ 下指定相对路径文件，例如 tickets/report.md',
    schema: z.object({
      filePath: z.string().min(1),
      content: z.string(),
    }),
  },
);

export const businessTools = [
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
] as const;

export { safePath, workspaceRoot };
