import { supabase } from '../config/supabase.js';

/**
 * POST /api/alerts/resolve
 * 관리자가 대시보드에서 [조치 완료] 버튼을 눌렀을 때 실행되는 컨트롤러
 */
export const resolveAlert = async (req, res) => {
    try {
        // 1. 프론트엔드에서 보낸 알람 고유 ID 추출
        const { id } = req.params;
        console.log("요청받은 ID:", id); // 👈 이게 찍히면 라우팅은 100% 성공!

        if (!id) {
            return res.status(400).json({ success: false, error: "올바른 알람 ID(alertId)가 필요합니다." });
        }

        const numericId = parseInt(id, 10);
        console.log("변환된 ID:", numericId)

        // 1. 업데이트 전에 먼저 데이터가 있는지 조회
        const { data: checkData, error: checkError } = await supabase
            .from('ai_events')
            .select('id, is_resolved')
            .eq('id', numericId)
            .maybeSingle();

        console.log("DB 데이터 존재 확인:", checkData);
        
        // 2. ai_events 테이블에서 해당 알람을 찾아 해결 완료(1) 상태로 업데이트
        const { data: updatedData, error: updateError } = await supabase
            .from('ai_events')
            .update({ 
                is_resolved: 1, 
                severity: 'NORMAL',
                resolved_at: new Date() // 조치 완료 시간 기록
            })
            .eq('id', id)
            .eq('is_resolved', 0) // 안전장치: 이미 해결된 상태가 아닌 미해결 상태만 타겟팅
            .select()
            //.maybeSingle();
            console.log("DB 업데이트 결과:", { updatedData, updateError });

        if (updateError) {
            throw updateError;
        }

        // 만약 조건에 맞는 알람이 없다면 (이미 처리됐거나 잘못된 ID인 경우)
        if (!updatedData) {
    // 💡 여기서 404를 반환하지 않고, 이미 처리된 데이터임을 인지하고 200(성공)을 반환합니다.
            console.log(`알람 ID ${id}는 이미 처리된 상태입니다.`);
            return res.status(200).json({ 
                success: true, 
                message: "이미 조치된 알람입니다.",
                alreadyResolved: true // 프론트엔드에 알려줌
            });
        }

        // 3. ✨ 웹소켓을 통한 실시간 화면 갱신 (선택 사항)
        // 대시보드를 열어놓은 모든 관리자 화면에서 해당 카드를 지우기 위해 소켓을 쏩니다.
        const io = req.app.get('io');
        if (io) {
            io.emit('alert_resolved', { id: id });
        }

        console.log(`알람 조치 완료 성공 - ID: ${id}`);
        return res.status(200).json({ 
            success: true, 
            message: "성공적으로 조치 완료 처리되었습니다.",
            data: updatedData 
        });

    } catch (error) {
        console.error("Resolve Alert Controller Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};