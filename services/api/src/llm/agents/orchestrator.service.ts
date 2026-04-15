import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  queryOrderTool,
  queryProductTool,
  readFileTool,
} from '../tools/business.tools';
import { createSubAgents, type SubAgents } from './sub-agents';

const AGENT_NAMES = [
  'extractAgent',
  'policyCheckAgent',
  'riskReviewAgent',
  'qaAgent',
  'summaryAgent',
] as const;

type AgentName = (typeof AGENT_NAMES)[number];
type WorkflowMode = 'fixed_workflow' | 'clarification' | 'fallback';
type WorkflowStepStatus = 'completed' | 'skipped' | 'failed';

type JsonRecord = Record<string, unknown>;

interface WorkflowStep {
  agent: AgentName;
  status: WorkflowStepStatus;
  output: unknown;
}

const nullableTrimmedString = z.preprocess((value) => {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}, z.string().nullable());

const nullableBoolean = z.preprocess((value) => {
  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (
      ['true', 'yes', 'y', '是', '未拆封', '未开封', '未使用'].includes(
        normalized,
      )
    ) {
      return true;
    }

    if (
      ['false', 'no', 'n', '否', '已拆封', '已开封', '已使用'].includes(
        normalized,
      )
    ) {
      return false;
    }
  }

  return null;
}, z.boolean().nullable());

type ExtractResult = {
  orderId: string | null;
  productId: string | null;
  requestType: string | null;
  receivedDate: string | null;
  isUnopened: boolean | null;
};

const extractResultSchema = z.object({
  orderId: nullableTrimmedString,
  productId: nullableTrimmedString,
  requestType: nullableTrimmedString,
  receivedDate: nullableTrimmedString,
  isUnopened: nullableBoolean,
});

type PolicyCheckResult = {
  eligibleForReturn: boolean;
  refundDecision: string;
  policyBasis: string[];
  decision: string;
  nextAction: string;
};

const policyCheckResultSchema = z.object({
  eligibleForReturn: z.boolean(),
  refundDecision: z.string(),
  policyBasis: z.array(z.string()),
  decision: z.string(),
  nextAction: z.string(),
});

type RiskReviewResult = {
  riskLevel: string;
  risks: string[];
  conflicts: string[];
  missingInformation: string[];
};

const riskReviewResultSchema = z.object({
  riskLevel: z.string(),
  risks: z.array(z.string()),
  conflicts: z.array(z.string()),
  missingInformation: z.array(z.string()),
});

type QaResult = {
  acceptanceCriteria: string[];
};

const qaResultSchema = z.object({
  acceptanceCriteria: z.array(z.string()),
});

interface OrchestrationResult {
  mode: WorkflowMode;
  clarificationQuestions: string[];
  usedAgents: AgentName[];
  fallback: 'manual_review' | null;
  steps: WorkflowStep[];
  report: string | null;
}

interface OrderContext {
  orderId: string;
  userId: string;
  productId: string;
  productName: string;
  status: string;
  purchaseDate: string;
  deliveryDate: string;
  amount: number;
  currency: string;
  returnWindowDays: number;
  currentDate: string;
  issue: string;
  eligibleForReturn: boolean;
}

interface ProductContext {
  productId: string;
  name: string;
  category: string;
  supportsReturn: boolean;
  warrantyMonths: number;
  description: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function stripCodeFence(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function parseJsonObject<T>(
  raw: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): T {
  const normalized = stripCodeFence(raw);
  const parsed = JSON.parse(normalized) as JsonRecord;
  return schema.parse(parsed);
}

function normalizeRequestType(requestType: string | null) {
  if (!requestType) {
    return null;
  }

  const normalized = requestType.trim().toLowerCase();

  if (normalized.includes('退货') || normalized === 'return') {
    return 'return';
  }

  if (normalized.includes('退款') || normalized === 'refund') {
    return 'refund';
  }

  if (normalized.includes('换货') || normalized === 'exchange') {
    return 'exchange';
  }

  return normalized === 'other' ? 'other' : 'other';
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDays(referenceDate: string, deltaDays: number) {
  const date = new Date(`${referenceDate}T12:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return formatLocalDate(date);
}

function resolveRelativeDate(
  receivedDate: string | null,
  referenceDate: string | null,
) {
  if (!receivedDate) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
    return receivedDate;
  }

  if (!referenceDate) {
    return receivedDate;
  }

  const normalized = receivedDate.trim();

  if (normalized === '今天') {
    return referenceDate;
  }

  if (normalized === '昨天') {
    return shiftDays(referenceDate, -1);
  }

  if (normalized === '前天') {
    return shiftDays(referenceDate, -2);
  }

  return receivedDate;
}

function buildSkippedSteps(
  reason: string,
  agents: readonly AgentName[],
  existingSteps: WorkflowStep[],
) {
  const completed = new Set(existingSteps.map((step) => step.agent));
  return agents
    .filter((agent) => !completed.has(agent))
    .map((agent) => ({
      agent,
      status: 'skipped' as const,
      output: reason,
    }));
}

@Injectable()
export class OrchestratorService {
  private readonly agents: SubAgents = createSubAgents();

  async orchestrate(input: string): Promise<OrchestrationResult> {
    const usedAgents: AgentName[] = [];
    const steps: WorkflowStep[] = [];

    try {
      usedAgents.push('extractAgent');
      const extractRaw = await this.agents.extractAgent.invoke({ input });
      const extracted = parseJsonObject(
        extractRaw,
        extractResultSchema,
      ) as ExtractResult;

      const order = await this.loadOrder(extracted.orderId);
      const enrichedExtracted = {
        ...extracted,
        productId: extracted.productId ?? order?.productId ?? null,
        requestType: normalizeRequestType(extracted.requestType),
        receivedDate: resolveRelativeDate(
          extracted.receivedDate ?? order?.deliveryDate ?? null,
          order?.currentDate ?? null,
        ),
      };

      steps.push({
        agent: 'extractAgent',
        status: 'completed',
        output: {
          ...enrichedExtracted,
          orderFound: Boolean(order),
        },
      });

      const clarificationQuestions = this.buildClarificationQuestions(
        enrichedExtracted,
        order,
      );

      if (clarificationQuestions.length > 0) {
        steps.push(
          ...buildSkippedSteps(
            '等待用户补充关键信息',
            AGENT_NAMES.slice(1),
            steps,
          ),
        );

        return {
          mode: 'clarification',
          clarificationQuestions,
          usedAgents,
          fallback: null,
          steps,
          report: null,
        };
      }

      const product = await this.loadProduct(enrichedExtracted.productId);
      const { returnPolicy, refundPolicy } = await this.loadPolicies();
      const sharedAgentInput = {
        input,
        extractedJson: stringifyJson(enrichedExtracted),
        orderJson: stringifyJson(order),
        productJson: stringifyJson(product),
        returnPolicy,
        refundPolicy,
      };

      usedAgents.push('policyCheckAgent', 'riskReviewAgent');
      const [policyResult, riskResult] = await Promise.allSettled([
        this.agents.policyCheckAgent.invoke(sharedAgentInput),
        this.agents.riskReviewAgent.invoke(sharedAgentInput),
      ]);

      const policyCheck = this.resolveSettledJsonStep(
        'policyCheckAgent',
        policyResult,
        policyCheckResultSchema,
        steps,
      );
      const riskReview = this.resolveSettledJsonStep(
        'riskReviewAgent',
        riskResult,
        riskReviewResultSchema,
        steps,
      );

      usedAgents.push('qaAgent');
      const qaRaw = await this.agents.qaAgent.invoke({
        extractedJson: stringifyJson(enrichedExtracted),
        policyCheckJson: stringifyJson(policyCheck),
        riskReviewJson: stringifyJson(riskReview),
      });
      const qa = parseJsonObject(qaRaw, qaResultSchema) as QaResult;
      steps.push({
        agent: 'qaAgent',
        status: 'completed',
        output: qa,
      });

      usedAgents.push('summaryAgent');
      const report = await this.agents.summaryAgent.invoke({
        input,
        extractedJson: stringifyJson(enrichedExtracted),
        policyCheckJson: stringifyJson(policyCheck),
        riskReviewJson: stringifyJson(riskReview),
        qaJson: stringifyJson(qa),
      });
      steps.push({
        agent: 'summaryAgent',
        status: 'completed',
        output: report,
      });

      return {
        mode: 'fixed_workflow',
        clarificationQuestions: [],
        usedAgents,
        fallback: null,
        steps,
        report,
      };
    } catch (error) {
      const message = getErrorMessage(error);

      if (steps.length === 0) {
        steps.push({
          agent: 'extractAgent',
          status: 'failed',
          output: message,
        });
      }

      steps.push(...buildSkippedSteps(message, AGENT_NAMES, steps));

      return {
        mode: 'fallback',
        clarificationQuestions: [],
        usedAgents,
        fallback: 'manual_review',
        steps,
        report: '自动编排失败，建议转人工审核。',
      };
    }
  }

  private resolveSettledJsonStep<T>(
    agent: AgentName,
    settledResult: PromiseSettledResult<string>,
    schema: z.ZodSchema<T>,
    steps: WorkflowStep[],
  ) {
    if (settledResult.status === 'rejected') {
      const message = getErrorMessage(settledResult.reason);
      steps.push({
        agent,
        status: 'failed',
        output: message,
      });
      throw new Error(`${agent} failed: ${message}`);
    }

    const parsed = parseJsonObject(settledResult.value, schema) as T;
    steps.push({
      agent,
      status: 'completed',
      output: parsed,
    });
    return parsed;
  }

  private buildClarificationQuestions(
    extracted: ExtractResult,
    order: OrderContext | null,
  ) {
    const questions: string[] = [];

    if (!extracted.orderId) {
      questions.push('请提供订单号，便于核对商品与签收时间。');
    } else if (!order && !extracted.productId) {
      questions.push(`未查询到订单 ${extracted.orderId}，请确认订单号或补充商品 ID。`);
    }

    if (!extracted.productId && extracted.orderId && order) {
      questions.push('请补充商品 ID，便于核对具体售后政策。');
    }

    if (!extracted.requestType) {
      questions.push('请确认你的诉求是退货、退款还是换货。');
    }

    if (!extracted.receivedDate) {
      questions.push('请提供签收或收货日期，便于判断是否仍在退货时效内。');
    }

    if (extracted.isUnopened === null) {
      questions.push('请确认商品目前是否未拆封、未使用。');
    }

    return questions;
  }

  private async loadOrder(orderId: string | null) {
    if (!orderId) {
      return null;
    }

    try {
      const result = await queryOrderTool.invoke({ orderId });
      return result.order as OrderContext;
    } catch {
      return null;
    }
  }

  private async loadProduct(productId: string | null) {
    if (!productId) {
      return null;
    }

    try {
      const result = await queryProductTool.invoke({ productId });
      return result.product as ProductContext;
    } catch {
      return null;
    }
  }

  private async loadPolicies() {
    const [returnPolicyResult, refundPolicyResult] = await Promise.all([
      readFileTool.invoke({ filePath: 'policies/return-policy.md' }),
      readFileTool.invoke({ filePath: 'policies/refund-policy.md' }),
    ]);

    return {
      returnPolicy: returnPolicyResult.content,
      refundPolicy: refundPolicyResult.content,
    };
  }
}

export type { OrchestrationResult, WorkflowStep, AgentName };
