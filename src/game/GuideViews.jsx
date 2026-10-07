import { useState } from 'react';
import { useGameLocale } from './GameLocaleContext.js';
import { GAMEPLAY_GUIDE_MODULES } from './content/gameplayGuide.js';
import { CROP_KNOWLEDGE } from './content/cropKnowledge.js';
import './guides.css';

function GuideCard({ card, navigate, index }) {
  const { locale } = useGameLocale();
  const text = value => value?.[locale] || value?.en || '';
  const List = card.ordered ? 'ol' : 'ul';
  return <article className="fg-panel fg-guide-card" data-guide-card={card.id}>
    {index != null && <span className="fg-guide-step">{String(index + 1).padStart(2, '0')}</span>}
    <h3>{text(card.title)}</h3>
    {card.body && <p>{text(card.body)}</p>}
    {card.items?.length > 0 && <List>{card.items.map((item, i) => <li key={i}>{text(item)}</li>)}</List>}
    {card.target && <button className="fg-button fg-button--secondary" onClick={() => navigate(card.target)}>{text(card.link)} <span aria-hidden="true">→</span></button>}
  </article>;
}

export function GameplayGuide({ navigate, modules = GAMEPLAY_GUIDE_MODULES }) {
  const { locale } = useGameLocale();
  const text = value => value?.[locale] || value?.en || '';
  return <div className="fg-guides" data-testid="gameplay-guide">
    <section className="fg-guide-intro"><span className="fg-eyebrow">{locale === 'zh' ? '新手入门' : 'GETTING STARTED'}</span><h2>{locale === 'zh' ? '先看清现状，再安排下一步' : 'Understand the farm, then plan your next step'}</h2><p>{locale === 'zh' ? '这些卡片介绍当前玩法、每天怎么操作，以及你可能遇到的取舍。随时回来看，不会消耗资源或推进时间。' : 'These cards explain the current rules, daily actions and likely trade-offs. Return any time; reading uses no resources and advances no time.'}</p></section>
    {modules.map(module => <section className="fg-guide-module" key={module.id} data-guide-module={module.id}><div className="fg-guide-heading"><h2>{text(module.title)}</h2><p>{text(module.description)}</p></div><div className="fg-guide-cards">{module.cards.map(card => <GuideCard key={card.id} card={card} navigate={navigate} />)}</div></section>)}
  </div>;
}

export function CropEncyclopedia({ navigate, crops = CROP_KNOWLEDGE, activeCropIds = [] }) {
  const { locale } = useGameLocale();
  const text = value => value?.[locale] || value?.en || '';
  const list = Object.values(crops);
  const [cropId, setCropId] = useState(list[0]?.id || '');
  const crop = crops[cropId] || list[0];
  if (!crop) return <section className="fg-panel">{locale === 'zh' ? '暂无作物知识卡片。' : 'No crop knowledge cards yet.'}</section>;
  return <div className="fg-guides" data-testid="crop-encyclopedia">
    <section className="fg-guide-intro"><span className="fg-eyebrow">{locale === 'zh' ? '作物百科' : 'CROP ENCYCLOPEDIA'}</span><h2>{locale === 'zh' ? '了解作物，也了解它的经营节奏' : 'Understand the crop and its business rhythm'}</h2><p>{locale === 'zh' ? '从作物特性到生长周期，再到成本、品质与市场。每种作物有独立知识卡片，方便扩充和对照。' : 'Explore crop traits, growth cycles, costs, quality and markets. Each crop has its own knowledge cards for extension and comparison.'}</p></section>
    <div className="fg-crop-picker" role="tablist" aria-label={locale === 'zh' ? '选择作物' : 'Select crop'}>{list.map(item => <button type="button" role="tab" key={item.id} aria-selected={crop.id === item.id} onClick={() => setCropId(item.id)}>{text(item.name)}{activeCropIds.includes(item.id) && <small>{locale === 'zh' ? '当前试玩' : 'Current scenario'}</small>}</button>)}</div>
    <section className="fg-guide-module"><div className="fg-guide-heading"><h2>{text(crop.name)}</h2><p>{text(crop.summary)}</p></div></section>
    {crop.sections.map(section => <section className="fg-guide-module" key={section.id} data-knowledge-section={section.id}><div className="fg-guide-heading"><h2>{text(section.title)}</h2>{section.intro && <p>{text(section.intro)}</p>}</div><div className={section.stages ? 'fg-guide-cards fg-guide-cards--stages' : 'fg-guide-cards'}>{(section.cards || section.stages || []).map((card, i) => <GuideCard key={card.id} card={card} index={section.stages ? i : null} navigate={navigate} />)}</div></section>)}
  </div>;
}
