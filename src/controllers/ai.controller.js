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

        //전체 로그 저장(ai_event_logs)
        await supabase.from('ai_event_logs').insert([aiData]);

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
        //조건부 상태 변화 체크 및 알람 저장
        const { data: lastEvent } = await supabase
            .from('ai_events')
            .select('severity')
            .eq('camera_id', aiData.camera_id)
            .order('ts', { ascending: false })
            .limit(1)
            .maybeSingle();

        //저장 전 백엔드에서 비율 계산 추가
        if (!lastEvent || lastEvent.severity !== aiData.severity) {
            if (aiData.bbox && aiData.resolution) {
                const { x, y, w, h } = aiData.bbox;
                const { width, height } = aiData.resolution;

                aiData.bbox = {
                    raw: {x, y, w, h},
                    ratio: {
                        x: parseFloat((x / width).toFixed(4)),
                        y: parseFloat((y / height).toFixed(4)),
                        w: parseFloat((w / width).toFixed(4)),
                        h: parseFloat((h / height).toFixed(4))
                    },
                    resolution: { width, height }
                };
            }
             //aiData를 ai_events 테이블에 저장
            const { error: aiError } = await supabase
            .from('ai_events')
            .insert([aiData]);

            if (aiError) throw aiError;
        }
        return res.status(201).json({ success: true, message: "Data processed successfully" });
    } catch (error) {
        console.error("AI Controller Error:", error.message);
        res.status(500).json({success: false,error: error.message});
    }
};