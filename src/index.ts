import { recordsApp } from '@/routes/records'
import { userApp } from '@/routes/user'
import { app } from '@/server'
import '@/oauth-providers/oauth.middleware'

app.route('/', recordsApp)
app.route('/', userApp)

export { app }
