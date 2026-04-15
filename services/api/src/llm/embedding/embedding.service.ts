import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { env as transformersEnv } from '@huggingface/transformers';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';

const EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const API_ROOT = resolve(
  process.cwd(),
  process.cwd().endsWith(join('services', 'api')) ? '.' : 'services/api',
);
const REQUIRED_MODEL_FILES = [
  'config.json',
  'tokenizer.json',
  'onnx/model_quantized.onnx',
];
const LOCAL_MODEL_DIR_NAMES = ['models', 'models-runtime', 'models-runtime-http'];

function hasRequiredModelFiles(modelPath: string) {
  return REQUIRED_MODEL_FILES.every((file) =>
    existsSync(resolve(modelPath, file)),
  );
}

function resolveLocalModelsRoot() {
  const override = process.env.HF_LOCAL_MODEL_ROOT?.trim();

  if (override) {
    return resolve(API_ROOT, override);
  }

  const candidateRoots = LOCAL_MODEL_DIR_NAMES.map((dirName) =>
    resolve(API_ROOT, dirName),
  );

  return (
    candidateRoots.find((root) =>
      hasRequiredModelFiles(resolve(root, EMBEDDING_MODEL)),
    ) ?? candidateRoots[0]
  );
}

const LOCAL_MODELS_ROOT = resolveLocalModelsRoot();
const LOCAL_EMBEDDING_MODEL_PATH = resolve(LOCAL_MODELS_ROOT, EMBEDDING_MODEL);

function configureTransformersEnv() {
  transformersEnv.allowLocalModels = true;
  transformersEnv.allowRemoteModels = false;
  transformersEnv.localModelPath = LOCAL_MODELS_ROOT;
}

function assertLocalEmbeddingModel() {
  const missingFiles = REQUIRED_MODEL_FILES.filter((file) => {
    return !existsSync(resolve(LOCAL_EMBEDDING_MODEL_PATH, file));
  });

  if (missingFiles.length === 0) {
    return;
  }

  throw new Error(
    `Missing local embedding model files in "${LOCAL_EMBEDDING_MODEL_PATH}": ${missingFiles.join(', ')}. ` +
      `Download with: hf download ${EMBEDDING_MODEL} --local-dir ${LOCAL_EMBEDDING_MODEL_PATH}`,
  );
}

function createEmbeddings() {
  configureTransformersEnv();
  assertLocalEmbeddingModel();

  return new HuggingFaceTransformersEmbeddings({
    model: EMBEDDING_MODEL,
    pretrainedOptions: {
      local_files_only: true,
    },
  });
}

@Injectable()
export class EmbeddingService {
  private readonly embeddings = createEmbeddings();

  embedQuery(text: string) {
    return this.embeddings.embedQuery(text);
  }

  embedDocuments(documents: string[]) {
    return this.embeddings.embedDocuments(documents);
  }
}

export { EMBEDDING_MODEL, LOCAL_EMBEDDING_MODEL_PATH, LOCAL_MODELS_ROOT };
