import { supabase } from '../config/supabase.js';

/**
 * 히스토리 로그 조회 (페이징, 필터링 및 튜플 배열 가공)
 * GET /api/history/logs
 */
export const logs = async (req, res) => {
  try {
    // 1. 요청 파라미터 파싱 및 기본값(Default) 설정
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const { 
      sortBy = 'ts', 
      sortOrder = 'desc', 
      severity, 
      zoneCode, 
      eventType, 
      dateFrom, 
      dateTo 
    } = req.query;

    // Supabase 페이징 인덱스 계산 (0부터 시작)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 2. Supabase 쿼리 빌드 (정확한 전체 개수를 위해 count: 'exact' 설정)
    // 원시 데이터가 쌓이는 테이블명을 프로젝트에 맞게 수정하세요 (예: 'analysis_logs')
    let query = supabase
      .from('ai_events') 
      .select('*', { count: 'exact' });

    // ============================================================
    // 3. 필터 조건 매핑 (Supabase JSONB 및 양방향 호환 보완)
    // ============================================================
    if (severity) {
      let dbSeverity = 'NORMAL';
      const upperSeverity = severity.toUpperCase();
      
      // 어떤 형식이 들어와도 DB 규격(CRITICAL, HIGH, NORMAL)으로 매핑
      if (upperSeverity === 'C' || upperSeverity === 'CRITICAL') {
        dbSeverity = 'CRITICAL';
      } else if (upperSeverity === 'W' || upperSeverity === 'WARNING' || upperSeverity === 'WARN' || upperSeverity === 'HIGH') {
        dbSeverity = 'HIGH'; 
      } else if (upperSeverity === 'I' || upperSeverity === 'INFO' || upperSeverity === 'NORMAL') {
        dbSeverity = 'NORMAL';
      }
      
      // Supabase에서는 filter() 대신 eq() 문법에 jsonb 패스를 지정하는 것이 안전합니다.
      query = query.eq('alerts->0->>severity', dbSeverity);
    }

    // 구역 필터
    if (zoneCode) {
      query = query.eq('alerts->0->zone_refs->>0', zoneCode);
    }

    // 이벤트 타입 필터
    if (eventType) {
      query = query.eq('alerts->0->>event_type', eventType);
    }

    // 날짜 범위 필터 (안전하게 포함 여부 체크 후 결합)
    if (dateFrom) {
      const startIso = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`;
      query = query.gte('ts', startIso);
    }
    if (dateTo) {
      const endIso = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte('ts', endIso);
    }

    // 정렬 및 페이징 범위 적용
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    // DB 호출 실행
    const { data: rawLogs, count, error } = await query;

    if (error) throw error;

    // ============================================================
    // 4. 데이터 가공 (AI Response 형식 구조에 맞춤 최적화)
    // ============================================================
    const formattedLogs = (rawLogs || []).map((row, index) => {
      const logId = from + index + 1; //프론트용 가짜 ID 생성
      
      // ISO 8601 타임스탬프 ➔ YYYY-MM-DD HH:mm:ss 변환
      let formattedTime = "알 수 없는 시간";
      if (row.ts) {
        const dateObj = new Date(row.ts);
        const pad = (n) => String(n).padStart(2, '0');
        formattedTime = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
      }

      // 1. alerts 배열에서 첫 번째 알람 정보 추출
      const mainAlert = row.alerts?.[0] || {};
      
      // 2. 구역 코드/이름 추출 로직 보완
      // alerts에 zone_refs가 있다면 그걸 쓰고, 없다면 zones 배열의 첫번째 name을 씁니다.
      let displayZone = "기타 구역";
      if (mainAlert.zone_refs && mainAlert.zone_refs.length > 0) {
        displayZone = mainAlert.zone_refs.join(', '); // 예: "danger_q2, forklift_lane"
      } else if (row.zones?.[0]?.name) {
        displayZone = row.zones[0].name;
      }
      
      // 3. 심각도 치환 (대소문자 완벽 방어)
      const rawSeverity = String(mainAlert.severity || row.zones?.[0]?.severity || '').toUpperCase();
      let severityCode = 'i'; // 기본값
      
      if (rawSeverity === 'CRITICAL' || rawSeverity === 'C') {
        severityCode = 'c';
      } else if (rawSeverity === 'HIGH' || rawSeverity === 'WARN' || rawSeverity === 'WARNING' || rawSeverity === 'W') {
        severityCode = 'w';
      } else if (rawSeverity === 'NORMAL' || rawSeverity === 'INFO' || rawSeverity === 'I') {
        severityCode = 'i';
      }

      // 프론트 요청 규격 튜플 배열 반환 [id, time, zone, severity, type, desc]
      return [
        logId,
        row.id, //디비 
        formattedTime,
        zoneCode || displayZone, // 쿼리 파라미터로 구역코드를 고정했다면 그걸 쓰고 아니면 추출한 구역 표시
        severityCode,
        mainAlert.event_type || 'GENERAL',
        mainAlert.message || '상세 내용 없음'
      ];
    });

    // 5. 응답 반환 (요청 파라미터를 그대로 echo 형태로 포함)
    return res.status(200).json({
      logs: formattedLogs,
      total: count || 0,
      page: page,
      pageSize: pageSize
    });

  } catch (err) {
    console.error("히스토리 조회 중 서버 오류:", err.message);
    return res.status(500).json({ error: "히스토리 데이터를 가져오는 중 오류가 발생했습니다." });
  }
};