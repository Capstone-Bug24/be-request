import { supabase } from '../config/supabase.js';

/**
 * POST /api/alerts/resolve
 * 관리자가 대시보드에서 [조치 완료] 버튼을 눌렀을 때 실행되는 컨트롤러
 */
export const resolveAlert = async (req, res) => {
    try {
        // 1. 프론트엔드에서 보낸 알람 고유 ID 추출
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, error: "올바른 알람 ID(alertId)가 필요합니다." });
        }

        // 2. ai_events 테이블에서 해당 알람을 찾아 해결 완료(1) 상태로 업데이트
        const { data: updatedData, error: updateError } = await supabase
            .from('ai_events')
            .update({ 
                is_resolved: 1, 
                resolved_at: new Date() // 조치 완료 시간 기록
            })
            .eq('id', id)
            .eq('is_resolved', 0) // 안전장치: 이미 해결된 상태가 아닌 미해결 상태만 타겟팅
            .select()
            .maybeSingle();

        if (updateError) {
            throw updateError;
        }

        // 만약 조건에 맞는 알람이 없다면 (이미 처리됐거나 잘못된 ID인 경우)
        if (!updatedData) {
            return res.status(404).json({ success: false, error: "이미 조치 완료되었거나 존재하지 않는 알람입니다." });
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