import { AIMessage } from '@langchain/core/messages';
import { createChatModel } from '../model.factory';
import { FilesystemService } from './filesystem.service';

jest.mock('../model.factory', () => ({
  createChatModel: jest.fn(),
}));

describe('FilesystemService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('runs tool loop until final answer is produced', async () => {
    const invoke = jest
      .fn()
      .mockResolvedValueOnce(
        new AIMessage({
          content: '',
          tool_calls: [
            {
              id: 'tool-1',
              name: 'query_order',
              args: {
                orderId: 'EC20240315001',
              },
            },
            {
              id: 'tool-2',
              name: 'read_file',
              args: {
                filePath: 'policies/return-policy.md',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        new AIMessage('订单 EC20240315001 在退货期内，可按政策申请退货。'),
      );

    (createChatModel as jest.Mock).mockReturnValue({
      bindTools: jest.fn(() => ({ invoke })),
    });

    const service = new FilesystemService();
    const result = await service.fileChat('查询订单 EC20240315001 的详情');

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      result: '订单 EC20240315001 在退货期内，可按政策申请退货。',
      toolCalls: [],
    });
  });
});
