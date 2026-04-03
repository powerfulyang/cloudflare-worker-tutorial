import { getAppInstance } from '@/core'
import { getCurrentUserRoute } from '@/routes/user/current.get'

export const userApp = getAppInstance()

userApp.route('/user', getCurrentUserRoute)
