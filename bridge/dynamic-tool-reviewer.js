const REVIEW_TIMEOUT_MS = 90_000;

export const REVIEW_REQUIRED_TOOLS = new Set([
  'run_figma_code',
  'create_skill',
  'update_skill',
  'download_files',
]);

const REVIEW_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    reason: { type: 'string' },
  },
  required: ['approved', 'risk', 'reason'],
  additionalProperties: false,
};

const REVIEWER_INSTRUCTIONS = `You are FigCodex's automatic permission reviewer. Review a proposed
side-effecting tool call against the user's exact request. Return only the JSON object required by
the output schema.

Approve only when the proposed action is directly authorized by the current user request, is
reasonably scoped to that request, and does not expose secrets, weaken security, or perform an
unrelated destructive action. A normal, reversible Figma document edit explicitly requested by the
user may be approved. A narrowly requested skill edit or file download may be approved. Deletion,
bulk replacement, credential access, data exfiltration, or an action whose scope cannot be
understood must be denied unless the user explicitly and narrowly authorized it.

Judge the proposed action itself. Do not execute tools, modify files, or invent missing consent.
If evidence is incomplete or the proposal is malformed, deny it. Keep reason concise and concrete.`;

export function needsDynamicToolReview(tool) {
  return REVIEW_REQUIRED_TOOLS.has(String(tool || ''));
}

export function parseReviewDecision(text) {
  const source = String(text || '').trim();
  const candidates = [source];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(source.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (typeof value?.approved !== 'boolean') continue;
      if (!['low', 'medium', 'high', 'critical'].includes(value?.risk)) continue;
      if (typeof value?.reason !== 'string' || !value.reason.trim()) continue;
      return {
        approved: value.approved,
        risk: value.risk,
        reason: value.reason.trim().slice(0, 1_000),
      };
    } catch {
      // Try the next bounded representation.
    }
  }
  return null;
}

function summarizeDownloadArguments(args) {
  const allFiles = Array.isArray(args?.files) ? args.files : [];
  const files = allFiles.slice(0, 100);
  return {
    fileCount: allFiles.length,
    truncated: allFiles.length > files.length,
    files: files.map((file) => {
      const content = file?.content;
      const contentSize = typeof content === 'string'
        ? content.length
        : Array.isArray(content)
          ? content.length
          : content && typeof content === 'object'
            ? Object.keys(content).length
            : 0;
      return {
        filename: String(file?.filename || '').slice(0, 300),
        mimeType: String(file?.mimeType || '').slice(0, 200),
        isBinary: Boolean(file?.isBinary),
        contentSize,
      };
    }),
  };
}

export function reviewableArguments(tool, args) {
  if (tool === 'download_files') return summarizeDownloadArguments(args);
  if (tool === 'run_figma_code') {
    return {
      description: String(args?.description || '').slice(0, 2_000),
      code: String(args?.code || '').slice(0, 100_000),
    };
  }
  if (tool === 'create_skill' || tool === 'update_skill') {
    return {
      ...(tool === 'update_skill' ? { id: String(args?.id || '').slice(0, 500) } : {}),
      name: String(args?.name || '').slice(0, 500),
      content: String(args?.content || '').slice(0, 60_000),
    };
  }
  return args && typeof args === 'object' ? args : {};
}

export async function reviewDynamicTool({ codex, root, userPrompt, tool, arguments: args }) {
  let reviewerThreadId = '';
  let reviewerTurnId = '';
  let reviewerText = '';
  let settled = false;
  let timer = null;
  let notificationHandler = null;

  const completion = new Promise((resolve) => {
    const finish = (decision) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (notificationHandler) codex.off('notification', notificationHandler);
      resolve(decision);
    };

    notificationHandler = ({ method, params }) => {
      if (!reviewerThreadId || params?.threadId !== reviewerThreadId) return;
      if (method === 'item/completed' && params?.item?.type === 'agentMessage') {
        reviewerText = String(params.item.text || reviewerText);
        return;
      }
      if (method === 'turn/completed') {
        const status = params?.turn?.status;
        const parsed = status === 'completed' ? parseReviewDecision(reviewerText) : null;
        finish(parsed || {
          approved: false,
          risk: 'high',
          reason: status === 'completed'
            ? 'Auto-review returned an invalid decision, so the action was denied.'
            : `Auto-review ended with status ${status || 'unknown'}, so the action was denied.`,
        });
      }
    };

    codex.on('notification', notificationHandler);
    timer = setTimeout(() => {
      if (reviewerThreadId && reviewerTurnId) {
        void codex.request('turn/interrupt', {
          threadId: reviewerThreadId,
          turnId: reviewerTurnId,
        }).catch(() => {});
      }
      finish({
        approved: false,
        risk: 'high',
        reason: 'Auto-review timed out, so the action was denied.',
      });
    }, REVIEW_TIMEOUT_MS);
    timer.unref();
  });

  try {
    const started = await codex.request('thread/start', {
      cwd: root,
      runtimeWorkspaceRoots: [root],
      approvalPolicy: 'never',
      sandbox: 'read-only',
      ephemeral: true,
      serviceName: 'figcodex_auto_reviewer',
      developerInstructions: REVIEWER_INSTRUCTIONS,
    });
    reviewerThreadId = String(started?.thread?.id || '');
    if (!reviewerThreadId) throw new Error('reviewer thread id is missing');

    const proposedArguments = reviewableArguments(tool, args);
    const reviewPrompt = [
      'CURRENT USER REQUEST:',
      String(userPrompt || '').slice(0, 80_000),
      '',
      'PROPOSED TOOL:',
      String(tool || ''),
      '',
      'PROPOSED ARGUMENTS:',
      JSON.stringify(proposedArguments, null, 2),
    ].join('\n');
    const turn = await codex.request('turn/start', {
      threadId: reviewerThreadId,
      input: [{ type: 'text', text: reviewPrompt, text_elements: [] }],
      outputSchema: REVIEW_OUTPUT_SCHEMA,
    });
    reviewerTurnId = String(turn?.turn?.id || '');
    return await completion;
  } catch (error) {
    settled = true;
    if (timer) clearTimeout(timer);
    if (notificationHandler) codex.off('notification', notificationHandler);
    return {
      approved: false,
      risk: 'high',
      reason: `Auto-review could not run: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1_000),
    };
  }
}
