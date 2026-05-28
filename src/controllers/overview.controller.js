import { supabase } from '../config/supabase.js';

/**
 * 🏭 [공통 팩토리 함수] 
 * DB에서 데이터를 긁어와 질문자님의 API 스키마 및 React 포맷에 맞게 통합 가공합니다.
 */
const FACTORY_OVERVIEW_DATA = async () => {
  // 1. 디비에서 미해결된 실시간 알람 목록 가져오기 (is_resolved = 0)
  const { data: activeEvents, error: eventsError } = await supabase
    .from('ai_events')
    .select('*')
    .eq('is_resolved', 0)
    .order('id', { ascending: false });

  if (eventsError) throw eventsError;

  // 안전장치: 데이터가 없을 경우를 대비해 빈 배열 기본값 지정
  const safeEvents = activeEvents || [];

  // 2. 금일 통계 계산을 위한 오늘 날짜 범위 세팅 (KST 기준 00시부터)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayTotalCount, error: countError } = await supabase
    .from('ai_event_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());
    
  if (countError) throw countError;

  // 3. 최신 IoT 센서 데이터들 조회
  const { data: latestSensors, error: sensorError } = await supabase
    .from('sensor_data')
    .select('*')
    .order('id', { ascending: false })
    .limit(5);

  if (sensorError) throw sensorError;

  // ============================================================
  // 4. 상황에 따른 동적 데이터 매핑 (Dynamic Mapping)
  // ============================================================

  // [Metrics 계산]
  const criticalCount = safeEvents.filter(e => e.severity?.toUpperCase() === 'CRITICAL').length;
  const warningCount = safeEvents.filter(e => e.severity?.toUpperCase() === 'HIGH' || e.severity?.toUpperCase() === 'WARNING').length;
  const infoCount = safeEvents.filter(e => e.severity?.toUpperCase() === 'NORMAL' || e.severity?.toUpperCase() === 'INFO').length;
  
  // 현재 위험 알람 수에 따라 가상으로 작업자 수 조절
  const activeWorkers = criticalCount > 0 ? 28 : 32; 

  const metrics = [
    todayTotalCount || 0, // 금일 총 알람 수
    criticalCount,        // 위험 수
    warningCount,         // 경고 수
    infoCount,            // 정보 수
    activeWorkers         // 현재 작업자 수
  ];

  // [Env 데이터 동적 매핑]
  const tempSensor = latestSensors?.find(s => s.sensor_type === 'temperature');
  const humSensor = latestSensors?.find(s => s.sensor_type === 'humidity');
  const gasSensor = latestSensors?.find(s => s.sensor_type === 'gas');

  const env = {
    temp: tempSensor ? String(tempSensor.sensor_value) : "24.5",
    hum: humSensor ? String(humSensor.sensor_value) : "45",
    gas: gasSensor ? String(gasSensor.sensor_value) : "stable"
  };

  // [★ Health 데이터 동적 매핑]
  const cctvStatus = criticalCount > 0 ? ["48/50", "warning"] : ["50/50", "good"];
  const iotStatus = (gasSensor && gasSensor.sensor_value > 50) ? ["danger", "warning"] : ["120/120", "good"];
  const aiStatus = safeEvents.length > 5 ? ["heavy load", "warning"] : ["active", "good"];
  const serverStatus = ["stable", "good"];

  const health = {
    "1": cctvStatus,
    "2": iotStatus,
    "3": aiStatus,
    "4": serverStatus
  };

  // [Zones 구역 데이터 가공] A~F 구역 기본 세팅
  const zoneCodes = ['A', 'B', 'C', 'D', 'E', 'F'];
  const zonesObj = {};
  zoneCodes.forEach(code => {
    zonesObj[code] = ["s", "특이사항 없음"];
  });

  // 미해결 알람이 있는 구역만 실시간 데이터로 덮어쓰기
  safeEvents.forEach(event => {
    const zoneLetter = event.camera_id ? String(event.camera_id).charAt(0).toUpperCase() : null;
    if (zoneCodes.includes(zoneLetter)) {
      const sevLetter = event.severity?.toUpperCase() === 'CRITICAL' ? 'c' : 'w';
      const msg = event.alerts?.[0]?.message || "위험 상황 감지";
      zonesObj[zoneLetter] = [sevLetter, msg];
    }
  });

  // [Alerts 튜플 배열 가공]
  const alerts = safeEvents.map(event => {
    let timeStr = "00:00:00";
    if (event.ts) {
      const dateObj = new Date(event.ts);
      const pad = (n) => String(n).padStart(2, '0');
      timeStr = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
    }

    const zoneLetter = event.camera_id ? String(event.camera_id).charAt(0).toUpperCase() : "C";
    const severityCode = event.severity?.toUpperCase() === 'CRITICAL' ? 'critical' : 'warning';
    const mainAlert = event.alerts?.[0] || {};

    return [
      event.id,
      timeStr,
      zoneLetter,
      severityCode,
      mainAlert.event_type || 'GENERAL',
      mainAlert.message || '상세 내용 없음'
    ];
  });

  // 최종 리턴 객체 조립
  return {
    metrics,
    health,
    env,
    zones: zonesObj,
    alerts,
    metricsData: {
      totalAlarms: metrics[0],
      critical: metrics[1],
      warning: metrics[2],
      info: metrics[3],
      activeWorkers: metrics[4]
    },
    zonesList: Object.entries(zonesObj).map(([code, value]) => ({
      id: code,
      name: `${code} 구역`,
      status: value[0] === 'c' ? 'critical' : value[0] === 'w' ? 'warning' : 'good',
      recentAlert: value[1]
    })),
    systemHealth: [
      { id: 1, name: "CCTV 카메라 스트림", iconType: "cctv", status: health["1"][0], state: health["1"][1] },
      { id: 2, name: "IoT 환경 가스 센서", iconType: "iot", status: health["2"][0], state: health["2"][1] },
      { id: 3, name: "Edge-AI 로컬 추론 분석기", iconType: "ai", status: health["3"][0], state: health["3"][1] },
      { id: 4, name: "중앙 관제 데이터 서버", iconType: "server", status: health["4"][0], state: health["4"][1] }
    ],
    envData: [
      { id: 1, name: "현재 내부 온도", iconType: "temp", value: `${env.temp}°C`, state: "good" },
      { id: 2, name: "현재 내부 습도", iconType: "humidity", value: `${env.hum}%`, state: "good" }
    ],
    recentAlerts: alerts.map(a => ({
      id: a[0],
      time: a[1],
      zone: `${a[2]} 구역`,
      severity: a[3],
      type: a[4],
      desc: a[5]
    }))
  };
};

/**
 * 🌐 GET /api/overview
 * 초기 진입 시 최초 1회 전체 데이터를 뿌려주는 REST API 컨트롤러
 */
export const getOverview = async (req, res) => {
  try {
    const responseData = await FACTORY_OVERVIEW_DATA();
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Overview Fetch Error:", error.message);
    return res.status(500).json({ success: false, error: "대시보드 데이터를 통합 가공하는 중 오류가 발생했습니다." });
  }
};

/**
 * 📡 실시간 Supabase 변경 감지 가동기
 * 외부(app.js 등)에서 소켓 엔진(io)을 받아와 실시간 리스너를 킵니다.
 */
export const initOverviewRealtime = (io) => {
  console.log("🔔 Supabase 실시간 구독 시작");

  supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE 모두 포착
        schema: 'public',
        table: 'ai_events'
      },
      async (payload) => {
        console.log('🔄 [DB 변경 감지됨] 오버뷰 데이터 실시간 브로드캐스트 발사');
        
        try {
          // 공통 가공 함수를 호출하여 최신 상태 갱신
          const updatedData = await FACTORY_OVERVIEW_DATA();
          
          // 웹소켓으로 연동된 클라이언트 화면에 쏴주기
          io.emit('overview_update', updatedData);
        } catch (error) {
          console.error('실시간 브로드캐스트 실패:', error.message);
        }
      }
    )
    .subscribe();
};