import { z } from 'zod';

export const passwordSchema = z.string()
  .min(12, 'Use at least 12 characters for the password.')
  .max(128, 'Use no more than 128 characters for the password.');
