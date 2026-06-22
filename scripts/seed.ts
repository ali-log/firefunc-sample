// Convenience wrapper so `node scripts/seed.ts` (via tsx) runs the DB seed.
import { seed } from "../src/db/seed.js";
import { logger } from "../src/shared/logger.js";

const result = seed();
logger.info("scripts/seed complete", { ...result });
