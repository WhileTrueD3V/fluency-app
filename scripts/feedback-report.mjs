import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const logPath = process.env.KIBBO_FEEDBACK_LOG_PATH
  ? path.resolve(process.env.KIBBO_FEEDBACK_LOG_PATH)
  : path.resolve(root, 'data/feedback-submissions.jsonl');
const outDir = path.resolve(root, 'dist');
const jsonOut = path.join(outDir, 'feedback-report.json');
const mdOut = path.join(outDir, 'feedback-report.md');

function parseRows() {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((row) => row && row.event === 'first_completion_feedback');
}

function countBy(rows, getKey) {
  return rows.reduce((counts, row) => {
    const key = getKey(row) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function summarize(rows) {
  const total = rows.length;
  const ratings = countBy(rows, (row) => String(row.rating ?? 'unknown'));
  const ratingSum = rows.reduce((sum, row) => sum + Number(row.rating ?? 0), 0);
  const averageRating = total ? Math.round((ratingSum / total) * 10) / 10 : null;
  const lowRatings = rows.filter((row) => Number(row.rating) <= 3).length;
  const commented = rows.filter((row) => String(row.comment ?? '').trim()).length;
  const latest = [...rows]
    .sort((a, b) => String(b.receivedAt ?? '').localeCompare(String(a.receivedAt ?? '')))
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      receivedAt: row.receivedAt,
      rating: row.rating,
      firstSessionType: row.firstSessionType || 'unknown',
      platform: row.client?.platform || 'unknown',
      comment: row.comment || '',
    }));

  return {
    source: logPath,
    generatedAt: new Date().toISOString(),
    total,
    averageRating,
    lowRatingCount: lowRatings,
    lowRatingPercent: pct(lowRatings, total),
    commentedCount: commented,
    commentedPercent: pct(commented, total),
    ratings,
    bySessionType: countBy(rows, (row) => row.firstSessionType),
    byPlatform: countBy(rows, (row) => row.client?.platform),
    latest,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Kibbo Feedback Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Source: \`${report.source}\``,
    '',
    '## Summary',
    '',
    `- Total feedback submissions: ${report.total}`,
    `- Average rating: ${report.averageRating ?? 'n/a'}`,
    `- Ratings 1-3: ${report.lowRatingCount} (${report.lowRatingPercent}%)`,
    `- With comments: ${report.commentedCount} (${report.commentedPercent}%)`,
    '',
    '## Rating Distribution',
    '',
    ...['1', '2', '3', '4', '5'].map((rating) => `- ${rating}: ${report.ratings[rating] ?? 0}`),
    '',
    '## By First Drill Type',
    '',
    ...Object.entries(report.bySessionType).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Latest Comments',
    '',
    ...(
      report.latest.length
        ? report.latest.map((row) => {
          const comment = row.comment ? row.comment.replace(/\s+/g, ' ') : '(no comment)';
          return `- ${row.rating}/5 · ${row.firstSessionType} · ${row.platform} · ${row.receivedAt}: ${comment}`;
        })
        : ['No feedback submissions yet.']
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(outDir, { recursive: true });
const report = summarize(parseRows());
fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdOut, renderMarkdown(report));

console.log('Feedback report');
console.log(`Source: ${logPath}`);
console.log(`Total: ${report.total}`);
console.log(`Average rating: ${report.averageRating ?? 'n/a'}`);
console.log(`Wrote ${path.relative(root, jsonOut)}`);
console.log(`Wrote ${path.relative(root, mdOut)}`);
