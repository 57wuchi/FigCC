import assert from 'node:assert/strict';
import test from 'node:test';
import {
  needsDynamicToolReview,
  parseReviewDecision,
  reviewableArguments,
} from '../bridge/dynamic-tool-reviewer.js';

test('only side-effecting FigCodex tools require bridge auto-review', () => {
  assert.equal(needsDynamicToolReview('run_figma_code'), true);
  assert.equal(needsDynamicToolReview('create_skill'), true);
  assert.equal(needsDynamicToolReview('update_skill'), true);
  assert.equal(needsDynamicToolReview('download_files'), true);
  assert.equal(needsDynamicToolReview('get_selection'), false);
  assert.equal(needsDynamicToolReview('fetch_docs'), false);
  assert.equal(needsDynamicToolReview('notify'), false);
});

test('review decisions parse structured and fenced JSON but fail closed otherwise', () => {
  assert.deepEqual(
    parseReviewDecision('{"approved":true,"risk":"low","reason":"Scoped edit."}'),
    { approved: true, risk: 'low', reason: 'Scoped edit.' }
  );
  assert.deepEqual(
    parseReviewDecision('```json\n{"approved":false,"risk":"high","reason":"Not authorized."}\n```'),
    { approved: false, risk: 'high', reason: 'Not authorized.' }
  );
  assert.equal(parseReviewDecision('{"approved":true,"risk":"unknown","reason":"No."}'), null);
  assert.equal(parseReviewDecision('not json'), null);
});

test('download review metadata excludes generated file contents', () => {
  const summarized = reviewableArguments('download_files', {
    files: [{ filename: 'icon.svg', mimeType: 'image/svg+xml', content: '<svg>secret</svg>' }],
  });
  assert.deepEqual(summarized, {
    fileCount: 1,
    truncated: false,
    files: [{
      filename: 'icon.svg',
      mimeType: 'image/svg+xml',
      isBinary: false,
      contentSize: 17,
    }],
  });
  assert.ok(!JSON.stringify(summarized).includes('secret'));
});
