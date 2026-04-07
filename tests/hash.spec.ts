import { sha256 } from 'hono/utils/crypto'

describe('hash', () => {
  it('should match', async () => {
    const str = '1'
    await expect(sha256(str)).resolves.toBe('6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b')
  })
})
