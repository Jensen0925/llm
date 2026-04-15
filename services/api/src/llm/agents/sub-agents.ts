import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createChatModel } from '../model.factory';

function buildStringAgent(
  model: ReturnType<typeof createChatModel>,
  systemPrompt: string,
  humanPrompt: string,
) {
  return ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', humanPrompt],
  ])
    .pipe(model)
    .pipe(new StringOutputParser());
}

const EXTRACT_AGENT_SYSTEM_PROMPT = [
  '你是电商客服退货咨询的结构化抽取专员。',
  '你只能根据客服对话中已经出现的信息做抽取，不要编造不存在的字段。',
  '如果字段缺失，请返回 null；如果日期是“昨天/今天/前天”这类相对表达且缺少参考日期，请保留原始表达。',
  'requestType 只能输出 return、refund、exchange、other 之一。',
  '最终只输出 JSON，不要输出 Markdown、解释或代码块。',
].join('\n');

const EXTRACT_AGENT_HUMAN_PROMPT = [
  '请从下面客服对话中抽取 orderId、productId、requestType、receivedDate、isUnopened。',
  '',
  '客服对话：',
  '{input}',
  '',
  '输出 JSON 格式：',
  '{{',
  '  "orderId": "string | null",',
  '  "productId": "string | null",',
  '  "requestType": "return | refund | exchange | other | null",',
  '  "receivedDate": "string | null",',
  '  "isUnopened": "boolean | null"',
  '}}',
].join('\n');

const POLICY_CHECK_AGENT_SYSTEM_PROMPT = [
  '你是电商客服退货与退款政策核对专员。',
  '请综合退货政策、退款政策、订单信息、商品信息与抽取结果，判断是否符合退货条件。',
  '只能使用输入中给出的事实；若事实不足，请明确指出需要人工审核。',
  '最终只输出 JSON，不要输出 Markdown、解释或代码块。',
].join('\n');

const POLICY_CHECK_AGENT_HUMAN_PROMPT = [
  '请根据以下信息核对退货与退款政策，判断是否符合退货条件。',
  '',
  '原始客服对话：',
  '{input}',
  '',
  '结构化抽取结果：',
  '{extractedJson}',
  '',
  '订单信息：',
  '{orderJson}',
  '',
  '商品信息：',
  '{productJson}',
  '',
  '退货政策：',
  '{returnPolicy}',
  '',
  '退款政策：',
  '{refundPolicy}',
  '',
  '输出 JSON 格式：',
  '{{',
  '  "eligibleForReturn": true,',
  '  "refundDecision": "full_refund_after_return | partial_refund | not_applicable | manual_review",',
  '  "policyBasis": ["string"],',
  '  "decision": "string",',
  '  "nextAction": "string"',
  '}}',
].join('\n');

const RISK_REVIEW_AGENT_SYSTEM_PROMPT = [
  '你是电商客服退货咨询的风险审查专员。',
  '你的任务是识别歧义、冲突、缺失信息与需要人工复核的风险点。',
  '若没有明显风险，也要说明为什么风险较低。',
  '最终只输出 JSON，不要输出 Markdown、解释或代码块。',
].join('\n');

const RISK_REVIEW_AGENT_HUMAN_PROMPT = [
  '请审查以下退货咨询信息，识别歧义、冲突、缺失信息与风险点。',
  '',
  '原始客服对话：',
  '{input}',
  '',
  '结构化抽取结果：',
  '{extractedJson}',
  '',
  '订单信息：',
  '{orderJson}',
  '',
  '商品信息：',
  '{productJson}',
  '',
  '退货政策：',
  '{returnPolicy}',
  '',
  '退款政策：',
  '{refundPolicy}',
  '',
  '输出 JSON 格式：',
  '{{',
  '  "riskLevel": "low | medium | high",',
  '  "risks": ["string"],',
  '  "conflicts": ["string"],',
  '  "missingInformation": ["string"]',
  '}}',
].join('\n');

const QA_AGENT_SYSTEM_PROMPT = [
  '你是电商售后流程的 QA 分析专员。',
  '请根据抽取结果与政策判断，生成 Given-When-Then 格式的验收条件。',
  '每一条都要完整、可测试、可执行。',
  '最终只输出 JSON，不要输出 Markdown、解释或代码块。',
].join('\n');

const QA_AGENT_HUMAN_PROMPT = [
  '请基于以下信息生成 Given-When-Then 格式的验收条件。',
  '',
  '结构化抽取结果：',
  '{extractedJson}',
  '',
  '政策核对结果：',
  '{policyCheckJson}',
  '',
  '风险审查结果：',
  '{riskReviewJson}',
  '',
  '输出 JSON 格式：',
  '{{',
  '  "acceptanceCriteria": [',
  '    "Given ... When ... Then ..."',
  '  ]',
  '}}',
].join('\n');

const SUMMARY_AGENT_SYSTEM_PROMPT = [
  '你是电商客服退货咨询的汇总专员。',
  '请综合所有子 Agent 的输出，生成最终退货判断报告。',
  '报告必须明确：是否建议退货、关键依据、风险点、后续动作、Given-When-Then 验收条件。',
  '请用中文输出，结构清晰，适合直接返回给业务系统。',
].join('\n');

const SUMMARY_AGENT_HUMAN_PROMPT = [
  '请汇总下面所有 Agent 输出，生成最终退货判断报告。',
  '',
  '原始客服对话：',
  '{input}',
  '',
  '结构化抽取结果：',
  '{extractedJson}',
  '',
  '政策核对结果：',
  '{policyCheckJson}',
  '',
  '风险审查结果：',
  '{riskReviewJson}',
  '',
  'QA 验收条件：',
  '{qaJson}',
].join('\n');

export function createSubAgents(model = createChatModel()) {
  return {
    extractAgent: buildStringAgent(
      model,
      EXTRACT_AGENT_SYSTEM_PROMPT,
      EXTRACT_AGENT_HUMAN_PROMPT,
    ),
    policyCheckAgent: buildStringAgent(
      model,
      POLICY_CHECK_AGENT_SYSTEM_PROMPT,
      POLICY_CHECK_AGENT_HUMAN_PROMPT,
    ),
    riskReviewAgent: buildStringAgent(
      model,
      RISK_REVIEW_AGENT_SYSTEM_PROMPT,
      RISK_REVIEW_AGENT_HUMAN_PROMPT,
    ),
    qaAgent: buildStringAgent(model, QA_AGENT_SYSTEM_PROMPT, QA_AGENT_HUMAN_PROMPT),
    summaryAgent: buildStringAgent(
      model,
      SUMMARY_AGENT_SYSTEM_PROMPT,
      SUMMARY_AGENT_HUMAN_PROMPT,
    ),
  };
}

export type SubAgents = ReturnType<typeof createSubAgents>;
