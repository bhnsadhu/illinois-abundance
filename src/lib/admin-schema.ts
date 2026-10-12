import { z } from 'zod';
import { emailSchema } from './validation';

const slug = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens for the link.');
const dateTime = z.iso.datetime({ offset: true });
const safeUrl = z.string().trim().max(2000).url().refine(value => /^https?:\/\//.test(value), 'Use an http or https link.');
const nullable = <T extends z.ZodType>(schema: T) => z.preprocess(value => value === '' ? null : value, schema.nullable());

export const adminResourceSchema = z.enum(['reviewers', 'topics', 'events', 'writers', 'learn', 'meetings', 'subscribers', 'samples']);
export const adminMutationSchema = z.object({
  action: z.enum(['save', 'delete']), id: z.uuid().optional(),
  values: z.record(z.string(), z.unknown()).optional().default({}),
}).strict();
export const subscriberRemovalSchema = z.object({ email: emailSchema }).strict();

const schemas = {
  reviewers: z.object({ email: emailSchema, name: z.string().trim().min(1).max(160), is_active: z.boolean() }).strict(),
  topics: z.object({ slug, name: z.string().trim().min(1).max(80), description: z.string().trim().max(600), sort_order: z.number().int().min(-10000).max(10000), is_active: z.boolean() }).strict(),
  events: z.object({
    slug, title: z.string().trim().min(1).max(200), description: z.string().trim().max(10000), starts_at: dateTime,
    ends_at: nullable(dateTime), location: z.string().trim().min(1).max(300), rsvp_url: nullable(safeUrl),
    recap_post_id: nullable(z.uuid()), is_published: z.boolean(),
  }).strict().refine(value => !value.ends_at || Date.parse(value.ends_at) > Date.parse(value.starts_at), { message: 'The end must be after the start.', path: ['ends_at'] }),
  writers: z.object({ slug, name: z.string().trim().min(1).max(160), bio: z.string().trim().max(2000) }).strict(),
  learn: z.object({ slug, title: z.string().trim().min(1).max(200), short_version: z.string().trim().max(600), body: z.string().trim().min(1).max(30000), is_published: z.boolean() }).strict(),
  meetings: z.object({ body_name: z.string().trim().min(1).max(200), starts_at: dateTime, location: z.string().trim().min(1).max(300), agenda_url: nullable(safeUrl), is_published: z.boolean() }).strict(),
} as const;

export type EditableAdminResource = keyof typeof schemas;
export const adminTables: Record<EditableAdminResource, string> = {
  reviewers: 'reviewers', topics: 'topics', events: 'events', writers: 'writers', learn: 'learn_pages', meetings: 'meetings',
};
const createDefaults: Record<EditableAdminResource, Record<string, unknown>> = {
  reviewers: { is_active: true },
  topics: { description: '', sort_order: 0, is_active: true },
  events: { description: '', ends_at: null, rsvp_url: null, recap_post_id: null, is_published: true },
  writers: { bio: '' }, learn: { short_version: '', is_published: true },
  meetings: { agenda_url: null, is_published: true },
};

/** Defaults apply only to new records; edits must send the full editable form. */
export function parseAdminValues(resource: EditableAdminResource, values: Record<string, unknown>, updating: boolean): Record<string, unknown> {
  return schemas[resource].parse(updating ? values : { ...createDefaults[resource], ...values });
}
