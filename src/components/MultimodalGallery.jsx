import React, { useState, useEffect, useMemo } from 'react';
import Icon from './Icon';
import useStore from '../engine/store';
import { publicAsset } from '../publicAsset.js';
import { pick, localeTag } from '../i18n/locale.js';
import { multimodalImagery } from '../data/mockData';

const typeColors = {
    drone_rgb: '#38bdf8',
    thermal_ir: '#ef4444',
    satellite_ndvi: '#34d399',
    pest_trap: '#f59e0b',
    hyperspectral: '#a78bfa',
    leaf_wetness: '#06b6d4',
};

const typeIcons = {
    drone_rgb: 'drone',
    thermal_ir: 'perception',
    satellite_ndvi: 'layers',
    pest_trap: 'alert-triangle',
    hyperspectral: 'perception',
    leaf_wetness: 'activity',
};

const annotationZh = {
    'IMG-001': '检测到灰霉病斑 15 处，严重度中高；8 个果簇可见孢子层。',
    'IMG-002': '温度分布 14.2-22.8°C，低温高湿区与真菌高风险区重合。',
    'IMG-003': 'NDVI 范围 0.42-0.78，东侧行区出现明显胁迫，与无人机结果一致。',
    'IMG-004': '识别到棉蚜 12 只、西花蓟马 3 只，当前低于施药阈值。',
    'IMG-005': '高光谱假彩图显示 23 个冠层片段出现早期病害信号。',
    'IMG-006': '叶面水膜持续 2.62 小时，预计 23:00 出现露点收敛。',
};

const sourceText = (img, locale) => (locale === 'zh' ? (img.sourceZh || img.source) : img.source);
const annotationText = (img, locale) => (locale === 'zh' ? (annotationZh[img.id] || img.annotation) : img.annotation);
const zoneText = (img, locale) => {
    if (locale !== 'zh') return img.zone;
    if (img.zoneZh) return img.zoneZh;
    const map = {
        'Rows 4-7, East': '东区第 4-7 行',
        'Full field B3': 'B3 全域',
        'Full farm overview': '农场全景',
        'Trap Station #7': '诱捕站 #7',
        'Rows 4-7': '第 4-7 行',
        'Row 5, Node 12': '第 5 行，节点 12',
    };
    return map[img.zone] || img.zone;
};

export default function MultimodalGallery({ compact = false }) {
    const locale = useStore(state => state.locale);
    const t = (en, zh) => pick(locale, en, zh);

    const [selected, setSelected] = useState(null);
    const [failedImages, setFailedImages] = useState({});
    const [streamIndex, setStreamIndex] = useState(0);

    const liveFeeds = useMemo(() => {
        return multimodalImagery.filter(img =>
            ['drone_rgb', 'thermal_ir', 'pest_trap', 'hyperspectral'].includes(img.type)
        );
    }, []);

    useEffect(() => {
        if (liveFeeds.length === 0) return;
        const interval = setInterval(() => {
            setStreamIndex(prev => (prev + 1) % liveFeeds.length);
        }, 15000);
        return () => clearInterval(interval);
    }, [liveFeeds]);

    const formatTimestamp = (ts) => {
        const d = new Date(ts);
        return d.toLocaleString(localeTag(locale), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const markImageFailed = (filename) => {
        setFailedImages(prev => ({ ...prev, [filename]: true }));
    };

    if (compact) {
        return (
            <div className="multimodal-strip">
                <div className="mm-thumb live-stream" onClick={() => setSelected(liveFeeds[streamIndex])} style={{ cursor: 'pointer', borderColor: '#ef4444' }}>
                    <div className="live-tag">{t('LIVE FEED', '实时画面')}</div>
                    {failedImages[liveFeeds[streamIndex].filename] ? (
                        <div className="mm-fallback">
                            <Icon name="camera" size={14} color="#94a3b8" />
                            <span>{t('Feed unavailable', '画面暂不可用')}</span>
                        </div>
                    ) : (
                        <img src={publicAsset(liveFeeds[streamIndex].filename)} alt={t('Live Feed', '实时画面')} loading="lazy" onError={() => markImageFailed(liveFeeds[streamIndex].filename)} />
                    )}
                    <div className="mm-thumb-label">
                        <Icon name={typeIcons[liveFeeds[streamIndex].type]} size={10} color={typeColors[liveFeeds[streamIndex].type]} />
                        <span>{sourceText(liveFeeds[streamIndex], locale)}</span>
                    </div>
                </div>

                {multimodalImagery.filter(img => img.id !== liveFeeds[streamIndex].id).slice(0, 3).map(img => (
                    <div key={img.id} className="mm-thumb" onClick={() => setSelected(img)} style={{ cursor: 'pointer' }}>
                        {failedImages[img.filename] ? (
                            <div className="mm-fallback">
                                <Icon name="camera" size={14} color="#94a3b8" />
                                <span>{t('Feed unavailable', '画面暂不可用')}</span>
                            </div>
                        ) : (
                            <img src={publicAsset(img.filename)} alt={sourceText(img, locale)} loading="lazy" onError={() => markImageFailed(img.filename)} />
                        )}
                        <div className="mm-thumb-label">
                            <Icon name={typeIcons[img.type]} size={10} color={typeColors[img.type]} />
                            <span>{sourceText(img, locale)}</span>
                        </div>
                    </div>
                ))}
                {selected && <ImageModal img={selected} onClose={() => setSelected(null)} failed={Boolean(failedImages[selected.filename])} onImageError={() => markImageFailed(selected.filename)} locale={locale} />}
            </div>
        );
    }

    return (
        <div className="multimodal-gallery">
            <div className="mm-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(167,139,250,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="perception" size={16} color="#38bdf8" />
                    </div>
                    <div>
                        <div className="mm-title">{t('Multimodal Sensor Feed', '多模态传感流')}</div>
                        <div className="mm-subtitle">{multimodalImagery.length} {t('sources', '个来源')} | {t('Latest', '最近')}: {formatTimestamp(multimodalImagery[0].timestamp)}</div>
                    </div>
                </div>
            </div>
            <div className="mm-grid">
                {multimodalImagery.map(img => (
                    <div key={img.id} className="mm-card" onClick={() => setSelected(img)}>
                        <div className="mm-card-image">
                            {failedImages[img.filename] ? (
                                <div className="mm-fallback">
                                    <Icon name="camera" size={15} color="#94a3b8" />
                                    <span>{t('Feed unavailable', '画面暂不可用')}</span>
                                </div>
                            ) : (
                                <img src={publicAsset(img.filename)} alt={sourceText(img, locale)} loading="lazy" onError={() => markImageFailed(img.filename)} />
                            )}
                            <div className="mm-card-type" style={{ background: typeColors[img.type] }}>
                                <Icon name={typeIcons[img.type]} size={10} color="#fff" />
                                {sourceText(img, locale)}
                            </div>
                        </div>
                        <div className="mm-card-info">
                            <div className="mm-card-source">{sourceText(img, locale)}</div>
                            <div className="mm-card-meta">
                                <span>{formatTimestamp(img.timestamp)}</span>
                                <span>{zoneText(img, locale)}</span>
                            </div>
                            <div className="mm-card-annotation">{annotationText(img, locale).slice(0, 80)}...</div>
                        </div>
                    </div>
                ))}
            </div>
            {selected && <ImageModal img={selected} onClose={() => setSelected(null)} failed={Boolean(failedImages[selected.filename])} onImageError={() => markImageFailed(selected.filename)} locale={locale} />}
        </div>
    );
}

function ImageModal({ img, onClose, failed, onImageError, locale }) {
    const t = (en, zh) => pick(locale, en, zh);

    return (
        <div className="mm-modal-overlay" onClick={onClose}>
            <div className="mm-modal" onClick={e => e.stopPropagation()}>
                <div className="mm-modal-image">
                    {failed ? (
                        <div className="mm-fallback">
                            <Icon name="camera" size={18} color="#94a3b8" />
                            <span>{t('Feed unavailable', '画面暂不可用')}</span>
                        </div>
                    ) : (
                        <img src={publicAsset(img.filename)} alt={sourceText(img, locale)} onError={onImageError} />
                    )}
                </div>
                <div className="mm-modal-sidebar">
                    <button type="button" className="mm-modal-close icon-btn" onClick={onClose} aria-label={t('Close image detail', '关闭图像详情')}>
                        <Icon name="x" size={14} color="#94a3b8" />
                    </button>
                    <div className="mm-modal-source" style={{ color: typeColors[img.type] }}>
                        <Icon name={typeIcons[img.type]} size={16} color={typeColors[img.type]} />
                        {sourceText(img, locale)}
                    </div>
                    <div className="mm-modal-field">{sourceText(img, locale)}</div>

                    <div className="mm-modal-section">
                        <div className="mm-modal-label">{t('Timestamp', '时间戳')}</div>
                        <div className="mm-modal-value">{new Date(img.timestamp).toLocaleString(localeTag(locale))}</div>
                    </div>
                    <div className="mm-modal-section">
                        <div className="mm-modal-label">{t('Zone', '分区')}</div>
                        <div className="mm-modal-value">{zoneText(img, locale)}</div>
                    </div>
                    <div className="mm-modal-section">
                        <div className="mm-modal-label">{t('Resolution', '分辨率')}</div>
                        <div className="mm-modal-value">{img.resolution}</div>
                    </div>
                    <div className="mm-modal-section">
                        <div className="mm-modal-label">{t('AI Annotation', 'AI 标注')}</div>
                        <div className="mm-modal-annotation">{annotationText(img, locale)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
