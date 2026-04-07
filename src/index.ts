import { registerOAuthRoutes } from '@/oauth-providers/oauth.middleware'
import { recordsApp } from '@/routes/records'
import { userApp } from '@/routes/user'
import { createApp } from '@/server'

const app = createApp()

// 注册 OAuth 中间件和路由
registerOAuthRoutes(app)

// 注册业务路由
app.route('/', recordsApp)
app.route('/', userApp)

export default app
