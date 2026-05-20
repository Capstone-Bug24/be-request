import {supabase } from '../config/supabase.js';

export const handleAiEvent = async (req, res) => {
    try {
        const data = req.body;
        //유효성 검사
        if (!data.analysis_id) {
            return res.status(400).json({ success: false, error: "Missing analysis_id" });
        }

        // 원본 데이터 복사하여 로그용 데이터 분리
        const logData = JSON.parse(JSON.stringify(data));
        delete logData.sensors;

        //전체 로그 저장(ai_event_logs)
        const { error: logError } = await supabase
            .from('ai_event_logs')
            .insert([logData]);
        
        if (logError) {
            console.error("ai_event_logs 저장 실패:", logError.message);
            throw logError;
        }

        //IoT 데이터 변환 및 저장
        if (data.sensors && Object.keys(data.sensors).length > 0) {
            const sensorEntries = Object.values(data.sensors).map((item) => ({
                analysis_id: data.analysis_id,
                sensor_device_id : item.id,
                sensor_type : item.type,
                sensor_ts : item.ts,
                status: item.status,
                unit: item.unit,
                sensor_value: item.value
            }));

            const { error: sensorError } = await supabase
            .from('sensor_data')
            .insert(sensorEntries);

            if (sensorError) throw sensorError;
        }

        //alerts가 비어있다면 평상시 상태로 취급
        const currentSeverity = data.alerts?.[0]?.severity || "NORMAL";
        //조건부 상태 변화 체크 및 알람 저장
        const { data: lastEvent } = await supabase
            .from('ai_events')
            .select('severity')
            .eq('camera_id', data.camera_id)
            .order('ts', { ascending: false })
            .limit(1)
            .maybeSingle();

        //저장 전 백엔드에서 비율 계산 추가
        if (!lastEvent || lastEvent.severity !== currentSeverity) {
            const aiEventData = {
                analysis_id: data.analysis_id,
                ts: data.ts,
                camera_id: data.camera_id,
                frame_id: data.frame_id,
                severity: currentSeverity,
                detections: data.detections,
                alerts: data.alerts,
                zones: data.zones
            };
            
            //ai_events 테이블에 저장
            const { error: aiError } = await supabase
                .from('ai_events')
                .insert([aiEventData]);

            if (aiError) throw aiError;

            console.log('디비 저장 성공');
        } else {
            console.log('위험상태가 이전과 동일해 저장 안함');
        }
        return res.status(201).json({ success: true, message: "Data processed successfully" });
    } catch (error) {
        console.error("AI Controller Error:", error.message);
        res.status(500).json({success: false,error: error.message});
    }
};