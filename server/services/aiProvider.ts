export type AIProviderId = 'deterministic' | 'bridge-openai-compatible' | 'official-openai-compatible';
export type AIAgentId = 'headline-impact' | 'fx-setup' | 'opportunity-ranker' | 'country-fundamentals';

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
  countryFundamentalsModel?: string;
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
const HEADLINE_IMPACT_MODEL = process.env.AI_HEADLINE_MODEL || process.env.LOCAL_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const FX_SETUP_MODEL = process.env.AI_FX_SETUP_MODEL || HEADLINE_IMPACT_MODEL;
const OPPORTUNITY_RANKER_MODEL = process.env.AI_OPPORTUNITY_MODEL || HEADLINE_IMPACT_MODEL;
const COUNTRY_FUNDAMENTALS_MODEL = process.env.AI_COUNTRY_MODEL || HEADLINE_IMPACT_MODEL;
const HEADLINE_REASONING_EFFORT = process.env.AI_HEADLINE_REASONING_EFFORT || 'low';
const FX_SETUP_REASONING_EFFORT = process.env.AI_FX_SETUP_REASONING_EFFORT || 'medium';
const OPPORTUNITY_REASONING_EFFORT = process.env.AI_OPPORTUNITY_REASONING_EFFORT || 'low';
const COUNTRY_REASONING_EFFORT = process.env.AI_COUNTRY_REASONING_EFFORT || 'medium';
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 12_000);
const DEFAULT_MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || 1);

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
    'country-fundamentals': { requests: 0, success: 0, failure: 0 },
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

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  if (candidate.startsWith('{') || candidate.startsWith('[')) {
    return candidate;
  }

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }

  return candidate;
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
    case 'country-fundamentals':
      return COUNTRY_FUNDAMENTALS_MODEL;
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
    case 'country-fundamentals':
      return COUNTRY_REASONING_EFFORT;
  }
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
    countryFundamentalsModel: isAIEnabled() ? COUNTRY_FUNDAMENTALS_MODEL : undefined,
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
  for (const agent of ['headline-impact', 'fx-setup', 'opportunity-ranker', 'country-fundamentals'] as const) {
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
      const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
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
      recordLatency(Date.now() - startedAt);
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
