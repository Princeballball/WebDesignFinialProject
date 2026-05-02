(function () {
  const quizSection = document.getElementById("quizSection");
  const quizToggle = document.getElementById("quizToggle");
  const quizToggleIcon = document.getElementById("quizToggleIcon");
  const quizPanel = document.getElementById("quizPanel");
  const quizShortcut = document.getElementById("quizShortcut");
  const quizAlgorithmLabel = document.getElementById("quizAlgorithmLabel");
  const quizProgress = document.getElementById("quizProgress");
  const quizScore = document.getElementById("quizScore");
  const quizQuestion = document.getElementById("quizQuestion");
  const quizOptions = document.getElementById("quizOptions");
  const quizFeedback = document.getElementById("quizFeedback");
  const quizSubmitBtn = document.getElementById("quizSubmitBtn");
  const quizNextBtn = document.getElementById("quizNextBtn");

  const algorithmNames = {
    bubble: "Bubble Sort",
    selection: "Selection Sort",
    insertion: "Insertion Sort",
  };

  const apiAlgorithmNames = {
    bubble: "BubbleSort",
    selection: "SelectionSort",
    insertion: "InsertionSort",
  };

  const state = {
    algorithm: "bubble",
    questions: [],
    currentIndex: 0,
    selectedAnswer: "",
    answered: false,
    score: 0,
  };

  async function loadQuizData(algorithm) {
    const localData = window.SortVisualizerQuizData || [];

    // Future backend version:
    // const apiName = apiAlgorithmNames[algorithm];
    // const response = await fetch(`/api/quizzes?algorithm=${encodeURIComponent(apiName)}`);
    // return response.json();
    return localData.filter((item) => item.algorithm === algorithm);
  }

  function submitQuizAnswer(question, selectedAnswer) {
    const isCorrect = selectedAnswer === question.answer;

    return {
      questionId: question.id,
      algorithm: question.algorithm,
      selectedAnswer,
      correctAnswer: question.answer,
      isCorrect,
      explanation: question.explanation,
    };
  }

  function saveQuizResult(result) {
    const storageKey = "sortVisualizerQuizResults";
    const session = JSON.parse(localStorage.getItem("sortVisualizerSession") || "null");
    const savedResult = {
      ...result,
      userId: result.userId || (session && session.id) || "",
      classroomId: result.classroomId || localStorage.getItem("activeClassroomId") || "",
      createdAt: new Date().toISOString(),
    };

    try {
      const previousResults = JSON.parse(localStorage.getItem(storageKey) || "[]");
      localStorage.setItem(storageKey, JSON.stringify([...previousResults, savedResult]));
    } catch (error) {
      console.warn("Quiz result was not saved locally.", error);
    }

    // Future backend version:
    fetch("/api/quiz-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedResult),
    }).catch(() => {
      // Local file mode can still use localStorage without a running API server.
    });

    return Promise.resolve(savedResult);
  }

  function getCurrentQuestion() {
    return state.questions[state.currentIndex];
  }

  function setQuizExpanded(expanded) {
    quizToggle.setAttribute("aria-expanded", String(expanded));
    quizPanel.classList.toggle("is-hidden", !expanded);
    quizToggleIcon.textContent = expanded ? "-" : "+";
  }

  function updateMeta() {
    const total = Math.max(state.questions.length, 1);
    quizAlgorithmLabel.textContent = `${algorithmNames[state.algorithm]} 題庫`;
    quizProgress.textContent = `${state.currentIndex + 1} / ${total}`;
    quizScore.textContent = `Score: ${state.score}`;
  }

  function clearFeedback() {
    quizFeedback.className = "quiz-feedback is-hidden";
    quizFeedback.innerHTML = "";
  }

  function renderOptions(question) {
    quizOptions.innerHTML = "";

    question.options.forEach((option, index) => {
      const optionButton = document.createElement("button");
      const marker = document.createElement("span");
      const optionText = document.createElement("span");

      optionButton.className = "quiz-option";
      optionButton.type = "button";
      optionButton.dataset.answer = option;
      optionButton.setAttribute("role", "radio");
      optionButton.setAttribute("aria-checked", String(state.selectedAnswer === option));

      marker.className = "quiz-option-marker";
      marker.textContent = String.fromCharCode(65 + index);

      optionText.className = "quiz-option-text";
      optionText.textContent = option;

      optionButton.appendChild(marker);
      optionButton.appendChild(optionText);
      optionButton.addEventListener("click", () => selectAnswer(option));
      quizOptions.appendChild(optionButton);
    });
  }

  function renderQuestion() {
    const question = getCurrentQuestion();

    if (!question) {
      quizQuestion.textContent = "目前沒有這個演算法的題目。";
      quizOptions.innerHTML = "";
      quizSubmitBtn.disabled = true;
      quizNextBtn.disabled = true;
      updateMeta();
      return;
    }

    state.selectedAnswer = "";
    state.answered = false;
    quizQuestion.textContent = question.question;
    quizSubmitBtn.disabled = true;
    quizNextBtn.disabled = state.questions.length <= 1;
    clearFeedback();
    renderOptions(question);
    updateMeta();
  }

  function selectAnswer(answer) {
    if (state.answered) {
      return;
    }

    state.selectedAnswer = answer;
    quizSubmitBtn.disabled = false;

    Array.from(quizOptions.children).forEach((optionButton) => {
      const selected = optionButton.dataset.answer === answer;
      optionButton.classList.toggle("is-selected", selected);
      optionButton.setAttribute("aria-checked", String(selected));
    });
  }

  async function handleSubmit() {
    const question = getCurrentQuestion();

    if (!question || !state.selectedAnswer || state.answered) {
      return;
    }

    const result = submitQuizAnswer(question, state.selectedAnswer);
    state.answered = true;

    if (result.isCorrect) {
      state.score += 1;
    }

    Array.from(quizOptions.children).forEach((optionButton) => {
      const answer = optionButton.dataset.answer;
      optionButton.disabled = true;
      optionButton.classList.toggle("is-correct", answer === question.answer);
      optionButton.classList.toggle("is-wrong", answer === state.selectedAnswer && !result.isCorrect);
    });

    quizSubmitBtn.disabled = true;
    quizFeedback.className = `quiz-feedback ${result.isCorrect ? "is-correct" : "is-wrong"}`;
    quizFeedback.innerHTML = `
      <strong>${result.isCorrect ? "答對了" : "答錯了"}</strong>
      <p>正確答案：${question.answer}</p>
      <p>${question.explanation}</p>
    `;

    updateMeta();
    await saveQuizResult(result);
  }

  function handleNext() {
    if (state.questions.length <= 1) {
      return;
    }

    state.currentIndex = (state.currentIndex + 1) % state.questions.length;
    renderQuestion();
  }

  async function setQuizAlgorithm(algorithm) {
    state.algorithm = algorithm;
    state.questions = await loadQuizData(algorithm);
    state.currentIndex = 0;
    state.selectedAnswer = "";
    state.answered = false;
    state.score = 0;
    renderQuestion();
  }

  quizToggle.addEventListener("click", () => {
    setQuizExpanded(quizToggle.getAttribute("aria-expanded") !== "true");
  });

  quizShortcut.addEventListener("click", () => {
    setQuizExpanded(true);
    quizSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });

  quizSubmitBtn.addEventListener("click", handleSubmit);
  quizNextBtn.addEventListener("click", handleNext);

  document.addEventListener("sortAlgorithmChange", (event) => {
    setQuizAlgorithm(event.detail.key);
  });

  setQuizAlgorithm(state.algorithm);

  window.SortVisualizerQuiz = {
    loadQuizData,
    submitQuizAnswer,
    saveQuizResult,
    setQuizAlgorithm,
  };
})();
