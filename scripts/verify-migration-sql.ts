/**
 * Migration SQL gate.
 *
 * R51 shipped a migration that GitHub CI reported as green while it was not executable SQL:
 *
 *   1. `public.admin_update_place_curation` was dollar-quoted with `$$` while its own body
 *      contains the price literals '$', '$$', '$$$' and '$$$$'. PostgreSQL terminates an
 *      untagged dollar-quoted body at its first `$$`, so the function was cut in half and the
 *      remainder was parsed as stray SQL.
 *   2. `public.admin_record_service_event` used `INSERT ... VALUES (...) WHERE ...`, which is
 *      not PostgreSQL grammar - a VALUES clause cannot filter itself out.
 *
 * Neither was caught because the SQL was only ever read as text by string-matching contract
 * tests. This gate closes that hole with two independent arms, and verifies *both* arms against
 * deliberately broken fixtures on every run, so a future change to either arm cannot silently
 * turn this into a no-op:
 *
 *   Arm 1 - real PostgreSQL grammar. The migration (and every `language sql` function body
 *           inside it, which the outer grammar only sees as an opaque string literal) is parsed
 *           with libpg_query, the parser PostgreSQL itself uses. plpgsql bodies are parsed with
 *           the plpgsql grammar. No database is contacted and nothing is executed: a parse is a
 *           pure grammar check, so this is safe to run in CI and offline.
 *
 *   Arm 2 - deterministic structural rules that hold even without the parser: dollar-quote
 *           delimiter collisions, `INSERT ... VALUES ... WHERE`, and migration-history drift.
 *
 * Migration-history alignment is part of the same gate because live Supabase recorded this
 * migration as version 20260917115914. A repository file under any other name would re-apply the
 * same schema under a second version, so the name is asserted, not documented.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse, parsePlPgSQL } from '@libpg-query/parser';

const MIGRATIONS_DIR = join('supabase', 'migrations');

/** The version live Supabase recorded when the manager applied this migration. */
const EXPECTED_MIGRATION = '20260917115914_admin_control_center.sql';
const EXPECTED_VERSION = '20260917115914';
/** The name the branch first used, retired so the schema is never applied twice. */
const RETIRED_MIGRATION = '20260918090000_admin_control_center.sql';

/** One marker per object this migration owns; a duplicate anywhere else is a second migration. */
const OWNED_OBJECTS = [
  'create table if not exists public.admin_accounts',
  'create table if not exists public.admin_audit_events',
  'create table if not exists public.service_events',
];

const RETIRED_NAMES: string[] = [RETIRED_MIGRATION];
const RETIRED_VERSIONS: string[] = ['20260918090000'];

/** Clauses PostgreSQL allows between a function's closing dollar quote and the `;`. */
const FUNCTION_TAIL =
  /^(?:;|language\b|returns\b|immutable\b|stable\b|volatile\b|security\b|set\b|parallel\b|cost\b|rows\b|strict\b|leakproof\b|called\b|support\b|transform\b|begin\b)/i;

type Block = { tag: string; start: number; end: number; bodyStart: number; bodyEnd: number };
type Scan = { masked: string; depth: Int32Array; blocks: Block[] };

/**
 * Replace every string literal, quoted identifier, comment and dollar-quoted body with spaces
 * (newlines kept, so errors can still quote a line number) and record paren depth and the
 * position of every dollar-quoted block. Offsets in the result always match the input.
 */
function scan(sql: string): Scan {
  const out = new Array<string>(sql.length);
  const depth = new Int32Array(sql.length);
  const blocks: Block[] = [];
  let i = 0;
  let level = 0;

  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < sql.length; k += 1) {
      out[k] = sql[k] === '\n' ? '\n' : ' ';
      depth[k] = level;
    }
  };

  while (i < sql.length) {
    const c = sql[i];

    if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        out[i] = ' ';
        depth[i] = level;
        i += 1;
      }
      continue;
    }

    if (c === '/' && sql[i + 1] === '*') {
      let nested = 1;
      i += 2;
      while (i < sql.length && nested > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          nested += 1;
          i += 2;
          continue;
        }
        if (sql[i] === '*' && sql[i + 1] === '/') {
          nested -= 1;
          i += 2;
          continue;
        }
        out[i] = sql[i] === '\n' ? '\n' : ' ';
        depth[i] = level;
        i += 1;
      }
      continue;
    }

    if (c === "'" || c === '"') {
      const quote = c;
      out[i] = ' ';
      depth[i] = level;
      i += 1;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            blank(i, i + 2);
            i += 2;
            continue;
          }
          out[i] = ' ';
          depth[i] = level;
          i += 1;
          break;
        }
        out[i] = sql[i] === '\n' ? '\n' : ' ';
        depth[i] = level;
        i += 1;
      }
      continue;
    }

    if (c === '$') {
      const tag = dollarTagAt(sql, i);
      if (tag !== null) {
        const delimiter = `$${tag}$`;
        const bodyStart = i + delimiter.length;
        const closeAt = sql.indexOf(delimiter, bodyStart);
        if (closeAt === -1) {
          throw new Error(`unterminated dollar-quoted string ${delimiter} at offset ${i}`);
        }
        const end = closeAt + delimiter.length;
        blank(i, end);
        blocks.push({ tag, start: i, end, bodyStart, bodyEnd: closeAt });
        i = end;
        continue;
      }
    }

    if (c === '(') {
      out[i] = c;
      depth[i] = level;
      level += 1;
      i += 1;
      continue;
    }
    if (c === ')') {
      level = Math.max(0, level - 1);
      out[i] = c;
      depth[i] = level;
      i += 1;
      continue;
    }

    out[i] = c;
    depth[i] = level;
    i += 1;
  }

  return { masked: out.join(''), depth, blocks };
}

/** PostgreSQL dollar-quote tags start with a letter or underscore; `$1` is a parameter. */
function dollarTagAt(sql: string, index: number): string | null {
  if (sql[index] !== '$') return null;
  let i = index + 1;
  if (!/[A-Za-z_]/.test(sql[i] ?? '')) return i < sql.length && sql[i] === '$' ? '' : null;
  while (i < sql.length && /[A-Za-z0-9_]/.test(sql[i])) i += 1;
  return sql[i] === '$' ? sql.slice(index + 1, i) : null;
}

/** Split a scanned text into statements at top-level semicolons. */
function statements(scanned: Scan): { start: number; end: number }[] {
  const parts: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < scanned.masked.length; i += 1) {
    if (scanned.masked[i] === ';' && scanned.depth[i] === 0) {
      parts.push({ start, end: i });
      start = i + 1;
    }
  }
  if (start < scanned.masked.length) parts.push({ start, end: scanned.masked.length });
  return parts;
}

/** Position of a keyword at paren depth 0, or -1. */
function topLevelKeyword(masked: string, depth: Int32Array, offset: number, pattern: RegExp): number {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(masked)) !== null) {
    if (depth[offset + match.index] === 0) return match.index;
    re.lastIndex = match.index + Math.max(1, match[0].length);
  }
  return -1;
}

function lineOf(sql: string, offset: number): number {
  return sql.slice(0, Math.max(0, offset)).split('\n').length;
}

/**
 * Arm 2a. Every function body must be closed by its own delimiter at the point the grammar
 * expects it. A delimiter that also occurs inside the body (`$$` around the price literals)
 * terminates the body early, so what follows the closing quote is not `;` or a clause keyword.
 */
function dollarQuoteErrors(sql: string, scanned: Scan): string[] {
  const errors: string[] = [];
  const header = /\bcreate\s+(?:or\s+replace\s+)?function\b/gi;
  let match: RegExpExecArray | null;
  header.lastIndex = 0;

  while ((match = header.exec(scanned.masked)) !== null) {
    const at = match.index;
    const nextSemicolon = scanned.masked.indexOf(';', at);
    const limit = nextSemicolon === -1 ? sql.length : nextSemicolon;
    const block = scanned.blocks.find((candidate) => candidate.start > at && candidate.start < limit);
    if (!block) continue;

    const name = /(?:create\s+(?:or\s+replace\s+)?function\s+)([A-Za-z0-9_."]+)/i.exec(sql.slice(at, at + 200))?.[1] ?? '?';
    const tail = sql.slice(block.end, block.end + 40).trim();
    if (!FUNCTION_TAIL.test(tail)) {
      errors.push(
        `function ${name} (line ${lineOf(sql, at)}) is not closed by its own $${block.tag}$ delimiter: ` +
          `the delimiter occurs inside the body, so PostgreSQL ends the body early and reads the ` +
          `remainder as SQL (found ${JSON.stringify(tail.slice(0, 24))} after the closing quote). ` +
          `Use a tagged delimiter such as $admin_curation$ that does not appear in the body.`,
      );
    }
  }
  return errors;
}

/**
 * Arm 2b. `INSERT ... VALUES (...) WHERE ...` is not PostgreSQL grammar: a VALUES clause has no
 * WHERE. The guard has to be SELECT-shaped (`INSERT ... SELECT ... WHERE ...`) or an ON CONFLICT
 * clause, whose WHERE is legal and therefore allowed here.
 */
function insertValuesWhereErrors(sql: string, scanned: Scan): string[] {
  const errors: string[] = [];
  for (const part of statements(scanned)) {
    const masked = scanned.masked.slice(part.start, part.end);
    if (!/^\s*(?:with\b[\s\S]*?)?insert\s+into\b/i.test(masked)) continue;

    const valuesAt = topLevelKeyword(masked, scanned.depth, part.start, /\bvalues\b/i);
    if (valuesAt === -1) continue;
    const whereAt = topLevelKeyword(masked, scanned.depth, part.start, /\bwhere\b/i);
    if (whereAt === -1) continue;
    const onConflictAt = topLevelKeyword(masked, scanned.depth, part.start, /\bon\s+conflict\b/i);
    if (onConflictAt !== -1 && whereAt > onConflictAt) continue;

    errors.push(
      `invalid INSERT grammar at line ${lineOf(sql, part.start + whereAt)}: ` +
        `a VALUES clause cannot be followed by WHERE (PostgreSQL has no WHERE after VALUES). ` +
        `Guard the row with INSERT ... SELECT ... WHERE ... instead, or move the predicate into ` +
        `an ON CONFLICT clause.`,
    );
  }
  return errors;
}

/** Every piece of plain SQL in the file: top-level statements plus `language sql` bodies. */
function sqlUnits(sql: string, scanned: Scan): { sql: string; offset: number; label: string }[] {
  const units = statements(scanned).map((part) => ({
    sql: sql.slice(part.start, part.end),
    offset: part.start,
    label: `statement at line ${lineOf(sql, part.start)}`,
  }));

  const header = /\bcreate\s+(?:or\s+replace\s+)?function\b/gi;
  let match: RegExpExecArray | null;
  header.lastIndex = 0;
  while ((match = header.exec(scanned.masked)) !== null) {
    const at = match.index;
    const nextSemicolon = scanned.masked.indexOf(';', at);
    const limit = nextSemicolon === -1 ? sql.length : nextSemicolon;
    const block = scanned.blocks.find((candidate) => candidate.start > at && candidate.start < limit);
    if (!block) continue;
    const declaration = sql.slice(at, block.start);
    if (!/\blanguage\s+sql\b/i.test(declaration)) continue; // plpgsql bodies go to the plpgsql grammar
    const name = /(?:create\s+(?:or\s+replace\s+)?function\s+)([A-Za-z0-9_."]+)/i.exec(declaration)?.[1] ?? '?';
    units.push({
      sql: sql.slice(block.bodyStart, block.bodyEnd),
      offset: block.bodyStart,
      label: `language sql body of ${name}`,
    });
  }
  return units;
}

/** Arm 2 (structural): everything that must hold before a parser is even consulted. */
function structuralErrors(sql: string): string[] {
  const scanned = scan(sql);
  const errors: string[] = [];
  errors.push(...dollarQuoteErrors(sql, scanned));
  for (const unit of sqlUnits(sql, scanned)) {
    const unitScan = scan(unit.sql);
    for (const message of insertValuesWhereErrors(unit.sql, unitScan)) {
      errors.push(`${unit.label}: ${message}`);
    }
  }
  return errors;
}

/** Arm 1 (grammar): the real PostgreSQL parser, over the file and over every SQL body. */
async function grammarErrors(sql: string): Promise<string[]> {
  const errors: string[] = [];
  const scanned = scan(sql);

  try {
    await parse(sql);
  } catch (error) {
    const at = (error as { sqlDetails?: { cursorPosition?: number } })?.sqlDetails?.cursorPosition;
    errors.push(
      `the migration is not valid PostgreSQL: ${(error as Error).message}` +
        (typeof at === 'number' ? ` (line ${lineOf(sql, at)})` : ''),
    );
  }

  try {
    await parsePlPgSQL(sql);
  } catch (error) {
    errors.push(`a plpgsql function body does not parse: ${(error as Error).message}`);
  }

  // The outer grammar sees a function body as one opaque string literal, so a broken `language
  // sql` body (the shape defect #2 had) only fails when the body is parsed on its own.
  for (const unit of sqlUnits(sql, scanned).filter((candidate) => candidate.label.startsWith('language sql'))) {
    try {
      const parsed = (await parse(unit.sql)) as { stmts?: unknown[] };
      if (!parsed?.stmts?.length) errors.push(`${unit.label}: parsed to no statement at all`);
    } catch (error) {
      errors.push(`${unit.label}: ${(error as Error).message}`);
    }
  }

  return errors;
}

// --------------------------------------------------------------------- the fixtures
// Deliberately broken SQL, checked with the very same code that checks the migration. If either
// arm ever stops recognising a defect, this run fails here instead of passing silently.

const FIXTURE_PLACE_TABLE = 'create table if not exists public.gate_fixture (a text, b boolean);';

const MUST_FAIL = [
  {
    name: 'dollar-quote delimiter collides with the function body',
    sql: `
      create or replace function public.gate_curation(p_price text)
      returns text language plpgsql as $$
      begin
        if p_price not in ('$', '$$', '$$$', '$$$$') then
          raise exception 'invalid price level';
        end if;
        return p_price;
      end;
      $$;
    `,
  },
  {
    name: 'INSERT ... VALUES (...) WHERE ... at statement level',
    sql: `${FIXTURE_PLACE_TABLE} insert into public.gate_fixture (a, b) values ('x', true) where true;`,
  },
  {
    name: 'INSERT ... VALUES (...) WHERE ... inside a language sql function',
    sql: `
      create or replace function public.gate_record(p_ok boolean)
      returns void language sql as $$
        insert into public.gate_fixture (a, b)
        values ('x', p_ok)
        where p_ok;
      $$;
    `,
  },
];

// Equivalent SQL that must keep passing: a SELECT-shaped guard and an ON CONFLICT ... WHERE are
// both legal, so the gate must not reject valid PostgreSQL.
const MUST_PASS = [
  {
    name: 'INSERT ... SELECT ... WHERE ... (the shape the fix uses)',
    sql: `${FIXTURE_PLACE_TABLE} insert into public.gate_fixture (a, b) select 'x', true where true;`,
  },
  {
    name: 'INSERT ... VALUES ... ON CONFLICT ... WHERE ...',
    sql: `${FIXTURE_PLACE_TABLE} insert into public.gate_fixture (a, b) values ('x', true) on conflict (a) do update set b = true where true;`,
  },
  {
    name: 'a tagged dollar quote whose body contains $$',
    sql: `
      create or replace function public.gate_curation(p_price text)
      returns text language plpgsql as $gate_curation$
      begin
        if p_price not in ('$', '$$', '$$$', '$$$$') then
          raise exception 'invalid price level';
        end if;
        return p_price;
      end;
      $gate_curation$;
    `,
  },
];

// --------------------------------------------------------------------- migration history
function assertMigrationHistory(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();

  if (!files.includes(EXPECTED_MIGRATION)) {
    throw new Error(
      `${MIGRATIONS_DIR} must contain ${EXPECTED_MIGRATION}: live Supabase recorded this ` +
        `migration under version ${EXPECTED_VERSION}, so any other name applies the same schema ` +
        `again under a second version. Found: ${files.join(', ')}`,
    );
  }

  const duplicates = files.filter((name) => name !== EXPECTED_MIGRATION && /admin_control_center/i.test(name));
  if (duplicates.length > 0) {
    throw new Error(`${MIGRATIONS_DIR} must not contain a second admin control centre migration: ${duplicates.join(', ')}`);
  }

  for (const retired of RETIRED_NAMES) {
    if (existsSync(join(MIGRATIONS_DIR, retired))) {
      throw new Error(`${MIGRATIONS_DIR}/${retired} was retired and must not come back`);
    }
  }

  // The schema may be declared once, in the versioned file above and nowhere else.
  for (const marker of OWNED_OBJECTS) {
    const owners = files.filter((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8').includes(marker));
    if (owners.length !== 1 || owners[0] !== EXPECTED_MIGRATION) {
      throw new Error(`"${marker}" must be declared only in ${EXPECTED_MIGRATION}; found it in: ${owners.join(', ') || 'nothing'}`);
    }
  }

  // Supabase applies migrations in filename order, so the recorded version has to be the newest.
  for (const name of files) {
    if (name === EXPECTED_MIGRATION) continue;
    const version = /^(\d+)/.exec(name)?.[1];
    if (!version) throw new Error(`${MIGRATIONS_DIR}/${name} has no version prefix`);
    if (version >= EXPECTED_VERSION) {
      throw new Error(
        `${MIGRATIONS_DIR}/${name} (${version}) sorts at or after ${EXPECTED_VERSION}; ` +
          `${EXPECTED_MIGRATION} must stay the newest migration so application order matches live history`,
      );
    }
    if (RETIRED_VERSIONS.includes(version)) {
      throw new Error(`${MIGRATIONS_DIR}/${name} reuses the retired version ${version}`);
    }
  }

  return join(MIGRATIONS_DIR, EXPECTED_MIGRATION);
}

// --------------------------------------------------------------------- run
function report(label: string, errors: string[]) {
  if (errors.length === 0) return;
  console.error(`${label} FAILED:`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exitCode = 1;
}

const migrationPath = assertMigrationHistory();
const migrationSql = readFileSync(migrationPath, 'utf8');

report(`${migrationPath} (structural rules)`, structuralErrors(migrationSql));
report(`${migrationPath} (PostgreSQL grammar)`, await grammarErrors(migrationSql));

for (const fixture of MUST_FAIL) {
  const structural = structuralErrors(fixture.sql);
  if (structural.length === 0) {
    report(`gate self-check: structural rules must reject "${fixture.name}"`, [
      'the structural arm accepted SQL it exists to reject, so it would not have caught the migration defect',
    ]);
  }
  const grammar = await grammarErrors(fixture.sql);
  if (grammar.length === 0) {
    report(`gate self-check: PostgreSQL grammar must reject "${fixture.name}"`, [
      'the grammar arm accepted SQL PostgreSQL cannot execute; the parser is not being applied to this shape',
    ]);
  }
}

for (const fixture of MUST_PASS) {
  report(`gate self-check: valid SQL must pass (${fixture.name})`, [
    ...structuralErrors(fixture.sql).map((message) => `structural: ${message}`),
    ...(await grammarErrors(fixture.sql)).map((message) => `grammar: ${message}`),
  ]);
}

if (process.exitCode) {
  console.error('Migration SQL verification failed');
} else {
  console.log(
    `Migration SQL verification passed (${EXPECTED_MIGRATION}: real PostgreSQL grammar, ` +
      'dollar-quote and INSERT/VALUES rules, and migration-history alignment, each proven against broken fixtures)',
  );
}
