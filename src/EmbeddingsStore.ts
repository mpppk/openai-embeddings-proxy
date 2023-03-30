export class EmbeddingsStore {
  private map = new Map<string, number[]>();
  get embeddings(): number[][] {
    if (!this.isFullyCached)
      throw new Error("not fully cached but embeddings are requested");
    return this.inputs.map((input) => this.map.get(input)!);
  }

  private constructor(private inputs: string[], private kv: KVNamespace) {}

  static async new(inputs: string[], kv: KVNamespace) {
    const store = new EmbeddingsStore(inputs, kv);
    const { embeddingsMap, cacheHitInputs, noCacheInputs } =
      await store.retrieveCache(inputs);
    store.map = embeddingsMap;
    return { store, cacheHitInputs, noCacheInputs };
  }

  private async retrieveCache(inputs: string[]) {
    const embeddingsMap = new Map<string, number[]>();
    const cacheHitInputs: string[] = [];
    const noCacheInputs: string[] = [];
    const promises = inputs.map((input) =>
      this.kv.get(`embeddings:ada:${input}`, {
        type: "text",
        cacheTtl: 60 * 10,
      })
    );
    const caches = await Promise.all(promises);
    caches.forEach((cache, index) => {
      const input = inputs[index];
      if (cache) {
        cacheHitInputs.push(input);
        embeddingsMap.set(input, JSON.parse(cache));
      } else {
        noCacheInputs.push(input);
      }
    });
    return { embeddingsMap, cacheHitInputs, noCacheInputs };
  }

  get isFullyCached() {
    return this.map.size === this.inputs.length;
  }

  public async addEmbeddings(inputs: string[], embedding: number[][]) {
    const promises = inputs.map((input, index) =>
      this.addEmbedding(input, embedding[index])
    );
    await Promise.all(promises);
  }

  public async addEmbedding(input: string, embedding: number[]) {
    await this.kv.put(`embeddings:ada:${input}`, JSON.stringify(embedding));
    this.map.set(input, embedding);
  }
}
