import { HomeTemplateDef } from '../types'
import { ONE_BEDROOM_TEMPLATE } from './one-bedroom'
import { TWO_BEDROOM_TEMPLATE } from './two-bedroom'

export const TEMPLATES: Record<string, HomeTemplateDef> = {
  one_bedroom: ONE_BEDROOM_TEMPLATE,
  two_bedroom: TWO_BEDROOM_TEMPLATE,
}
