import 'server-only';
import { requireAdmin } from './auth';
import { serviceDatabase } from './database/service';

export type AdminStats = {
  published_count: number;
  submission_count: number;
  median_publish_hours: number | null;
  active_writer_count: number;
  subscriber_count: number;
  top_posts: { id: string; slug: string; headline: string; views: number }[];
};

export async function getAdminStats(): Promise<AdminStats> {
  await requireAdmin();
  const { data, error } = await serviceDatabase().rpc<AdminStats>('get_admin_stats');
  if (error || !data) throw new Error('The admin overview is temporarily unavailable.');
  return data;
}
