import { Injectable } from '@nestjs/common';
import type { BaseMessage } from '@langchain/core/messages';
import { FilesystemService } from './filesystem/filesystem.service';
import { RunnableMemoryService } from './memory/runnable-memory.service';
import {
  OrchestratorService,
  type OrchestrationResult,
} from './agents/orchestrator.service';

type HistoryEntry = {
  role: string;
  content: string;
};

type AdvancedAnalysisResult = OrchestrationResult & {
  sessionId: string;
  history: HistoryEntry[];
  analyzedInput: string;
  ticketPath: string | null;
  finalConclusion: string;
};

function normalizeMessageRole(message: BaseMessage) {
  const type = message.getType();

  if (type === 'human') {
    return 'user';
  }

  if (type === 'ai') {
    return 'assistant';
  }

  return type;
}

function getMessageContent(message: BaseMessage) {
  return message.text.trim();
}

function buildHistoryEntries(history: BaseMessage[]): HistoryEntry[] {
  return history
    .map((message) => ({
      role: normalizeMessageRole(message),
      content: getMessageContent(message),
    }))
    .filter((entry) => entry.content.length > 0);
}

function buildAnalyzedInput(history: HistoryEntry[], input: string) {
  if (history.length === 0) {
    return input;
  }

  const historyBlock = history
    .map((entry) => {
      const speaker = entry.role === 'user' ? '用户' : '客服';
      return `${speaker}: ${entry.content}`;
    })
    .join('\n');

  return [
    '以下是同一会话的历史上下文，请结合历史信息理解当前问题。',
    '',
    '历史对话：',
    historyBlock,
    '',
    '当前用户输入：',
    input,
  ].join('\n');
}

function buildFinalConclusion(result: OrchestrationResult) {
  if (result.mode === 'clarification') {
    return result.clarificationQuestions.join('\n');
  }

  return result.report ?? '分析完成，但未生成可展示的结论。';
}

function createTicketFilePath(sessionId: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `tickets/${sessionId}-${timestamp}.md`;
}

function buildTicketContent(
  sessionId: string,
  input: string,
  analyzedInput: string,
  result: OrchestrationResult,
) {
  return [
    '# 分析报告',
    '',
    `- Session: ${sessionId}`,
    `- Mode: ${result.mode}`,
    `- Fallback: ${result.fallback ?? 'none'}`,
    `- Used Agents: ${result.usedAgents.join(', ') || 'none'}`,
    '',
    '## 当前输入',
    input,
    '',
    '## 分析上下文',
    analyzedInput,
    '',
    '## 最终报告',
    result.report ?? '无',
    '',
    '## 澄清问题',
    result.clarificationQuestions.length > 0
      ? result.clarificationQuestions.map((item) => `- ${item}`).join('\n')
      : '- 无',
    '',
    '## 执行步骤',
    '```json',
    JSON.stringify(result.steps, null, 2),
    '```',
    '',
  ].join('\n');
}

@Injectable()
export class AdvancedAnalysisService {
  constructor(
    private readonly memoryService: RunnableMemoryService,
    private readonly filesystemService: FilesystemService,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  async analyze(sessionId: string, input: string): Promise<AdvancedAnalysisResult> {
    const historyMessages = await this.memoryService.getHistory(sessionId);
    const history = buildHistoryEntries(historyMessages);
    const analyzedInput = buildAnalyzedInput(history, input);
    const orchestrationResult =
      await this.orchestratorService.orchestrate(analyzedInput);

    let ticketPath: string | null = null;

    if (orchestrationResult.mode !== 'clarification') {
      const filePath = createTicketFilePath(sessionId);
      const content = buildTicketContent(
        sessionId,
        input,
        analyzedInput,
        orchestrationResult,
      );
      const saved = await this.filesystemService.writeWorkspaceContent(
        filePath,
        content,
      );
      ticketPath = saved.path;
    }

    const finalConclusion = buildFinalConclusion(orchestrationResult);

    await this.memoryService.appendMessage(sessionId, input, finalConclusion);

    return {
      ...orchestrationResult,
      sessionId,
      history,
      analyzedInput,
      ticketPath,
      finalConclusion,
    };
  }
}

export type { AdvancedAnalysisResult, HistoryEntry };
