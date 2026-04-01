import { getRequiredEnv } from "./required-env";

export function getAdminJwtSecret(): string {
  return process.env.ADMIN_JWT_SECRET || getRequiredEnv("API_SECRET_KEY");
}

