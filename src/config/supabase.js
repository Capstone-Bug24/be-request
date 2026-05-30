import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {     //Debug
  throw new Error('Supabase env variables are missing');
}
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);//디버그용

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // 서버 환경이므로 세션 고정 해제
  },
  realtime: {
    transport: ws,
    params: {
      eventsPerSecond: 20, // 초당 수신 이벤트 제한 (안정성)
    },
    timeout: 40000, // 타임아웃 시간을 40초로 넉넉하게 늘려줍니다.
  }
});
