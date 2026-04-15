import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';
import { createChatModel } from '../model.factory';
import { RunnableMemoryService } from './runnable-memory.service';

jest.mock('../model.factory', () => ({
  createChatModel: jest.fn(),
}));

async function normalizeMessages(input: unknown): Promise<BaseMessage[]> {
  if (Array.isArray(input)) {
    return input as BaseMessage[];
  }

  if (
    input &&
    typeof input === 'object' &&
    'toChatMessages' in input &&
    typeof input.toChatMessages === 'function'
  ) {
    return input.toChatMessages();
  }

  return [];
}

describe('RunnableMemoryService', () => {
  beforeEach(() => {
    (createChatModel as jest.Mock).mockReturnValue(
      RunnableLambda.from(async (input: unknown) => {
        const messages = await normalizeMessages(input);
        const humanMessages = messages
          .filter((message) => message.getType() === 'human')
          .map((message) => message.text);

        const lastInput = humanMessages.at(-1) ?? '';

        return new AIMessage(
          `已记录用户诉求：${humanMessages.join(' | ')}；当前问题：${lastInput}`,
        );
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps multi-turn memory isolated by sessionId', async () => {
    const service = new RunnableMemoryService();

    await service.chat('s1', '我买的蓝牙耳机降噪效果不好，想退货');
    await service.chat('s1', '订单号是 EC20240315001');
    const thirdTurn = await service.chat(
      's1',
      '帮我判断一下这个订单能不能退',
    );

    const otherSession = await service.chat('s2', '我要查询别的订单');

    expect(thirdTurn.response).toContain('我买的蓝牙耳机降噪效果不好，想退货');
    expect(thirdTurn.response).toContain('订单号是 EC20240315001');
    expect(thirdTurn.response).toContain('帮我判断一下这个订单能不能退');
    expect(otherSession.response).not.toContain('EC20240315001');
  });

  it('trims old history and keeps latest context', async () => {
    const service = new RunnableMemoryService();
    const longComplaint = '蓝牙耳机问题描述'.repeat(220);

    await service.chat('s1', longComplaint);
    await service.chat('s1', '订单号是 EC20240315001');
    const thirdTurn = await service.chat(
      's1',
      '帮我判断一下这个订单能不能退',
    );

    expect(thirdTurn.response).toContain('订单号是 EC20240315001');
    expect(thirdTurn.response).toContain('帮我判断一下这个订单能不能退');
    expect(thirdTurn.response).not.toContain(longComplaint);
  });

  it('supports appendMessage, getHistory and clearSession', async () => {
    const service = new RunnableMemoryService();

    await service.appendMessage(
      's1',
      '我买的蓝牙耳机降噪效果不好，想退货',
      '您好，可以先提供订单号，我帮您判断。',
    );

    const history = await service.getHistory('s1');

    expect(history.map((message) => message.text)).toEqual([
      '我买的蓝牙耳机降噪效果不好，想退货',
      '您好，可以先提供订单号，我帮您判断。',
    ]);

    service.clearSession('s1');

    await expect(service.getHistory('s1')).resolves.toEqual([]);
  });
});
