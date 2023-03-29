import { Hono } from "hono";

const app = new Hono();

const OPENAI_HOST = "https://api.openai.com";
const EMBEDDING_ENDPOINT = "/v1/embeddings" as const;
const proxyCacheHitNumHeaderKey = "proxy-cache-hit-num";

interface EmbeddingRequestBody {
  input: string | string[];
  model: string;
  user?: string;
}

interface OpenAIEmbeddingResponse {
  object: "list"; // FIXME: 他にどんな値がある?
  data: Array<OpenAIEmbeddingResponseData>;
  model: "text-embedding-ada-002"; // FIXME: 他のモデル追加
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIEmbeddingResponseData {
  object: "embedding";
  embedding: number[];
  index: number;
}

const newEmbeddingResponse = (
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

const newResponseHeaders = (cacheHitNum: number) => {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    [proxyCacheHitNumHeaderKey]: cacheHitNum.toString(),
  };
};

const newEmbeddingsMapWithCache = async (
  OPENAI_CACHE_KV: any,
  inputs: string[]
): Promise<[Map<string, string>, string[], number[]]> => {
  const embeddingsMap = new Map<string, string>();
  const noCacheInputs = [];
  const cacheHitIndices = [];
  let index = 0;
  for (const input of inputs) {
    const cache = await OPENAI_CACHE_KV.get(`embeddings:ada:${input}`, {
      type: "text",
    });
    if (cache) {
      cacheHitIndices.push(index);
      embeddingsMap.set(input, cache);
    } else {
      noCacheInputs.push(input);
    }
    index++;
  }
  return [embeddingsMap, noCacheInputs, cacheHitIndices];
};

const fetchEmbedding = async (
  reqBody: EmbeddingRequestBody,
  headers: Record<string, string>,
  input: string[]
) => {
  return await fetch(OPENAI_HOST + EMBEDDING_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...reqBody, input }),
  });
};

const toResponseDataList = async (
  inputs: string[],
  embeddingsMap: Map<string, string>
) => {
  const responseDataList: OpenAIEmbeddingResponseData[] = [];
  inputs.forEach((input, index) => {
    responseDataList.push({
      object: "embedding",
      embedding: JSON.parse(embeddingsMap.get(input)!),
      index,
    });
  });
  return responseDataList;
};

const updateAndCacheResponse = async (
  body: OpenAIEmbeddingResponse,
  inputs: string[],
  embeddingsMap: Map<string, string>,
  OPENAI_CACHE: KVNamespace
) => {
  for (const data of body.data) {
    await OPENAI_CACHE.put(
      `embeddings:ada:${inputs[data.index]}`,
      JSON.stringify(data.embedding)
    );
    embeddingsMap.set(inputs[data.index], JSON.stringify(data.embedding));
  }
};

app.post(EMBEDDING_ENDPOINT, async (c) => {
  c.req.headers;
  const Authorization = c.req.header("Authorization");
  const contentType = c.req.header("Content-Type");
  const headers: Partial<Record<"Authorization" | "Content-Type", string>> = {};
  if (Authorization) {
    headers["Authorization"] = Authorization;
  }
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  const requestBody = await c.req.json<EmbeddingRequestBody>();
  const inputs = Array.isArray(requestBody.input)
    ? requestBody.input
    : [requestBody.input];
  const [embeddingsMap, noCacheInputs, cacheHitIndices] =
    await newEmbeddingsMapWithCache(c.env?.OPENAI_CACHE, inputs);
  if (noCacheInputs.length === 0) {
    const embeddingsVectors = inputs.map((input) =>
      JSON.parse(embeddingsMap.get(input)!)
    );
    return c.text(
      JSON.stringify(newEmbeddingResponse(embeddingsVectors), null, 2),
      200,
      newResponseHeaders(cacheHitIndices.length)
    );
  }

  const res = await fetchEmbedding(requestBody, headers, noCacheInputs);
  if (res.status !== 200) {
    return res;
  }

  const body: OpenAIEmbeddingResponse = await res.json();
  await updateAndCacheResponse(
    body,
    noCacheInputs,
    embeddingsMap,
    c.env?.OPENAI_CACHE as KVNamespace
  );

  return c.text(
    JSON.stringify(
      { ...body, data: await toResponseDataList(inputs, embeddingsMap) },
      null,
      2
    ),
    200,
    {
      ...newResponseHeaders(cacheHitIndices.length),
      ...res.headers,
    }
  );
});

export default app;
