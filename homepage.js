const barContainer = document.getElementById("barContainer");
const shuffleBtn = document.getElementById("shuffleBtn");
const applyInputBtn = document.getElementById("applyInputBtn");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const statusText = document.getElementById("statusText");
const algorithmName = document.getElementById("algorithmName");
const algorithmDescription = document.getElementById("algorithmDescription");
const algoButtons = document.querySelectorAll(".algo-btn");
const arrayInput = document.getElementById("arrayInput");
const inputError = document.getElementById("inputError");
const speedRange = document.getElementById("speedRange");
const speedLabel = document.getElementById("speedLabel");

const algorithmMeta = {
  bubble: {
    title: "Bubble Sort",
    description: "透過相鄰元素比較與交換，把較大的值慢慢推到右側。"
  },
  selection: {
    title: "Selection Sort",
    description: "每一輪從未排序區間找出最小值，並放到正確位置。"
  },
  insertion: {
    title: "Insertion Sort",
    description: "將新元素插入前方已排序區間，逐步建立有序序列。"
  }
};

let values = [];
let currentAlgorithm = "bubble";
let isAnimating = false;
let isPaused = false;
let delay = Number(speedRange.value);

function randomValues() {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 90) + 10);
}

function updateInputValue() {
  arrayInput.value = values.join(", ");
}

function updateSpeedLabel() {
  speedLabel.textContent = `${delay} ms`;
}

function parseInputValues(text) {
  const parts = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 24) {
    throw new Error("請輸入 2 到 24 個整數。");
  }

  const parsed = parts.map((item) => {
    const value = Number(item);
    if (!Number.isInteger(value)) {
      throw new Error("陣列內容必須全部是整數。");
    }
    return value;
  });

  return parsed;
}

async function sleepWithPause(ms) {
  let remaining = ms;

  while (remaining > 0) {
    while (isPaused) {
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

    let colorClass = "bg-gradient-to-t from-cyan-500 via-sky-400 to-indigo-400 shadow-[0_0_20px_rgba(56,189,248,0.18)]";
    if (isSorted) {
      colorClass = "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.45)]";
    } else if (isSwapping) {
      colorClass = "bg-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.52)]";
    } else if (isComparing) {
      colorClass = "bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.45)]";
    }

    bar.className = `w-full rounded-t-2xl transition-all duration-300 ease-out ${colorClass}`;
    bar.style.height = `${normalizedHeight}px`;
    bar.style.transform = isSwapping
      ? "translateY(-10px) scale(1.03)"
      : isComparing
        ? "translateY(-4px)"
        : "translateY(0)";
    bar.title = String(value);

    label.className = `mt-2 block text-center text-[10px] font-semibold ${
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

  algoButtons.forEach((button) => {
    const active = button.dataset.algo === algo;
    button.classList.toggle("border-slate-900", active);
    button.classList.toggle("bg-slate-900", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("border-slate-300", !active);
    button.classList.toggle("bg-white", !active);
    button.classList.toggle("text-slate-900", !active);
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
    statusText.textContent = isPaused ? "已暫停" : "繼續排序中";
  }
}

function applyInputValues() {
  if (isAnimating) {
    return;
  }

  try {
    const parsed = parseInputValues(arrayInput.value);
    inputError.classList.add("hidden");
    values = parsed;
    statusText.textContent = "已套用自訂陣列";
    renderBars();
  } catch (error) {
    inputError.textContent = error.message;
    inputError.classList.remove("hidden");
  }
}

async function bubbleSortAnimation() {
  const sorted = [];

  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length - i - 1; j += 1) {
      statusText.textContent = `比較索引 ${j} 與 ${j + 1}`;
      renderBars([j, j + 1], sorted);
      await sleepWithPause(delay);

      if (values[j] > values[j + 1]) {
        statusText.textContent = `交換索引 ${j} 與 ${j + 1}`;
        renderBars([], sorted, [j, j + 1]);
        await sleepWithPause(delay);
        [values[j], values[j + 1]] = [values[j + 1], values[j]];
        renderBars([], sorted, [j, j + 1]);
        await sleepWithPause(delay);
      }
    }

    sorted.push(values.length - i - 1);
    renderBars([], sorted);
    await sleepWithPause(Math.max(80, delay - 40));
  }
}

async function selectionSortAnimation() {
  const sorted = [];

  for (let i = 0; i < values.length; i += 1) {
    let minIndex = i;

    for (let j = i + 1; j < values.length; j += 1) {
      statusText.textContent = `比較目前最小值 ${minIndex} 與 ${j}`;
      renderBars([minIndex, j], sorted);
      await sleepWithPause(delay);

      if (values[j] < values[minIndex]) {
        minIndex = j;
        renderBars([i, minIndex], sorted);
        await sleepWithPause(Math.max(80, delay - 20));
      }
    }

    if (minIndex !== i) {
      statusText.textContent = `交換索引 ${i} 與 ${minIndex}`;
      renderBars([], sorted, [i, minIndex]);
      await sleepWithPause(delay);
      [values[i], values[minIndex]] = [values[minIndex], values[i]];
    }

    sorted.push(i);
    renderBars([], sorted, minIndex !== i ? [i] : []);
    await sleepWithPause(delay);
  }
}

async function insertionSortAnimation() {
  const sorted = [0];
  renderBars([], sorted);
  await sleepWithPause(delay);

  for (let i = 1; i < values.length; i += 1) {
    const current = values[i];
    let j = i - 1;

    statusText.textContent = `取出索引 ${i} 的值 ${current}`;
    renderBars([i], sorted);
    await sleepWithPause(delay);

    while (j >= 0 && values[j] > current) {
      statusText.textContent = `右移索引 ${j} 的值`;
      renderBars([j, j + 1], sorted, [j, j + 1]);
      await sleepWithPause(delay);
      values[j + 1] = values[j];
      renderBars([], sorted, [j, j + 1]);
      await sleepWithPause(delay);
      j -= 1;
    }

    values[j + 1] = current;
    sorted.length = 0;
    for (let k = 0; k <= i; k += 1) {
      sorted.push(k);
    }

    statusText.textContent = `插入到索引 ${j + 1}`;
    renderBars([j + 1], sorted, [j + 1]);
    await sleepWithPause(delay);
  }
}

async function runAnimation() {
  if (isAnimating) {
    return;
  }

  isAnimating = true;
  setPauseState(false);
  inputError.classList.add("hidden");
  startBtn.disabled = true;
  startBtn.classList.add("opacity-60", "cursor-not-allowed");

  if (currentAlgorithm === "bubble") {
    await bubbleSortAnimation();
  } else if (currentAlgorithm === "selection") {
    await selectionSortAnimation();
  } else {
    await insertionSortAnimation();
  }

  renderBars([], values.map((_, index) => index));
  statusText.textContent = "排序完成";
  startBtn.disabled = false;
  startBtn.classList.remove("opacity-60", "cursor-not-allowed");
  isAnimating = false;
  setPauseState(false);
  updateInputValue();
}

shuffleBtn.addEventListener("click", () => {
  if (isAnimating) {
    return;
  }

  values = randomValues();
  updateInputValue();
  inputError.classList.add("hidden");
  statusText.textContent = "已產生隨機陣列";
  renderBars();
});

applyInputBtn.addEventListener("click", applyInputValues);
startBtn.addEventListener("click", runAnimation);

pauseBtn.addEventListener("click", () => {
  if (!isAnimating) {
    return;
  }

  setPauseState(!isPaused);
});

speedRange.addEventListener("input", () => {
  delay = Number(speedRange.value);
  updateSpeedLabel();

  if (!isAnimating) {
    statusText.textContent = `速度已調整為 ${delay} ms`;
  }
});

algoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (isAnimating) {
      return;
    }

    setAlgorithm(button.dataset.algo);
    statusText.textContent = "已切換演算法";
    renderBars();
  });
});

arrayInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyInputValues();
  }
});

values = randomValues();
updateInputValue();
updateSpeedLabel();
setAlgorithm(currentAlgorithm);
renderBars();
