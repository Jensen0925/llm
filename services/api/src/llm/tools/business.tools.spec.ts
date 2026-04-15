import fs from 'node:fs/promises';
import path from 'node:path';
import {
  queryOrderTool,
  queryProductTool,
  readFileTool,
  safePath,
  workspaceRoot,
  writeFileTool,
} from './business.tools';

describe('business.tools', () => {
  afterEach(async () => {
    await fs.rm(path.join(workspaceRoot, 'tickets', 'tool-test.md'), {
      force: true,
    });
  });

  it('reads order and product files from workspace', async () => {
    await expect(
      queryOrderTool.invoke({ orderId: 'EC20240315001' }),
    ).resolves.toMatchObject({
      orderId: 'EC20240315001',
      path: 'orders/EC20240315001.json',
      order: expect.objectContaining({
        productId: 'BT-1001',
        eligibleForReturn: true,
      }),
    });

    await expect(queryProductTool.invoke({ productId: 'BT-1001' })).resolves
      .toMatchObject({
        productId: 'BT-1001',
        path: 'products/BT-1001.json',
        product: expect.objectContaining({
          supportsReturn: true,
        }),
      });
  });

  it('reads and writes files inside workspace only', async () => {
    await expect(
      readFileTool.invoke({ filePath: 'policies/return-policy.md' }),
    ).resolves.toMatchObject({
      path: 'policies/return-policy.md',
      content: expect.stringContaining('退货政策'),
    });

    await expect(
      writeFileTool.invoke({
        filePath: 'tickets/tool-test.md',
        content: '退货判断：订单仍在 7 天时效内，可申请退货。',
      }),
    ).resolves.toMatchObject({
      path: 'tickets/tool-test.md',
      bytes: expect.any(Number),
    });

    await expect(
      fs.readFile(path.join(workspaceRoot, 'tickets', 'tool-test.md'), 'utf8'),
    ).resolves.toBe('退货判断：订单仍在 7 天时效内，可申请退货。');
  });

  it('blocks path traversal outside workspace', () => {
    expect(() => safePath('../secrets.txt')).toThrow(
      '禁止访问 workspace/ 目录外的文件',
    );
  });
});
