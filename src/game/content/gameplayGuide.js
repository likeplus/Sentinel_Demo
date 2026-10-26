const text = (zh, en) => ({ zh, en });
const card = (id, zh, en, bodyZh, bodyEn, items = [], target = "map") => ({
  id,
  title: text(zh, en),
  body: text(bodyZh, bodyEn),
  items: items.map(([zh, en]) => text(zh, en)),
  target,
  link: text("前往操作", "Open workspace"),
});

export const DAILY_BRIEFING = {
  title: text("先看农场，再安排工作", "Observe the farm, then arrange work"),
  body: text(
    "早会查看左侧状态、报告日期和已有任务，在右侧分配人员与资源。处理所有待表态事件后开始执行；日终核对实际结果，次日再调整。",
    "At the morning meeting, review conditions, report dates and existing plans on the left; allocate people and resources on the right. Address every pending decision before execution, review actual results, then adjust next morning.",
  ),
  reminder: text(
    "信息陈旧不代表安全，作业完成不代表问题已经解决。",
    "Old information does not confirm safety; completed work does not confirm recovery.",
  ),
  loop: text(
    "观察 → 判断 → 安排 → 执行 → 复盘 → 次日早会",
    "Observe → Assess → Plan → Execute → Review → Next morning",
  ),
};

// Shared management modules; crop-specific knowledge remains in crop packs/cards.
export const GAMEPLAY_GUIDE_MODULES = [
  {
    id: "manager",
    title: text("你要管理什么", "Your role as farm manager"),
    description: text(
      "在有限的信息、人员、设备和资源下，决定哪里需要关注、先做什么，以及哪些工作可以等待。",
      "With limited information, people, equipment and resources, decide what needs attention, what comes first and what can wait.",
    ),
    cards: [
      card(
        "production-units",
        "从生产单元开始",
        "Start with production units",
        "生产单元是可以分别查看状态和安排工作的管理对象。你不必每天检查所有单元，但要分清哪些情况已经了解，哪些地方缺少信息。",
        "A production unit is a management area with its own conditions and work plans. You need not inspect every unit daily, but should distinguish known conditions from information gaps.",
        [
          [
            "左侧查看天气、状态、证据和日历；右侧安排资源、任务并查看结算。",
            "Review weather, conditions, evidence and the calendar on the left; arrange resources and work and review settlement on the right.",
          ],
          [
            "左右多选同步。可以为多个生产单元安排同一项工作。",
            "Selections stay synchronized on both sides. Plan the same work for multiple units.",
          ],
        ],
      ),
    ],
  },
  {
    id: "daily-management",
    title: text("每天怎样进行", "The daily management cycle"),
    description: text(
      "早会是正式排程窗口。执行后回顾结果，次日再作调整。",
      "The morning meeting is the scheduling window. Review execution results and adjust the next morning.",
    ),
    cards: [
      card(
        "first-day",
        "按一天的顺序操作",
        "Work through a day",
        "观察、判断、安排、执行和复盘形成连续的管理循环。",
        "Observation, assessment, planning, execution and review form one continuous management cycle.",
        [
          [
            "早会：回顾昨日结果、天气、新报告和已有排程，安排今天或未来的工作。",
            "Morning meeting: review yesterday’s results, weather, reports and existing plans; schedule today or later.",
          ],
          [
            "执行：人员和设备按计划开展工作。当日排程关闭，新发现留到下一次早会处理。",
            "Execution: people and equipment follow the plan. Scheduling closes; new findings wait for the next meeting.",
          ],
          [
            "日终复盘：核对完成、受阻、资源消耗和需要验证的效果。",
            "End-of-day review: check completion, blocked work, resources used and effects requiring verification.",
          ],
          [
            "次日早会：接收新信息，结合昨日结果重新判断。",
            "Next morning: receive new evidence and reassess using yesterday’s results.",
          ],
        ],
      ),
    ],
  },
  {
    id: "evidence-actions",
    title: text("先看状态，再看证据", "Read conditions together with evidence"),
    description: text(
      "信息内容、采样时间和来源要一起看。未知不能当作正常。",
      "Read findings, sampling time and source together. Unknown does not mean normal.",
    ),
    cards: [
      card(
        "information",
        "分清不同状态",
        "Separate the different conditions",
        "水分胁迫、病虫害迹象和设备状态描述不同问题。未见病虫害不代表供水正常；长期可靠也不代表设备今天没有故障。",
        "Water stress, pest/disease signs and equipment status describe different issues. No visible pests does not confirm adequate water; long-term reliability does not confirm that equipment works today.",
        [
          [
            "水分分值是状态评估，不是土壤含水率或缺水概率。",
            "A water-stress score is an assessment, not soil water content or the probability of a shortage.",
          ],
          [
            "生长阶段依据已收到的阶段报告；报告陈旧时应留意是否需要重新确认。",
            "Growth stage is based on a delivered stage report; old reports may need confirmation.",
          ],
        ],
      ),
      card(
        "information-updates",
        "这些信息是什么时候获得的？",
        "When was this information obtained?",
        "信息新鲜度显示“当天／几天前／暂无信息”，表示有效信息距今多久，不是作物长了几天。",
        "Information freshness shows Today, days ago or No information yet. It is evidence age, not crop age.",
        [
          [
            "一次完整巡查同步检查水分、作物与设备。传感器之后可以单独更新水分信息。",
            "A full inspection checks water, crops and equipment together. Sensors may subsequently update water information independently.",
          ],
          [
            "例如昨天巡查、今天传感器更新：水分信息为当天，病虫害与设备巡查信息为1天前。",
            "Yesterday’s inspection followed by today’s sensor update means water information is current today while crop/equipment inspection information is one day old.",
          ],
          [
            "巡查可信度来自最近一次巡查报告。传感器更新不会提高这份报告的可信度。",
            "Inspection confidence belongs to the latest inspection report. Sensor updates do not increase that report’s confidence.",
          ],
          [
            "没有新观测时，主值和证据曲线停在最后观测。旧值不变不代表农场没变，当前状态可能尚未确认。",
            "Without new evidence, the main value and evidence curve stop at the last observation. An unchanged old value does not mean the farm stopped changing; current conditions may be unconfirmed.",
          ],
        ],
      ),
    ],
  },
  {
    id: "people-resources",
    title: text("谁负责什么", "People and resources"),
    description: text(
      "根据任务实际使用的人员和设备预约容量，不把不同人员混成一个名额。",
      "Reserve the people and equipment that actually perform each task; keep separate personnel capacities distinct.",
    ),
    cards: [
      card(
        "resources",
        "人员容量与经理注意力",
        "Personnel capacity and manager attention",
        "劳动力是班组当天的工作容量，不能结转。独立维修人员另有自己的可用人员日。经理注意力用于亲自判断和现场投入，不按点击次数计算。",
        "Labor is a crew’s daily work capacity and does not carry over. Independent technicians have their own available person-days. Manager attention covers personal judgment and field involvement, rather than clicks.",
        [
          [
            "农场经理确定优先级、安排工作，可以亲自判断复杂问题或委派分析。",
            "The manager sets priorities and plans work, personally reviewing complex issues or delegating analysis.",
          ],
          [
            "田间班组执行巡查、人工补水、喷施和任务指定的普通维修。专业维修事件使用独立维修人员。",
            "Field crews perform inspections, manual watering, spraying and assigned routine repairs. Specialist repair events use independent technicians.",
          ],
          [
            "早会固定消耗1点注意力；普通排程不额外消耗。复杂经理判断消耗1点，经理亲自巡查消耗2点且不占班组劳动力，附加现场工作仍需人员。",
            "The meeting costs 1 Attention; routine scheduling costs no extra. Complex manager review costs 1; personal inspection costs 2 with no crew labor, while attached fieldwork still needs personnel.",
          ],
          [
            "注意力用完仍可安排普通工作，或把复杂判断交给团队与智能助手。",
            "At zero attention you can still plan routine work or delegate complex judgment to the team or AI assistant.",
          ],
        ],
      ),
    ],
  },
  {
    id: "planning",
    title: text("怎样安排工作", "Planning work"),
    description: text(
      "先选对象与日期，再核对资源和已有预约。",
      "Select the target and date, then check resources and existing reservations.",
    ),
    cards: [
      card(
        "actions",
        "选择、组合与调整任务",
        "Select, combine and adjust tasks",
        "选择一个或多个单元，为今天或未来日期安排任务。确认前核对本次需求、预计费用和排程后剩余容量。",
        "Select one or more units and schedule today or later. Before confirming, check requirements, expected costs and capacity remaining after this plan.",
        [
          [
            "巡查可以附加人工补水、喷施、维修或传感器迁移，组合中的每项工作都核算资源并保留结果。",
            "Attach manual watering, spraying, repair or sensor relocation to inspection. Each attached action uses resources and keeps its own result.",
          ],
          [
            "系统灌溉是一项安排在指定日期的作业，依赖灌溉设备。人工补水需要更多人力，可以绕过故障设备。",
            "System irrigation is an operation on a chosen date and depends on irrigation equipment. Manual watering requires more labor and can bypass a fault.",
          ],
          [
            "同一单元、日期和作业类型只能安排一次。批量任务全部通过资源检查后才会创建。",
            "Each action is unique per unit and date. A batch is created only if every task passes resource checks.",
          ],
          [
            "尚未执行的任务可保留、改期或取消。取消释放预约，不产生观测。固定传感器不能迁移，移动传感器通过正式任务迁移。",
            "Keep, reschedule or cancel unexecuted work. Cancellation releases reservations and produces no observation. Fixed sensors stay in place; move mobile sensors through a scheduled task.",
          ],
        ],
      ),
    ],
  },
  {
    id: "decisions-reports",
    title: text("遇到事件怎样决策", "Decisions and reports"),
    description: text(
      "先比较证据和可行方案，再明确下一步。",
      "Compare evidence and feasible options, then record the next step.",
    ),
    cards: [
      card(
        "delegation",
        "处理当前待表态事件",
        "Address pending decisions",
        "查看事件相关单元的趋势、证据和资源条件。所有当前待表态事件处理后，才能开始执行。",
        "Review the affected units’ trends, evidence and resource constraints. Address every pending decision before execution.",
        [
          [
            "可以安排处理、先调查、委派等待、暂缓并设复查日，或明确不采取行动。等待也需要明确记录。",
            "Act, investigate first, delegate and wait, defer to a review date or explicitly take no action. Waiting is a decision that must be recorded.",
          ],
          [
            "调查和委派需要时间；已明确等待的事件不会阻止进入下一天。复查到期或新建议送达时再作判断。",
            "Investigations and delegation take time. An explicit wait does not block tomorrow. Reassess when a review is due or a proposal arrives.",
          ],
          [
            "团队和智能助手提供建议，不自动执行。智能助手的建议可以接受或拒绝；接受不扣注意力，仍需通过资源检查。",
            "Team and AI proposals do not execute automatically. Accept or reject AI advice; accepting uses no attention but still requires available resources.",
          ],
        ],
        "decisions",
      ),
      card(
        "sampling",
        "农艺师与检测报告",
        "Agronomists and laboratory reports",
        "农艺师负责采样、组织送检和解读，实验室负责样品检测。报告的采样时间与送达时间分别记录。",
        "Agronomists sample, arrange testing and interpret results; laboratories analyze samples. Sampling and delivery times are recorded separately.",
        [
          [
            "例如，3月4日采样、3月6日收到的送检报告，反映采样当时的情况，不是6日的实时状态。",
            "For example, a report sampled on March 4 and delivered on March 6 describes conditions at sampling time, not live conditions on delivery day.",
          ],
          [
            "报告可靠度不是风险概率。对比更新的观测、不同来源和采样时间，再判断是否需要检查或处理。",
            "Report reliability is not risk probability. Compare newer observations, sources and sampling times before deciding whether to inspect or act.",
          ],
          [
            "人员例行水分抽测提供局部信息，不等于一次完整的作物与设备巡查。",
            "Routine field water checks provide partial evidence and are not full crop/equipment inspections.",
          ],
        ],
      ),
    ],
  },
  {
    id: "review",
    title: text("执行后怎样复盘", "Reviewing execution"),
    description: text(
      "比较计划与实际，把未确认的问题带到次日早会。",
      "Compare plan and execution and carry unconfirmed issues into the next meeting.",
    ),
    cards: [
      card(
        "feedback",
        "核对结果，再判断效果",
        "Check execution before judging effects",
        "作业完成与问题得到控制是两件事。复盘同时看完成情况、受阻原因、实际消耗与后续验证。",
        "Completed work and controlled risk are different outcomes. Review completion, blocking causes, actual resource use and follow-up evidence.",
        [
          [
            "补水后显示预计影响，不会凭空生成一条巡查记录。是否恢复，需要后续有效观测确认。",
            "Watering shows an expected effect without creating an inspection record. Subsequent valid evidence must confirm recovery.",
          ],
          [
            "费用按实际执行记账。预计收入不是已到账现金；将生产状况、信息覆盖、资源使用与经营成本一起考虑。",
            "Book costs on actual execution. Forecast revenue is not cash received. Consider production, evidence coverage, resource use and operating costs together.",
          ],
          [
            "缺水遇上故障时比较维修与人工补水；报告冲突时先比较时间与来源；资源不足时调整优先级或未来排程。",
            "When stress meets a fault, compare repair and manual watering. When reports disagree, compare time and source. When resources are tight, change priorities or future plans.",
          ],
        ],
      ),
    ],
  },
];
