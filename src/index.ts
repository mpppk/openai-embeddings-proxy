import { Hono } from "hono";
import {
  EmbeddingRequestBody,
  newEmbeddingResponse,
  newResponseHeaders,
  OpenAIEmbeddingResponse,
  OpenAIEmbeddingResponseData,
  setHeaders,
} from "./reqres";
import { EmbeddingsStore } from "./EmbeddingsStore";
import { EMBEDDING_ENDPOINT, fetchEmbedding } from "./openai";
import { toPrettyJson } from "./lib";

const app = new Hono();

const toResponseDataList = (
  embeddings: number[][]
): OpenAIEmbeddingResponseData[] => {
  return embeddings.map((embedding, index) => ({
    object: "embedding",
    embedding: embedding,
    index,
  }));
};

app.post(EMBEDDING_ENDPOINT, async (c) => {
  const requestBody = await c.req.json<EmbeddingRequestBody>();
  const inputs = Array.isArray(requestBody.input)
    ? requestBody.input
    : [requestBody.input];
  const { store, cacheHitInputs, noCacheInputs } = await EmbeddingsStore.new(
    inputs,
    c.env?.OPENAI_CACHE as any
  );

  if (store.isFullyCached) {
    const body = toPrettyJson(newEmbeddingResponse(store.embeddings));
    const res = new Response(body);
    setHeaders(res, newResponseHeaders(cacheHitInputs.length));
    return res;
  }

  const res = await fetchEmbedding(requestBody, c.req.headers, noCacheInputs);
  if (res.status !== 200) {
    return res;
  }

  let body: OpenAIEmbeddingResponse = await res.json();
  await store.addEmbeddings(
    noCacheInputs,
    body.data.map((d) => d.embedding)
  );
  body.data = toResponseDataList(store.embeddings);

  const newRes = new Response(toPrettyJson(body), res);
  setHeaders(newRes, newResponseHeaders(cacheHitInputs.length));
  return newRes;
});

export default app;
