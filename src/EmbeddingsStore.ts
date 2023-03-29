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
    const cacheHitInputs: string[] = [];
    const noCacheInputs: string[] = [];
    for (const input of inputs) {
      const cache = await kv.get(`embeddings:ada:${input}`, {
        type: "text",
      });
      if (cache) {
        cacheHitInputs.push(input);
        store.map.set(input, JSON.parse(cache));
      } else {
        noCacheInputs.push(input);
      }
    }
    return { store, cacheHitInputs, noCacheInputs };
  }

  get isFullyCached() {
    console.log(this.map.size, this.inputs.length);
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
