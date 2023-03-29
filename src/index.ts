import { Hono } from "hono";
import {
  EmbeddingRequestBody,
  newEmbeddingResponse,
  newResponseHeaders,
  OpenAIEmbeddingResponse,
} from "./reqres";
import { EmbeddingsStore } from "./EmbeddingsStore";
import { EMBEDDING_ENDPOINT, fetchEmbedding } from "./openai";

const app = new Hono();

const toResponseDataList = async (embeddings: number[][]) => {
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
    return c.text(
      JSON.stringify(newEmbeddingResponse(store.embeddings), null, 2),
      200,
      newResponseHeaders(cacheHitInputs.length)
    );
  }

  const res = await fetchEmbedding(requestBody, c.req.headers, noCacheInputs);
  if (res.status !== 200) {
    return res;
  }

  const body: OpenAIEmbeddingResponse = await res.json();
  await store.addEmbeddings(
    noCacheInputs,
    body.data.map((d) => d.embedding)
  );

  return c.text(
    JSON.stringify(
      { ...body, data: await toResponseDataList(store.embeddings) },
      null,
      2
    ),
    200,
    {
      ...newResponseHeaders(cacheHitInputs.length),
      ...res.headers,
    }
  );
});

export default app;
