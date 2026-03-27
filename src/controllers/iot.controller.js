// src/controllers/iot.controller.js
import { supabase } from '../config/supabase.js';

export const collectData = async (req, res) => {
  const { device_id, sensor_type, value, image_path } = req.body;

  if (!device_id || !sensor_type) {
    return res.status(400).json({ error: "기기 아이디와 센서 타입을 확인하세요." });
  }

  const { data, error } = await supabase
    .from('sensor_raw_data')
    .insert([{ device_id, sensor_type, value, image_path }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "IoT 데이터가 성공적으로 기록되었습니다.", id: data[0].id });
};

export const getLatestData = async (req, res) => {
  const { device_id, sensor_type } = req.query;

  const { data, error } = await supabase
    .from('sensor_raw_data')
    .select('*')
    .eq('device_id', device_id)
    .eq('sensor_type', sensor_type)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ message: "데이터가 없습니다." });

  res.json({ message: "최신 데이터 조회 성공", latest_data: data[0] });
};