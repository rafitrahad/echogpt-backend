import type { Request } from 'express';
import { UsageType } from '../enums';

/**
 * AI usage details a controller attaches to the request,
 * so the request-logging interceptor can store them in api_usage_logs.
 */
export interface RequestUsageMeta {
  usageType: UsageType;
  providerId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

export type RequestWithUsageMeta = Request & { usageMeta?: RequestUsageMeta };