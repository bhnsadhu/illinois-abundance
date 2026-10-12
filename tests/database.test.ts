import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// These tests execute the actual migrations in PostgreSQL, including grants,
// row security, functions, and triggers. Supabase's auth helpers and the storage
// catalog structure are stubbed; object delivery still needs a hosted smoke test.
let db: PGlite;
const reviewerId = "70000000-0000-4000-8000-000000000001";
const otherReviewerId = "70000000-0000-4000-8000-000000000002";
const challengeId = "80000000-0000-4000-8000-000000000001";
const topicId = "10000000-0000-4000-8000-000000000001";
const validHash = "a".repeat(64);
const wrongHash = "b".repeat(64);

async function role(value: "postgres" | "anon" | "authenticated" | "service_role", email?: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify(email ? { sub: reviewerId, email } : {}),
  ]);
  if (value !== "postgres") await db.exec(`set role ${value}`);
}

async function rpc(name: string, args: unknown[] = []) {
  const result = await db.query<{ result: Record<string, unknown> | boolean | string }>(
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args,
  );
  return result.rows[0].result;
}

async function start(id = challengeId) {
  return rpc("start_verification", [id, "student@illinois.edu", "Student Writer", "The original submission.", validHash]);
}

async function submission() {
  await start();
  const result = await rpc("verify_submission", [challengeId, validHash]) as { post_id: string };
  return result.post_id;
}

const publishChanges = {
  slug: "a-more-abundant-campus", headline: "A more abundant campus",
  short_version: "More homes make room for more neighbors. We can start here.",
  final_body: "The edited article.", topic_id: topicId, byline: "Student Writer",
};

// Preserve the transaction after expected SQL failures, so multiple assertions
// can verify a sequence without silently skipping later checks.
async function denied(sql: string, params: unknown[] = [], pattern: RegExp = /permission denied/) {
  await db.exec("savepoint expected_failure");
  await expect(db.query(sql, params)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint expected_failure");
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    grant usage on schema auth, public to anon, authenticated, service_role;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select (auth.jwt()->>'sub')::uuid $$;
    create schema storage;
    grant usage on schema storage to anon, authenticated, service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant select on storage.objects to anon,authenticated;
    grant all on storage.buckets,storage.objects to service_role;
  `);
  for (const file of ["202610120001_initial.sql", "202610120002_storage.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.exec(await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
}, 30000);

beforeEach(async () => {
  await db.exec("begin");
  await role("service_role");
  await db.query("insert into public.reviewers(id,email,name) values ($1,'reviewer@illinois.edu','Reviewer'),($2,'other@illinois.edu','Other reviewer')", [reviewerId, otherReviewerId]);
});

afterEach(async () => { await db.exec("rollback; reset role"); });
afterAll(async () => { await db.close(); });

describe("database privacy and RLS", () => {
  it("serves published projections while every private table and draft stays inaccessible anonymously", async () => {
    const id = await submission();
    await rpc("review_post", [id, 1, reviewerId, "publish", publishChanges]);
    await db.query("insert into posts(author_name,final_body) values ('Private draft','Never public')");
    await role("anon");
    const { rows } = await db.query("select * from public.public_posts");
    expect(rows).toHaveLength(1);
    const payload = JSON.stringify(rows);
    for (const secret of ["author_email", "original_body", "claimed_by", "decline_note", "student@", "Never public"]) {
      expect(payload).not.toContain(secret);
    }
    for (const table of ["submission_private", "writer_contacts", "reviewers", "email_verifications", "subscribers", "digest_log", "rate_limits", "post_views"]) {
      await denied(`select * from public.${table}`);
    }
    await denied("select author_email from public.public_posts", [], /does not exist/);
    await denied("update public.posts set status='published'");
    await denied("delete from public.public_posts");
    await denied("insert into public.subscribers(email,token) values ('attack@example.com',repeat('x',32))");
    await denied("select public.verify_submission($1,$2)", [challengeId, validHash]);
    await denied("select public.review_post($1,2,$2,'unpublish','{}')", [id, reviewerId]);
  });

  it("allows private reads only while the authenticated reviewer is on the active list", async () => {
    await submission();
    await role("authenticated", "stranger@illinois.edu");
    expect((await db.query("select * from public.submission_private")).rows).toHaveLength(0);
    expect((await db.query("select * from public.posts")).rows).toHaveLength(0);
    await role("authenticated", "reviewer@illinois.edu");
    expect((await db.query("select original_body from public.submission_private")).rows).toHaveLength(1);
    await denied("update public.posts set headline='Unauthorized direct write'");
    await role("service_role");
    await db.query("update public.reviewers set is_active=false where id=$1", [reviewerId]);
    await role("authenticated", "reviewer@illinois.edu");
    expect((await db.query("select * from public.submission_private")).rows).toHaveLength(0);
  });

  it("filters hidden topics, draft explainers, events, and meetings in every public view", async () => {
    await db.query("update topics set is_active=false where id=$1", [topicId]);
    await db.exec(`
      insert into learn_pages(slug,title,body,is_published) values ('draft','Private explainer','Private',false);
      insert into events(slug,title,starts_at,location,is_published) values ('draft','Private event',now(),'Private',false);
      insert into meetings(body_name,starts_at,location,is_published) values ('Private meeting',now(),'Private',false);
    `);
    await role("anon");
    expect((await db.query("select * from public_topics")).rows).toHaveLength(5);
    for (const view of ["public_learn_pages", "public_events", "public_meetings"]) {
      expect((await db.query(`select * from ${view}`)).rows).toHaveLength(0);
    }
  });

  it("protects original text and source identity even from accidental service-role edits and deletes", async () => {
    const id = await submission();
    await denied("update submission_private set original_body='Rewritten' where post_id=$1", [id], /immutable/);
    await denied("update submission_private set author_email='other@illinois.edu' where post_id=$1", [id], /immutable/);
    await denied("update submission_private set is_sample=true where post_id=$1", [id], /immutable/);
    await denied("delete from submission_private where post_id=$1", [id], /permanent/);
    await denied("delete from posts where id=$1", [id], /permanent/);
    await denied("update posts set is_sample=true where id=$1", [id], /origin/);
  });

  it("keeps draft covers in a private bucket with no client object access", async () => {
    expect((await db.query("select public from storage.buckets where id='covers'")).rows[0]).toEqual({ public: false });
    await db.exec("insert into storage.objects(bucket_id,name) values ('covers','private-draft.png')");
    await role("anon");
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
    await denied("insert into storage.objects(bucket_id,name) values ('covers','untrusted.png')");
    await role("authenticated", "reviewer@illinois.edu");
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
  });
});

describe("verification transactions", () => {
  it("creates exactly one submission and immutable original, including on repeated verification", async () => {
    await start();
    const first = await rpc("verify_submission", [challengeId, validHash]) as { post_id: string; status: string };
    expect(first.status).toBe("verified");
    expect(await rpc("verify_submission", [challengeId, validHash])).toEqual({ status: "already_verified", post_id: first.post_id });
    expect((await db.query("select * from posts")).rows).toHaveLength(1);
    expect((await db.query("select original_body from submission_private")).rows[0]).toEqual({ original_body: "The original submission." });
  });

  it("consumes five failed attempts and refuses the correct code afterward", async () => {
    await start();
    for (let i = 0; i < 5; i++) expect(await rpc("verify_submission", [challengeId, wrongHash])).toEqual({ status: "mismatch" });
    expect(await rpc("verify_submission", [challengeId, validHash])).toEqual({ status: "locked" });
    expect((await db.query("select attempts from email_verifications")).rows[0]).toEqual({ attempts: 5 });
    expect((await db.query("select * from posts")).rows).toHaveLength(0);
  });

  it("expires after ten minutes and invalidates the old hash when resent", async () => {
    await start();
    const expiry = await db.query<{ seconds: number }>("select extract(epoch from expires_at-created_at)::integer as seconds from email_verifications");
    expect(expiry.rows[0].seconds).toBe(600);
    await db.query("update email_verifications set expires_at=now()-interval '1 second'");
    expect(await rpc("verify_submission", [challengeId, validHash])).toEqual({ status: "expired" });
    await rpc("start_verification", [challengeId, "student@illinois.edu", "Student Writer", "The original submission.", wrongHash]);
    expect(await rpc("verify_submission", [challengeId, validHash])).toEqual({ status: "mismatch" });
    expect((await rpc("verify_submission", [challengeId, wrongHash]) as { status: string }).status).toBe("verified");
  });

  it("allows two independent pieces from one email, but never lets a resend swap the text", async () => {
    await submission();
    await start("80000000-0000-4000-8000-000000000002");
    expect((await rpc("verify_submission", ["80000000-0000-4000-8000-000000000002", validHash]) as { status: string }).status).toBe("verified");
    expect((await db.query("select * from posts")).rows).toHaveLength(2);
    await denied("select start_verification($1,'student@illinois.edu','Student Writer','Swapped text',$2)", [challengeId, validHash], /cannot be changed/);
  });

  it("enforces the Illinois domain and submission character cap at storage", async () => {
    await denied("select start_verification($1,'student@illinois.edu.evil.test','Student','Body',$2)", [challengeId, validHash], /check constraint/);
    await denied("select start_verification($1,'student@illinois.edu','Student',repeat('x',20001),$2)", [challengeId, validHash], /check constraint/);
  });
});

describe("reviewing and publish permissions", () => {
  it("takes, publishes, edits, and unpublishes while preserving original text and first publication date", async () => {
    const id = await submission();
    expect(await rpc("review_post", [id, 1, reviewerId, "claim", {}])).toMatchObject({ status: "ok", version: 2 });
    expect((await db.query("select claimed_by from submission_private")).rows[0]).toEqual({ claimed_by: reviewerId });
    expect(await rpc("review_post", [id, 2, reviewerId, "publish", publishChanges])).toMatchObject({ status: "ok", version: 3 });
    await role("anon");
    expect((await db.query("select headline from public_posts")).rows[0]).toEqual({ headline: publishChanges.headline });
    await role("service_role");
    const firstDate = (await db.query<{ published_at: Date }>("select published_at from posts where id=$1", [id])).rows[0].published_at;
    await rpc("review_post", [id, 3, reviewerId, "save", { headline: "An updated headline" }]);
    expect((await db.query<{ published_at: Date }>("select published_at from posts where id=$1", [id])).rows[0].published_at).toEqual(firstDate);
    expect((await db.query<{ original_body: string }>("select original_body from submission_private")).rows[0].original_body).toBe("The original submission.");
    await rpc("review_post", [id, 4, reviewerId, "unpublish", {}]);
    await role("anon");
    expect((await db.query("select * from public_posts")).rows).toHaveLength(0);
  });

  it("rejects stale mutations without overwriting the first reviewer", async () => {
    const id = await submission();
    await rpc("review_post", [id, 1, reviewerId, "claim", {}]);
    expect(await rpc("review_post", [id, 1, otherReviewerId, "publish", publishChanges])).toEqual({ status: "conflict", version: 2 });
    expect((await db.query("select status,headline from posts where id=$1", [id])).rows[0]).toEqual({ status: "in_progress", headline: "" });
    await rpc("review_post", [id, 2, otherReviewerId, "claim", {}]);
    expect((await db.query<{ claimed_by: string }>("select claimed_by from submission_private")).rows[0].claimed_by).toBe(otherReviewerId);
  });

  it("forbids inactive reviewers and requires a complete article and active topic", async () => {
    const id = await submission();
    await db.query("update reviewers set is_active=false where id=$1", [otherReviewerId]);
    expect(await rpc("review_post", [id, 1, otherReviewerId, "publish", publishChanges])).toEqual({ status: "forbidden" });
    await denied("select review_post($1,1,$2,'publish','{}')", [id, reviewerId], /active topic/);
    await denied("select review_post($1,1,$2,'publish',$3)", [id, reviewerId, { ...publishChanges, headline: "" }], /published_posts_complete/);
  });
});

describe("abuse prevention and sample cleanup", () => {
  it("atomically caps requests and opens a fresh window after expiry", async () => {
    expect(await rpc("consume_rate_limit", ["hashed-ip-and-purpose", 2, 600])).toBe(true);
    expect(await rpc("consume_rate_limit", ["hashed-ip-and-purpose", 2, 600])).toBe(true);
    expect(await rpc("consume_rate_limit", ["hashed-ip-and-purpose", 2, 600])).toBe(false);
    expect((await db.query<{ requests: number }>("select requests from rate_limits")).rows[0].requests).toBe(2);
    await db.exec("update rate_limits set window_started_at=now()-interval '11 minutes'");
    expect(await rpc("consume_rate_limit", ["hashed-ip-and-purpose", 2, 600])).toBe(true);
    expect((await db.query<{ requests: number }>("select requests from rate_limits")).rows[0].requests).toBe(1);
  });

  it("deduplicates a visitor's daily view counter", async () => {
    const id = await submission();
    for (let i = 0; i < 2; i++) await db.query("insert into post_views(post_id,visitor_hash) values($1,$2) on conflict do nothing", [id, validHash]);
    expect((await db.query("select * from post_views")).rows).toHaveLength(1);
  });

  it("deletes sample archives without deleting real originals or foundational topics", async () => {
    const id = await submission();
    await db.exec(`
      insert into posts(id,author_name,is_sample) values ('30000000-0000-4000-8000-000000000099','Sample',true);
      insert into submission_private(post_id,author_email,original_body,is_sample)
        values ('30000000-0000-4000-8000-000000000099','sample@example.test','Sample body',true);
      select public.delete_sample_content();
    `);
    expect((await db.query("select id from posts")).rows).toEqual([{ id }]);
    expect((await db.query("select * from submission_private")).rows).toHaveLength(1);
    expect((await db.query("select * from topics")).rows).toHaveLength(6);
  });
});
