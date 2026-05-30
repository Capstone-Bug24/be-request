import { supabase } from '../config/supabase.js';

// 🎯 순수 데이터 가공 함수 (HTTP와 웹소켓 둘 다 사용)
export const fetchOverviewData = async () => {
  try {
    const { data: events, error } = await supabase
      .from('ai_events')
      .select('*')
      .order('id', { ascending: false })
      .limit(20);

    if (error) throw error;
    const safeEvents = events || [];

    const { data: metricsData } = await supabase
      .from('ai_events')
      .select('camera_id, severity, is_resolved');

    const safeMetrics = metricsData || [];

    // =================================================================
    // [Metrics 연산]
    // =================================================================
    const totalAlarms = safeMetrics.length;
    const activeMetrics = safeMetrics.filter(e => e.is_resolved === 0);
    const cCount = activeMetrics.filter(e => e.severity?.toLowerCase() === 'critical').length;
    const wCount = activeMetrics.filter(e => e.severity?.toLowerCase() === 'warning' || e.severity?.toLowerCase() === 'high').length;
    const iCount = activeMetrics.filter(e => e.severity?.toLowerCase() === 'info' || e.severity?.toLowerCase() === 'normal').length;

    const metrics = [totalAlarms, cCount, wCount, iCount, 32];

    // =================================================================
    // [Health 연산]
    // =================================================================
    const uniqueCameras = new Set();
    safeMetrics.forEach(e => { if (e.camera_id) uniqueCameras.add(e.camera_id); });
    const cameraCount = uniqueCameras.size || 3;

    const health = {
      "1": [`${cameraCount}/${cameraCount}`, "good"],
      "2": ["120/120", "good"],
      "3": ["active", "good"],
      "4": ["stable", "good"]
    };

    const env = { temp: "24.5", hum: "45" };

    const mapCameraToZone = (cameraId) => {
      if (!cameraId) return 'A';
      const numMatch = cameraId.match(/\d+/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        return String.fromCharCode(64 + num);
      }
      return 'A';
    };

    // =================================================================
    // [Zones 연산]
    // =================================================================
    const zones = {
      A: ["s", "특이사항 없음"], B: ["s", "특이사항 없음"], C: ["s", "특이사항 없음"],
      D: ["s", "특이사항 없음"], E: ["s", "특이사항 없음"], F: ["s", "특이사항 없음"]
    };

    const unResolvedEvents = safeEvents.filter(e => e.is_resolved === 0);
    unResolvedEvents.forEach(event => {
      const zoneCode = mapCameraToZone(event.camera_id);
      if (zones[zoneCode] && zones[zoneCode][0] === "s") {
        const sevLetter = event.severity?.toLowerCase() === 'critical' ? 'c' : 'w';
        
        // ⭐ Zones 쪽도 동일하게 안전 파싱 적용
        let parsedAlerts = [];
        if (event.alerts) {
          if (typeof event.alerts === 'string') {
            try { parsedAlerts = JSON.parse(event.alerts); } catch (e) { parsedAlerts = []; }
          } else if (Array.isArray(event.alerts)) {
            parsedAlerts = event.alerts;
          }
        }
        
        const firstAlert = parsedAlerts.length > 0 ? parsedAlerts[0] : null;
        const summaryText = firstAlert ? (firstAlert.message || "위험 상황 감지") : "위험 상황 감지";
        zones[zoneCode] = [sevLetter, summaryText];
      }
    });

    // =================================================================
    // [Alerts 연산]
    // =================================================================
    const alerts = safeEvents.map(event => {
      const zoneCode = mapCameraToZone(event.camera_id);
      
      let timeStr = "00:00:00";
      const timestamp = event.ts || event.created_at;
      if (timestamp) {
        const date = new Date(timestamp);
        timeStr = date.toLocaleTimeString('ko-KR', { hour12: false });
      }
      
      const sevLetter = event.severity?.toLowerCase() === 'critical' ? 'c' : 'w';
      
      let parsedAlerts = [];
      if (event.alerts) {
        if (typeof event.alerts === 'string') {
          try { parsedAlerts = JSON.parse(event.alerts); } catch (e) { parsedAlerts = []; }
        } else if (Array.isArray(event.alerts)) {
          parsedAlerts = event.alerts;
        }
      }

      const firstAlert = parsedAlerts.length > 0 ? parsedAlerts[0] : null;
      
      const eventType = firstAlert?.event_type || firstAlert?.reason?.code || "ZONE_INTRUSION";
      const description = firstAlert?.message || "작업자 진입 감지";

      return [
        event.id,       // alert[0]
        timeStr,        // alert[1]
        zoneCode,       // alert[2]
        sevLetter,      // alert[3]
        eventType,      // alert[4]
        description     // alert[5]
      ];
    });
    
    // 🔗 잃어버렸던 데이터 리턴 및 함수 종료 블록 추가!
    return { metrics, health, env, zones, alerts };

  } catch (error) {
    console.error("데이터 가공 에러:", error.message);
    throw error;
  }
};
    
// 🎯 기존 API용 컨트롤러 (포스트맨 테스트용 유지)
export const getOverview = async (req, res) => {
  try {
    const data = await fetchOverviewData();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};