import { BLUEBERRY_STAGE_CARDS } from './blueberryStages.js';
const text = (zh, en) => ({ zh, en });

/** Registry key matches CropPack.id. New crops can provide cards and stages independently. */
export const CROP_KNOWLEDGE = {
  blueberry: {
    id: 'blueberry', name: text('蓝莓', 'Blueberry'),
    summary: text('多年生果树，根区管理和果实品质直接影响产量、商品率与经营结果。把品种、气候、栽培方式和销售渠道放在一起理解。', 'A perennial fruit crop whose root-zone management and fruit quality affect yield, marketable output and business results. Consider cultivar, climate, growing system and sales channel together.'),
    sections: [
      { id: 'traits', title: text('作物特性', 'Crop characteristics'), cards: [
        { id: 'roots', title: text('浅根系：水分稳定比单次大水更重要', 'Shallow roots favor stable moisture'), body: text('蓝莓根系较浅，根区缺水和积水都可能影响长势。基质或土壤需要合适酸度、良好排水与通气；管理策略应按品种、根区条件和栽培方式调整。', 'Blueberries have relatively shallow roots. Both drought and waterlogging can impair growth. Soil or substrate needs suitable acidity, drainage and aeration; adapt management to cultivar and growing system.') },
        { id: 'variety-climate', title: text('品种与气候决定节奏', 'Cultivar and climate set the rhythm'), body: text('不同品种的冷量需求、成熟时间、花果表现和果实品质不同。设施栽培与露地栽培也会改变管理节奏；不要把同一日期、同一灌溉量直接复制给所有单元。', 'Cultivars differ in chilling needs, maturity, flowering and fruit quality. Protected and outdoor systems also differ. Do not copy the same timing and water dose across every unit.') },
        { id: 'fruit-quality', title: text('果实易受损，商品率不等于总产量', 'Delicate fruit makes marketable yield important'), body: text('鲜果的大小、硬度、果粉、成熟度和外观影响分级与销售。采摘、分拣、降温和运输中的损伤与损耗，可能让高产量无法转化为同等收入。', 'Size, firmness, bloom, ripeness and appearance affect grading. Damage and losses during picking, sorting, cooling and transport can prevent high yields from becoming equivalent revenue.') },
      ] },
      { id: 'cycle', title: text('生长周期', 'Growth cycle'), intro: text('蓝莓有多年生的生命周期，也有每年的生长与结果周期。实际时间因品种、产区和设施而异，以下按阶段理解，而非固定月份。', 'Blueberries have a perennial lifecycle and an annual growth-and-fruiting cycle. Timing varies by cultivar, location and protected cultivation; these are stages rather than fixed months.'), stages: [
        { id: 'dormancy', title: text('休眠与萌芽准备', 'Dormancy and bud preparation'), body: text('了解品种冷量需求、花芽与枝条基础，检查越冬、修剪和设备准备。多年生植株的树势会影响后续结果能力。', 'Understand chilling requirements, flower buds and cane structure. Prepare for overwintering, pruning and equipment readiness; plant vigor affects later fruiting.') },
        ...BLUEBERRY_STAGE_CARDS,
      ] },
      { id: 'after-season', title: text('采后与下一年：延伸知识', 'After harvest and next season: background'), cards: [
        { id: 'postharvest', title: text('采后恢复与下一年准备', 'Postharvest recovery and next-season preparation'), body: text('采收结束后仍需维持叶片和根系健康，为枝条恢复、花芽形成和下一年生产打基础。它属于多年生经营背景，不对应当前试玩的采收期，也不会新增游戏阶段。', 'After harvest, maintain healthy leaves and roots to support cane recovery, flower-bud formation and next year’s production. This is perennial business background, not the demo’s harvest stage, and introduces no new simulated stage.') },
      ] },
      { id: 'business', title: text('经营与市场规律', 'Business and market patterns'), cards: [
        { id: 'costs', title: text('经营要算完整成本', 'Account for the complete cost'), body: text('除水肥与田间作业外，还要考虑苗木和设施投入、采摘用工、包装、分级、冷链、物流与损耗。实际经营应看可售产量和单位可售产品的成本。', 'Include plants, infrastructure, harvest labor, packing, grading, cold chain, logistics and losses alongside field inputs. Evaluate marketable yield and cost per saleable unit.') },
        { id: 'seasonality', title: text('供给季节性与上市窗口', 'Seasonal supply and marketing windows'), body: text('集中上市会增加供给压力，早晚上市或特定品质可能有不同价格机会，但也可能增加设施、能耗和管理成本。上市早并不必然利润更高。', 'Concentrated harvest increases supply pressure. Early or late windows and specific quality may offer price opportunities, but infrastructure, energy and management costs may also rise. Earlier does not automatically mean more profitable.') },
        { id: 'channels', title: text('渠道、品质和稳定交付', 'Channel, quality and consistent delivery'), body: text('批发、零售、直销和合同渠道的分级要求、包装、回款与销售成本不同。果实品质、可追溯性、交付稳定性和售后损耗共同影响实际成交。', 'Wholesale, retail, direct and contract channels differ in grading, packaging, payment and selling costs. Quality, traceability, consistent delivery and losses affect realized sales.') },
        { id: 'perishable', title: text('鲜果的库存不是越多越好', 'More fresh-fruit inventory is not always better'), body: text('鲜果保鲜时间有限，及时降温、合理冷链和销售衔接很重要。对采收节奏、天气、人手和出货能力一起排程，可降低积压、品质下降和报损。', 'Fresh fruit has a limited shelf life. Prompt cooling, suitable cold chain and sales coordination matter. Plan picking, weather, labor and shipping capacity together to reduce backlog and losses.') },
      ] },
      { id: 'in-game', title: text('把知识用于当前试玩', 'Apply this knowledge in the demo'), cards: [
        { id: 'stage-priorities', title: text('不同阶段，观察重点不同', 'Different stages need different observations'), body: text('当前试玩重点管理水分、信息、设备和资源。开花与果实发育阶段更应关注供水稳定与及时证据；成熟阶段关注果况与品质。先看已知阶段，再判断任务优先级。', 'This demo focuses on water, information, equipment and resources. Flowering and fruit development need stable water and timely evidence; ripening emphasizes fruit condition and quality. Use the observed stage to prioritize work.'), target: 'map', link: text('查看单元与已知阶段', 'View units and observed stages') },
        { id: 'scope', title: text('知识百科与游戏模拟范围', 'Knowledge versus simulated mechanics'), body: text('百科描述作物与经营背景，不代表当前试玩已模拟多年树龄、真实市场价格、分级、冷链和销售合同。当前预计收入仍是基于证据的示例估算，不能当作销售到账。', 'The encyclopedia provides crop and business context. The demo does not yet simulate multi-year age, live prices, grading, cold chain or contracts. Forecast revenue remains an illustrative estimate, not received sales income.') },
      ] },
    ],
  },
};
