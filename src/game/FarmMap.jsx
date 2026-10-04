import { useId, useState } from 'react';
import { geometryBounds, geometryCenter, groupMapClusters, polygonPoints } from './mapGeometry.js';
import './farm-map.css';

function knownStatus(unit, overlay) {
  if (overlay === 'tasks') return 'current';
  const status = unit.water?.status || 'unknown';
  return status === 'fresh' ? 'current' : status;
}

function waterColor(unit) {
  const risk = unit.risk?.level;
  if (risk === 'high' || risk === 'critical') return 'high';
  if (risk === 'medium' || risk === 'moderate' || risk === 'elevated') return 'medium';
  return 'low';
}

function taskCount(unit) {
  const operations = (unit.operations || []).filter(operation => !['completed', 'cancelled', 'failed'].includes(operation.executionStatus || operation.status));
  const decisions = (unit.decisions || []).filter(decision => !['resolved', 'closed', 'expired', 'dismissed'].includes(decision.status));
  return operations.length + decisions.length;
}

function clusterLabel(id) {
  return id === 'unassigned' ? '未分区' : `分区 ${id.replace(/^CL-/, '')}`;
}

function UnitShape({ unit, prefix, selected, overlay, onSelect, aggregate }) {
  const points = polygonPoints(unit);
  if (!points.length) return null;
  const bounds = geometryBounds([unit]);
  const [cx, cy] = geometryCenter(unit);
  const status = knownStatus(unit, overlay);
  const count = taskCount(unit);
  const theme = overlay === 'tasks' ? (count ? 'tasks' : 'low') : overlay === 'freshness'
    ? (status === 'current' ? 'low' : status === 'stale' ? 'medium' : 'unknown') : waterColor(unit);
  const scale = Math.min(bounds.width, bounds.height);
  const idSize = Math.max(5, Math.min(12, scale * 0.145));
  const detailSize = Math.max(4, Math.min(7.6, scale * 0.091));
  const shapeId = `${prefix}-${unit.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const variety = (unit.varietyName || unit.varietyId || '品种未登记').replace(/\s*\(training\)/, '');
  const stateLabel = overlay === 'tasks' ? `${count} 项待办` : unit.water?.label || '尚无水分观测';
  const stageLabel = unit.stage?.label || '阶段待确认';
  const accessibleLabel = `${unit.id}，${variety}，${stageLabel}，${stateLabel}${status === 'stale' ? '，观测已过期' : ''}`;
  return (
    <g className={`farm-map__unit farm-map__unit--${theme} farm-map__unit--${status}${selected ? ' farm-map__unit--selected' : ''}`}
      role="button" tabIndex={aggregate ? -1 : 0} aria-label={accessibleLabel} aria-pressed={selected}
      data-testid={`map-unit-${unit.id}`} data-unit-id={unit.id} data-observation-status={status}
      onClick={() => onSelect?.(unit.id)} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(unit.id); }
      }}>
      <title>{accessibleLabel}</title>
      <defs><clipPath id={shapeId}><polygon points={points.map(point => point.join(',')).join(' ')} /></clipPath></defs>
      <polygon className="farm-map__field" points={points.map(point => point.join(',')).join(' ')} />
      <g clipPath={`url(#${shapeId})`} aria-hidden="true">
        {Array.from({ length: Math.max(3, Math.round(bounds.height / Math.max(8, scale / 9))) }, (_, index) => (
          <line key={index} className="farm-map__crop-row" x1={bounds.x - 5} x2={bounds.x + bounds.width + 5}
            y1={bounds.y + 7 + index * Math.max(8, scale / 9)} y2={bounds.y + 7 + index * Math.max(8, scale / 9)} />
        ))}
        {(status === 'unknown' || status === 'stale') && <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height}
          className="farm-map__fog" fill={`url(#${prefix}-fog)`} />}
        <rect className="farm-map__label-bg" x={cx - bounds.width * 0.42} y={cy - scale * 0.29}
          width={bounds.width * 0.84} height={scale * 0.58} rx={3} />
      </g>
      <text className="farm-map__unit-id" x={cx} y={cy - scale * 0.11} fontSize={idSize}>{unit.id}</text>
      <text className="farm-map__variety" x={cx} y={cy + scale * 0.045} fontSize={detailSize}>{variety}</text>
      <text className="farm-map__stage" x={cx} y={cy + scale * 0.175} fontSize={detailSize * 0.92}>{stageLabel}</text>
      {(status === 'unknown' || status === 'stale') && <text className="farm-map__freshness" x={cx}
        y={bounds.y + bounds.height - scale * 0.067} fontSize={detailSize * 0.84}>{status === 'unknown' ? '待观测' : '观测已过期'}</text>}
      <circle className="farm-map__indicator" cx={bounds.x + bounds.width - scale * 0.105}
        cy={bounds.y + scale * 0.105} r={scale * 0.043} aria-hidden="true" />
      {overlay === 'tasks' && count > 0 && <g aria-hidden="true">
        <circle className="farm-map__task-badge" cx={bounds.x + scale * 0.115} cy={bounds.y + scale * 0.115} r={scale * 0.09} />
        <text className="farm-map__task-count" x={bounds.x + scale * 0.115} y={bounds.y + scale * 0.15} fontSize={detailSize}>{count}</text>
      </g>}
      <polygon className="farm-map__selection" points={points.map(point => point.join(',')).join(' ')} aria-hidden="true" />
    </g>
  );
}

/** Only accepts the public player projection, never engine state or checkpoint data. */
export default function FarmMap({ units = [], selectedUnitId, onSelect, onSelectUnit, overlay, layer,
  clusterFilter = 'all', varietyFilter = 'all' }) {
  const prefix = `farm-map-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [zoom, setZoom] = useState(1);
  const [focusedCluster, setFocusedCluster] = useState(null);
  const activeOverlay = overlay || layer || 'water';
  const select = onSelect || onSelectUnit;
  const validUnits = units.filter(unit => polygonPoints(unit).length);
  const visibleUnits = validUnits.filter(unit => (!clusterFilter || clusterFilter === 'all' || unit.clusterId === clusterFilter)
    && (!varietyFilter || varietyFilter === 'all' || unit.varietyId === varietyFilter));
  const clusters = groupMapClusters(visibleUnits);
  const mapBounds = geometryBounds(validUnits, 24);
  const focusedUnits = focusedCluster ? visibleUnits.filter(unit => unit.clusterId === focusedCluster) : [];
  const framing = focusedUnits.length ? geometryBounds(focusedUnits, 18) : mapBounds;
  const selectedUnit = visibleUnits.find(unit => unit.id === selectedUnitId);
  const center = !focusedUnits.length && zoom > 1 && selectedUnit ? geometryCenter(selectedUnit)
    : [framing.x + framing.width / 2, framing.y + framing.height / 2];
  const viewWidth = framing.width / zoom;
  const viewHeight = framing.height / zoom;
  const viewBox = `${center[0] - viewWidth / 2} ${center[1] - viewHeight / 2} ${viewWidth} ${viewHeight}`;
  const aggregate = zoom < 0.9;
  const displayArea = visibleUnits.reduce((sum, unit) => sum + (unit.area?.unit === 'ha' ? unit.area.value || 0 : 0), 0);
  return (
    <div className="farm-map" data-testid="farm-map" data-layer={activeOverlay} data-zoom={zoom}>
      <div className="farm-map__summary">
        <span><span className="farm-map__live-dot" /> {activeOverlay === 'tasks' ? '作业与决策' : activeOverlay === 'freshness' ? '水分信息新鲜度' : '水分与风险'}</span>
        <span>{visibleUnits.length} 个单元 · {clusters.length} 个分区{displayArea > 0 ? ` · ${displayArea.toFixed(2)} ha` : ''}</span>
      </div>
      <div className="farm-map__canvas">
        <svg viewBox={viewBox} className="farm-map__svg" aria-label="农场生产单元地图" role="group">
          <defs>
            <pattern id={`${prefix}-fog`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <rect width="8" height="8" fill="#e1e5de" /><line x1="0" y1="0" x2="0" y2="8" stroke="#c5cec1" strokeWidth="1.5" />
            </pattern>
            <pattern id={`${prefix}-ground`} width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="0.6" fill="#cad4c3" />
            </pattern>
          </defs>
          <rect x={mapBounds.x - mapBounds.width} y={mapBounds.y - mapBounds.height}
            width={mapBounds.width * 3} height={mapBounds.height * 3} fill="#edf0e6" />
          <rect x={mapBounds.x - mapBounds.width} y={mapBounds.y - mapBounds.height}
            width={mapBounds.width * 3} height={mapBounds.height * 3} fill={`url(#${prefix}-ground)`} />
          <path className="farm-map__landscape" d={`M ${mapBounds.x - 15} ${mapBounds.y + mapBounds.height * 0.16}
            Q ${mapBounds.x + mapBounds.width * 0.15} ${mapBounds.y - 44} ${mapBounds.x + mapBounds.width * 0.43} ${mapBounds.y - 12}
            T ${mapBounds.x + mapBounds.width + 24} ${mapBounds.y + 18}`} />
          <path className="farm-map__boundary" d={`M ${mapBounds.x + 8} ${mapBounds.y + mapBounds.height - 8}
            H ${mapBounds.x + mapBounds.width - 8} V ${mapBounds.y + 8} H ${mapBounds.x + 8} Z`} />
          {clusters.map(cluster => <g key={`cluster-road-${cluster.id}`} aria-hidden="true">
            <path className="farm-map__track" d={`M ${cluster.bounds.x - 10} ${cluster.bounds.y + cluster.bounds.height + 10}
              H ${cluster.bounds.x + cluster.bounds.width + 10}`} />
            {!aggregate && <text className="farm-map__cluster-label" x={cluster.bounds.x - 7}
              y={cluster.bounds.y + cluster.bounds.height / 2} transform={`rotate(-90 ${cluster.bounds.x - 7} ${cluster.bounds.y + cluster.bounds.height / 2})`}>{clusterLabel(cluster.id)}</text>}
          </g>)}
          <g className={aggregate ? 'farm-map__units farm-map__units--aggregate' : 'farm-map__units'} aria-hidden={aggregate}>
            {visibleUnits.map(unit => <UnitShape key={unit.id} unit={unit} prefix={prefix} selected={unit.id === selectedUnitId}
              overlay={activeOverlay} onSelect={select} aggregate={aggregate} />)}
          </g>
          {aggregate && clusters.map(cluster => {
            const x = cluster.bounds.x + cluster.bounds.width / 2;
            const y = cluster.bounds.y + cluster.bounds.height / 2;
            const pending = cluster.units.reduce((sum, unit) => sum + taskCount(unit), 0);
            const expand = () => { setFocusedCluster(cluster.id); setZoom(1); };
            return <g key={cluster.id} className="farm-map__cluster-button" role="button" tabIndex={0}
              aria-label={`${clusterLabel(cluster.id)}，${cluster.units.length} 个单元，点击展开`}
              onClick={expand} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand(); } }}>
              <rect x={x - 55} y={y - 21} width={110} height={42} rx={8} />
              <text x={x} y={y - 4}>{clusterLabel(cluster.id)}</text>
              <text className="farm-map__cluster-detail" x={x} y={y + 10}>{cluster.units.length} 个单元{activeOverlay === 'tasks' ? ` · ${pending} 项待办` : ' · 点击展开'}</text>
            </g>;
          })}
        </svg>
        {!visibleUnits.length && <div className="farm-map__empty">没有符合筛选条件的生产单元</div>}
        <div className="farm-map__compass" aria-hidden="true"><span>↑</span>N</div>
        <div className="farm-map__zoom" role="group" aria-label="地图缩放">
          <button type="button" aria-label="放大地图" disabled={zoom >= 1.75} onClick={() => setZoom(current => Math.min(1.75, current + 0.25))}>+</button>
          <button type="button" aria-label="缩小地图" disabled={zoom <= 0.5} onClick={() => setZoom(current => Math.max(0.5, current - 0.25))}>−</button>
          <button type="button" className="farm-map__fit" aria-label="显示整个农场" onClick={() => { setZoom(1); setFocusedCluster(null); }}>全图</button>
        </div>
        <div className="farm-map__map-note">示意地图 · 点击生产单元查看证据</div>
      </div>
      <div className="farm-map__legend" aria-label="地图图例">
        {activeOverlay === 'tasks' ? <><span><i className="farm-map__swatch farm-map__swatch--tasks" />有待办</span>
          <span><i className="farm-map__swatch farm-map__swatch--low" />暂无待办</span></>
          : activeOverlay === 'freshness' ? <><span><i className="farm-map__swatch farm-map__swatch--low" />当前有效</span>
            <span><i className="farm-map__swatch farm-map__swatch--stale" />已过期</span>
            <span><i className="farm-map__swatch farm-map__swatch--unknown" />尚无信息</span></>
          : <><span><i className="farm-map__swatch farm-map__swatch--low" />低风险</span>
            <span><i className="farm-map__swatch farm-map__swatch--medium" />需关注</span>
            <span><i className="farm-map__swatch farm-map__swatch--high" />高风险</span>
            <span><i className="farm-map__swatch farm-map__swatch--unknown" />未知</span>
            <span><i className="farm-map__swatch farm-map__swatch--stale" />过期</span></>}
        <span className="farm-map__legend-note">颜色依据已送达的信息</span>
      </div>
    </div>
  );
}
