import type { Request } from 'express';

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

/** Device info for a new session: which browser and which IP */
export function getRequestMeta(req: Request): RequestMeta {
  const userAgent = req.headers['user-agent'];
  return {
    userAgent: userAgent ? userAgent.slice(0, 500) : null,
    ipAddress: req.ip ? req.ip.slice(0, 45) : null,
  };
}