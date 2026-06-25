const VIDEO_CDN_BASE = "https://media.githubusercontent.com/media/wendell0823/AI-XXW/main/assets/videos/";
const useRemoteVideoFiles = /\.vercel\.app$/i.test(window.location.hostname);

function resolveVideoSrc(pathOrFile) {
  const path = pathOrFile.includes("/") ? pathOrFile : `assets/videos/${pathOrFile}`;
  if (!useRemoteVideoFiles) return path;
  return `${VIDEO_CDN_BASE}${encodeURIComponent(path.split("/").pop())}`;
}

function applyStaticVideoSources() {
  document.querySelectorAll("video[data-video-src]").forEach((video) => {
    video.src = resolveVideoSrc(video.dataset.videoSrc || "");
    if (useRemoteVideoFiles) video.crossOrigin = "anonymous";
  });
}

function initEntryLoader() {
  const loader = document.querySelector("#entryLoader");
  const badgeWrap = document.querySelector("#entryBadgeWrap");
  const badge = document.querySelector("#entryBadge");
  const status = document.querySelector("#entryLoaderStatus");
  const numberNodes = [...document.querySelectorAll("[data-loader-number]")];
  if (!loader || !badgeWrap || !badge || !status || !numberNodes.length) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    progress: 0,
    displayed: 0,
    ready: false,
    unlocked: false,
    dragging: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    releaseX: 0,
    releaseY: 0,
    pointerId: null,
    animationFrame: 0,
    progressTimer: 0,
  };

  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
  const formatProgress = (value) => String(Math.round(clampValue(value, 0, 100)));

  function setBadgeTransform(x, y, immediate = false) {
    state.x = x;
    state.y = y;
    badgeWrap.style.setProperty("--badge-x", `${x.toFixed(1)}px`);
    badgeWrap.style.setProperty("--badge-y", `${y.toFixed(1)}px`);
    const rotateX = clampValue(-y / 15, -13, 13);
    const rotateY = clampValue(x / 13, -18, 18);
    const rotateZ = clampValue(x / 62, -9, 9);
    badge.style.setProperty("--badge-rotate-x", `${rotateX.toFixed(2)}deg`);
    badge.style.setProperty("--badge-rotate-y", `${rotateY.toFixed(2)}deg`);
    badge.style.setProperty("--badge-rotate-z", `${rotateZ.toFixed(2)}deg`);
  }

  function renderNumber() {
    const delta = state.progress - state.displayed;
    state.displayed += delta * (prefersReduced ? 1 : 0.16);
    if (Math.abs(delta) < 0.05) state.displayed = state.progress;
    const next = formatProgress(state.displayed);
    numberNodes.forEach((node) => {
      if (node.textContent === next) return;
      node.textContent = next;
      node.classList.remove("is-counting");
      void node.offsetWidth;
      node.classList.add("is-counting");
    });

    if (state.displayed < state.progress || state.displayed < 100) {
      state.animationFrame = requestAnimationFrame(renderNumber);
    } else {
      state.animationFrame = 0;
    }
  }

  function setProgress(value) {
    const next = clampValue(value, state.progress, 100);
    if (next === state.progress) return;
    state.progress = next;
    if (!state.animationFrame) state.animationFrame = requestAnimationFrame(renderNumber);
    if (state.progress >= 100 && !state.ready) {
      state.ready = true;
      loader.classList.add("is-ready");
      status.textContent = "Drag it";
    }
  }

  function completeLoading() {
    window.clearInterval(state.progressTimer);
    setProgress(100);
  }

  function trackLoadingProgress() {
    const loadables = [
      ...document.images,
      ...document.querySelectorAll("video"),
      ...document.querySelectorAll('link[rel="preload"][as="image"]'),
    ];
    const total = Math.max(1, loadables.length);
    const countReady = () =>
      loadables.filter((item) => {
        if (item instanceof HTMLImageElement) return item.complete && item.naturalWidth > 0;
        if (item instanceof HTMLVideoElement) return item.readyState >= 1 || item.networkState === HTMLMediaElement.NETWORK_IDLE;
        if (item instanceof HTMLLinkElement) return true;
        return false;
      }).length;

    state.progressTimer = window.setInterval(() => {
      const assetProgress = (countReady() / total) * 68;
      const timedProgress = Math.min(24, performance.now() / 95);
      const readyStateBoost = document.readyState === "complete" ? 8 : document.readyState === "interactive" ? 4 : 0;
      setProgress(Math.min(96, assetProgress + timedProgress + readyStateBoost));
    }, 90);

    if (document.readyState === "complete") {
      window.setTimeout(completeLoading, 420);
    } else {
      window.addEventListener("load", () => window.setTimeout(completeLoading, 420), { once: true });
    }
  }

  function unlockSite() {
    if (state.unlocked) return;
    state.unlocked = true;
    loader.classList.add("is-revealing");
    window.setTimeout(() => {
      loader.classList.add("is-hidden");
      document.body.classList.remove("entry-loading");
    }, prefersReduced ? 80 : 620);
    window.setTimeout(() => {
      loader.remove();
    }, prefersReduced ? 140 : 1120);
  }

  function flyAway() {
    const distance = Math.max(80, Math.hypot(state.releaseX, state.releaseY));
    const fallbackX = state.releaseX || 1;
    const fallbackY = state.releaseY || -0.35;
    const norm = Math.max(1, Math.hypot(fallbackX, fallbackY));
    const directionX = -fallbackX / norm;
    const directionY = -fallbackY / norm;
    const flight = Math.max(window.innerWidth, window.innerHeight) * 1.25 + distance;
    loader.classList.add("is-flying");
    setBadgeTransform(directionX * flight, directionY * flight, true);
    badge.style.setProperty("--badge-rotate-x", `${(-directionY * 42).toFixed(2)}deg`);
    badge.style.setProperty("--badge-rotate-y", `${(directionX * 64).toFixed(2)}deg`);
    badge.style.setProperty("--badge-rotate-z", `${(directionX * 46).toFixed(2)}deg`);
    window.setTimeout(unlockSite, prefersReduced ? 60 : 420);
  }

  function resetBadge() {
    badgeWrap.style.transition = "";
    badge.style.transition = "";
    loader.classList.remove("is-dragging");
    setBadgeTransform(0, 0, true);
  }

  badge.addEventListener("pointerdown", (event) => {
    if (state.unlocked) return;
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.startX = event.clientX - state.x;
    state.startY = event.clientY - state.y;
    state.releaseX = 0;
    state.releaseY = 0;
    loader.classList.add("is-dragging");
    badge.setPointerCapture(event.pointerId);
  });

  badge.addEventListener("pointermove", (event) => {
    if (!state.dragging || state.pointerId !== event.pointerId) return;
    const nextX = event.clientX - state.startX;
    const nextY = event.clientY - state.startY;
    state.releaseX = nextX;
    state.releaseY = nextY;
    setBadgeTransform(nextX, nextY, true);
  });

  function releaseBadge(event) {
    if (!state.dragging || state.pointerId !== event.pointerId) return;
    state.dragging = false;
    state.pointerId = null;
    badge.releasePointerCapture?.(event.pointerId);
    loader.classList.remove("is-dragging");
    if (state.ready && Math.hypot(state.releaseX, state.releaseY) > 24) {
      flyAway();
    } else {
      resetBadge();
    }
  }

  badge.addEventListener("pointerup", releaseBadge);
  badge.addEventListener("pointercancel", releaseBadge);
  document.body.classList.add("entry-loading");
  setBadgeTransform(0, 0);
  trackLoadingProgress();
  setProgress(1);
}

applyStaticVideoSources();
initEntryLoader();

const storySections = [
  {
    slide: 2,
    id: "stage-02",
    nav: "02",
    tone: "stage",
    kind: "工具现状",
    title: "曾经的盲目摸索，演进为现在的全栈多模态矩阵",
    lead: "工具从单点生成扩展为文案、音频、图片、视频和无限画布的全栈协同。",
    model: "Gemini / SUNO / GPT Image 2.0 / Nano Banana 2 Pro / Seedance 2.0",
    visual: "assets/visuals/stage-02-full.png",
    visualAlt: "AI 多模态工具参考图",
    visualMode: "reference",
    lines: [
      "曾经主要使用的 AI：Seedream / Seedance，用于生成图片和视频",
      "现在使用的 AI：Gemini 3.1 PRO 生成脚本、分镜、提示词",
      "音频：SUNO / MINIMAX 生成 BGM、歌曲、音色、配音",
      "图片：GPT IMAGE 2.0 / Nano Banana 2 Pro / Midjourney / Grok",
      "视频：Seedance 2.0 / 3.0 Omini / Happy Horse / Grok",
    ],
  },
  {
    slide: 3,
    id: "stage-03",
    nav: "03",
    tone: "stage",
    kind: "效率跃迁",
    title: "无限画布工作流：打破工具孤岛的集大成者",
    titleLines: ["无限画布工作流", "打破工具孤岛的", "集大成者"],
    lead: "第三方集成平台把复杂链路节点放到同一张画布上，让 AI 生成不再局限于单次提示词对话。",
    leadLines: ["第三方集成平台把复杂链路节点放到同一张画布上，", "让 AI 生成不再局限于单次提示词对话。"],
    model: "Lovart / TapNow / LibTV / RHTV / updream / Flova.ai",
    visual: "assets/visuals/stage-03-workflow.png",
    visualAlt: "常见 AI 集成平台与无限画布工作流",
    visualMode: "reference",
    lines: [
      "使用第三方集成平台构建自定义工作流",
      "Lovart、LibTV、RHTV、TapNow 等平台可承载复杂链路节点",
      "无限画布让素材、提示词、人物、场景和结果沉淀到同一流程中",
    ],
  },
  {
    slide: 4,
    id: "stage-04",
    nav: "04",
    tone: "stage",
    kind: "克隆量产",
    title: "暂时抛开创意与审美，感受下“量产机器”",
    titleLines: ["暂时抛开", "创意与审美", "感受下“量产机器”"],
    lead: "当工作流连线跑通后，换产品图、换模特脸、改模块能变成几秒钟的机械化替换。",
    visual: "assets/visuals/stage-04-production.png",
    visualAlt: "AI 无限画布量产工作流",
    visualMode: "reference",
    lines: [
      "一键换皮的“模板化克隆”",
      "工作流连线跑通后，换个产品图、改个模特脸就是几秒钟的事",
      "烧掉的是 Token，赚到的是时间",
      "设计到修改耗时节省约 40%，流程越丝滑越能快速交付",
    ],
  },
  {
    slide: 5,
    id: "stage-05",
    nav: "05",
    tone: "stage",
    kind: "自主意识",
    title: "光会克隆不够：像拿控片场一样去创作",
    titleLines: ["光会克隆不够：", "像拿控片场一样去创作"],
    lead: "AI 可以批量执行，但成片质量取决于前置镜头意志、构图、场景、人设和剪辑思维。",
    visual: "assets/visuals/stage-05-director.png",
    visualAlt: "从早期生成到导演思维的 AI 创作流程",
    visualMode: "reference",
    lines: [
      "人人都能使用 AI 生成，怎么才能做有质量的生成",
      "我们曾经做的：一句简单的提示词，批量执行，大量抽卡",
      "我们现在做的：AI 帮你发挥不能的职能，你需要扮演导演",
      "导演思维：构图、场景、人设、镜头、提示词、图片、视频、剪辑思维、成片",
    ],
  },
  {
    slide: 6,
    id: "stage-06",
    nav: "06",
    tone: "stage",
    kind: "大脑天花板",
    title: "不管是抄、是借，还是自己死磕，决定成品画面的依然是你的前置意图",
    titleLines: ["不管是抄、是借，还是自己死磕", "决定成品画面的，依然是你的前置意图"],
    kicker: "进化的脊梁 · 大脑天花板",
    lead: "复制、借鉴和原创都可以成为方法，但真正决定画面的是审美大局观和对痛点的敏感。",
    layout: "centered-feature",
    visual: "assets/visuals/stage-06-methods.png",
    visualAlt: "复制技法、借鉴拼贴和独立原创三个创作方法模块",
    lines: [
      "复制技法：可以轻易去扒别人的 Prompt",
      "借鉴拼贴：在无限画布上拼接大师色调和分镜",
      "独立原创：打动人的是你对痛点的敏感",
      "AI 负责几秒钟完成繁衍复制，但为什么要创造这幅画面，仍然由你决定",
    ],
  },
  {
    slide: 7,
    id: "stage-07",
    nav: "07",
    tone: "stage",
    kind: "审美筛选",
    title: "当克隆技术门槛为零，审美格调变成了顶级奢侈品",
    titleLines: ["当克隆技术门槛为零，", "审美格调变成了", "顶级奢侈品"],
    lead: "技术和平台越来越低门槛，真正稀缺的是顶层策略、高敏锐审美力和判断价值的能力。",
    visual: "assets/visuals/stage-07-value.png",
    visualAlt: "从传统执行到顶层策略与高敏锐审美的价值变化",
    visualMode: "reference",
    lines: [
      "以前昂贵的精细手绘、三维渲染和复杂特效，现在部分情况下 AI 都可以解决",
      "大多数：机械化批量流水线操作",
      "少数人：支配 AI 全链路的超级“创意导演”",
      "顶层策略 + 高敏锐审美力，成为唯一的商业溢价高地",
    ],
  },
  {
    slide: 8,
    id: "stage-08",
    nav: "08",
    tone: "stage",
    kind: "结论转场",
    title: "成为驾驭巨浪的“新物种”，在这张无限画布上写你的名字",
    titleLines: ["成为驾驭巨浪的“新物种”", "在这张无限画布上写你的名字"],
    layout: "centered-statement",
    lead: "前面的工具、效率和审美判断，最终都会回到一张可沉淀、可复用、可扩展的无限画布。",
    lines: ["成为驾驭巨浪的“新物种”", "在这张无限画布上写你的名字"],
  },
  {
    slide: 9,
    id: "insight-09",
    nav: "09",
    tone: "insight",
    kind: "AI 使用心得",
    title: "画布与 Agent：把想法一次性铺开",
    lead: "从一张无限画布出发，把角色、场景、文案、参考图、流程和 Agent 对话汇成完整生成链路。",
    model: "skill / agent",
    visual: "assets/visuals/insight-09-transparent.png",
    visualAlt: "无限画布、AI 智能体和多工具创作流程",
    visualMode: "reference",
    lines: [
      "有想法有逻辑你只需要一顿输出",
      "实在没想法，部分画布也有自带的模版和 skill，通过和智能体 agent 对话也可以生成",
    ],
  },
  {
    slide: 10,
    id: "insight-10",
    nav: "10",
    tone: "insight",
    kind: "AI 使用心得",
    title: "故事板模板：批量生成更稳定",
    lead: "简单视频先拆成可复用的故事板结构，让人物、动线、分镜、剧情和风格在同一套模板中被反复校准。",
    visual: "assets/visuals/insight-10-transparent.png",
    visualAlt: "角色、场景、故事板和镜头规划案例",
    lines: [
      "剧情内容",
      "人物主体",
      "场景 / 动线",
      "分镜数量",
      "风格情绪",
    ],
  },
  {
    slide: 11,
    id: "insight-11",
    nav: "11",
    tone: "insight",
    kind: "AI 使用心得",
    title: "资产建立：角色和场景先稳住",
    titleLines: ["资产建立：", "角色和场景先稳住"],
    lead: "把人物三视图、表情变化、皮肤质感和空间机位先固化，再进入后续的镜头生成。",
    visual: "assets/visuals/insight-11-transparent.png",
    visualAlt: "角色三视图、表情资产和演唱形象组合",
    assetGuide: {
      person: {
        label: "人物",
        intro: [
          "根据角色风格设定人物三视图、多角度图或表情变化图",
          "外貌身形、五官、服装（颜色、材质、外形）、妆容，甚至是性格",
        ],
        vitalityLabel: "人物生动化",
        vitality: [
          ["眼神光", "眼睛里有聚焦的光、可爱的眼神光、调皮的微光等"],
          ["情绪流动", "不仅有单纯的情绪，还要有表情描述：嘴角微微上扬、细微的肌肉拉扯、微皱的眉头、眼睛笑成月牙弯状等"],
          ["皮肤质感（真人）", "不要过度磨皮，保留皮肤微纹理，甚至可以有血丝、轻微瑕疵；皮肤可以加入自然、透着血色的光"],
        ],
      },
      scene: {
        label: "场景",
        intro: "尽量保持场景一致性",
        methods: [
          ["场景俯视图 + 9 宫格场景图（同空间不同机位）", "俯视图适合控制空间关系、灵活走位，九宫格帮助补镜头换角度"],
          ["720 度全景图", "画布上使用全景图功能，直接生成场景全景（细节可能存在问题）"],
          ["360 度环绕视频截图", "先生成 360 度环绕视频，然后截取需要的角度"],
          ["用 Image2.0 生成其他角度", "保持人物或主体动作位置不变，移动调整镜头角度位置"],
        ],
      },
    },
  },
  {
    slide: 12,
    id: "insight-12",
    nav: "12",
    tone: "insight",
    kind: "AI 使用心得",
    title: "提示词：把镜头语言写进去",
    titleLines: ["提示词：", "把镜头语言写进去"],
    lead: "视频提示词不只写内容，还要补上构图、光线、景别、角度和相机参数，让画面有可控的导演意图。",
    visual: "assets/visuals/insight-12-character.png",
    visualAlt: "持枪的幻想角色与四张镜头画面组成的动态视觉",
    bounceCards: [
      "assets/visuals/insight-12-card-1.png",
      "assets/visuals/insight-12-card-2.png",
      "assets/visuals/insight-12-card-3.png",
      "assets/visuals/insight-12-card-4.png",
    ],
    promptGuide: {
      composition: {
        label: "构图",
        items: [
          ["中心构图", "突出人物情绪"],
          ["对称构图", "更有秩序感"],
          ["前景构图", "以主体或环境元素作为前景遮挡"],
          ["三分线构图", "常用构图更自然，突出环境和人物关系"],
          ["对角线构图", "更适合运动、冲突的画面"],
        ],
      },
      lighting: {
        label: "光线",
        items: [
          ["平光", "基础打光（主体前方）"],
          ["侧光", "半明半暗，适合反派悬疑（水平方向）"],
          ["逆光", "故事感、氛围感（主体背后）"],
          ["底光", "恐怖感（主体正下方）"],
          ["轮廓光", "仅看见主体边缘，孤独感（主体侧后方）"],
          ["丁达尔光", "上帝光；侧后光与逆光组合，呈放射状"],
        ],
      },
      parameters: [
        ["景别", "特写、近景、中景、全景、远景……"],
        ["角度", "平视、俯视、仰视、广角、环绕、变焦……"],
        ["相机参数", "相机型号、焦段、光圈、镜头种类、景深……"],
      ],
    },
  },
  {
    slide: 13,
    id: "insight-13",
    nav: "13",
    tone: "insight",
    kind: "AI 使用心得",
    title: "不懂专业词：让模型补齐表达",
    titleLines: ["不懂专业词：", "让模型补齐表达"],
    lead: "当镜头、灯光、构图术语不够时，可以让 Gemini 或 Codex 学习 skill 后生成提示词，再人工筛选和校正。",
    visual: "assets/visuals/insight-13-transparent.png",
    visualAlt: "分镜脚本提示词、Codex Skill 与视频提示词生成案例",
    zoomableVisual: true,
    model: "Gemini 3.1 PRO / Codex skill",
    lines: ["Gemini 3.1 PRO 生成提示词", "Codex 学习 Skill 后输出，效果仍需改进"],
  },
];

const demoCases = [
  {
    slide: 14,
    id: "case-14",
    title: "导演台 3D：锁定人物位置和动作",
    lead: "新出的导演台 3D 功能可以辅助锁定单人或多人位置，把动作关系先固定，再交给 Image2 继续扩展。",
    model: "IMAGE 2.0",
    lines: [],
    modalVisual: "assets/visuals/case-14-transparent.png",
    modalVisualAlt: "导演台 3D 人物机位、角色资产与生成画面案例",
  },
  {
    slide: 15,
    id: "case-15",
    title: "Banner 直出：素材 + 文案 + 提示词",
    lead: "基于 Image2，常规尺寸 Banner 可以批量直出，节省广告创意和视觉变体的制作时间。",
    model: "IMAGE 2.0",
    lines: [],
    modalVisual: "assets/visuals/case-15-transparent.png",
    modalVisualAlt: "Banner 素材、广告创意与世界杯音乐页面生成案例",
  },
  {
    slide: 16,
    id: "case-16",
    title: "创意 + 设定 + 静态分镜 + 后期",
    lead: "去年下半年阶段的 AI 视频链路，依赖大量静态分镜图与后期组合，适合观察早期工作流的成本。",
    model: "海螺 + 即梦 + 可灵 + 本地部署",
    lines: ["创意 + 设定 + 大量静态分镜图 + 后期（基于去年下半年的 AI）"],
    modalVisual: "assets/visuals/case-16-transparent.png",
    modalVisualAlt: "毛毡角色在肠道场景中的静态分镜组合",
    videos: [{ file: "media2.mp4", title: "静态分镜后期成片" }],
  },
  {
    slide: 17,
    id: "case-17",
    title: "年初 AI：生视频全靠静态分镜",
    lead: "年初时的 AI，故事板方法还没出现，生视频全靠出静态分镜，画面连贯性差。",
    model: "Nano banana pro + 可灵Omini",
    lines: [],
    modalVisual: "assets/visuals/case-17-transparent.png",
    modalVisualAlt: "早期 AI 静态分镜与镜头节点工作流",
    videos: [{ file: "media3.mp4", title: "早期静态分镜案例" }],
  },
  {
    slide: 18,
    id: "case-18",
    title: "动作分镜：让人物动作更流畅",
    lead: "动作分镜能减少人物运动的歧义，让 AI 更容易处理连续动作。",
    model: "Image 2.0 + Seednce 2.0",
    lines: [],
    modalVisual: "assets/visuals/case-18-transparent.png",
    modalVisualAlt: "角色资产、动作故事板与视频生成链路",
    videos: [{ file: "media4.mp4", title: "动作分镜生成视频" }],
  },
  {
    slide: 19,
    id: "case-19",
    title: "爆款倒推：脚本、人物资产和故事板",
    lead: "从爆款视频倒推脚本，设定人物资产，再套用故事板通用提示词和自定义画面生成连续视频。",
    model: "Gemini 3.1 Pro + Nano Banana 2 Pro + Image 2.0 + Seednce 2.0",
    lines: [
      "根据爆款视频倒推脚本",
      "设定人物资产",
      "套用故事板通用提示词 + 自定义画面内容生成故事板图片",
    ],
    modalVisual: "assets/visuals/case-19-transparent.png",
    modalVisualAlt: "护肤视频倒推脚本、人物资产与故事板工作流",
    videos: [{ file: "media5.mp4", title: "故事板链路案例" }],
  },
  {
    slide: 20,
    id: "case-20",
    title: "镜头移动：故事板和动线箭头",
    lead: "通过故事板、动线箭头和更详细的提示词，引导镜头移动并减少随机性。",
    model: "Image 2.0 + Seednce 2.0 + Omini",
    lines: ["故事板镜头移动引导线的作用", "有故事板 + 动线箭头 + 较详细提示词的镜头移动"],
    modalVisual: "assets/visuals/case-20-primary.jpg",
    modalVisualAlt: "邮轮一镜到底 FPV 路径、分镜与镜头参数规划",
    betweenVideoVisual: "assets/visuals/case-20-between-videos.jpg",
    betweenVideoVisualAlt: "跑酷角色、场景故事板与镜头运动流程规划",
    videos: [
      { file: "media6.mp4", title: "镜头移动案例 A" },
      { file: "media7.mp4", title: "镜头移动案例 B" },
    ],
  },
  {
    slide: 21,
    slides: [21, 22],
    modalSlides: [21],
    id: "case-21",
    title: "多工具链路：从歌曲、故事板到完整视频",
    lead: "把想法拆到 Gemini、SUNO、Image 2.0 和 Seednce，完成曲风歌词、歌曲、人物资产、分镜、场景生成与最终成片。",
    model: "Gemini + SUNO + Image 2.0 + Seednce 2.0",
    modalVisual: "assets/visuals/case-21-transparent.png",
    modalVisualAlt: "歌曲、人物资产、故事板与完整视频生成工作流",
    lines: [
      "Gemini 输出曲风和歌词",
      "SUNO 生成歌曲",
      "建立人物资产、分镜与故事板",
      "建立场景并生成单个画面",
      "将一系列 AI 产物组合为完整视频",
    ],
    videos: [{ file: "media8.mp4", title: "音乐视频完整案例" }],
  },
  {
    slide: 23,
    id: "case-23",
    title: "游戏界面提示词：设定后的 UI 生成",
    lead: "有自己的设定和通用游戏界面提示词后，可以得到更完整的游戏界面视觉 Demo。",
    model: "MiniMax + Image 2.0 + Seednce 2.0",
    lines: [],
    modalVisual: "assets/visuals/case-23-primary.jpg",
    modalVisualAlt: "游戏角色、武器资产与界面生成节点工作流",
    videos: [{ file: "media9.mp4", title: "游戏 UI 生成视频" }],
  },
];

const finalSections = [
  {
    slide: 24,
    id: "future-24",
    nav: "24",
    tone: "future",
    kind: "后续验证",
    title: "进一步验证：分层、PSD 与自动成片",
    titleLines: ["进一步验证：", "分层、PSD 与自动成片"],
    lead: "下一阶段要验证的是 AI 图像分层、PSD 可编辑性、Photoshop 连接和自动成片能力。",
    model: "LOVART / Codex / GPT + Photoshop",
    visual: "assets/visuals/future-24-transparent.png",
    visualAlt: "AI 图像分层、PSD 和 Photoshop 连接验证流程",
    visualMode: "transparent",
    zoomableVisual: true,
    lines: [
      "在 LOVART 画布中分层并导出 PSD",
      "用 CODEX 分成透明底模并导出，仅能分出透明底图片并导出 PSD，特效文字不可编辑",
      "GPT 连接 photoshop 应用拆分图片内容，分层精细度不够",
      "如何运用 AI 让其自动成片",
    ],
  },
  {
    slide: 25,
    id: "summary-25",
    nav: "25",
    tone: "future",
    kind: "最后总结",
    layout: "summary-switcher",
    switcher: [
      {
        label: "生态共生",
        text: "多模态工具矩阵 + 无限画布打通",
        titleImage: "assets/visuals/summary/t1.png",
        visual: "assets/visuals/summary/25-1.png",
      },
      {
        label: "工业量产",
        text: "工作流及后续 AI 带来的智能量产",
        titleImage: "assets/visuals/summary/t2.png",
        visual: "assets/visuals/summary/25-2.png",
      },
      {
        label: "意识觉醒",
        text: "“前置主观意图”控制后续系列生成",
        titleImage: "assets/visuals/summary/t3.png",
        visual: "assets/visuals/summary/25-3.png",
      },
    ],
  },
];

const storyRoot = document.querySelector("#storyRoot");
const sectionRail = document.querySelector("#sectionRail");
const pageProgress = document.querySelector("#pageProgress");

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const leadingPunctuation = /^[，。、；：！？）】》〉」』”’％%…]+$/;
const punctuationJoinerPattern = /([，。、；：！？）】》〉」』”’％%…])/g;

function bindLeadingPunctuation(value) {
  return String(value).replace(punctuationJoinerPattern, "\u2060$1");
}

function visibleText(value) {
  return escapeHtml(bindLeadingPunctuation(value));
}

function slideImage(slide) {
  return `assets/slides/slide-${String(slide).padStart(2, "0")}.webp`;
}

function linesMarkup(lines = []) {
  return lines.map((line, index) => `<li style="--i:${index}">${visibleText(line)}</li>`).join("");
}

function summaryMarkup(section) {
  if (!section.summary) return "";
  return `
    <div class="summary-grid">
      ${section.summary
        .map(
          ([title, text]) => `
            <div class="summary-item">
              <strong>${visibleText(title)}</strong>
              <span>${visibleText(text)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function manualLinesMarkup(lines, fallback, className) {
  if (!lines?.length) return visibleText(fallback);
  return lines.map((line) => `<span class="${className}">${visibleText(line)}</span>`).join("");
}

function assetGuideMarkup(guide) {
  if (!guide) return "";
  const { person, scene } = guide;
  return `
    <div class="asset-guide">
      <section class="asset-guide-group asset-guide-person" aria-label="${escapeHtml(person.label)}">
        <div class="asset-guide-topline">
          <span class="asset-guide-label">${visibleText(person.label)}</span>
          <div class="asset-guide-intro">
            ${person.intro.map((line) => `<p>${visibleText(line)}</p>`).join("")}
          </div>
        </div>
        <div class="asset-vitality">
          <span class="asset-guide-label asset-guide-label-outline">${visibleText(person.vitalityLabel)}</span>
          <dl class="asset-vitality-grid">
            ${person.vitality
              .map(
                ([title, text]) => `
                  <div class="asset-vitality-item">
                    <dt>${visibleText(title)}</dt>
                    <dd>${visibleText(text)}</dd>
                  </div>
                `,
              )
              .join("")}
          </dl>
        </div>
      </section>
      <section class="asset-guide-group asset-guide-scene" aria-label="${escapeHtml(scene.label)}">
        <div class="asset-guide-topline">
          <span class="asset-guide-label">${visibleText(scene.label)}</span>
          <strong>${visibleText(scene.intro)}</strong>
        </div>
        <div class="asset-scene-methods">
          ${scene.methods
            .map(
              ([title, text]) => `
                <div class="asset-scene-method">
                  <strong class="asset-method-name">${visibleText(title)}</strong>
                  <span class="asset-method-desc">${visibleText(text)}</span>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function promptGuideMarkup(guide) {
  if (!guide) return "";
  const methodGroup = (group, className) => `
    <section class="prompt-guide-group ${className}" aria-label="${escapeHtml(group.label)}">
      <span class="prompt-guide-label">${visibleText(group.label)}</span>
      <div class="prompt-guide-methods">
        ${group.items
          .map(
            ([title, text]) => `
              <div class="prompt-guide-method">
                <strong>${visibleText(title)}</strong>
                <span>${visibleText(text)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;

  return `
    <div class="prompt-guide">
      ${methodGroup(guide.composition, "prompt-guide-composition")}
      ${methodGroup(guide.lighting, "prompt-guide-lighting")}
      <div class="prompt-guide-parameters">
        ${guide.parameters
          .map(
            ([label, text]) => `
              <div class="prompt-guide-row">
                <span class="prompt-guide-label">${visibleText(label)}</span>
                <p>${visibleText(text)}</p>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function sectionVisualMarkup(section) {
  if (section.bounceCards?.length) {
    const cardTransforms = [
      [-198, -8],
      [-68, 4],
      [68, -4],
      [198, 8],
    ];
    return `
      <figure class="prompt-visual" aria-label="${escapeHtml(section.visualAlt)}">
        <div class="prompt-bounce-cards" aria-label="四张动态镜头画面">
          ${section.bounceCards
            .map(
              (src, index) => `
                <div class="prompt-bounce-card prompt-bounce-card-${index}" data-card-index="${index}" data-x="${cardTransforms[index][0]}" data-rotate="${cardTransforms[index][1]}">
                  <div class="prompt-bounce-card-inner">
                    <img src="${src}" alt="镜头画面 ${index + 1}" decoding="async" />
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
        <img class="prompt-character" src="${section.visual}" alt="${escapeHtml(section.visualAlt)}" decoding="async" />
      </figure>
    `;
  }

  const visualClasses = [
    "slide-frame",
    section.visualMode === "reference" ? "slide-frame-reference" : "",
    section.visualMode === "transparent" ? "slide-frame-transparent" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const visualImage = `<img src="${section.visual || slideImage(section.slide)}" alt="${escapeHtml(section.visualAlt || `第 ${section.slide} 页完整画面`)}" loading="${section.visual ? "eager" : "lazy"}" decoding="async" />`;

  return `
    <figure class="${visualClasses}">
      ${
        section.zoomableVisual
          ? `<button class="section-image-zoom" type="button" aria-label="放大查看图片">${visualImage}</button>`
          : visualImage
      }
    </figure>
  `;
}

function sectionMarkup(section) {
  if (section.layout === "summary-switcher") {
    return `
      <section class="story-section summary-switcher-section" id="${section.id}" data-nav="${section.nav}" data-tone="${section.tone}">
        <div class="summary-switcher-copy reveal">
          <div class="page-kind">${String(section.slide).padStart(2, "0")} / ${visibleText(section.kind)}</div>
          <div class="summary-title-stage" aria-live="polite">
            ${section.switcher
              .map(
                (item, index) => `
                  <img
                    class="summary-title-image ${index === 0 ? "is-active" : ""}"
                    src="${item.titleImage}"
                    alt="${escapeHtml(`${item.label}：${item.text}`)}"
                    data-summary-title="${index}"
                    decoding="async"
                  />
                `,
              )
              .join("")}
          </div>
          <div class="summary-switcher-controls" role="tablist" aria-label="最后总结切换">
            ${section.switcher
              .map(
                (item, index) => `
                  <button
                    class="summary-switcher-tab ${index === 0 ? "is-active" : ""}"
                    type="button"
                    role="tab"
                    aria-selected="${index === 0 ? "true" : "false"}"
                    data-summary-index="${index}"
                  >
                    <strong>${visibleText(item.label)}</strong>
                  </button>
                `,
              )
              .join("")}
          </div>
        </div>
        <div class="summary-switcher-visual reveal">
          <div class="summary-visual-stage">
            ${section.switcher
              .map(
                (item, index) => `
                  ${
                    index === 1
                      ? `<button class="summary-visual-zoom summary-visual-image ${index === 0 ? "is-active" : ""}" type="button" data-summary-visual="${index}" aria-label="放大查看${escapeHtml(item.label)}示意图">
                          <img src="${item.visual}" alt="${escapeHtml(`${item.label}示意图`)}" decoding="async" />
                        </button>`
                      : `<img
                          class="summary-visual-image ${index === 0 ? "is-active" : ""}"
                          src="${item.visual}"
                          alt="${escapeHtml(`${item.label}示意图`)}"
                          data-summary-visual="${index}"
                          decoding="async"
                        />`
                  }
                `,
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  if (section.layout === "centered-statement") {
    return `
      <section class="story-section story-section-centered story-section-statement" id="${section.id}" data-nav="${section.nav}" data-tone="${section.tone}">
        <div class="section-copy reveal">
          <span class="statement-check" aria-hidden="true">✓</span>
          <h2>${manualLinesMarkup(section.titleLines, section.title, "manual-title-line")}</h2>
        </div>
      </section>
    `;
  }

  if (section.layout === "centered-feature") {
    return `
      <section class="story-section story-section-centered" id="${section.id}" data-nav="${section.nav}" data-tone="${section.tone}">
        <div class="section-copy reveal">
          <div class="page-kind">${visibleText(section.kicker || section.kind)}</div>
          <h2>${manualLinesMarkup(section.titleLines, section.title, "manual-title-line")}</h2>
          <div class="centered-feature-modules" role="group" aria-label="${escapeHtml(section.visualAlt)}">
            ${[1, 2, 3]
              .map(
                (panel) => `
                  <figure class="centered-feature-module" data-panel="${panel}">
                    <img src="${section.visual}" alt="${panel === 1 ? escapeHtml(section.visualAlt) : ""}" ${panel === 1 ? "" : 'aria-hidden="true"'} decoding="async" />
                  </figure>
                `,
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="story-section ${section.visualMode === "reference" ? "story-section-tilt-safe" : ""}" id="${section.id}" data-nav="${section.nav}" data-tone="${section.tone}">
      <div class="section-copy reveal">
        <div class="page-kind">${String(section.slide).padStart(2, "0")} / ${visibleText(section.kind)}</div>
        <h2>${manualLinesMarkup(section.titleLines, section.title, "manual-title-line")}</h2>
        <p class="lead">${manualLinesMarkup(section.leadLines, section.lead, "manual-lead-line")}</p>
        ${assetGuideMarkup(section.assetGuide)}
        ${promptGuideMarkup(section.promptGuide)}
        ${section.model ? `<div class="model-chip">${visibleText(section.model)}</div>` : ""}
        ${section.lines?.length ? `<ul class="content-lines">${linesMarkup(section.lines)}</ul>` : ""}
        ${summaryMarkup(section)}
      </div>
      <div class="section-visual reveal ${section.visualMode === "reference" ? "section-visual-reference" : ""}">
        ${sectionVisualMarkup(section)}
      </div>
    </section>
  `;
}

function demoCarouselMarkup() {
  return `
    <section class="demo-carousel-section" id="demo-carousel" data-nav="DEMO" data-tone="demo">
      <div class="demo-head reveal">
        <div>
          <div class="page-kind">14-23 / 案例 DEMO</div>
          <h2>案例&DEMO</h2>
        </div>
        <div class="carousel-controls" aria-label="案例轮播控制">
          <button type="button" data-carousel-prev aria-label="上一组案例">←</button>
          <button type="button" data-carousel-next aria-label="下一组案例">→</button>
        </div>
      </div>
      <div class="case-track reveal" id="caseTrack">
        ${demoCases
          .map(
            (item, index) => `
              <button class="case-card" type="button" data-case-id="${item.id}" id="${item.id}">
                <span class="case-card-media">
                  <img src="assets/visuals/demo/d${index + 1}.jpg" alt="${escapeHtml(item.title)} 预览图" loading="lazy" decoding="async" />
                  <span class="case-play">${item.videos?.length ? "PLAY" : "VIEW"}</span>
                </span>
                <span class="case-card-info">
                  <strong>${visibleText(item.title)}</strong>
                  <span>${visibleText(item.model)}</span>
                </span>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

storyRoot.innerHTML = [...storySections.map(sectionMarkup), demoCarouselMarkup(), ...finalSections.map(sectionMarkup)].join("");

function segmentText(text) {
  const segments = "Segmenter" in Intl
    ? (() => {
    const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
        return [...segmenter.segment(text)].map((item) => item.segment);
      })()
    : Array.from(text);

  return segments.reduce((result, segment) => {
    if (leadingPunctuation.test(segment) && result.length) {
      result[result.length - 1] += segment;
    } else {
      result.push(segment);
    }
    return result;
  }, []);
}

const splitTitleSelector = ".hero-title-line, .section-copy h2, .demo-head h2, .case-modal-copy h2, .summary-item strong";

function prepareSplitTitleText(root = document) {
  const targets = root.querySelectorAll(splitTitleSelector);
  targets.forEach((target) => {
    if (target.dataset.splitReady === "true") return;
    const manualLines = [...target.children]
      .filter((child) => child.classList.contains("manual-title-line"))
      .map((line) => line.textContent || "");
    const textLines = manualLines.length ? manualLines : [target.textContent || ""];
    if (!textLines.some((line) => line.trim())) return;
    target.dataset.splitReady = "true";
    target.classList.add("split-title");
    target.setAttribute("aria-label", textLines.join(" ").replaceAll("\u2060", ""));
    target.textContent = "";
    textLines.forEach((line) => {
      const lineElement = document.createElement("span");
      if (manualLines.length) lineElement.className = "split-title-manual-line";
      segmentText(line).forEach((segment) => {
        const piece = document.createElement("span");
        piece.setAttribute("aria-hidden", "true");
        if (segment === " ") {
          piece.className = "split-title-space";
          piece.textContent = "\u00a0";
        } else {
          piece.className = "split-title-word";
          piece.textContent = segment;
        }
        lineElement.appendChild(piece);
      });
      target.appendChild(lineElement);
    });
  });
}

function assignSplitTitleLines(root = document) {
  root.querySelectorAll(".split-title").forEach((target) => {
    const words = [...target.querySelectorAll(".split-title-word")];
    const lineMap = new Map();
    words.forEach((word) => {
      const top = Math.round(word.offsetTop);
      if (!lineMap.has(top)) lineMap.set(top, lineMap.size);
      word.style.setProperty("--line-i", lineMap.get(top));
    });
  });
}

function prepareBlurText(root = document) {
  const targets = root.querySelectorAll(".hero-subtitle, .section-copy .lead, .demo-head .lead");
  targets.forEach((target) => {
    if (target.dataset.blurReady === "true") return;
    const manualLines = [...target.children]
      .filter((child) => child.classList.contains("manual-lead-line"))
      .map((line) => line.textContent || "");
    const textLines = manualLines.length ? manualLines : [target.textContent || ""];
    target.dataset.blurReady = "true";
    target.classList.add("blur-text");
    target.setAttribute("aria-label", textLines.join(" ").replaceAll("\u2060", ""));
    target.textContent = "";
    let pieceIndex = 0;
    textLines.forEach((line) => {
      const lineElement = document.createElement("span");
      if (manualLines.length) lineElement.className = "blur-text-manual-line";
      segmentText(line).forEach((segment) => {
        const piece = document.createElement("span");
        piece.className = "blur-text-piece";
        piece.style.setProperty("--i", pieceIndex++);
        piece.setAttribute("aria-hidden", "true");
        piece.textContent = segment === " " ? "\u00a0" : segment;
        lineElement.appendChild(piece);
      });
      target.appendChild(lineElement);
    });
  });
}

prepareSplitTitleText();
prepareBlurText();
requestAnimationFrame(() => assignSplitTitleLines());
document.fonts?.ready.then(() => assignSplitTitleLines());

const heroVideoCard = document.querySelector("#heroVideoCard");
const heroVideo = document.querySelector("#heroVideo");
const heroPlayButton = document.querySelector("#heroPlayButton");

function playHeroVideo() {
  if (!heroVideoCard || !heroVideo) return;
  heroVideoCard.classList.add("is-playing");
  heroVideo.controls = true;
  heroVideo.focus({ preventScroll: true });
  if (heroPlayButton) heroPlayButton.setAttribute("aria-hidden", "true");
  heroVideo.play().catch(() => {
    heroVideoCard.classList.remove("is-playing");
    if (heroPlayButton) heroPlayButton.removeAttribute("aria-hidden");
  });
}

heroPlayButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  playHeroVideo();
});

heroVideo?.addEventListener("pause", () => {
  if (!heroVideoCard || heroVideo.ended) return;
  heroVideoCard.classList.remove("is-playing");
  heroPlayButton?.removeAttribute("aria-hidden");
});

heroVideo?.addEventListener("ended", () => {
  heroVideoCard?.classList.remove("is-playing");
  heroPlayButton?.removeAttribute("aria-hidden");
});

const navTargets = [
  { id: "top", label: "TOP" },
  ...storySections.map((section) => ({ id: section.id, label: section.nav })),
  { id: "demo-carousel", label: "DEMO" },
  ...finalSections.map((section) => ({ id: section.id, label: section.nav })),
];

const railDenominator = Math.max(1, navTargets.length - 1);
sectionRail.innerHTML = `
  <div class="rail-liquid" aria-hidden="true">
    <span class="rail-liquid-fill"></span>
  </div>
  ${navTargets
    .map(
      (item, index) => `
        <a
          class="rail-item"
          href="#${item.id}"
          data-target="${item.id}"
          data-label="${item.label}"
          style="--rail-pos:${(index / railDenominator).toFixed(4)}"
          aria-label="跳转到 ${item.label}"
        >
          <span class="rail-dot"></span>
          <span class="rail-label">${item.label}</span>
        </a>
      `,
    )
    .join("")}
`;

const allSections = [...document.querySelectorAll("[data-nav]")];
const railItems = [...document.querySelectorAll(".rail-item")];

function scrollToSectionTarget(target, behavior = "smooth") {
  if (!target) return;
  const headerOffset = window.innerWidth <= 980 ? 78 : 90;
  const scrollToTarget = (scrollBehavior) => {
    window.scrollTo({
      top: Math.max(0, target.offsetTop - headerOffset),
      behavior: scrollBehavior,
    });
    setActiveSection(target.id);
    requestScrollUpdate();
  };

  scrollToTarget(behavior);
  window.setTimeout(() => scrollToTarget("auto"), 180);
  window.setTimeout(() => scrollToTarget("auto"), 620);
}

function setActiveSection(id) {
  railItems.forEach((item) => item.classList.toggle("is-active", item.dataset.target === id));
  const activeIndex = Math.max(0, navTargets.findIndex((item) => item.id === id));
  const activeItem = navTargets[activeIndex] || navTargets[0];
  sectionRail.style.setProperty("--rail-active", (activeIndex / railDenominator).toFixed(4));
  sectionRail.dataset.current = activeItem.label;
}

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        setActiveSection(entry.target.id);
      }
    });
  },
  { rootMargin: "-38% 0px -42% 0px", threshold: 0 },
);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      assignSplitTitleLines(entry.target);
      revealObserver.unobserve(entry.target);
    });
  },
  { rootMargin: "0px 0px -12% 0px", threshold: 0.04 },
);

allSections.forEach((section) => {
  sectionObserver.observe(section);
  revealObserver.observe(section);
});
document.querySelector(".hero-section").classList.add("is-visible");
setActiveSection("top");

const heroBackgroundVideo = document.querySelector(".hero-background-video");
if (heroBackgroundVideo) {
  const heroVideoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          heroBackgroundVideo.play().catch(() => {});
        } else {
          heroBackgroundVideo.pause();
        }
      });
    },
    { threshold: 0.08 },
  );
  heroVideoObserver.observe(document.querySelector(".hero-section"));
}

const initialHashTarget = window.location.hash
  ? document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
  : null;
if (initialHashTarget) {
  const restoreInitialHash = () => {
    scrollToSectionTarget(initialHashTarget, "auto");
  };
  requestAnimationFrame(restoreInitialHash);
  window.setTimeout(restoreInitialHash, 120);
  window.addEventListener("load", () => window.setTimeout(restoreInitialHash, 80), { once: true });
  window.setTimeout(restoreInitialHash, 650);
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = decodeURIComponent(link.getAttribute("href").slice(1));
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    history.pushState(null, "", `#${id}`);
    scrollToSectionTarget(target);
  });
});

let ticking = false;
let currentScrollProgress = 0;
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateScrollState() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = clamp(scrollTop / maxScroll, 0, 1);
  currentScrollProgress = progress;
  document.documentElement.style.setProperty("--page-progress", progress.toFixed(4));
  document.documentElement.style.setProperty("--page-progress-pct", `${(progress * 100).toFixed(3)}%`);
  pageProgress.style.transform = `scaleX(${progress})`;

  const center = window.innerHeight * 0.52;
  allSections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height * 0.5 - center);
    const local = clamp(1 - distance / (window.innerHeight * 0.86), 0, 1);
    section.style.setProperty("--local", local.toFixed(3));
  });

  ticking = false;
}

function requestScrollUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(updateScrollState);
}

window.addEventListener("scroll", requestScrollUpdate, { passive: true });
window.addEventListener("resize", () => {
  requestScrollUpdate();
  requestAnimationFrame(() => assignSplitTitleLines());
});
requestScrollUpdate();

const caseTrack = document.querySelector("#caseTrack");
const caseCarouselSection = document.querySelector("#demo-carousel");
let caseAutoFrame = 0;
let caseAutoLastTime = 0;
let caseAutoPaused = false;

function carouselStepDistance() {
  const firstCard = caseTrack.querySelector(".case-card");
  if (!firstCard) return Math.min(window.innerWidth * 0.82, 960);
  const trackStyle = getComputedStyle(caseTrack);
  const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
  return firstCard.getBoundingClientRect().width + gap;
}

function setCaseAutoPaused(paused) {
  caseAutoPaused = paused;
  if (!paused) caseAutoLastTime = 0;
}

function isCaseCarouselInView() {
  if (!caseCarouselSection) return false;
  const rect = caseCarouselSection.getBoundingClientRect();
  return rect.bottom > window.innerHeight * 0.15 && rect.top < window.innerHeight * 0.85;
}

function runCaseAutoScroll(now) {
  if (!caseAutoFrame) return;
  const modalOpen = caseModal?.getAttribute("aria-hidden") === "false";
  const sectionVisible = isCaseCarouselInView();
  const canScroll = caseTrack.scrollWidth > caseTrack.clientWidth + 4;

  if (!prefersReducedMotion && !caseAutoPaused && !modalOpen && sectionVisible && canScroll) {
    if (!caseAutoLastTime) caseAutoLastTime = now;
    const delta = Math.min(48, now - caseAutoLastTime);
    caseTrack.scrollLeft += delta * 0.05;
    if (caseTrack.scrollLeft >= caseTrack.scrollWidth - caseTrack.clientWidth - 2) {
      caseTrack.scrollTo({ left: 0, behavior: "auto" });
    }
  } else {
    caseAutoLastTime = now;
  }

  caseAutoLastTime = now;
  caseAutoFrame = requestAnimationFrame(runCaseAutoScroll);
}

document.querySelector("[data-carousel-prev]").addEventListener("click", () => {
  caseTrack.scrollBy({ left: -carouselStepDistance(), behavior: "smooth" });
  setCaseAutoPaused(true);
  window.setTimeout(() => setCaseAutoPaused(false), 2600);
});
document.querySelector("[data-carousel-next]").addEventListener("click", () => {
  caseTrack.scrollBy({ left: carouselStepDistance(), behavior: "smooth" });
  setCaseAutoPaused(true);
  window.setTimeout(() => setCaseAutoPaused(false), 2600);
});

caseTrack.addEventListener("focusin", () => setCaseAutoPaused(true));
caseTrack.addEventListener("focusout", () => setCaseAutoPaused(false));
caseAutoFrame = requestAnimationFrame(runCaseAutoScroll);

const caseModal = document.querySelector("#caseModal");
const caseModalKind = document.querySelector("#caseModalKind");
const caseModalTitle = document.querySelector("#caseModalTitle");
const caseModalLead = document.querySelector("#caseModalLead");
const caseModalModel = document.querySelector("#caseModalModel");
const caseModalLines = document.querySelector("#caseModalLines");
const caseModalMedia = document.querySelector("#caseModalMedia");
const imageLightbox = document.querySelector("#imageLightbox");
const imageLightboxImage = document.querySelector("#imageLightboxImage");
const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function setVideoOrientation(video) {
  const isPortrait = video.videoHeight > video.videoWidth;
  video.dataset.orientation = isPortrait ? "portrait" : "landscape";
}

function openCaseModal(caseItem) {
  const caseSlides = caseItem.slides || [caseItem.slide];
  const modalSlides = caseItem.modalSlides || caseSlides;
  const slideLabel = caseSlides.length > 1
    ? `${String(caseSlides[0]).padStart(2, "0")}-${String(caseSlides.at(-1)).padStart(2, "0")}`
    : String(caseItem.slide).padStart(2, "0");
  caseModalKind.textContent = `${slideLabel} / 案例 DEMO`;
  caseModalTitle.removeAttribute("data-split-ready");
  caseModalTitle.classList.remove("split-title");
  caseModalTitle.textContent = bindLeadingPunctuation(caseItem.title);
  caseModalLead.textContent = bindLeadingPunctuation(caseItem.lead);
  caseModalModel.textContent = bindLeadingPunctuation(caseItem.model || "");
  caseModalLines.innerHTML = linesMarkup(caseItem.lines || []);
  caseModalLines.hidden = !caseItem.lines?.length;
  const videoList = caseItem.videos || [];
  caseModalMedia.innerHTML = `
    ${modalSlides
      .map(
        (slide) => `
          <figure class="modal-slide-frame ${caseItem.modalVisual ? "modal-slide-frame-transparent" : ""}">
            <button class="modal-image-zoom" type="button" aria-label="放大查看图片">
              <img src="${caseItem.modalVisual || slideImage(slide)}" alt="${escapeHtml(caseItem.modalVisualAlt || `第 ${slide} 页完整画面`)}" />
            </button>
          </figure>
        `,
      )
      .join("")}
    ${videoList
      .map(
        (video, index) => `
          <div class="detail-video-block">
            <div class="video-meta">
              <div>
                <div class="video-index">VIDEO ${String(index + 1).padStart(2, "0")}</div>
                <div class="video-title">${escapeHtml(video.title)}</div>
              </div>
              <div class="video-model">${visibleText(caseItem.model || "")}</div>
            </div>
            <video class="detail-video" controls playsinline preload="metadata" ${useRemoteVideoFiles ? 'crossorigin="anonymous"' : ""} src="${escapeHtml(resolveVideoSrc(video.file))}"></video>
          </div>
          ${caseItem.betweenVideoVisual && index === 0 ? `
            <figure class="modal-slide-frame modal-slide-frame-transparent modal-between-videos">
              <button class="modal-image-zoom" type="button" aria-label="放大查看图片">
                <img src="${caseItem.betweenVideoVisual}" alt="${escapeHtml(caseItem.betweenVideoVisualAlt || "视频间补充案例图")}" />
              </button>
            </figure>
          ` : ""}
        `,
      )
      .join("")}
  `;
  caseModalMedia.querySelectorAll("video").forEach((video) => {
    video.addEventListener("loadedmetadata", () => setVideoOrientation(video), { once: true });
  });
  caseModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  prepareSplitTitleText(caseModal);
  requestAnimationFrame(() => assignSplitTitleLines(caseModal));
}

function openImageLightbox(image) {
  if (!imageLightbox || !imageLightboxImage || !image) return;
  imageLightboxImage.src = image.currentSrc || image.src;
  imageLightboxImage.alt = image.alt || "案例图片";
  imageLightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeImageLightbox() {
  if (!imageLightbox || !imageLightboxImage) return;
  imageLightbox.setAttribute("aria-hidden", "true");
  imageLightboxImage.src = transparentPixel;
  imageLightboxImage.alt = "";
  if (caseModal?.getAttribute("aria-hidden") !== "false") {
    document.body.classList.remove("modal-open");
  }
}

function closeCaseModal() {
  closeImageLightbox();
  caseModal.querySelectorAll("video").forEach((video) => video.pause());
  caseModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  caseModalMedia.innerHTML = "";
}

caseModalMedia.addEventListener("click", (event) => {
  const zoomButton = event.target.closest(".modal-image-zoom");
  if (!zoomButton) return;
  const image = zoomButton.querySelector("img");
  openImageLightbox(image);
});

document.addEventListener("click", (event) => {
  const zoomButton = event.target.closest(".section-image-zoom");
  if (!zoomButton) return;
  const image = zoomButton.querySelector("img");
  openImageLightbox(image);
});

document.querySelectorAll("[data-close-lightbox]").forEach((button) => {
  button.addEventListener("click", closeImageLightbox);
});

document.querySelectorAll(".case-card").forEach((card) => {
  card.addEventListener("pointerenter", () => setCaseAutoPaused(true));
  card.addEventListener("pointerleave", () => setCaseAutoPaused(false));
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  });
  card.addEventListener("click", () => {
    const caseItem = demoCases.find((item) => item.id === card.dataset.caseId);
    if (caseItem) openCaseModal(caseItem);
  });
});

document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeCaseModal));
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (imageLightbox?.getAttribute("aria-hidden") === "false") {
    closeImageLightbox();
    return;
  }
  if (caseModal.getAttribute("aria-hidden") === "false") closeCaseModal();
});

const canvas = document.querySelector("#fieldCanvas");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initPromptBounceCards() {
  document.querySelectorAll(".prompt-bounce-cards").forEach((container) => {
    const cards = [...container.querySelectorAll(".prompt-bounce-card")];
    const setTransform = (card, extraX = 0, flatten = false) => {
      const x = Number(card.dataset.x) + extraX;
      const rotation = flatten ? 0 : Number(card.dataset.rotate);
      card.style.transform = `translate(calc(-50% + ${x}px), -50%) rotate(${rotation}deg)`;
    };

    cards.forEach((card, hoveredIndex) => {
      setTransform(card);
      card.addEventListener("pointerenter", () => {
        if (prefersReducedMotion) return;
        cards.forEach((item, index) => {
          const direction = index < hoveredIndex ? -1 : 1;
          setTransform(item, index === hoveredIndex ? 0 : direction * 82, index === hoveredIndex);
          item.classList.toggle("is-active", index === hoveredIndex);
        });
      });
    });

    container.addEventListener("pointerleave", () => {
      cards.forEach((card) => {
        setTransform(card);
        card.classList.remove("is-active");
      });
    });
  });
}

initPromptBounceCards();

function initReferenceCardTilt() {
  if (prefersReducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  document.querySelectorAll(".slide-frame-reference, #insight-13 .slide-frame").forEach((frame) => {
    const section = frame.closest(".story-section");
    const stage = Number(section?.id.replace("stage-", ""));
    const isInsight13 = section?.id === "insight-13";
    if (!isInsight13 && (!Number.isFinite(stage) || stage < 2 || stage > 7)) return;

    const rotateAmplitude = 7.5;

    frame.addEventListener("pointerenter", () => {
      frame.classList.add("is-tilting");
      frame.style.setProperty("--tilt-scale", "1.025");
    });

    frame.addEventListener("pointermove", (event) => {
      const rect = frame.getBoundingClientRect();
      const offsetX = (event.clientX - rect.left - rect.width / 2) / Math.max(1, rect.width / 2);
      const offsetY = (event.clientY - rect.top - rect.height / 2) / Math.max(1, rect.height / 2);
      frame.style.setProperty("--tilt-rotate-x", `${(-offsetY * rotateAmplitude).toFixed(2)}deg`);
      frame.style.setProperty("--tilt-rotate-y", `${(offsetX * rotateAmplitude).toFixed(2)}deg`);
    });

    frame.addEventListener("pointerleave", () => {
      frame.classList.remove("is-tilting");
      frame.style.setProperty("--tilt-rotate-x", "0deg");
      frame.style.setProperty("--tilt-rotate-y", "0deg");
      frame.style.setProperty("--tilt-scale", "1");
    });
  });
}

initReferenceCardTilt();

function initSummarySwitcher() {
  const section = document.querySelector("#summary-25");
  if (!section) return;
  const visualStage = section.querySelector(".summary-visual-stage");
  const tabs = [...section.querySelectorAll(".summary-switcher-tab")];
  const titleImages = [...section.querySelectorAll(".summary-title-image")];
  const visualImages = [...section.querySelectorAll(".summary-visual-image")];

  const setActive = (activeIndex) => {
    tabs.forEach((tab, index) => {
      const isActive = index === activeIndex;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
    titleImages.forEach((image, index) => image.classList.toggle("is-active", index === activeIndex));
    visualImages.forEach((image, index) => image.classList.toggle("is-active", index === activeIndex));
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const index = Number(tab.dataset.summaryIndex);
      if (Number.isFinite(index)) setActive(index);
    });
  });

  section.querySelector(".summary-visual-zoom")?.addEventListener("click", (event) => {
    const image = event.currentTarget.querySelector("img");
    openImageLightbox(image);
  });

  if (!prefersReducedMotion && visualStage && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const rotateAmplitude = 7.5;
    visualStage.addEventListener("pointerenter", () => {
      visualStage.classList.add("is-tilting");
      visualStage.style.setProperty("--tilt-scale", "1.025");
    });

    visualStage.addEventListener("pointermove", (event) => {
      const rect = visualStage.getBoundingClientRect();
      const offsetX = (event.clientX - rect.left - rect.width / 2) / Math.max(1, rect.width / 2);
      const offsetY = (event.clientY - rect.top - rect.height / 2) / Math.max(1, rect.height / 2);
      visualStage.style.setProperty("--tilt-rotate-x", `${(-offsetY * rotateAmplitude).toFixed(2)}deg`);
      visualStage.style.setProperty("--tilt-rotate-y", `${(offsetX * rotateAmplitude).toFixed(2)}deg`);
    });

    visualStage.addEventListener("pointerleave", () => {
      visualStage.classList.remove("is-tilting");
      visualStage.style.setProperty("--tilt-rotate-x", "0deg");
      visualStage.style.setProperty("--tilt-rotate-y", "0deg");
      visualStage.style.setProperty("--tilt-scale", "1");
    });
  }
}

initSummarySwitcher();

function initFinalPage() {
  const endButton = document.querySelector("#endButton");
  const finalPage = document.querySelector("#finalPage");
  const finalCanvas = document.querySelector("#finalStars");
  const finalTitle = document.querySelector("#finalTitle");
  const finalHomeButton = document.querySelector("#finalHomeButton");
  if (!endButton || !finalPage || !finalCanvas || !finalTitle || !finalHomeButton) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clampFinal = (value, min, max) => Math.min(max, Math.max(min, value));
  let galaxyController = null;

  function prepareFinalTitle() {
    if (finalTitle.dataset.splitReady === "true") return;
    const text = finalTitle.textContent || "Thank You";
    finalTitle.textContent = "";
    finalTitle.dataset.splitReady = "true";
    Array.from(text).forEach((char, index) => {
      const span = document.createElement("span");
      span.style.setProperty("--char-i", index);
      if (char === " ") {
        span.className = "final-title-space";
        span.setAttribute("aria-hidden", "true");
        span.textContent = "\u00a0";
      } else {
        span.className = "final-title-char";
        span.setAttribute("aria-hidden", "true");
        span.textContent = char;
      }
      finalTitle.appendChild(span);
    });
  }

  function resetFinalTitleAnimation() {
    finalTitle.querySelectorAll(".final-title-char").forEach((char) => {
      char.style.animation = "none";
      void char.offsetWidth;
      char.style.animation = "";
    });
  }

  function initGalaxyCanvas() {
    const canvas = finalCanvas;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;
    const stars = [];
    const pointer = { x: 0.5, y: 0.5, active: false };
    const galaxyParams = {
      animationSpeed: 1.2,
      density: 1,
      glowIntensity: 0.3,
      hueShift: 150,
      mouseInteraction: true,
      mouseRepulsion: true,
      repulsionStrength: 0.5,
      rotationSpeed: 0.15,
      saturation: 0.4,
      starSpeed: 0.5,
      twinkleIntensity: 0.3,
    };
    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;
    let running = false;
    let start = performance.now();

    function makeStar(index) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.54);
      return {
        angle,
        radius,
        layer: 0.42 + Math.random() * 1.18,
        size: 0.35 + Math.random() * 1.9,
        spin: (Math.random() - 0.5) * 0.0032,
        twinkle: Math.random() * Math.PI * 2,
        hue: galaxyParams.hueShift + Math.random() * 48,
        seed: index + Math.random() * 100,
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const targetCount = prefersReduced
        ? 120
        : Math.floor(Math.min(680, Math.max(300, (width * height) / (3200 / galaxyParams.density))));
      while (stars.length < targetCount) stars.push(makeStar(stars.length));
      stars.length = targetCount;
    }

    function draw(now) {
      if (!running) return;
      const time = (now - start) * 0.001 * galaxyParams.animationSpeed;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      const focalX = width * 0.5;
      const focalY = height * 0.5;
      const minAxis = Math.min(width, height);
      const pointerX = pointer.x * width;
      const pointerY = pointer.y * height;
      const repulsionRadius = Math.max(170, minAxis * 0.34);

      stars.forEach((star) => {
        const depth = (star.radius + time * (0.038 + galaxyParams.starSpeed * 0.05) * star.layer) % 1;
        const scale = 0.15 + depth * 1.72;
        const orbit = star.angle + time * (galaxyParams.rotationSpeed * 0.24 + star.spin);
        let x = focalX + Math.cos(orbit) * minAxis * depth * 1.04;
        let y = focalY + Math.sin(orbit) * minAxis * depth * 0.72;

        if (galaxyParams.mouseInteraction && galaxyParams.mouseRepulsion && pointer.active) {
          const deltaX = x - pointerX;
          const deltaY = y - pointerY;
          const distance = Math.hypot(deltaX, deltaY) || 1;
          if (distance < repulsionRadius) {
            const falloff = Math.pow(1 - distance / repulsionRadius, 2);
            const push = falloff * galaxyParams.repulsionStrength * 180 * (1.08 - depth * 0.24);
            x += (deltaX / distance) * push;
            y += (deltaY / distance) * push;
          }
        }

        const alpha = Math.max(0, Math.min(1, depth * 1.08));
        const twinkle = 0.7 + Math.sin(time * (2.4 + star.layer * 1.35) + star.twinkle) * galaxyParams.twinkleIntensity;
        const size = star.size * scale * twinkle;
        const glow = size * (4.2 + star.layer * 2.2) * (1 + galaxyParams.glowIntensity);

        const gradient = context.createRadialGradient(x, y, 0, x, y, glow);
        gradient.addColorStop(0, `hsla(${star.hue}, ${galaxyParams.saturation * 100}%, 86%, ${0.9 * alpha})`);
        gradient.addColorStop(0.22, `hsla(${star.hue}, ${galaxyParams.saturation * 100}%, 66%, ${0.22 * alpha})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, glow, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(255, 255, 255, ${0.82 * alpha})`;
        context.beginPath();
        context.arc(x, y, Math.max(0.35, size * 0.36), 0, Math.PI * 2);
        context.fill();
      });

      frame = requestAnimationFrame(draw);
    }

    function startGalaxy() {
      if (running) return;
      running = true;
      start = performance.now();
      frame = requestAnimationFrame(draw);
    }

    function stopGalaxy() {
      running = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    resize();
    window.addEventListener("resize", resize);
    finalPage.addEventListener("pointermove", (event) => {
      pointer.x = clampFinal(event.clientX / Math.max(1, width), 0, 1);
      pointer.y = clampFinal(event.clientY / Math.max(1, height), 0, 1);
      pointer.active = true;
    }, { passive: true });
    finalPage.addEventListener("pointerleave", () => {
      pointer.active = false;
    });

    return { start: startGalaxy, stop: stopGalaxy, resize };
  }

  function openFinalPage() {
    prepareFinalTitle();
    resetFinalTitleAnimation();
    finalPage.setAttribute("aria-hidden", "false");
    finalPage.classList.add("is-active");
    document.body.classList.add("final-active");
    try {
      history.pushState(null, "", "#ending");
    } catch {
      window.location.hash = "ending";
    }
    galaxyController ||= initGalaxyCanvas();
    galaxyController?.resize();
    if (!prefersReduced) galaxyController?.start();
  }

  function goHome() {
    const baseUrl = window.location.href.split("#")[0].split("?")[0];
    window.location.href = `${baseUrl}?home=${Date.now()}`;
  }

  endButton.addEventListener("click", openFinalPage);
  finalHomeButton.addEventListener("click", goHome);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && finalPage.classList.contains("is-active")) {
      goHome();
    }
  });
}

initFinalPage();

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
  }
  return program;
}

function setMat3FromEuler(yawY, pitchX, rollZ, out) {
  const cy = Math.cos(yawY);
  const sy = Math.sin(yawY);
  const cx = Math.cos(pitchX);
  const sx = Math.sin(pitchX);
  const cz = Math.cos(rollZ);
  const sz = Math.sin(rollZ);

  out[0] = cy * cz + sy * sx * sz;
  out[1] = cx * sz;
  out[2] = -sy * cz + cy * sx * sz;
  out[3] = -cy * sz + sy * sx * cz;
  out[4] = cx * cz;
  out[5] = sy * sz + cy * sx * cz;
  out[6] = sy * cx;
  out[7] = -sx;
  out[8] = cy * cx;
  return out;
}

function initPrismBackground() {
  if (!canvas || prefersReducedMotion) return;
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return;

  const vertex = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragment = `
    precision highp float;

    uniform vec2 iResolution;
    uniform float iTime;
    uniform float uHeight;
    uniform float uBaseHalf;
    uniform mat3 uRot;
    uniform int uUseBaseWobble;
    uniform float uGlow;
    uniform vec2 uOffsetPx;
    uniform float uNoise;
    uniform float uSaturation;
    uniform float uHueShift;
    uniform float uColorFreq;
    uniform float uBloom;
    uniform float uCenterShift;
    uniform float uInvBaseHalf;
    uniform float uInvHeight;
    uniform float uMinAxis;
    uniform float uPxScale;
    uniform float uTimeScale;

    vec4 tanh4(vec4 x) {
      vec4 e2x = exp(2.0 * x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float sdOctaAnisoInv(vec3 p) {
      vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
      float m = q.x + q.y + q.z - 1.0;
      return m * uMinAxis * 0.5773502691896258;
    }

    float sdPyramidUpInv(vec3 p) {
      float oct = sdOctaAnisoInv(p);
      float halfSpace = -p.y;
      return max(oct, halfSpace);
    }

    mat3 hueRotation(float a) {
      float c = cos(a), s = sin(a);
      mat3 W = mat3(
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114
      );
      mat3 U = mat3(
         0.701, -0.587, -0.114,
        -0.299,  0.413, -0.114,
        -0.300, -0.588,  0.886
      );
      mat3 V = mat3(
         0.168, -0.331,  0.500,
         0.328,  0.035, -0.500,
        -0.497,  0.296,  0.201
      );
      return W + U * c + V * s;
    }

    void main() {
      vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;
      float z = 5.0;
      float d = 0.0;
      vec3 p;
      vec4 o = vec4(0.0);
      float centerShift = uCenterShift;
      float cf = uColorFreq;

      mat2 wob = mat2(1.0);
      if (uUseBaseWobble == 1) {
        float t = iTime * uTimeScale;
        float c0 = cos(t + 0.0);
        float c1 = cos(t + 33.0);
        float c2 = cos(t + 11.0);
        wob = mat2(c0, c1, c2, c0);
      }

      const int STEPS = 64;
      for (int i = 0; i < STEPS; i++) {
        p = vec3(f, z);
        p.xz = p.xz * wob;
        p = uRot * p;
        vec3 q = p;
        q.y += centerShift;
        d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
        z -= d;
        o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
      }

      o = tanh4(o * o * (uGlow * uBloom) / 1e5);
      vec3 col = o.rgb;
      float n = rand(gl_FragCoord.xy + vec2(iTime));
      col += (n - 0.5) * uNoise;
      col = clamp(col, 0.0, 1.0);

      float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);
      col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);

      float alpha = clamp(max(max(col.r, col.g), col.b) * 1.14, 0.0, 0.88);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  const program = createProgram(gl, vertex, fragment);
  gl.useProgram(program);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = Object.fromEntries(
    [
      "iResolution",
      "iTime",
      "uHeight",
      "uBaseHalf",
      "uRot",
      "uUseBaseWobble",
      "uGlow",
      "uOffsetPx",
      "uNoise",
      "uSaturation",
      "uHueShift",
      "uColorFreq",
      "uBloom",
      "uCenterShift",
      "uInvBaseHalf",
      "uInvHeight",
      "uMinAxis",
      "uPxScale",
      "uTimeScale",
    ].map((name) => [name, gl.getUniformLocation(program, name)]),
  );

  const heightValue = 3.5;
  const baseHalf = 5.5 * 0.5;
  const rot = new Float32Array(9);
  const offset = new Float32Array(2);
  const pointer = { x: 0, y: 0, inside: false };
  let scrollOffsetY = 0;
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let raf = 0;
  let running = true;
  let startTime = performance.now();

  gl.uniform1f(uniforms.uHeight, heightValue);
  gl.uniform1f(uniforms.uBaseHalf, baseHalf);
  gl.uniform1i(uniforms.uUseBaseWobble, 0);
  gl.uniform1f(uniforms.uGlow, 0.76);
  gl.uniform1f(uniforms.uNoise, 0.035);
  gl.uniform1f(uniforms.uSaturation, 1.14);
  gl.uniform1f(uniforms.uColorFreq, 1.08);
  gl.uniform1f(uniforms.uBloom, 0.66);
  gl.uniform1f(uniforms.uCenterShift, heightValue * 0.25);
  gl.uniform1f(uniforms.uInvBaseHalf, 1 / baseHalf);
  gl.uniform1f(uniforms.uInvHeight, 1 / heightValue);
  gl.uniform1f(uniforms.uMinAxis, Math.min(baseHalf, heightValue));
  gl.uniform1f(uniforms.uTimeScale, 0.32);

  function resizePrism() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1);
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    offset[0] = 0;
    scrollOffsetY = -height * 0.02 * dpr;
    offset[1] = scrollOffsetY;
    gl.uniform2f(uniforms.iResolution, canvas.width, canvas.height);
    gl.uniform2fv(uniforms.uOffsetPx, offset);
    gl.uniform1f(uniforms.uPxScale, 1 / ((canvas.height || 1) * 0.1 * 2.62));
  }

  function renderPrism(now) {
    if (!running) return;
    const time = (now - startTime) * 0.001;
    const targetYaw = (pointer.inside ? -pointer.x : 0) * 0.96;
    const targetPitch = (pointer.inside ? pointer.y : 0) * 0.9;
    const dpr = canvas.height / Math.max(1, window.innerHeight);
    const targetScrollOffsetY = (currentScrollProgress - 0.5) * window.innerHeight * 0.16 * dpr - window.innerHeight * 0.02 * dpr;
    yaw += (targetYaw - yaw) * 0.05;
    pitch += (targetPitch - pitch) * 0.05;
    roll += (Math.sin(time * 0.24) * 0.08 - roll) * 0.025;
    scrollOffsetY += (targetScrollOffsetY - scrollOffsetY) * 0.07;
    offset[1] = scrollOffsetY;

    gl.uniform1f(uniforms.iTime, time);
    gl.uniform1f(uniforms.uHueShift, currentScrollProgress * 1.2 + Math.sin(time * 0.06) * 0.08);
    gl.uniform2fv(uniforms.uOffsetPx, offset);
    gl.uniformMatrix3fv(uniforms.uRot, false, setMat3FromEuler(yaw, pitch, roll, rot));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(renderPrism);
  }

  function startPrism() {
    if (raf) return;
    running = true;
    raf = requestAnimationFrame(renderPrism);
  }

  function stopPrism() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  resizePrism();
  startPrism();

  window.addEventListener("resize", resizePrism);
  window.addEventListener("pointermove", (event) => {
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.5;
    pointer.x = clamp((event.clientX - cx) / Math.max(1, cx), -1, 1);
    pointer.y = clamp((event.clientY - cy) / Math.max(1, cy), -1, 1);
    pointer.inside = true;
  }, { passive: true });
  window.addEventListener("mouseleave", () => {
    pointer.inside = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPrism();
    else if (!document.body.classList.contains("modal-open")) startPrism();
  });

  const modalStateObserver = new MutationObserver(() => {
    if (document.hidden) return;
    if (document.body.classList.contains("modal-open")) stopPrism();
    else startPrism();
  });
  modalStateObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

try {
  initPrismBackground();
} catch (error) {
  console.warn("Prism background disabled:", error);
  if (canvas) canvas.hidden = true;
}
