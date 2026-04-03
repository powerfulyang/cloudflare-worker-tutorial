import { getAppInstance } from '@/core'
import { recordRoute } from '@/routes/records/record'

export const recordsApp = getAppInstance()

recordsApp.route('/records', recordRoute)
