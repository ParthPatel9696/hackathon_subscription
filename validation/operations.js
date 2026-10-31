const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid record id.');
const noteBody = z.object({ body: z.string().trim().min(1).max(5000) }).strict();
const tagsBody = z.object({ tags: z.array(z.string().trim().min(1).max(40)).max(20) }).strict();
const planChangeBody = z.object({
  planId: objectId,
  quantity: z.number().int().min(1).max(100000),
  timing: z.enum(['immediate', 'next_cycle']).default('immediate'),
  reason: z.string().max(500).optional().default('')
}).strict();

module.exports = { noteBody, tagsBody, planChangeBody };
