import { ChatOpenAI } from '@langchain/openai';
import {
  loadLangChainConfig,
  getApiKeys,
} from '../config/load-langchain-config';

function getModelKwargs(model: string, modelKwargs?: Record<string, unknown>) {
  if (!model.toLowerCase().startsWith('glm-')) {
    return modelKwargs;
  }

  const chatTemplateKwargs =
    typeof modelKwargs?.chat_template_kwargs === 'object' &&
    modelKwargs.chat_template_kwargs !== null
      ? modelKwargs.chat_template_kwargs
      : {};

  const thinking =
    typeof modelKwargs?.thinking === 'object' && modelKwargs.thinking !== null
      ? modelKwargs.thinking
      : {};

  return {
    ...modelKwargs,
    chat_template_kwargs: {
      ...chatTemplateKwargs,
      enable_thinking: false,
    },
    thinking: {
      ...thinking,
      type: 'disabled',
    },
  };
}

export function createChatModel() {
  const config = loadLangChainConfig();
  const keys = getApiKeys();

  return new ChatOpenAI({
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    timeout: config.llm.timeout,
    streaming: config.llm.streaming,
    modelKwargs: getModelKwargs(config.llm.model, config.llm.modelKwargs),
    openAIApiKey: keys.openaiApiKey,
    configuration: keys.openaiBaseUrl
      ? { baseURL: keys.openaiBaseUrl }
      : undefined,
  });
}
