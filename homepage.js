const barContainer = document.getElementById("barContainer");
const shuffleBtn = document.getElementById("shuffleBtn");
const applyInputBtn = document.getElementById("applyInputBtn");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const statusText = document.getElementById("statusText");
const algorithmName = document.getElementById("algorithmName");
const algorithmDescription = document.getElementById("algorithmDescription");
const algorithmCode = document.getElementById("algorithmCode");
const codeTitle = document.getElementById("codeTitle");
const algoCards = document.querySelectorAll(".algo-card");
const arrayInput = document.getElementById("arrayInput");
const inputError = document.getElementById("inputError");
const speedRange = document.getElementById("speedRange");
const speedLabel = document.getElementById("speedLabel");
const sortModal = document.getElementById("sortModal");
const modalOverlay = document.getElementById("modalOverlay");

const algorithmMeta = {
  bubble: {
    title: "Bubble Sort",
    description: "反覆比較相鄰的兩個數字，若順序錯誤就交換，較大的值會一步步浮到右側。",
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
let delay = Number(speedRange.value);
let animationToken = 0;
let isModalOpen = false;

function randomValues() {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 90) + 10);
}

function updateInputValue() {
  arrayInput.value = values.join(", ");
}

function updateSpeedLabel() {
  speedLabel.textContent = `${delay} ms`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function parseInputValues(text) {
  const parts = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 24) {
    throw new Error("請輸入 2 到 24 個整數。");
  }

  return parts.map((item) => {
    const value = Number(item);

    if (!Number.isInteger(value)) {
      throw new Error("每一個項目都必須是整數。");
    }

    return value;
  });
}

function setControlsIdle() {
  isAnimating = false;
  isPaused = false;
  startBtn.disabled = false;
  startBtn.classList.remove("opacity-60", "cursor-not-allowed");
  pauseBtn.textContent = "暫停";
  pauseBtn.classList.remove("bg-emerald-500", "text-white");
  pauseBtn.classList.add("bg-slate-200", "text-slate-700");
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

  values.forEach((value, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-1 flex-col items-center justify-end";

    const bar = document.createElement("div");
    const label = document.createElement("span");
    const isComparing = compareIndexes.includes(index);
    const isSorted = sortedIndexes.includes(index);
    const isSwapping = swapIndexes.includes(index);
    const normalizedHeight = Math.max((Math.abs(value) / maxValue) * 250, 18);

    let colorClass = "bg-sky-400";
    if (isSorted) colorClass = "bg-emerald-400";
    else if (isSwapping) colorClass = "bg-rose-500";
    else if (isComparing) colorClass = "bg-amber-400";

    bar.className = `w-full rounded-t-2xl transition-all duration-300 ${colorClass}`;
    bar.style.height = `${normalizedHeight}px`;
    bar.style.transform = isSwapping
      ? "translateY(-10px) scale(1.03)"
      : isComparing
        ? "translateY(-4px)"
        : "translateY(0)";

    label.className = `mt-2 text-[10px] font-semibold ${
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

function setAlgorithm(algo) {
  currentAlgorithm = algo;
  algorithmName.textContent = algorithmMeta[algo].title;
  algorithmDescription.textContent = algorithmMeta[algo].description;
  algorithmCode.textContent = algorithmMeta[algo].code;
  codeTitle.textContent = algorithmMeta[algo].title;

  algoCards.forEach((card) => {
    const active = card.dataset.algo === algo;
    card.classList.toggle("border-slate-900", active);
    card.classList.toggle("border-slate-300", !active);
    card.classList.toggle("ring-4", active);
    card.classList.toggle("ring-sky-100", active);
  });
}

function setPauseState(nextPaused) {
  isPaused = nextPaused;
  pauseBtn.textContent = isPaused ? "繼續" : "暫停";
  pauseBtn.classList.toggle("bg-emerald-500", isPaused);
  pauseBtn.classList.toggle("text-white", isPaused);
  pauseBtn.classList.toggle("bg-slate-200", !isPaused);
  pauseBtn.classList.toggle("text-slate-700", !isPaused);

  if (isAnimating) {
    setStatus(isPaused ? "排序已暫停" : "排序進行中");
  }
}

function applyInputValues() {
  if (isAnimating) {
    cancelCurrentAnimation();
  }

  try {
    values = parseInputValues(arrayInput.value);
    inputError.classList.add("hidden");
    setStatus("資料已更新，可以開啟排序過程。");

    if (isModalOpen) {
      renderBars();
    }
  } catch (error) {
    if (error.message === "ANIMATION_CANCELLED") {
      return false;
    }

    inputError.textContent = error.message;
    inputError.classList.remove("hidden");
    return false;
  }

  return true;
}

function openModal() {
  if (!applyInputValues()) {
    return;
  }

  isModalOpen = true;
  sortModal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  renderBars();
}

function closeModal() {
  if (isAnimating) {
    cancelCurrentAnimation();
    setStatus("已關閉排序過程。");
  }

  isModalOpen = false;
  sortModal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

async function bubbleSortAnimation(token) {
  const sorted = [];

  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length - i - 1; j += 1) {
      ensureActive(token);
      setStatus(`正在比較索引 ${j} 和 ${j + 1}`);
      renderBars([j, j + 1], sorted);
      await sleepWithPause(delay, token);

      if (values[j] > values[j + 1]) {
        setStatus(`交換索引 ${j} 和 ${j + 1}`);
        renderBars([], sorted, [j, j + 1]);
        await sleepWithPause(delay, token);
        [values[j], values[j + 1]] = [values[j + 1], values[j]];
        renderBars([], sorted, [j, j + 1]);
        await sleepWithPause(delay, token);
      }
    }

    sorted.push(values.length - i - 1);
    renderBars([], sorted);
    await sleepWithPause(Math.max(80, delay - 40), token);
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
      await sleepWithPause(delay, token);

      if (values[j] < values[minIndex]) {
        minIndex = j;
        setStatus(`找到新的最小值：索引 ${minIndex}`);
        renderBars([i, minIndex], sorted);
        await sleepWithPause(Math.max(80, delay - 20), token);
      }
    }

    if (minIndex !== i) {
      setStatus(`交換索引 ${i} 和 ${minIndex}`);
      renderBars([], sorted, [i, minIndex]);
      await sleepWithPause(delay, token);
      [values[i], values[minIndex]] = [values[minIndex], values[i]];
    }

    sorted.push(i);
    renderBars([], sorted, minIndex !== i ? [i] : []);
    await sleepWithPause(delay, token);
  }
}

async function insertionSortAnimation(token) {
  const sorted = [0];
  renderBars([], sorted);
  await sleepWithPause(delay, token);

  for (let i = 1; i < values.length; i += 1) {
    ensureActive(token);

    const current = values[i];
    let j = i - 1;
    setStatus(`取出索引 ${i} 的值 ${current}`);
    renderBars([i], sorted);
    await sleepWithPause(delay, token);

    while (j >= 0 && values[j] > current) {
      ensureActive(token);
      setStatus(`將索引 ${j} 的值往右移`);
      renderBars([j, j + 1], sorted, [j, j + 1]);
      await sleepWithPause(delay, token);
      values[j + 1] = values[j];
      renderBars([], sorted, [j, j + 1]);
      await sleepWithPause(delay, token);
      j -= 1;
    }

    values[j + 1] = current;
    sorted.length = 0;

    for (let k = 0; k <= i; k += 1) {
      sorted.push(k);
    }

    setStatus(`把 ${current} 插入到索引 ${j + 1}`);
    renderBars([j + 1], sorted, [j + 1]);
    await sleepWithPause(delay, token);
  }
}

async function runAnimation() {
  if (isAnimating) {
    return;
  }

  const token = animationToken + 1;
  animationToken = token;
  isAnimating = true;
  setPauseState(false);
  inputError.classList.add("hidden");
  startBtn.disabled = true;
  startBtn.classList.add("opacity-60", "cursor-not-allowed");

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
    updateInputValue();
  } catch (error) {
    if (error.message !== "ANIMATION_CANCELLED") {
      throw error;
    }
  } finally {
    if (token === animationToken) {
      setControlsIdle();
    }
  }
}

shuffleBtn.addEventListener("click", () => {
  if (isAnimating) {
    cancelCurrentAnimation();
  }

  values = randomValues();
  updateInputValue();
  inputError.classList.add("hidden");
  setStatus("已產生新的隨機資料。");

  if (isModalOpen) {
    renderBars();
  }
});

applyInputBtn.addEventListener("click", applyInputValues);
startBtn.addEventListener("click", runAnimation);

pauseBtn.addEventListener("click", () => {
  if (!isAnimating) {
    return;
  }

  setPauseState(!isPaused);
});

closeModalBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

speedRange.addEventListener("input", () => {
  delay = Number(speedRange.value);
  updateSpeedLabel();

  if (!isAnimating) {
    setStatus(`動畫速度已調整為 ${delay} ms`);
  }
});

algoCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (isAnimating) {
      cancelCurrentAnimation();
    }

    setAlgorithm(card.dataset.algo);
    setStatus("排序法已切換。");
    openModal();
  });
});

arrayInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyInputValues();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isModalOpen) {
    closeModal();
  }
});

values = randomValues();
updateInputValue();
updateSpeedLabel();
setAlgorithm(currentAlgorithm);
setStatus("準備開始");
