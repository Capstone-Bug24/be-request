import {supabase } from '../config/supabase.js';
import { io } from '../sockets/socketManager.js'; 
import { fetchOverviewData } from './overview.controller.js';
import { formatBboxData } from './frontend.controller.js';

export const handleAiEvent = async (req, res) => {
    try {
        const data = req.body;
        //유효성 검사
        if (!data.analysis_id) {
            return res.status(400).json({ success: false, error: "Missing analysis_id" });
        }

        const currentSeverity = data.severity || data.alerts?.[0]?.severity || "NORMAL";

        // 원본 데이터 복사하여 로그용 데이터 분리
        const logData = JSON.parse(JSON.stringify(data));
        delete logData.sensors;

        delete logData.id;

        //로그 테이블 데이터에도 최상위에 severity 컬럼 값이 명시되도록 강제 주입
        logData.severity = currentSeverity;

        //전체 로그 저장(ai_event_logs)
        const { error: logError } = await supabase
            .from('ai_event_logs')
            .insert([logData]);
        
        if (logError) {
            console.error("ai_event_logs 저장 실패:", logError.message);
            throw logError;
        }
        
        if (io) {
            // DB에서 꺼내지 않고, 방금 들어온 req.body(data)를 바로 가공해서 쏨
            const bboxData = formatBboxData(data); 
            io.emit('bbox_update', bboxData);
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

        //조건부 상태 변화 체크 및 알람 저장
        const { data: lastEvent } = await supabase
            .from('ai_events')
            .select('severity')
            .eq('site_id', data.site_id)
            .eq('frame_ts',data.frame_ts)
            .eq('camera_id', data.camera_id)
            .eq('is_resolved', 0)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();
        //대소문자 통일
        const isSameState = lastEvent && 
            String(lastEvent.severity).toUpperCase() === String(currentSeverity).toUpperCase();

        //저장 전 백엔드에서 비율 계산 추가
        if (!isSameState) {
            const aiEventData = {
                analysis_id: data.analysis_id,
                ts: data.ts,
                site_id: data.site_id,
                camera_id: data.camera_id,
                frame_id: data.frame_id,
                frame_width: data.frame_width || 1920,  // 데이터가 없으면 기본값 설정
                frame_height: data.frame_height || 1080,
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

            if (io) {
                // 1. 대시보드 오버뷰 업데이트
                const freshData = await fetchOverviewData();
                io.emit('overview_update', freshData);

                // 2. BBOX 화면 실시간 업데이트
                // data.alerts 등은 aiEventData에 이미 들어있으므로 포맷팅 함수를 태웁니다.
                const bboxData = formatBboxData(aiEventData); 
                io.emit('bbox_update', bboxData);
            }
        } else {
            console.log('위험상태가 이전과 동일해 ai_events에는 저장 안함 (로그에는 적재됨)');
        }
        return res.status(201).json({ success: true, message: "Data processed successfully" });
    } catch (error) {
        console.error("AI Controller Error:", error.message);
        res.status(500).json({success: false,error: error.message});
    }
};