export type AIProviderId = 'deterministic' | 'bridge-openai-compatible' | 'official-openai-compatible';
export type AIAgentId = 'headline-impact' | 'fx-setup' | 'opportunity-ranker';

export interface AIProviderStatus {
  provider: AIProviderId;
  model: string | null;
  enabled: boolean;
  available: boolean;
  baseUrl?: string;
  lastError?: string;
  headlineImpactModel?: string;
  fxSetupModel?: string;
  opportunityRankerModel?: string;

  lastLatencyMs?: number;
  avgLatencyMs?: number;
  usage?: {
    totalRequests: number;
    totalSuccess: number;
    totalFailures: number;
    byAgent: Record<AIAgentId, {
      requests: number;
      success: number;
      failure: number;
      lastTriggeredAt?: number;
      lastSuccessAt?: number;
      lastFailureAt?: number;
      lastModel?: string;
      lastReasoningEffort?: string;
      lastStatusCode?: number;
      rateLimit?: {
        limit?: string;
        remaining?: string;
        reset?: string;
        retryAfter?: string;
      };
    }>;
    recent: Array<{
      agent: AIAgentId;
      model: string;
      ok: boolean;
      timestamp: number;
      latencyMs?: number;
      statusCode?: number;
      error?: string;
    }>;
  };
}

export interface AIInvocationOptions {
  agent: AIAgentId;
  systemPrompt: string;
  userPayload: unknown;
  timeoutMs?: number;
  maxRetries?: number;
  maxTokens?: number;
}

export interface AIInvocationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const AI_PROVIDER = (process.env.AI_PROVIDER || 'deterministic') as AIProviderId;
const AI_BASE_URL = (
  process.env.AI_BRIDGE_BASE_URL ||
  process.env.LOCAL_AI_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'http://127.0.0.1:8765/v1'
).replace(/\/$/, '');
const AI_API_KEY = process.env.AI_BRIDGE_API_KEY || process.env.LOCAL_AI_API_KEY || process.env.OPENAI_API_KEY || '';
const HEADLINE_IMPACT_MODEL = process.env.AI_HEADLINE_MODEL || 'claude-haiku-4-5-20251001';
const FX_SETUP_MODEL = process.env.AI_FX_SETUP_MODEL || 'minimax/minimax-m2.5';
const OPPORTUNITY_RANKER_MODEL = process.env.AI_OPPORTUNITY_MODEL || 'gpt-5.2';

// Per-agent endpoint overrides (base URL + API key)
const AGENT_ENDPOINTS: Partial<Record<AIAgentId, { baseUrl: string; apiKey: string }>> = {};
if (process.env.AI_FX_SETUP_BASE_URL) {
  AGENT_ENDPOINTS['fx-setup'] = {
    baseUrl: process.env.AI_FX_SETUP_BASE_URL.replace(/\/$/, ''),
    apiKey: process.env.AI_FX_SETUP_API_KEY || '',
  };
}
if (process.env.AI_HEADLINE_BASE_URL) {
  AGENT_ENDPOINTS['headline-impact'] = {
    baseUrl: process.env.AI_HEADLINE_BASE_URL.replace(/\/$/, ''),
    apiKey: process.env.AI_HEADLINE_API_KEY || '',
  };
}
if (process.env.AI_OPPORTUNITY_BASE_URL) {
  AGENT_ENDPOINTS['opportunity-ranker'] = {
    baseUrl: process.env.AI_OPPORTUNITY_BASE_URL.replace(/\/$/, ''),
    apiKey: process.env.AI_OPPORTUNITY_API_KEY || '',
  };
}

const HEADLINE_REASONING_EFFORT = process.env.AI_HEADLINE_REASONING_EFFORT || 'low';
const FX_SETUP_REASONING_EFFORT = process.env.AI_FX_SETUP_REASONING_EFFORT || 'medium';
const OPPORTUNITY_REASONING_EFFORT = process.env.AI_OPPORTUNITY_REASONING_EFFORT || 'medium';

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 12_000);
const DEFAULT_MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || 1);

import { trackRequest } from './apiTracker.js';

let lastProviderError = '';
let lastLatencyMs = 0;
let latencySamples: number[] = [];
const usageStats = {
  totalRequests: 0,
  totalSuccess: 0,
  totalFailures: 0,
  byAgent: {
    'headline-impact': { requests: 0, success: 0, failure: 0 },
    'fx-setup': { requests: 0, success: 0, failure: 0 },
    'opportunity-ranker': { requests: 0, success: 0, failure: 0 },
  } as Record<AIAgentId, {
    requests: number;
    success: number;
    failure: number;
    lastTriggeredAt?: number;
    lastSuccessAt?: number;
    lastFailureAt?: number;
    lastModel?: string;
    lastReasoningEffort?: string;
    lastStatusCode?: number;
    rateLimit?: {
      limit?: string;
      remaining?: string;
      reset?: string;
      retryAfter?: string;
    };
  }>,
  recent: [] as Array<{
    agent: AIAgentId;
    model: string;
    ok: boolean;
    timestamp: number;
    latencyMs?: number;
    statusCode?: number;
    error?: string;
  }>,
};

function extractJSONObject(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Strip markdown fences if present
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // Find the outermost JSON object or array
  const firstBrace = stripped.indexOf('{');
  const firstBracket = stripped.indexOf('[');
  const start = firstBrace === -1 ? firstBracket
    : firstBracket === -1 ? firstBrace
    : Math.min(firstBrace, firstBracket);
  if (start === -1) return stripped;

  const closer = stripped[start] === '{' ? '}' : ']';
  const lastClose = stripped.lastIndexOf(closer);
  if (lastClose > start) {
    return stripped.slice(start, lastClose + 1);
  }

  return stripped;
}

function isAIEnabled() {
  return AI_PROVIDER !== 'deterministic';
}

function recordLatency(ms: number) {
  lastLatencyMs = ms;
  latencySamples.push(ms);
  if (latencySamples.length > 20) latencySamples.shift();
}

function getAverageLatency() {
  if (latencySamples.length === 0) return 0;
  return Math.round(latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length);
}

function pushRecent(entry: {
  agent: AIAgentId;
  model: string;
  ok: boolean;
  timestamp: number;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
}) {
  usageStats.recent.unshift(entry);
  if (usageStats.recent.length > 50) usageStats.recent.pop();
}

function modelForAgent(agent: AIAgentId) {
  switch (agent) {
    case 'headline-impact':
      return HEADLINE_IMPACT_MODEL;
    case 'fx-setup':
      return FX_SETUP_MODEL;
    case 'opportunity-ranker':
      return OPPORTUNITY_RANKER_MODEL;
  }
}

function reasoningEffortForAgent(agent: AIAgentId) {
  switch (agent) {
    case 'headline-impact':
      return HEADLINE_REASONING_EFFORT;
    case 'fx-setup':
      return FX_SETUP_REASONING_EFFORT;
    case 'opportunity-ranker':
      return OPPORTUNITY_REASONING_EFFORT;
  }
}

function endpointForAgent(agent: AIAgentId) {
  const override = AGENT_ENDPOINTS[agent];
  return {
    baseUrl: override?.baseUrl || AI_BASE_URL,
    apiKey: override?.apiKey || AI_API_KEY,
  };
}

function supportsReasoningEffort(model: string) {
  return model.startsWith('gpt-');
}

export function getAIProviderStatus(): AIProviderStatus {
  return {
    provider: AI_PROVIDER,
    model: isAIEnabled() ? HEADLINE_IMPACT_MODEL : null,
    enabled: isAIEnabled(),
    available: isAIEnabled() ? !lastProviderError : true,
    baseUrl: isAIEnabled() ? AI_BASE_URL : undefined,
    lastError: lastProviderError || undefined,
    headlineImpactModel: isAIEnabled() ? HEADLINE_IMPACT_MODEL : undefined,
    fxSetupModel: isAIEnabled() ? FX_SETUP_MODEL : undefined,
    opportunityRankerModel: isAIEnabled() ? OPPORTUNITY_RANKER_MODEL : undefined,

    lastLatencyMs: lastLatencyMs || undefined,
    avgLatencyMs: getAverageLatency() || undefined,
    usage: isAIEnabled() ? usageStats : undefined,
  };
}

export function resetAIUsageStats() {
  lastProviderError = '';
  lastLatencyMs = 0;
  latencySamples = [];
  usageStats.totalRequests = 0;
  usageStats.totalSuccess = 0;
  usageStats.totalFailures = 0;
  usageStats.recent = [];
  for (const agent of ['headline-impact', 'fx-setup', 'opportunity-ranker'] as const) {
    usageStats.byAgent[agent] = {
      requests: 0,
      success: 0,
      failure: 0,
    };
  }
}

export async function invokeAIAgent<T>(options: AIInvocationOptions): Promise<AIInvocationResult<T>> {
  if (!isAIEnabled()) {
    return { ok: false, error: 'ai disabled' };
  }

  const model = modelForAgent(options.agent);
  const reasoningEffort = reasoningEffortForAgent(options.agent);
  const { baseUrl, apiKey } = endpointForAgent(options.agent);
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? 2000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    usageStats.totalRequests += 1;
    usageStats.byAgent[options.agent].requests += 1;
    usageStats.byAgent[options.agent].lastTriggeredAt = Date.now();
    usageStats.byAgent[options.agent].lastModel = model;
    usageStats.byAgent[options.agent].lastReasoningEffort = reasoningEffort;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          ...(supportsReasoningEffort(model) ? { reasoning_effort: reasoningEffort } : {}),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: options.systemPrompt },
            { role: 'user', content: JSON.stringify(options.userPayload) },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const elapsed = Date.now() - startedAt;
      recordLatency(elapsed);
      trackRequest({ service: 'ai-proxy', endpoint: options.agent, method: 'POST', status: response.status, latencyMs: elapsed, detail: model });
      usageStats.byAgent[options.agent].lastStatusCode = response.status;
      usageStats.byAgent[options.agent].rateLimit = {
        limit: response.headers.get('x-ratelimit-limit-requests') || response.headers.get('x-ratelimit-limit') || undefined,
        remaining: response.headers.get('x-ratelimit-remaining-requests') || response.headers.get('x-ratelimit-remaining') || undefined,
        reset: response.headers.get('x-ratelimit-reset-requests') || response.headers.get('x-ratelimit-reset') || undefined,
        retryAfter: response.headers.get('retry-after') || undefined,
      };

      if (!response.ok) {
        lastProviderError = `${options.agent} ${response.status}`;
        usageStats.totalFailures += 1;
        usageStats.byAgent[options.agent].failure += 1;
        usageStats.byAgent[options.agent].lastFailureAt = Date.now();
        pushRecent({
          agent: options.agent,
          model,
          ok: false,
          timestamp: Date.now(),
          latencyMs: Date.now() - startedAt,
          statusCode: response.status,
          error: lastProviderError,
        });
        if (response.status === 429) {
          return { ok: false, error: lastProviderError };
        }
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastProviderError = `${options.agent} empty response`;
        usageStats.totalFailures += 1;
        usageStats.byAgent[options.agent].failure += 1;
        usageStats.byAgent[options.agent].lastFailureAt = Date.now();
        pushRecent({
          agent: options.agent,
          model,
          ok: false,
          timestamp: Date.now(),
          latencyMs: Date.now() - startedAt,
          statusCode: response.status,
          error: lastProviderError,
        });
        continue;
      }

      try {
        const parsed = JSON.parse(extractJSONObject(content)) as T;
        lastProviderError = '';
        usageStats.totalSuccess += 1;
        usageStats.byAgent[options.agent].success += 1;
        usageStats.byAgent[options.agent].lastSuccessAt = Date.now();
        pushRecent({
          agent: options.agent,
          model,
          ok: true,
          timestamp: Date.now(),
          latencyMs: Date.now() - startedAt,
          statusCode: response.status,
        });
        return { ok: true, data: parsed };
      } catch (error) {
        lastProviderError = `${options.agent} invalid json: ${(error as Error).message}`;
        usageStats.totalFailures += 1;
        usageStats.byAgent[options.agent].failure += 1;
        usageStats.byAgent[options.agent].lastFailureAt = Date.now();
        pushRecent({
          agent: options.agent,
          model,
          ok: false,
          timestamp: Date.now(),
          latencyMs: Date.now() - startedAt,
          statusCode: response.status,
          error: lastProviderError,
        });
        continue;
      }
    } catch (error) {
      clearTimeout(timeout);
      const status = (error as Error).name === 'AbortError' ? 'timeout' as const : 'error' as const;
      trackRequest({ service: 'ai-proxy', endpoint: options.agent, method: 'POST', status, latencyMs: Date.now() - startedAt, detail: `${model}: ${(error as Error).message}` });
      lastProviderError = (error as Error).name === 'AbortError'
        ? `${options.agent} timeout`
        : (error as Error).message;
      usageStats.totalFailures += 1;
      usageStats.byAgent[options.agent].failure += 1;
      usageStats.byAgent[options.agent].lastFailureAt = Date.now();
      pushRecent({
        agent: options.agent,
        model,
        ok: false,
        timestamp: Date.now(),
        latencyMs: Date.now() - startedAt,
        error: lastProviderError,
      });
    }
  }

  return { ok: false, error: lastProviderError || `${options.agent} failed` };
}
