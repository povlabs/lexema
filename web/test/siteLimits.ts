// The sites' per-visitor limits, as worker/index.ts hands them to `withRateLimits`.

import { developerLimitOf } from "@/worker/developers/limits.ts";
import { dictionaryLimitOf } from "@/worker/dictionary/limits.ts";
import type { SiteLimits } from "@/worker/shared/rateLimit.ts";

export const SITE_LIMITS: SiteLimits = { developers: developerLimitOf, dictionary: dictionaryLimitOf };
