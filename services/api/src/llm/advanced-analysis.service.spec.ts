import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { AdvancedAnalysisService } from './advanced-analysis.service';
import { OrchestratorService } from './agents/orchestrator.service';
import { FilesystemService } from './filesystem/filesystem.service';
import { RunnableMemoryService } from './memory/runnable-memory.service';

describe('AdvancedAnalysisService', () => {
  let service: AdvancedAnalysisService;
  let memoryService: jest.Mocked<RunnableMemoryService>;
  let filesystemService: jest.Mocked<FilesystemService>;
  let orchestratorService: jest.Mocked<OrchestratorService>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T12:34:56.789Z'));

    memoryService = {
      getHistory: jest.fn(),
      appendMessage: jest.fn(),
    } as unknown as jest.Mocked<RunnableMemoryService>;

    filesystemService = {
      writeWorkspaceContent: jest.fn(),
    } as unknown as jest.Mocked<FilesystemService>;

    orchestratorService = {
      orchestrate: jest.fn(),
    } as unknown as jest.Mocked<OrchestratorService>;

    service = new AdvancedAnalysisService(
      memoryService,
      filesystemService,
      orchestratorService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('combines memory context, orchestrates analysis, writes ticket, and appends conclusion', async () => {
    memoryService.getHistory.mockResolvedValue([
      new HumanMessage('我买的蓝牙耳机降噪效果不好，想退货'),
      new AIMessage('您好，请提供订单号和签收情况。'),
      new HumanMessage('订单号是 EC20240315001，昨天收到还没拆封'),
      new AIMessage('收到，请问您希望退货还是退款？'),
      new HumanMessage('想退货'),
      new AIMessage('好的，我先帮您记录。'),
    ]);

    orchestratorService.orchestrate.mockResolvedValue({
      mode: 'fixed_workflow',
      clarificationQuestions: [],
      usedAgents: [
        'extractAgent',
        'policyCheckAgent',
        'riskReviewAgent',
        'qaAgent',
        'summaryAgent',
      ],
      fallback: null,
      steps: [
        {
          agent: 'extractAgent',
          status: 'completed',
          output: { orderId: 'EC20240315001' },
        },
      ],
      report: '最终判断：订单在退货时效内且商品未拆封，建议发起退货申请并等待仓库签收后退款。',
    });

    filesystemService.writeWorkspaceContent.mockResolvedValue({
      path: 'tickets/session-1-2026-04-15T12-34-56-789Z.md',
      bytes: 123,
      savedTo: '/tmp/session-1.md',
    });

    const result = await service.analyze(
      'session-1',
      '帮我判断一下能不能退，如果可以请告诉我下一步操作',
    );

    expect(orchestratorService.orchestrate).toHaveBeenCalledWith(
      expect.stringContaining('历史对话：'),
    );
    expect(orchestratorService.orchestrate).toHaveBeenCalledWith(
      expect.stringContaining('用户: 我买的蓝牙耳机降噪效果不好，想退货'),
    );
    expect(orchestratorService.orchestrate).toHaveBeenCalledWith(
      expect.stringContaining('当前用户输入：\n帮我判断一下能不能退，如果可以请告诉我下一步操作'),
    );
    expect(filesystemService.writeWorkspaceContent).toHaveBeenCalledWith(
      'tickets/session-1-2026-04-15T12-34-56-789Z.md',
      expect.stringContaining('最终判断：订单在退货时效内且商品未拆封'),
    );
    expect(memoryService.appendMessage).toHaveBeenCalledWith(
      'session-1',
      '帮我判断一下能不能退，如果可以请告诉我下一步操作',
      '最终判断：订单在退货时效内且商品未拆封，建议发起退货申请并等待仓库签收后退款。',
    );
    expect(result).toMatchObject({
      sessionId: 'session-1',
      mode: 'fixed_workflow',
      ticketPath: 'tickets/session-1-2026-04-15T12-34-56-789Z.md',
      finalConclusion:
        '最终判断：订单在退货时效内且商品未拆封，建议发起退货申请并等待仓库签收后退款。',
    });
    expect(result.history).toHaveLength(6);
  });

  it('skips writing ticket when clarification is required but still appends final conclusion', async () => {
    memoryService.getHistory.mockResolvedValue([]);
    orchestratorService.orchestrate.mockResolvedValue({
      mode: 'clarification',
      clarificationQuestions: ['请提供订单号。', '请确认商品是否未拆封。'],
      usedAgents: ['extractAgent'],
      fallback: null,
      steps: [],
      report: null,
    });

    const result = await service.analyze('session-2', '帮我判断一下能不能退');

    expect(filesystemService.writeWorkspaceContent).not.toHaveBeenCalled();
    expect(memoryService.appendMessage).toHaveBeenCalledWith(
      'session-2',
      '帮我判断一下能不能退',
      '请提供订单号。\n请确认商品是否未拆封。',
    );
    expect(result.ticketPath).toBeNull();
    expect(result.finalConclusion).toBe('请提供订单号。\n请确认商品是否未拆封。');
  });
});
