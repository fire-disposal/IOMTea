import { z } from 'zod'

export const FormFieldSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string().min(1).max(64), label: z.string().min(1), required: z.boolean().default(true), type: z.literal('choice'), options: z.array(z.object({ value: z.string(), label: z.string() })).min(1) }),
  z.object({ id: z.string().min(1).max(64), label: z.string().min(1), required: z.boolean().default(true), type: z.literal('multi'), options: z.array(z.object({ value: z.string(), label: z.string() })).min(1) }),
  z.object({ id: z.string().min(1).max(64), label: z.string().min(1), required: z.boolean().default(true), type: z.literal('likert'), labels: z.array(z.string()).min(2).max(9) }),
  z.object({ id: z.string().min(1).max(64), label: z.string().min(1), required: z.boolean().default(true), type: z.literal('vas'), min_label: z.string().optional(), max_label: z.string().optional() }),
  z.object({ id: z.string().min(1).max(64), label: z.string().min(1), required: z.boolean().default(true), type: z.literal('number'), min: z.number().optional(), max: z.number().optional(), unit: z.string().optional() }),
  z.object({ id: z.string().min(1).max(64), label: z.string().min(1), required: z.boolean().default(true), type: z.literal('text'), placeholder: z.string().optional(), rows: z.number().int().min(1).max(20).default(3) }),
])

export const FormDefinitionSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1),
  description: z.string().optional(),
  cron: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1).max(50),
})

export type FormDefinition = z.infer<typeof FormDefinitionSchema>
export type FormField = z.infer<typeof FormFieldSchema>

export function buildResponseSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of fields) {
    let field: z.ZodTypeAny
    switch (f.type) {
      case 'choice':
        field = z.string()
        break
      case 'multi':
        field = z.array(z.string())
        break
      case 'likert':
        field = z.number().int().min(0).max(f.labels.length - 1)
        break
      case 'vas':
        field = z.number().min(0).max(100)
        break
      case 'number':
        field = z.number()
        break
      case 'text':
        field = z.string()
        break
    }
    if (f.required) shape[f.id] = field
    else shape[f.id] = field.nullable()
  }
  return z.object(shape)
}
