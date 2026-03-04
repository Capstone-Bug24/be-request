import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {     //Debug
  throw new Error('Supabase env variables are missing');
}
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);//디버그용
export const supabase = createClient(supabaseUrl, supabaseKey);
