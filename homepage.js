const barContainer = document.getElementById("barContainer");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const statusText = document.getElementById("statusText");
const algorithmName = document.getElementById("algorithmName");
const currentAlgorithmText = document.getElementById("currentAlgorithmText");
const algorithmDescription = document.getElementById("algorithmDescription");
const algorithmUseCase = document.getElementById("algorithmUseCase");
const algorithmTags = document.getElementById("algorithmTags");
const algorithmCode = document.getElementById("algorithmCode");
const algoCards = document.querySelectorAll(".algo-card");
const algorithmSelect = document.getElementById("algorithmSelect");
const inputError = document.getElementById("inputError");
const sizeRange = document.getElementById("sizeRange");
const sizeLabel = document.getElementById("sizeLabel");
const speedRange = document.getElementById("speedRange");
const speedLabel = document.getElementById("speedLabel");
const detailsToggle = document.getElementById("detailsToggle");
const detailsPanel = document.getElementById("detailsPanel");
const detailsIcon = document.getElementById("detailsIcon");
const detailsSection = document.getElementById("detailsSection");
const detailsShortcut = document.getElementById("detailsShortcut");
const algorithmTime = document.getElementById("algorithmTime");
const algorithmSpace = document.getElementById("algorithmSpace");
const algorithmStable = document.getElementById("algorithmStable");

const algorithmMeta = {
  bubble: {
    title: "Bubble Sort",
    description: "反覆比較相鄰的兩個數字，若順序錯誤就交換，較大的值會一步步浮到右側。",
    useCase: "適合情境：教學入門、觀察相鄰比較與交換，不適合大量資料。",
    tags: ["相鄰比較", "容易理解", "交換頻繁", "教學常見", "動畫明顯"],
    complexity: {
      time: "Best O(n), Average/Worst O(n²)",
      space: "O(1)",
      stable: "Yes",
    },
    code: `for (let i = 0; i < arr.length - 1; i++) {
  for (let j = 0; j < arr.length - i - 1; j++) {
    if (arr[j] > arr[j + 1]) {
      [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
    }
  }
}`,
  },
  selection: {
    title: "Selection Sort",
    description: "每一輪從尚未排序的區間中找出最小值，並放到目前最前面的位置。",
    useCase: "適合情境：想看出已排序區與未排序區，或比較交換次數較少的排序流程。",
    tags: ["尋找最小值", "交換次數少", "區塊清楚", "教學常見", "步驟直觀"],
    complexity: {
      time: "Best/Average/Worst O(n²)",
      space: "O(1)",
      stable: "No",
    },
    code: `for (let i = 0; i < arr.length; i++) {
  let minIndex = i;

  for (let j = i + 1; j < arr.length; j++) {
    if (arr[j] < arr[minIndex]) {
      minIndex = j;
    }
  }

  [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
}`,
  },
  insertion: {
    title: "Insertion Sort",
    description: "像整理手牌一樣，把目前元素插入前面已排序好的區間，逐步完成排序。",
    useCase: "適合情境：小資料或接近排序完成的資料，能清楚觀察元素位移。",
    tags: ["逐步插入", "實作簡單", "位移明顯", "小資料適合", "近乎有序"],
    complexity: {
      time: "Best O(n), Average/Worst O(n²)",
      space: "O(1)",
      stable: "Yes",
    },
    code: `for (let i = 1; i < arr.length; i++) {
  const current = arr[i];
  let j = i - 1;

  while (j >= 0 && arr[j] > current) {
    arr[j + 1] = arr[j];
    j--;
  }

  arr[j + 1] = current;
}`,
  },
};

let values = [];
let currentAlgorithm = "bubble";
let isAnimating = false;
let isPaused = false;
let animationDelay = Number(speedRange.value);
let dataSize = Number(sizeRange.value);
let animationToken = 0;

function randomValues(length = dataSize) {
  return Array.from({ length }, () => Math.floor(Math.random() * 90) + 10);
}

function updateSpeedLabel() {
  speedLabel.textContent = `${animationDelay} ms`;
}

function updateSizeLabel() {
  sizeLabel.textContent = dataSize;
}

function setStatus(message) {
  statusText.textContent = message;
}

function setControlsIdle() {
  isAnimating = false;
  isPaused = false;
  startBtn.disabled = false;
  resetBtn.disabled = false;
  algorithmSelect.disabled = false;
  sizeRange.disabled = false;
}

function setControlsAnimating() {
  isAnimating = true;
  startBtn.disabled = true;
  resetBtn.disabled = false;
  algorithmSelect.disabled = true;
  sizeRange.disabled = true;
}

function cancelCurrentAnimation() {
  animationToken += 1;
  setControlsIdle();
}

function ensureActive(token) {
  if (token !== animationToken) {
    throw new Error("ANIMATION_CANCELLED");
  }
}

async function sleepWithPause(ms, token) {
  let remaining = ms;

  while (remaining > 0) {
    ensureActive(token);

    while (isPaused) {
      ensureActive(token);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    const step = Math.min(remaining, 30);
    await new Promise((resolve) => setTimeout(resolve, step));
    remaining -= step;
  }
}

function renderBars(compareIndexes = [], sortedIndexes = [], swapIndexes = []) {
  barContainer.innerHTML = "";
  const maxValue = Math.max(...values.map((value) => Math.abs(value)), 1);
  const showLabels = values.length <= 30;

  values.forEach((value, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex min-w-0 flex-1 flex-col items-center justify-end";

    const bar = document.createElement("div");
    const label = document.createElement("span");
    const isComparing = compareIndexes.includes(index);
    const isSorted = sortedIndexes.includes(index);
    const isSwapping = swapIndexes.includes(index);
    const normalizedHeight = Math.max((Math.abs(value) / maxValue) * 290, 18);

    let colorClass = "bg-sky-400";
    if (isSorted) colorClass = "bg-emerald-400";
    else if (isSwapping) colorClass = "bg-rose-500";
    else if (isComparing) colorClass = "bg-amber-400";

    bar.className = `w-full rounded-t-xl transition-all duration-300 ${colorClass}`;
    bar.style.height = `${normalizedHeight}px`;
    bar.style.transform = isSwapping
      ? "translateY(-10px) scale(1.03)"
      : isComparing
        ? "translateY(-4px)"
        : "translateY(0)";

    label.className = `mt-2 text-[10px] font-semibold ${
      showLabels ? "block" : "hidden"
    } ${
      isSorted
        ? "text-emerald-300"
        : isSwapping
          ? "text-rose-300"
          : isComparing
            ? "text-amber-200"
            : "text-slate-200"
    }`;
    label.textContent = value;

    wrapper.appendChild(bar);
    wrapper.appendChild(label);
    barContainer.appendChild(wrapper);
  });
}

function renderTags(tags) {
  algorithmTags.innerHTML = "";

  tags.forEach((tag) => {
    const tagElement = document.createElement("span");
    tagElement.className = "rounded-full bg-slate-100 px-3 py-1.5";
    tagElement.textContent = tag;
    algorithmTags.appendChild(tagElement);
  });
}

function setAlgorithm(algo) {
  currentAlgorithm = algo;
  const meta = algorithmMeta[algo];

  algorithmName.textContent = meta.title;
  currentAlgorithmText.textContent = meta.title;
  algorithmDescription.textContent = meta.description;
  algorithmUseCase.textContent = meta.useCase;
  algorithmCode.textContent = meta.code;
  algorithmTime.textContent = meta.complexity.time;
  algorithmSpace.textContent = meta.complexity.space;
  algorithmStable.textContent = meta.complexity.stable;
  algorithmSelect.value = algo;
  renderTags(meta.tags);

  algoCards.forEach((card) => {
    const active = card.dataset.algo === algo;
    card.classList.toggle("border-sky-500", active);
    card.classList.toggle("bg-sky-50", active);
    card.classList.toggle("text-sky-700", active);
    card.classList.toggle("shadow-sm", active);
    card.classList.toggle("border-slate-300", !active);
    card.classList.toggle("bg-white", !active);
    card.classList.toggle("text-slate-700", !active);
    card.classList.toggle("hover:border-slate-500", !active);
    card.classList.toggle("hover:bg-slate-50", !active);
  });

  document.dispatchEvent(
    new CustomEvent("sortAlgorithmChange", {
      detail: {
        key: algo,
        title: meta.title,
      },
    }),
  );
}

function regenerateValues(message = "已重設資料，可以開始排序。") {
  if (isAnimating) {
    cancelCurrentAnimation();
  }

  values = randomValues();
  inputError.classList.add("hidden");
  setStatus(message);
  renderBars();
}

async function bubbleSortAnimation(token) {
  const sorted = [];

  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length - i - 1; j += 1) {
      ensureActive(token);
      setStatus(`正在比較索引 ${j} 和 ${j + 1}`);
      renderBars([j, j + 1], sorted);
      await sleepWithPause(animationDelay, token);

      if (values[j] > values[j + 1]) {
        setStatus(`交換索引 ${j} 和 ${j + 1}`);
        renderBars([], sorted, [j, j + 1]);
        await sleepWithPause(animationDelay, token);
        [values[j], values[j + 1]] = [values[j + 1], values[j]];
        renderBars([], sorted, [j, j + 1]);
        await sleepWithPause(animationDelay, token);
      }
    }

    sorted.push(values.length - i - 1);
    renderBars([], sorted);
    await sleepWithPause(Math.max(80, animationDelay - 40), token);
  }
}

async function selectionSortAnimation(token) {
  const sorted = [];

  for (let i = 0; i < values.length; i += 1) {
    let minIndex = i;

    for (let j = i + 1; j < values.length; j += 1) {
      ensureActive(token);
      setStatus(`正在比較目前最小值索引 ${minIndex} 和索引 ${j}`);
      renderBars([minIndex, j], sorted);
      await sleepWithPause(animationDelay, token);

      if (values[j] < values[minIndex]) {
        minIndex = j;
        setStatus(`找到新的最小值：索引 ${minIndex}`);
        renderBars([i, minIndex], sorted);
        await sleepWithPause(Math.max(80, animationDelay - 20), token);
      }
    }

    if (minIndex !== i) {
      setStatus(`交換索引 ${i} 和 ${minIndex}`);
      renderBars([], sorted, [i, minIndex]);
      await sleepWithPause(animationDelay, token);
      [values[i], values[minIndex]] = [values[minIndex], values[i]];
    }

    sorted.push(i);
    renderBars([], sorted, minIndex !== i ? [i] : []);
    await sleepWithPause(animationDelay, token);
  }
}

async function insertionSortAnimation(token) {
  const sorted = [0];
  renderBars([], sorted);
  await sleepWithPause(animationDelay, token);

  for (let i = 1; i < values.length; i += 1) {
    ensureActive(token);

    const current = values[i];
    let j = i - 1;
    setStatus(`取出索引 ${i} 的值 ${current}`);
    renderBars([i], sorted);
    await sleepWithPause(animationDelay, token);

    while (j >= 0 && values[j] > current) {
      ensureActive(token);
      setStatus(`將索引 ${j} 的值往右移`);
      renderBars([j, j + 1], sorted, [j, j + 1]);
      await sleepWithPause(animationDelay, token);
      values[j + 1] = values[j];
      renderBars([], sorted, [j, j + 1]);
      await sleepWithPause(animationDelay, token);
      j -= 1;
    }

    values[j + 1] = current;
    sorted.length = 0;

    for (let k = 0; k <= i; k += 1) {
      sorted.push(k);
    }

    setStatus(`把 ${current} 插入到索引 ${j + 1}`);
    renderBars([j + 1], sorted, [j + 1]);
    await sleepWithPause(animationDelay, token);
  }
}

async function runAnimation() {
  if (isAnimating) {
    return;
  }

  const token = animationToken + 1;
  animationToken = token;
  setControlsAnimating();
  inputError.classList.add("hidden");
  setStatus("排序進行中");

  try {
    if (currentAlgorithm === "bubble") {
      await bubbleSortAnimation(token);
    } else if (currentAlgorithm === "selection") {
      await selectionSortAnimation(token);
    } else {
      await insertionSortAnimation(token);
    }

    ensureActive(token);
    renderBars([], values.map((_, index) => index));
    setStatus("排序完成");
  } catch (error) {
    if (error.message !== "ANIMATION_CANCELLED") {
      inputError.textContent = "排序動畫發生錯誤，請重設後再試。";
      inputError.classList.remove("hidden");
      throw error;
    }
  } finally {
    if (token === animationToken) {
      setControlsIdle();
    }
  }
}

function handleAlgorithmChange(algo) {
  if (isAnimating) {
    cancelCurrentAnimation();
  }

  setAlgorithm(algo);
  setStatus(`目前選擇：${algorithmMeta[algo].title}`);
  renderBars();
}

algoCards.forEach((card) => {
  card.addEventListener("click", () => {
    handleAlgorithmChange(card.dataset.algo);
  });
});

algorithmSelect.addEventListener("change", (event) => {
  handleAlgorithmChange(event.target.value);
});

startBtn.addEventListener("click", runAnimation);
resetBtn.addEventListener("click", () => {
  regenerateValues("資料已重新產生。");
});

sizeRange.addEventListener("input", () => {
  dataSize = Number(sizeRange.value);
  updateSizeLabel();
  regenerateValues(`資料數量已調整為 ${dataSize}。`);
});

speedRange.addEventListener("input", () => {
  animationDelay = Number(speedRange.value);
  updateSpeedLabel();

  if (!isAnimating) {
    setStatus(`動畫速度已調整為 ${animationDelay} ms`);
  }
});

detailsToggle.addEventListener("click", () => {
  setDetailsExpanded(detailsToggle.getAttribute("aria-expanded") !== "true");
});

function setDetailsExpanded(expanded) {
  detailsToggle.setAttribute("aria-expanded", String(expanded));
  detailsPanel.classList.toggle("hidden", !expanded);
  detailsIcon.textContent = expanded ? "-" : "+";
}

detailsShortcut.addEventListener("click", () => {
  setDetailsExpanded(true);
  detailsSection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

values = randomValues();
updateSizeLabel();
updateSpeedLabel();
setAlgorithm(currentAlgorithm);
setStatus("準備開始");
renderBars();
