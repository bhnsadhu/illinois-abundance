export const site = {
  name: 'Illinois Abundance',
  description: 'Student writing on local policy in Champaign Urbana.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  contact: process.env.CONTACT_EMAIL || 'bhnsadhu@gmail.com',
};
export const hasDatabase = () => Boolean(process.env.DATABASE_URL);
export const samplesEnabled = () => process.env.SEED_SAMPLE_CONTENT === 'true';
