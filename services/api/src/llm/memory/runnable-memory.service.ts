import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { AIMessage, HumanMessage, trimMessages } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableLambda, RunnableWithMessageHistory } from '@langchain/core/runnables';
import { createChatModel } from '../model.factory';

type MemoryChatInput = {
  input: string;
};

type MemoryPromptInput = MemoryChatInput & {
  history: BaseMessage[];
};

const MEMORY_MAX_TOKENS = 2000;
const MEMORY_TRIM_STRATEGY = 'last';
const MEMORY_MESSAGE_OVERHEAD = 20;

function getMessageText(message: BaseMessage): string {
  return message.text.trim();
}

function countMessageTokens(messages: BaseMessage[]): number {
  return messages.reduce((total, message) => {
    const text = getMessageText(message);
    return total + MEMORY_MESSAGE_OVERHEAD + text.length;
  }, 0);
}

@Injectable()
export class RunnableMemoryService {
  private readonly store = new Map<string, InMemoryChatMessageHistory>();
  private readonly model = createChatModel();

  private readonly prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      [
        '你是一名电商客服助手。',
        '请结合历史对话理解用户上下文，优先围绕订单、退货、退款、售后流程回答。',
        '如果用户补充了订单号、商品问题或诉求，请在回复中主动利用这些历史信息。',
      ].join(''),
    ],
    new MessagesPlaceholder('history'),
    ['human', '{input}'],
  ]);

  private readonly trimHistoryRunnable = RunnableLambda.from(
    async ({ history }: MemoryPromptInput) =>
      trimMessages(history, {
        maxTokens: MEMORY_MAX_TOKENS,
        tokenCounter: countMessageTokens,
        strategy: MEMORY_TRIM_STRATEGY,
      }),
  );

  private readonly chain = this.prompt.pipe(this.model);

  private readonly trimmedChain = RunnableLambda.from(
    async (input: MemoryPromptInput) => ({
      ...input,
      history: await this.trimHistoryRunnable.invoke(input),
    }),
  )
    .pipe(this.prompt)
    .pipe(this.model);

  private readonly getSessionHistory = (sessionId: string) => {
    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, new InMemoryChatMessageHistory());
    }

    return this.store.get(sessionId)!;
  };

  private readonly withHistory = new RunnableWithMessageHistory<
    MemoryChatInput,
    AIMessage
  >({
    runnable: this.chain,
    getMessageHistory: this.getSessionHistory,
    inputMessagesKey: 'input',
    historyMessagesKey: 'history',
  });

  private readonly withTrimmedHistory = new RunnableWithMessageHistory<
    MemoryChatInput,
    AIMessage
  >({
    runnable: this.trimmedChain,
    getMessageHistory: this.getSessionHistory,
    inputMessagesKey: 'input',
    historyMessagesKey: 'history',
  });

  async chat(sessionId: string, input: string): Promise<{ response: string }> {
    const response = await this.withTrimmedHistory.invoke(
      { input },
      { configurable: { sessionId } },
    );
    const text = getMessageText(response);

    if (!text) {
      throw new InternalServerErrorException(
        '模型返回了空 content。请检查模型兼容接口配置或重启服务后重试。',
      );
    }

    return { response: text };
  }

  async getHistory(sessionId: string): Promise<BaseMessage[]> {
    return this.getSessionHistory(sessionId).getMessages();
  }

  async appendMessage(sessionId: string, human: string, ai: string) {
    const history = this.getSessionHistory(sessionId);
    await history.addMessages([new HumanMessage(human), new AIMessage(ai)]);
  }

  clearSession(sessionId: string) {
    this.store.delete(sessionId);
  }

  async chatWithoutTrim(
    sessionId: string,
    input: string,
  ): Promise<{ response: string }> {
    const response = await this.withHistory.invoke(
      { input },
      { configurable: { sessionId } },
    );

    return { response: getMessageText(response) };
  }
}
