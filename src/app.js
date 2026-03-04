import express from 'express';
import cors from 'cors';
import { supabase } from './config/supabase.js';


const app = express(); // 가장 먼저 생성//app은 만들고, 설정하고, 라우트 붙힌다.

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ✅ 실제 DB 연결 확인 라우트
app.get('/db-check', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sensor_raw_data') // 수정된 테이블명
      .select('*')
      .limit(1);

    if (error) throw error;

    res.json({ 
      message: 'Supabase Connection Success!',
      database: 'sensor_raw_data table is ready',
      data: data 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'DB Connection Failed', 
      error: err.message 
    });
  }
});
// IoT
app.post('/api/iot/collect', async (req, res) => {
  const { device_id, sensor_type, value, image_path } = req.body;

  // 데이터 유효성 검사 (필수 필드 확인)
  if (!device_id || !sensor_type) {
    return res.status(400).json({ error: "기기 아이디와 센서 타입을 확인하세요." });
  }

  const { data, error } = await supabase
    .from('sensor_raw_data')
    .insert([{ 
      device_id, 
      sensor_type, // "temperature" 등 어떤 데이터인지 저장
      value,       // 25.4 등 데이터 값 저장
      image_path 
    }])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ 
    message: "IoT 데이터가 성공적으로 기록되었습니다.", 
    id: data[0].id 
  });
});
export default app;
