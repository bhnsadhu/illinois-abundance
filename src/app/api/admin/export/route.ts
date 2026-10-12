import { getReviewer } from '@/lib/auth';
import { apiFailure, privateJson } from '@/lib/api';
import { serviceDatabase } from '@/lib/database/service';
import { csvCell } from '@/lib/format';

export const dynamic = 'force-dynamic';
const BATCH_SIZE = 250;
const publishedColumns = [
  'id', 'slug', 'author_name', 'headline', 'short_version', 'final_body', 'topic_id',
  'byline', 'writer_id', 'sources', 'cover_url', 'cover_alt', 'published_at',
  'updated_at', 'created_at', 'is_sample',
] as const;
const postColumns = ['id', 'status', ...publishedColumns.slice(1), 'version'];
const privateColumns = ['author_email', 'original_body', 'claimed_by', 'claimed_at', 'decline_note'];
type Row = Record<string, unknown> & { id: string };
type Archive = Record<string, unknown> & { post_id: string };

export async function GET(request: Request) {
  try {
    const reviewer = await getReviewer();
    if (!reviewer?.isAdmin) return privateJson({ error: 'Admin access is required.' }, 403);
    const type = new URL(request.url).searchParams.get('type');
    if (type !== 'published' && type !== 'submissions') {
      return privateJson({ error: 'Choose published pieces or submissions to export.' }, 400);
    }
    const db = serviceDatabase();
    const columns = type === 'published' ? [...publishedColumns] : [...postColumns, ...privateColumns];
    async function batch(after?: string): Promise<Row[]> {
      let query = db.from<Row>(type === 'published' ? 'public_posts' : 'posts')
        .select((type === 'published' ? publishedColumns : postColumns).join(','))
        .order('id').limit(BATCH_SIZE);
      if (after) query = query.gt('id', after);
      const result = await query;
      if (result.error) throw new Error('The export could not be loaded.');
      const rows = result.data ?? [];
      if (type === 'published' || !rows.length) return rows;
      const archives = await db.from<Archive>('submission_private')
        .select(['post_id', ...privateColumns].join(',')).in('post_id', rows.map(row => row.id));
      if (archives.error) throw new Error('The export could not be loaded.');
      const byPost = new Map((archives.data ?? []).map(row => [row.post_id, row]));
      return rows.map(row => ({ ...row, ...byPost.get(row.id) }));
    }

    // Validate the first query before committing the response headers.
    const first = await batch();
    const encoder = new TextEncoder();
    async function* chunks() {
      yield encoder.encode(`\uFEFF${columns.map(csvCell).join(',')}\r\n`);
      let rows = first;
      while (rows.length) {
        yield encoder.encode(rows.map(row => columns.map(column => csvCell(row[column])).join(',')).join('\r\n') + '\r\n');
        if (rows.length < BATCH_SIZE || request.signal.aborted) return;
        rows = await batch(rows.at(-1)!.id);
      }
    }
    const iterator = chunks();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const result = await iterator.next();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        } catch {
          console.error('An admin export was interrupted.');
          controller.error(new Error('The export was interrupted. Please download it again.'));
        }
      },
      async cancel() { await iterator.return(undefined); },
    });
    return new Response(stream, { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="illinois-abundance-${type}.csv"`,
      'Cache-Control': 'private, no-store',
      'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    } });
  } catch (error) { return apiFailure(error); }
}
