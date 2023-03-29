import { Hono } from 'hono'

const app = new Hono()

const OPENAI_HOST = 'https://api.openai.com'

app.post('/v1/embeddings', async (c) => {
    console.log('hello!')
    const Authorization = c.req.header("Authorization")
    const contentType = c.req.header("Content-Type")
    const headers: Partial<Record<'Authorization' | 'Content-Type', string>> = {}
    if (Authorization) {
        headers['Authorization'] = Authorization
    }
    if (contentType) {
        headers['Content-Type'] = contentType
    }
    return await fetch(`${OPENAI_HOST}/v1/embeddings`, { method: 'POST', headers, body: c.req.body })
})

export default app
