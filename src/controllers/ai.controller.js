import {supabase } from '../config/supabase.js';

export const handleAiEvent = async (req, res) => {
    try {
        const data = req.body;
        //유효성 검사
        if (!data.event_id) {
            return res.status(400).json({ success: false, error: "Missing event_id" });
        }

        // sensors만빼고 나머지 변수들 aiData에 저장
        const { sensors, ...aiData } = data;

        //aiData를 ai_events 테이블에 저장
        const { error: aiError } = await supabase
        .from('ai_events')
        .insert([aiData]);

        if (aiError) throw aiError;

        //IoT 데이터 변환 및 저장
        if (sensors && Object.keys(sensors).length > 0) {
            const sensorEntries = Object.entries(sensors).map(([type, value]) => ({
                event_id: aiData.event_id,
                sensor_type: type,
                sensor_value: value
            }));
            const { error: sensorError } = await supabase
            .from('sensor_data')
            .insert(sensorEntries);

            if (sensorError) throw sensorError;
        }

        res.status(201).json({ success:true, message: "AAI & IoT Data Saved"});
    } catch (error) {
        console.error("AI Controller Error:", error.message);
        res.status(500).json({success: false,error: error.message});
    }
};