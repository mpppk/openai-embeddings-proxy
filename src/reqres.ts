const proxyCacheHitNumHeaderKey = "proxy-cache-hit-num";

export interface EmbeddingRequestBody {
  input: string | string[];
  model: string;
  user?: string;
}

export interface OpenAIEmbeddingResponse {
  object: "list"; // FIXME: 他にどんな値がある?
  data: Array<OpenAIEmbeddingResponseData>;
  model: "text-embedding-ada-002"; // FIXME: 他のモデル追加
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIEmbeddingResponseData {
  object: "embedding";
  embedding: number[];
  index: number;
}

export const newEmbeddingResponse = (
  embeddings: number[][]
): OpenAIEmbeddingResponse => ({
  object: "list",
  data: embeddings.map((embedding, index) => ({
    object: "embedding",
    embedding,
    index,
  })),
  model: "text-embedding-ada-002", // FIXME
  usage: {
    prompt_tokens: 0,
    total_tokens: 0,
  },
});

export const newResponseHeaders = (cacheHitNum: number) => {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    [proxyCacheHitNumHeaderKey]: cacheHitNum.toString(),
  };
};
