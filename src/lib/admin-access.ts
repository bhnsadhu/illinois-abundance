import 'server-only';
import { emailSchema } from '@/lib/validation';

// Two explicit deployment-controlled identities. Roster fields and login form
// roles never grant admin access; current active membership is still required.
export function isAdminEmail(email: string): boolean {
  const candidate = emailSchema.safeParse(email);
  if (!candidate.success) return false;
  return [process.env.ADMIN_EMAIL, process.env.SECOND_ADMIN_EMAIL].some(value => {
    const configured = emailSchema.safeParse(value);
    return configured.success && candidate.data === configured.data;
  });
}
