// src/utils/bboxFormatter.js

export const formatBboxData = (data) => {
  // 경고 수준 확인 (기존 로직 유지)
  const hasCriticalAlert = data.alerts?.some(alert => 
    ['HIGH', 'CRITICAL'].includes(alert.severity?.toUpperCase())
  ) ?? false;

  // 프론트엔드 렌더링에 최적화된 구조로 변환
  return {
    analysis_id: data.analysis_id,
    frame_size: { width: data.frame_width, height: data.frame_height },
    detections: data.detections?.map(det => ({
      id: det.detection_id,
      type: det.object_type,
      bbox: det.bbox, // [xmin, ymin, xmax, ymax]
      bbox_norm: det.bbox_norm,
      is_alert: hasCriticalAlert
    })) ?? [],
    zones: data.zones?.map(zone => ({
      id: zone.zone_id,
      name: zone.name,
      points: zone.points
    })) ?? []
  };
};