import { describe,it,expect } from 'vitest';
import { submissionSchema, sourceSchema } from '@/lib/validation';
describe('submission validation',()=>{
 const valid={name:'A Writer',email:'Writer@ILLINOIS.EDU',body:'A local idea worth sharing with our community.',website:''};
 it('normalizes the exact school domain',()=>expect(submissionSchema.parse(valid).email).toBe('writer@illinois.edu'));
 it('keeps the original body byte for byte',()=>{const body='  A local idea worth sharing with our community.\n\n';expect(submissionSchema.parse({...valid,body}).body).toBe(body);});
 it('rejects deceptive domains and honeypots',()=>{for(const email of ['writer@illinois.edu.evil.com','writer@example.com','writer@sub.illinois.edu'])expect(submissionSchema.safeParse({...valid,email}).success).toBe(false);expect(submissionSchema.safeParse({...valid,website:'spam'}).success).toBe(false);});
 it('caps original size without truncating text',()=>expect(submissionSchema.safeParse({...valid,body:'x'.repeat(20001)}).success).toBe(false));
 it('rejects active URL schemes',()=>expect(sourceSchema.safeParse({label:'Bad',url:'javascript:alert(1)'}).success).toBe(false));
});
