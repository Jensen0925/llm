import { Injectable } from '@nestjs/common';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
  type ToolCall,
} from '@langchain/core/messages';
import { createChatModel } from '../model.factory';
import {
  businessTools,
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
} from '../tools/business.tools';

const FILE_ASSISTANT_PROMPT = [
  '你是一名电商客服系统的文件与业务查询助手。',
  '你可以查询订单、商品、政策文件，并在需要时写入工单或分析报告。',
  '请优先通过工具获取事实，不要编造订单、商品、政策或写入结果。',
  '当用户要求写文件时，先完成必要查询，再调用 write_file 写入最终结论。',
  '返回给用户的最终答案要简洁，包含关键判断依据和实际写入的文件路径（如果有）。',
].join('');

function getMessageText(message: BaseMessage) {
  return message.text.trim();
}

@Injectable()
export class FilesystemService {
  private readonly model = createChatModel();
  private readonly tools = [...businessTools];

  async fileChat(input: string) {
    const modelWithTools = this.model.bindTools(this.tools);
    const messages: BaseMessage[] = [
      new SystemMessage(FILE_ASSISTANT_PROMPT),
      new HumanMessage(input),
    ];

    for (let index = 0; index < 8; index += 1) {
      const response = await modelWithTools.invoke(messages);
      messages.push(response);

      const toolCalls = response.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return {
          result: getMessageText(response),
          toolCalls: [],
        };
      }

      const executedToolCalls: ToolCall[] = [];

      for (const toolCall of toolCalls) {
        if (!toolCall.id) {
          continue;
        }

        executedToolCalls.push(toolCall as ToolCall);

        try {
          const toolResult = await this.executeToolCall(toolCall);
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult, null, 2),
            }),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'tool execution failed';

          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: message }),
              status: 'error',
            }),
          );
        }
      }

      if (executedToolCalls.length === 0) {
        return {
          result: getMessageText(response),
          toolCalls: [],
        };
      }
    }

    const finalResponse = messages
      .filter((message): message is AIMessage => message instanceof AIMessage)
      .at(-1);

    return {
      result: finalResponse ? getMessageText(finalResponse) : '',
      toolCalls: [],
    };
  }

  private async executeToolCall(toolCall: ToolCall) {
    switch (toolCall.name) {
      case queryOrderTool.name:
        return queryOrderTool.invoke(toolCall);
      case queryProductTool.name:
        return queryProductTool.invoke(toolCall);
      case readFileTool.name:
        return readFileTool.invoke(toolCall);
      case writeFileTool.name:
        return writeFileTool.invoke(toolCall);
      default:
        throw new Error(`unsupported tool: ${toolCall.name}`);
    }
  }
}

export {
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
};
