import { AgentsController } from './agents.controller';
import { OrchestratorService } from './orchestrator.service';

describe('AgentsController', () => {
  let controller: AgentsController;
  let orchestratorService: jest.Mocked<OrchestratorService>;

  beforeEach(() => {
    orchestratorService = {
      orchestrate: jest.fn(),
    } as unknown as jest.Mocked<OrchestratorService>;

    controller = new AgentsController(orchestratorService);
  });

  it('delegates orchestration input to OrchestratorService', async () => {
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
      steps: [],
      report: '最终判断：可退货。',
    });

    await expect(
      controller.orchestrate({
        input:
          '我买的蓝牙耳机降噪效果不好，订单号 EC20240315001，昨天收到还没拆封，想退货',
      }),
    ).resolves.toMatchObject({
      report: '最终判断：可退货。',
    });

    expect(orchestratorService.orchestrate).toHaveBeenCalledWith(
      '我买的蓝牙耳机降噪效果不好，订单号 EC20240315001，昨天收到还没拆封，想退货',
    );
  });

  it('uses empty string when request body is missing', async () => {
    orchestratorService.orchestrate.mockResolvedValue({
      mode: 'clarification',
      clarificationQuestions: ['请提供订单号。'],
      usedAgents: ['extractAgent'],
      fallback: null,
      steps: [],
      report: null,
    });

    await controller.orchestrate(undefined);

    expect(orchestratorService.orchestrate).toHaveBeenCalledWith('');
  });
});
