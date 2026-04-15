import { AdvancedController } from './advanced.controller';
import { AdvancedAnalysisService } from './advanced-analysis.service';

describe('AdvancedController', () => {
  let controller: AdvancedController;
  let advancedAnalysisService: jest.Mocked<AdvancedAnalysisService>;

  beforeEach(() => {
    advancedAnalysisService = {
      analyze: jest.fn(),
    } as unknown as jest.Mocked<AdvancedAnalysisService>;

    controller = new AdvancedController(advancedAnalysisService);
  });

  it('delegates analyze requests to AdvancedAnalysisService', async () => {
    advancedAnalysisService.analyze.mockResolvedValue({
      sessionId: 'session-1',
      history: [],
      analyzedInput: '上下文',
      mode: 'fixed_workflow',
      clarificationQuestions: [],
      usedAgents: ['extractAgent'],
      fallback: null,
      steps: [],
      report: '最终判断：可退货。',
      ticketPath: 'tickets/session-1.md',
      finalConclusion: '最终判断：可退货。',
    });

    await expect(
      controller.analyze({
        sessionId: 'session-1',
        input: '帮我判断一下能不能退，如果可以请告诉我下一步操作',
      }),
    ).resolves.toMatchObject({
      report: '最终判断：可退货。',
      ticketPath: 'tickets/session-1.md',
    });

    expect(advancedAnalysisService.analyze).toHaveBeenCalledWith(
      'session-1',
      '帮我判断一下能不能退，如果可以请告诉我下一步操作',
    );
  });
});
