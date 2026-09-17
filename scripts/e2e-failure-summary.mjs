// Turns a Playwright JSON report into a short failure digest. Used by the
// temporary E2E diagnostics workflow, where job logs are not reachable.
import { readFileSync, writeFileSync } from 'node:fs';

const [inputPath = 'playwright-results.json', outputPath = 'summary.md'] = process.argv.slice(2);

const clean = (value) => String(value || '')
  .replace(/\u001b\[[0-9;]*m/g, '')
  .replace(/\r/g, '');

let report;
try {
  report = JSON.parse(clean(readFileSync(inputPath, 'utf8')));
} catch {
  writeFileSync(outputPath, 'E2E diagnostics: no Playwright JSON report was produced.\n');
  process.exit(0);
}

const failures = [];
const walk = (suites, titlePrefix = '') => {
  for (const suite of suites || []) {
    const title = titlePrefix ? `${titlePrefix} › ${suite.title}` : suite.title;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          if (result.status === 'passed' || result.status === 'skipped') continue;
          const message = clean(result.error?.message || result.error?.value || '')
            .split('\n')
            .slice(0, 18)
            .join('\n');
          failures.push(`### ${title} › ${spec.title}\n- status: \`${result.status}\` (attempt ${result.retry + 1})\n\`\`\`\n${message}\n\`\`\``);
        }
      }
    }
    walk(suite.suites, title);
  }
};

walk(report.suites);

const stats = `stats: ${JSON.stringify(report.stats || {})}`;
const body = failures.length
  ? `E2E diagnostics — ${failures.length} failing result(s).\n\n${stats}\n\n${failures.join('\n\n')}`.slice(0, 60000)
  : `E2E diagnostics — all Playwright tests passed.\n\n${stats}`;

writeFileSync(outputPath, `${body}\n`);
console.log(body.slice(0, 8000));
