import { Injectable, NestMiddleware, BadRequestException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const store = new Map<string, RateLimitEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      store.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > MAX_REQUESTS) {
      throw new BadRequestException({
        message: "Too many requests. Please slow down and try again later.",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    if (entry.count === MAX_REQUESTS) {
      _res.setHeader("Retry-After", Math.ceil(WINDOW_MS / 1000));
    }

    if (entry.count % 10 === 0) cleanup();

    next();
  }
}
