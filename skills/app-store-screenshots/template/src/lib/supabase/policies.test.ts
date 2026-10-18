import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Real Postgres execution (WASM), not mocks of policy outcomes. The hosted
// Auth/Storage services still require a separate live two-account test.
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
const bundle = (title: string) => ({ version: 1, activeId: "p1", order: ["p1"], projects: { p1: { id: "p1", name: title } } });
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function save(title: string, revision = "missing") {
  return db.query<{ revision: string }>("select public.save_workspace($1::jsonb, $2) as revision", [JSON.stringify(bundle(title)), revision]);
}
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    grant usage on schema public, auth, storage to authenticated, anon;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant usage on all sequences in schema storage to authenticated;
    insert into auth.users(id) values('${alice}'),('${bob}'),('${outsider}');
  `);
  // Apply every migration in filename order, exactly as hosted Supabase does.
  // A hand-maintained list once skipped two live migrations without failing.
  for (const file of (await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.query("insert into public.beta_members(user_id) values ($1), ($2)", [alice, bob]);
}, 20_000);
afterEach(async () => { await db.close(); });

describe("Supabase migration policies", () => {
  it("keeps the conflict migration idempotent and preserves invoker security and grants", async () => {
    await db.exec(await readFile("supabase/migrations/202610170001_nonretrying_workspace_conflicts.sql", "utf8"));
    const { rows } = await db.query<{ definer: boolean; authenticated: boolean; anon: boolean }>(`
      select prosecdef as definer,
        has_function_privilege('authenticated', oid, 'execute') as authenticated,
        has_function_privilege('anon', oid, 'execute') as anon
      from pg_proc where oid = 'public.save_workspace(jsonb,text)'::regprocedure
    `);
    expect(rows).toEqual([{ definer: false, authenticated: true, anon: false }]);
  });
  it("isolates projects and workspace snapshots even when accounts use identical project IDs", async () => {
    await asUser(alice); expect((await save("Alice")).rows[0].revision).toBe("1");
    await asUser(bob); expect((await db.query("select * from public.projects")).rows).toHaveLength(0);
    await save("Bob");
    const snapshot = await db.query<{ snapshot: { state: { projects: { p1: { name: string } } } } }>("select public.read_workspace() as snapshot");
    expect(snapshot.rows[0].snapshot.state.projects.p1.name).toBe("Bob");
    expect((await db.query("update public.projects set state='{}' where user_id=$1 returning id", [alice])).rows).toHaveLength(0);
    expect((await db.query("delete from public.projects where user_id=$1 returning id", [alice])).rows).toHaveLength(0);
    await expect(db.query("insert into public.projects values($1, 'stolen', '{}')", [alice])).rejects.toThrow(/row-level security/i);
    await asUser(alice); expect((await db.query<{ state: { name: string } }>("select state from public.projects")).rows[0].state.name).toBe("Alice");
  });
  it("rejects stale saves atomically and persists deletion without resurrecting projects", async () => {
    await asUser(alice); await save("Original");
    // An application revision conflict must NOT use serialization_failure:
    // PostgREST 14 retries SQLSTATE 40001 indefinitely inside its pool.
    await expect(save("Stale", "missing")).rejects.toMatchObject({ code: "PT409" });
    expect((await db.query<{ revision: number }>("select revision from public.workspaces")).rows[0].revision).toBe(1);
    await save("Updated", "1");
    await expect(save("Late tab", "1")).rejects.toMatchObject({ code: "PT409" });
    await db.query("select public.save_workspace($1, '2')", [JSON.stringify({ version: 1, activeId: null, order: [], projects: {} })]);
    expect((await db.query("select * from public.projects")).rows).toHaveLength(0);
  });
  it("denies non-invited and anonymous users without exposing membership lists", async () => {
    await asUser(outsider);
    expect((await db.query("select * from public.beta_members")).rows).toHaveLength(0);
    await expect(save("Uninvited")).rejects.toThrow(/row-level security/i);
    expect((await db.query<{ allowed: boolean }>("select consume_beta_budget('ai') as allowed")).rows[0].allowed).toBe(false);
    await db.exec("reset role; set role anon;");
    await expect(db.query("select public.read_workspace()")).rejects.toThrow(/permission denied/i);
  });
  it("enforces private file ownership on read, insert, update and delete", async () => {
    await asUser(alice);
    await db.query("insert into storage.objects(bucket_id,name) values('project-assets',$1)", [`${alice}/capture.png`]);
    await asUser(bob);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
    await expect(db.query("insert into storage.objects(bucket_id,name) values('project-assets',$1)", [`${alice}/capture2.png`])).rejects.toThrow(/row-level security/i);
    expect((await db.query("update storage.objects set name='changed' returning id")).rows).toHaveLength(0);
    expect((await db.query("delete from storage.objects returning id")).rows).toHaveLength(0);
    await asUser(alice); expect((await db.query("select * from storage.objects")).rows).toHaveLength(1);
  });
  it("bounds AI attempts and prevents users from resetting usage counters", async () => {
    await asUser(alice);
    for (let n = 0; n < 20; n++) expect((await db.query<{ allowed: boolean }>("select consume_beta_budget('ai') as allowed")).rows[0].allowed).toBe(true);
    expect((await db.query<{ allowed: boolean }>("select consume_beta_budget('ai') as allowed")).rows[0].allowed).toBe(false);
    await expect(db.query("delete from public.beta_usage")).rejects.toThrow(/permission denied/i);
    await asUser(bob); expect((await db.query("select * from public.beta_usage")).rows).toHaveLength(0);
    expect((await db.query<{ allowed: boolean }>("select consume_beta_budget('ai') as allowed")).rows[0].allowed).toBe(true);
  });
  // Value: protects=per-account daily caps for import (10) and upload (100) through the v1 name older deploys call; fails_when=the v2 rewrite or wrapper changes a non-AI cap
  // why_new=existing cap tests exercise only 'ai'; seam=none; no_claim=global pool sizes, concurrent callers, hosted PostgREST behavior
  it("keeps the per-account import and upload caps through the v1 name", async () => {
    const allowed = async (kind: string) => (await db.query<{ allowed: boolean }>("select consume_beta_budget($1) as allowed", [kind])).rows[0].allowed;
    await asUser(alice);
    for (const [kind, cap] of [["import", 10], ["upload", 100]] as const) {
      for (let n = 0; n < cap; n++) expect(await allowed(kind)).toBe(true);
      expect(await allowed(kind)).toBe(false);
    }
    await asUser(bob);
    expect(await allowed("import")).toBe(true);
  });
  it("explains refusals: global pool before per-user cap, and denies unknown kinds", async () => {
    const verdict = async (kind: string | null) =>
      (await db.query<{ verdict: string }>("select public.consume_beta_budget_v2($1) as verdict", [kind])).rows[0].verdict;
    await asUser(alice);
    expect(await verdict("ai")).toBe("ok");
    expect(await verdict("video")).toBe("denied");
    expect(await verdict(null)).toBe("denied");
    for (let n = 1; n < 20; n++) await verdict("ai");
    expect(await verdict("ai")).toBe("user");
    // Fill the shared pool from another account; alice is also at her cap,
    // and the global verdict must win so operators see the real cause.
    await db.exec("reset role;");
    await db.query("insert into public.beta_usage(user_id, day, kind, attempts) values($1, (now() at time zone 'utc')::date, 'ai', 980)", [bob]);
    await asUser(bob);
    expect(await verdict("ai")).toBe("global");
    await asUser(alice);
    expect(await verdict("ai")).toBe("global");
    expect(await verdict("upload")).toBe("ok");
    await asUser(outsider);
    expect(await verdict("ai")).toBe("denied");
  });
  it("refuses to drop v2 while the v1 wrapper depends on it", async () => {
    await db.exec("reset role;");
    await expect(db.exec("drop function public.consume_beta_budget_v2(text)")).rejects.toThrow(/depend/i);
    expect((await db.query("select 1 from pg_proc where proname = 'consume_beta_budget_v2'")).rows).toHaveLength(1);
  });
  it("keeps the v1 name as a boolean mirror of v2 so older deployments survive rollback", async () => {
    await asUser(bob);
    expect((await db.query<{ allowed: boolean }>("select consume_beta_budget('import') as allowed")).rows[0].allowed).toBe(true);
    expect((await db.query<{ attempts: number }>("select attempts from public.beta_usage where kind='import'")).rows[0].attempts).toBe(1);
    expect((await db.query<{ allowed: boolean }>("select consume_beta_budget('video') as allowed")).rows[0].allowed).toBe(false);
    const { rows } = await db.query<{ name: string; authenticated: boolean; anon: boolean }>(`
      select proname as name,
        has_function_privilege('authenticated', oid, 'execute') as authenticated,
        has_function_privilege('anon', oid, 'execute') as anon
      from pg_proc where proname in ('consume_beta_budget', 'consume_beta_budget_v2') order by proname
    `);
    expect(rows).toEqual([
      { name: "consume_beta_budget", authenticated: true, anon: false },
      { name: "consume_beta_budget_v2", authenticated: true, anon: false },
    ]);
  });
});

describe("public signup enrollment", () => {
  const newcomer = "44444444-4444-4444-8444-444444444444";
  // The harness already applied every migration. Re-apply this one from scratch
  // so the tests can also prove its one-time backfill of pre-existing users.
  const apply = async () => {
    await db.exec("drop trigger if exists screenova_enroll_confirmed_user on auth.users; drop function if exists public.enroll_confirmed_user();");
    await db.exec(await readFile("supabase/migrations/202610160002_public_signup.sql", "utf8"));
  };

  it("grants a private workspace only after email confirmation, without an invitation", async () => {
    await apply();
    await db.query("insert into auth.users(id,email) values($1,'new@example.com')", [newcomer]);
    await asUser(newcomer);
    await expect(save("Before confirmation")).rejects.toThrow(/row-level security/i);
    await db.exec("reset role");
    await db.query("update auth.users set email_confirmed_at=now() where id=$1", [newcomer]);
    await asUser(newcomer);
    expect((await save("New private workspace")).rows[0].revision).toBe("1");
    await asUser(bob);
    expect((await db.query("select * from public.projects")).rows).toHaveLength(0);
    expect((await db.query("select * from public.beta_members")).rows).toHaveLength(1);
  });

  it("enrolls confirmed inserts and pre-existing verified users, excluding anonymous or unverified accounts", async () => {
    await db.query("update auth.users set email='existing@example.com',email_confirmed_at=now() where id=$1", [outsider]);
    await apply();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'new@example.com',now())", [newcomer]);
    expect((await db.query("select * from public.beta_members")).rows).toHaveLength(4);
    await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values('55555555-5555-4555-8555-555555555555','anon@example.com',now(),true)");
    expect((await db.query("select * from public.beta_members")).rows).toHaveLength(4);
  });

  it("does not restore revoked access during later profile or confirmation updates", async () => {
    await apply();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'new@example.com',now())", [newcomer]);
    await db.query("delete from public.beta_members where user_id=$1", [newcomer]);
    await db.query("update auth.users set email='renamed@example.com',email_confirmed_at=now() where id=$1", [newcomer]);
    await asUser(newcomer);
    expect((await db.query("select * from public.beta_members")).rows).toHaveLength(0);
    await expect(save("Revoked")).rejects.toThrow(/row-level security/i);
  });

  it("does not let clients enroll themselves or invoke the privileged trigger", async () => {
    await apply();
    await asUser(outsider);
    await expect(db.query("insert into public.beta_members(user_id) values($1)", [outsider])).rejects.toThrow(/permission denied/i);
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.enroll_confirmed_user()','execute') as allowed")).rows[0].allowed).toBe(false);
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon','public.enroll_confirmed_user()','execute') as allowed")).rows[0].allowed).toBe(false);
  });
});
