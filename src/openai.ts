import { EmbeddingRequestBody } from "./reqres";

const OPENAI_HOST = "https://api.openai.com";
export const EMBEDDING_ENDPOINT = "/v1/embeddings" as const;

export const fetchEmbedding = async (
  reqBody: EmbeddingRequestBody,
  headers: Headers,
  input: string[]
) => {
  return await fetch(OPENAI_HOST + EMBEDDING_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...reqBody, input }),
  });
};
