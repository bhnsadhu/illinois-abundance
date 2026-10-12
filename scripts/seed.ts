import { createClient } from '@supabase/supabase-js';
import { sampleTopics, sampleWriters, samplePosts, sampleEvents, sampleLearnPages, sampleMeetings } from '../src/lib/sample-data';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set the Supabase URL and service role key first.');
const db = createClient(url,key,{auth:{persistSession:false}});
for(const [table, rows] of [
  ['topics', sampleTopics],
  ...(process.env.SEED_SAMPLE_CONTENT === 'true' ? [
    ['writers',sampleWriters], ['posts',samplePosts.map(p=>({...p,status:'published'}))],
    ['events',sampleEvents], ['learn_pages',sampleLearnPages], ['meetings',sampleMeetings],
  ] : []),
] as [string, unknown[]][]) {
 const {error} = await db.from(table).upsert(rows,{onConflict:'id',ignoreDuplicates:true});
 if(error) throw new Error(`Could not seed ${table}: ${error.message}`);
 console.log(`Seeded ${table}: ${rows.length} rows (existing rows preserved).`);
}
const admin = process.env.ADMIN_EMAIL?.toLowerCase();
if(admin){const {error}=await db.from('reviewers').upsert({email:admin,name:'Admin',is_active:true},{onConflict:'email',ignoreDuplicates:true});if(error)throw error;console.log('Admin reviewer ready.');}
