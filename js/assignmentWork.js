(function () {
  const LOCAL_ASSIGNMENTS_KEY = "sortVisualizerLocalAssignments";
  const LOCAL_ASSIGNMENT_SUBMISSIONS_KEY = "sortVisualizerLocalAssignmentSubmissions";
  const LOCAL_CLASSROOMS_KEY = "sortVisualizerLocalClassrooms";

  const state = {
    session: null,
    assignment: null,
    questions: [],
    marks: {},
  };

  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(payload.message || "Request failed");
      error.isHttpError = true;
      throw error;
    }

    return payload;
  }

  function getLocalAssignments() {
    return JSON.parse(localStorage.getItem(LOCAL_ASSIGNMENTS_KEY) || "[]");
  }

  function getLocalSubmissions() {
    return JSON.parse(localStorage.getItem(LOCAL_ASSIGNMENT_SUBMISSIONS_KEY) || "[]");
  }

  function saveLocalSubmissions(submissions) {
    localStorage.setItem(LOCAL_ASSIGNMENT_SUBMISSIONS_KEY, JSON.stringify(submissions));
  }

  function getLocalClassrooms() {
    return JSON.parse(localStorage.getItem(LOCAL_CLASSROOMS_KEY) || "[]");
  }

  function getAssignmentId() {
    return new URLSearchParams(window.location.search).get("id");
  }

  function formatDueDate(dueDate) {
    return dueDate ? `截止日期：${dueDate}` : "沒有截止日期";
  }

  function isPastDue(assignment) {
    return assignment.dueDate && new Date() > new Date(`${assignment.dueDate}T23:59:59`);
  }

  async function loadAssignment(session, assignmentId) {
    try {
      const query = new URLSearchParams({
        userId: session.id,
        role: session.role,
      });
      const { assignments } = await requestJson(`/api/assignments?${query.toString()}`);
      return assignments.find((assignment) => assignment.id === assignmentId);
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const classrooms = getLocalClassrooms();
      const joinedClassIds = classrooms
        .filter((classroom) => (classroom.students || classroom.studentIds || []).includes(session.id))
        .map((classroom) => classroom.id);
      const submissions = getLocalSubmissions();
      const assignment = getLocalAssignments().find(
        (item) => item.id === assignmentId && joinedClassIds.includes(item.classroomId),
      );

      if (!assignment) {
        return null;
      }

      return {
        ...assignment,
        submissions: submissions.filter(
          (submission) => submission.assignmentId === assignment.id && submission.studentId === session.id,
        ),
      };
    }
  }

  async function submitAssignment(payload) {
    try {
      return await requestJson(`/api/assignments/${payload.assignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const submission = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        ...payload,
        submittedAt: new Date().toISOString(),
      };
      const submissions = getLocalSubmissions().filter(
        (item) => !(item.assignmentId === payload.assignmentId && item.studentId === payload.studentId),
      );
      saveLocalSubmissions([...submissions, submission]);
      return { submission };
    }
  }

  function setMessage(message, type = "success") {
    const messageEl = document.getElementById("assignmentMessage");
    messageEl.textContent = message;
    messageEl.className = `dashboard-message is-${type}`;
  }

  function renderSummary() {
    const summary = document.getElementById("assignmentSummary");
    const ownSubmission = (state.assignment.submissions || []).find(
      (submission) => submission.studentId === state.session.id,
    );

    summary.innerHTML = `
      <dl>
        <div>
          <dt>作答狀態</dt>
          <dd>${ownSubmission ? "已完成" : "尚未完成"}</dd>
        </div>
        <div>
          <dt>截止日期</dt>
          <dd>${formatDueDate(state.assignment.dueDate)}</dd>
        </div>
        <div>
          <dt>演算法</dt>
          <dd>${state.assignment.algorithm}</dd>
        </div>
        <div>
          <dt>分數</dt>
          <dd>${ownSubmission ? `${ownSubmission.score}/${ownSubmission.total}` : "尚未送出"}</dd>
        </div>
      </dl>
    `;
  }

  function renderQuestions() {
    const form = document.getElementById("assignmentForm");
    form.innerHTML = state.questions.map((question, questionIndex) => `
      <article id="question-${questionIndex}" class="assignment-question-card">
        <h2>${questionIndex + 1}. ${question.question}</h2>
        ${question.options.map((option) => `
          <label class="answer-option">
            <input type="radio" name="question-${questionIndex}" value="${option}" />
            <span>${option}</span>
          </label>
        `).join("")}
      </article>
    `).join("");

    form.addEventListener("change", renderNavigator);
  }

  function renderNavigator() {
    const navigator = document.getElementById("questionNavigator");
    navigator.innerHTML = state.questions.map((question, questionIndex) => {
      const selected = document.querySelector(`input[name="question-${questionIndex}"]:checked`);
      const mark = state.marks[questionIndex] || "";
      const classes = [
        "question-nav-btn",
        selected ? "is-answered" : "",
        mark === "yellow" ? "is-yellow" : "",
        mark === "red" ? "is-red" : "",
      ].filter(Boolean).join(" ");

      return `
        <div class="question-nav-row">
          <button class="${classes}" type="button" data-goto-question="${questionIndex}">
            ${questionIndex + 1}
          </button>
          <div class="mark-controls">
            <button class="mark-btn" type="button" data-mark="yellow" data-question-index="${questionIndex}">黃</button>
            <button class="mark-btn" type="button" data-mark="red" data-question-index="${questionIndex}">紅</button>
            <button class="mark-btn" type="button" data-mark="clear" data-question-index="${questionIndex}">清</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function bindNavigator() {
    document.getElementById("questionNavigator").addEventListener("click", (event) => {
      const gotoButton = event.target.closest("[data-goto-question]");
      const markButton = event.target.closest("[data-mark]");

      if (gotoButton) {
        document.getElementById(`question-${gotoButton.dataset.gotoQuestion}`).scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }

      if (markButton) {
        const questionIndex = markButton.dataset.questionIndex;
        const mark = markButton.dataset.mark;

        if (mark === "clear") {
          delete state.marks[questionIndex];
        } else {
          state.marks[questionIndex] = mark;
        }

        renderNavigator();
      }
    });
  }

  async function handleSubmit() {
    if (isPastDue(state.assignment)) {
      setMessage("這份作業已超過截止日期，無法送出。", "error");
      return;
    }

    const answers = state.questions.map((question, questionIndex) => {
      const selected = document.querySelector(`input[name="question-${questionIndex}"]:checked`);
      return {
        questionId: question.id,
        selectedAnswer: selected ? selected.value : "",
        correctAnswer: question.answer,
        isCorrect: selected ? selected.value === question.answer : false,
        mark: state.marks[questionIndex] || "",
      };
    });

    if (answers.some((answer) => !answer.selectedAnswer)) {
      setMessage("請完成所有題目再送出。可以用紅/黃標記提醒自己回來檢查。", "error");
      return;
    }

    if (!confirm("確定要送出作業嗎？送出後會立即計分並前往詳解頁。")) {
      return;
    }

    const score = answers.filter((answer) => answer.isCorrect).length;

    try {
      await submitAssignment({
        assignmentId: state.assignment.id,
        studentId: state.session.id,
        score,
        total: state.questions.length,
        answers,
      });
      sessionStorage.setItem("assignmentReview", JSON.stringify({
        assignment: state.assignment,
        questions: state.questions,
        answers,
        score,
        total: state.questions.length,
        submittedAt: new Date().toISOString(),
      }));
      window.location.href = `./assignment_review.html?id=${state.assignment.id}`;
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function init() {
    state.session = window.Auth.requireRole("student");

    if (!state.session) {
      return;
    }

    const assignmentId = getAssignmentId();
    state.assignment = await loadAssignment(state.session, assignmentId);

    if (!state.assignment) {
      document.getElementById("assignmentTitle").textContent = "找不到作業";
      document.getElementById("assignmentMeta").textContent = "請回學生中心重新選擇作業。";
      return;
    }

    state.questions = (window.SortVisualizerQuizData || [])
      .filter((question) => question.algorithm === state.assignment.algorithm)
      .slice(0, 10);

    document.getElementById("assignmentTitle").textContent = state.assignment.title;
    document.getElementById("assignmentMeta").textContent = `${state.assignment.algorithm} · ${formatDueDate(state.assignment.dueDate)}`;

    renderSummary();
    renderQuestions();
    renderNavigator();
    bindNavigator();

    if (isPastDue(state.assignment)) {
      document.getElementById("submitAssignmentBtn").disabled = true;
      setMessage("這份作業已超過截止日期，僅可查看題目。", "error");
    }

    document.getElementById("submitAssignmentBtn").addEventListener("click", handleSubmit);
  }

  init();
})();
