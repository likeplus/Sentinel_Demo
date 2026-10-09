import { GROWTH_STAGES } from '../../domain/growthStages.js';
const text = (zh, en) => ({ zh, en });
const labels = {
  happening: text('正在发生什么', 'What is happening'),
  water: text('水分敏感点', 'Water sensitivity'),
  pest: text('病虫害关注点', 'Pest and disease sensitivity'),
  observe: text('巡查重点', 'Important observations'),
  priority: text('当前管理优先级', 'Management priorities'),
  mistake: text('常见误判', 'Common mistakes'),
  business: text('经营安排', 'Business planning'),
};

/** Knowledge content is extensible independently of stage timing and simulated actions. */
const details = {
  vegetative: {
    happening: text('新梢、叶片与根系生长，形成后续供养花果的基础。', 'Shoots, leaves and roots grow, building the capacity to support later fruiting.'),
    water: text('保持根区水分稳定、排水和通气；不能只看叶片正常就判断根区安全。', 'Maintain stable root moisture, drainage and aeration. Healthy-looking leaves alone do not confirm a safe root zone.'),
    pest: text('关注嫩叶、嫩梢的虫害与病斑，比较不同单元的长势差异。', 'Check young leaves and shoots for pests and lesions, and compare vigor between units.'),
    observe: text('叶色、新梢生长、萎蔫、根区水分，以及滴头和管路出水。', 'Observe leaf color, shoot growth, wilt, root moisture, drippers and pipe flow.'),
    priority: text('先补齐过旧或未知的信息，再处理缺水与供水故障，维持健康树势。', 'Refresh stale or unknown evidence, then address water stress and irrigation faults to maintain healthy growth.'),
    mistake: text('把快速长枝当作产量已经提高；把大水灌溉当作长期稳定供水。', 'Treating rapid shoot growth as realized yield, or a large water dose as lasting moisture stability.'),
    business: text('主要是投入与树势管理阶段，预计收入仍是估计，并非销售到账。', 'This is primarily an investment and plant-vigor stage. Forecast revenue is an estimate, not received sales income.'),
  },
  flowering: {
    happening: text('花朵开放并完成授粉；授粉质量影响下一阶段能留下多少幼果。', 'Flowers open and are pollinated. Pollination quality influences how many young fruits remain in the next stage.'),
    water: text('对缺水较敏感；避免供水中断，也避免根区积水。', 'Sensitive to water shortage. Avoid interrupted supply and waterlogged roots.'),
    pest: text('重点关注花部病害、叶面持续湿润和病虫害迹象。', 'Pay attention to flower disease, prolonged leaf wetness and signs of pests.'),
    observe: text('花朵健康、授粉表现、叶片萎蔫、供水均匀性与设备异常。', 'Check flower health, pollination, leaf wilt, uniform water delivery and equipment issues.'),
    priority: text('有可靠证据时优先稳定供水；发现病害迹象后再判断是否需要喷施。', 'Prioritize stable water when supported by evidence, and assess spraying after detecting disease signs.'),
    mistake: text('开花多不等于坐果多；不要仅凭阶段名称就安排喷施。', 'Many flowers do not guarantee many fruits. A stage name alone is not a reason to spray.'),
    business: text('及时巡查与设备保障影响后续产量基础；安排人员时留意高风险单元。', 'Timely inspection and reliable irrigation protect future yield potential. Allocate labor with high-risk units in mind.'),
  },
  fruit_set: {
    happening: text('授粉后幼果保留并逐渐膨大；本试玩的坐果期也覆盖早期果实发育。', 'Young fruit remains after pollination and begins expanding. The demo’s fruit-set stage also covers early fruit development.'),
    water: text('是供水要求较高的阶段，持续缺水可能影响果径与品质。', 'Water demand is particularly high. Sustained deficits may affect fruit size and quality.'),
    pest: text('关注果叶病斑和病虫害发展，不把正常果色变化误判为病害。', 'Watch fruit and leaf lesions and pest development; do not mistake normal color changes for disease.'),
    observe: text('坐果表现、果径变化、叶片萎蔫、滴头流量，以及水分信息是否及时。', 'Check fruit retention, size changes, leaf wilt, dripper flow and the age of water evidence.'),
    priority: text('优先避免持续缺水；设备故障时比较维修与人工补水，并检查当天劳动力。', 'Prevent sustained deficits. With faulty equipment, compare repair and manual watering against available labor.'),
    mistake: text('灌溉任务完成不等于作物已确认恢复；当天预计影响仍需后续证据核实。', 'A completed irrigation task does not confirm crop recovery. Its expected impact still needs later evidence.'),
    business: text('果径和商品率影响收入潜力；水、人工与维修成本应和风险一起考虑。', 'Fruit size and marketable yield affect revenue potential. Consider water, labor and repair costs alongside risk.'),
  },
  ripening: {
    happening: text('果实逐渐转色、成熟并形成品质；同一单元的果实不会同时成熟。', 'Fruit changes color, ripens and develops quality. Fruit within a unit does not ripen all at once.'),
    water: text('稳定供水仍重要；既要避免缺水，也要防止过量供水和积水。', 'Stable moisture remains important. Avoid deficits, excessive watering and waterlogging.'),
    pest: text('重点关注果腐、裂果和异常果况，区分正常转色与病斑。', 'Look for fruit rot, cracking and abnormal condition, distinguishing normal color change from lesions.'),
    observe: text('果色、硬度、裂果、病斑、水分胁迫，以及不同单元的成熟差异。', 'Observe color, firmness, cracking, lesions, water stress and differences in maturity between units.'),
    priority: text('保持供水与设备稳定，关注品质风险，并提前检查未来人员安排。', 'Maintain stable water and equipment, watch quality risks and review future labor arrangements.'),
    mistake: text('仅凭变蓝就认定所有果实适收；把预计收入当成已经实现的收益。', 'Assuming all fruit is ready because some berries turn blue, or treating forecast revenue as realized income.'),
    business: text('开始协调采收、分级、降温与运输的背景安排；这些市场流程尚未在试玩中完整模拟。', 'Begin coordinating harvest, grading, cooling and transport. These business processes are not fully simulated in this demo.'),
  },
  harvest: {
    happening: text('进入适收窗口，按成熟度分批采收；这是采收期，不是采后恢复期。', 'Fruit enters the harvest window and is picked in batches according to ripeness. This is harvest, not postharvest recovery.'),
    water: text('维持适当供水和健康树势，避免因采收忙碌而忽略缺水或积水。', 'Maintain appropriate moisture and healthy plants. Busy harvest work should not hide drought or waterlogging.'),
    pest: text('关注成熟果的果腐、病斑与损伤，异常果况影响商品率。', 'Check ripe fruit for rot, lesions and damage that reduce marketable yield.'),
    observe: text('成熟度、硬度、果实健康、设备状态与现场通道。', 'Observe ripeness, firmness, fruit health, equipment condition and field access.'),
    priority: text('当前试玩继续安排巡查、供水与维修，检查资源冲突；采摘和销售尚非可执行动作。', 'Continue inspection, watering and repair while checking resource conflicts. Picking and selling are not executable demo actions yet.'),
    mistake: text('把采收期理解为本季已经结束；把百科里的采摘与销售当成现有游戏按钮。', 'Treating harvest as an already finished season, or expecting picking and selling buttons from encyclopedia descriptions.'),
    business: text('分批采摘、及时降温和协调出货可减少损耗；鲜果市场通常受上市时段、品质和渠道影响。', 'Batch picking, prompt cooling and coordinated shipping limit losses. Fresh-fruit markets depend on timing, quality and sales channels.'),
  },
};

export const BLUEBERRY_STAGE_CARDS = Object.entries(details).map(([id, fields]) => ({
  id, title: GROWTH_STAGES[id],
  facts: Object.entries(fields).map(([key, value]) => ({ key, label: labels[key], value })),
}));
