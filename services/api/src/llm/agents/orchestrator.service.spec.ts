const mockExtractAgent = { invoke: jest.fn() };
const mockPolicyCheckAgent = { invoke: jest.fn() };
const mockRiskReviewAgent = { invoke: jest.fn() };
const mockQaAgent = { invoke: jest.fn() };
const mockSummaryAgent = { invoke: jest.fn() };

jest.mock('./sub-agents', () => ({
  createSubAgents: jest.fn(() => ({
    extractAgent: mockExtractAgent,
    policyCheckAgent: mockPolicyCheckAgent,
    riskReviewAgent: mockRiskReviewAgent,
    qaAgent: mockQaAgent,
    summaryAgent: mockSummaryAgent,
  })),
}));

import { OrchestratorService } from './orchestrator.service';

const SAMPLE_INPUT =
  '我买的蓝牙耳机降噪效果不好，订单号 EC20240315001，昨天收到还没拆封，想退货';

describe('OrchestratorService', () => {
  let service: OrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrchestratorService();
  });

  it('runs the fixed workflow and returns a final report', async () => {
    mockExtractAgent.invoke.mockResolvedValue(
      JSON.stringify({
        orderId: 'EC20240315001',
        productId: null,
        requestType: '退货',
        receivedDate: '昨天',
        isUnopened: true,
      }),
    );
    mockPolicyCheckAgent.invoke.mockResolvedValue(
      JSON.stringify({
        eligibleForReturn: true,
        refundDecision: 'full_refund_after_return',
        policyBasis: ['订单在 7 天退货时效内', '商品未拆封', '订单详情标记可退货'],
        decision: '符合退货条件，可进入退货退款流程。',
        nextAction: '创建退货工单并等待仓库收货后退款。',
      }),
    );
    mockRiskReviewAgent.invoke.mockResolvedValue(
      JSON.stringify({
        riskLevel: 'medium',
        risks: ['用户口述“昨天收到”与订单记录 deliveryDate 存在 2 天差异'],
        conflicts: ['收货时间表述与订单履约记录不一致'],
        missingInformation: [],
      }),
    );
    mockQaAgent.invoke.mockResolvedValue(
      JSON.stringify({
        acceptanceCriteria: [
          'Given 订单号 EC20240315001 存在且商品未拆封 When 客服发起退货审核 Then 系统应判定可进入退货流程。',
        ],
      }),
    );
    mockSummaryAgent.invoke.mockResolvedValue(
      '最终判断：建议通过退货申请，并提示仓库签收后原路退款。',
    );

    const result = await service.orchestrate(SAMPLE_INPUT);

    expect(result).toMatchObject({
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
      report: '最终判断：建议通过退货申请，并提示仓库签收后原路退款。',
    });
    expect(result.steps).toHaveLength(5);
    expect(result.steps.map((step) => step.status)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
    ]);
    expect(mockPolicyCheckAgent.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedJson: expect.stringContaining('"productId": "BT-1001"'),
        orderJson: expect.stringContaining('"eligibleForReturn": true'),
        returnPolicy: expect.stringContaining('退货政策'),
      }),
    );
    expect(mockPolicyCheckAgent.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedJson: expect.stringContaining('"receivedDate": "2024-03-20"'),
      }),
    );
    expect(mockRiskReviewAgent.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        productJson: expect.stringContaining('"supportsReturn": true'),
      }),
    );
    expect(mockSummaryAgent.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        qaJson: expect.stringContaining('Given 订单号 EC20240315001'),
      }),
    );
  });

  it('returns clarification questions when key fields are missing', async () => {
    mockExtractAgent.invoke.mockResolvedValue(
      JSON.stringify({
        orderId: null,
        productId: null,
        requestType: 'return',
        receivedDate: null,
        isUnopened: null,
      }),
    );

    const result = await service.orchestrate('耳机效果一般，想退货');

    expect(result).toEqual({
      mode: 'clarification',
      clarificationQuestions: [
        '请提供订单号，便于核对商品与签收时间。',
        '请提供签收或收货日期，便于判断是否仍在退货时效内。',
        '请确认商品目前是否未拆封、未使用。',
      ],
      usedAgents: ['extractAgent'],
      fallback: null,
      steps: [
        expect.objectContaining({
          agent: 'extractAgent',
          status: 'completed',
        }),
        {
          agent: 'policyCheckAgent',
          status: 'skipped',
          output: '等待用户补充关键信息',
        },
        {
          agent: 'riskReviewAgent',
          status: 'skipped',
          output: '等待用户补充关键信息',
        },
        {
          agent: 'qaAgent',
          status: 'skipped',
          output: '等待用户补充关键信息',
        },
        {
          agent: 'summaryAgent',
          status: 'skipped',
          output: '等待用户补充关键信息',
        },
      ],
      report: null,
    });
    expect(mockPolicyCheckAgent.invoke).not.toHaveBeenCalled();
    expect(mockRiskReviewAgent.invoke).not.toHaveBeenCalled();
    expect(mockQaAgent.invoke).not.toHaveBeenCalled();
    expect(mockSummaryAgent.invoke).not.toHaveBeenCalled();
  });

  it('falls back to manual review when an agent fails', async () => {
    mockExtractAgent.invoke.mockRejectedValue(new Error('model timeout'));

    const result = await service.orchestrate(SAMPLE_INPUT);

    expect(result.mode).toBe('fallback');
    expect(result.fallback).toBe('manual_review');
    expect(result.report).toBe('自动编排失败，建议转人工审核。');
    expect(result.steps).toEqual([
      {
        agent: 'extractAgent',
        status: 'failed',
        output: 'model timeout',
      },
      {
        agent: 'policyCheckAgent',
        status: 'skipped',
        output: 'model timeout',
      },
      {
        agent: 'riskReviewAgent',
        status: 'skipped',
        output: 'model timeout',
      },
      {
        agent: 'qaAgent',
        status: 'skipped',
        output: 'model timeout',
      },
      {
        agent: 'summaryAgent',
        status: 'skipped',
        output: 'model timeout',
      },
    ]);
  });
});
