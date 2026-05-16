(function () {
  const LOCAL_CLASSROOMS_KEY = "sortVisualizerLocalClassrooms";
  const LOCAL_ASSIGNMENTS_KEY = "sortVisualizerLocalAssignments";
  const LOCAL_ASSIGNMENT_SUBMISSIONS_KEY = "sortVisualizerLocalAssignmentSubmissions";
  const LOCAL_USERS_KEY = "sortVisualizerLocalUsers";

  const state = {
    session: null,
    classroomId: "",
    assignmentId: "",
    classroom: null,
    students: [],
    assignments: [],
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

  function getLocalClassrooms() {
    return JSON.parse(localStorage.getItem(LOCAL_CLASSROOMS_KEY) || "[]").map((classroom) => ({
      ...classroom,
      students: classroom.students || classroom.studentIds || [],
    }));
  }

  function getLocalAssignments() {
    return JSON.parse(localStorage.getItem(LOCAL_ASSIGNMENTS_KEY) || "[]");
  }

  function getLocalSubmissions() {
    return JSON.parse(localStorage.getItem(LOCAL_ASSIGNMENT_SUBMISSIONS_KEY) || "[]");
  }

  function getLocalUsers() {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
  }

  function getAssignmentQuestions(algorithm) {
    return (window.SortVisualizerQuizData || [])
      .filter((question) => question.algorithm === algorithm)
      .slice(0, 10);
  }

  function formatDueDate(dueDate) {
    return dueDate ? `截止日期：${dueDate}` : "沒有截止日期";
  }

  function formatSubmittedAt(value) {
    return value ? new Date(value).toLocaleString() : "未記錄";
  }

  async function loadClassroom() {
    try {
      const { classrooms } = await requestJson(`/api/classrooms?${new URLSearchParams({
        userId: state.session.id,
        role: state.session.role,
      }).toString()}`);
      return classrooms.find((classroom) => classroom.id === state.classroomId);
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      return getLocalClassrooms().find((classroom) => classroom.id === state.classroomId);
    }
  }

  async function loadStudents() {
    try {
      const { students } = await requestJson(`/api/classrooms/${state.classroomId}/students`);
      return students;
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const classroom = getLocalClassrooms().find((item) => item.id === state.classroomId);
      return getLocalUsers()
        .filter((user) => classroom && classroom.students.includes(user.id))
        .map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
        }));
    }
  }

  async function loadAssignments() {
    try {
      const query = new URLSearchParams({
        userId: state.session.id,
        role: state.session.role,
        classroomId: state.classroomId,
      });
      const { assignments } = await requestJson(`/api/assignments?${query.toString()}`);
      return assignments;
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const submissions = getLocalSubmissions();
      return getLocalAssignments()
        .filter((assignment) => assignment.classroomId === state.classroomId)
        .map((assignment) => ({
          ...assignment,
          submissions: submissions.filter((submission) => submission.assignmentId === assignment.id),
        }));
    }
  }

  function getActiveAssignment() {
    return state.assignments.find((assignment) => assignment.id === state.assignmentId)
      || state.assignments[0]
      || null;
  }

  function buildQuestionStats(assignment) {
    const questions = getAssignmentQuestions(assignment.algorithm);
    const submissions = assignment.submissions || [];

    if (!questions.length) {
      return `<p class="empty-state">目前沒有題目資料。</p>`;
    }

    return questions.map((question, index) => {
      const answered = submissions.filter((submission) => submission.answers && submission.answers[index]);
      const correct = answered.filter((submission) => submission.answers[index].isCorrect).length;
      const rate = answered.length ? Math.round((correct / answered.length) * 100) : 0;

      return `
        <div class="accuracy-row">
          <span>第 ${index + 1} 題</span>
          <div class="accuracy-bar"><span style="width: ${rate}%"></span></div>
          <strong>${rate}%</strong>
        </div>
      `;
    }).join("");
  }

  function buildStudentRows(assignment) {
    const submissions = assignment.submissions || [];

    if (!state.students.length) {
      return `<p class="empty-state">此教室尚未加入學生。</p>`;
    }

    return state.students.map((student) => {
      const submission = submissions.find((item) => item.studentId === student.id);

      if (!submission) {
        return `
          <article class="grade-row">
            <div>
              <h4>${student.email}</h4>
              <p>尚未繳交</p>
            </div>
            <span class="class-code">未交</span>
          </article>
        `;
      }

      return `
        <article class="grade-row">
          <div>
            <h4>${student.email}</h4>
            <p>送出時間：${formatSubmittedAt(submission.submittedAt)}</p>
          </div>
          <span class="assignment-score">${submission.score}/${submission.total}</span>
        </article>
      `;
    }).join("");
  }

  function renderAssignmentList() {
    const list = document.getElementById("reportAssignmentList");

    if (!state.assignments.length) {
      list.innerHTML = `<p class="empty-state">尚未指派作業。</p>`;
      return;
    }

    list.innerHTML = state.assignments.map((assignment) => {
      const isActive = assignment.id === state.assignmentId;
      const submissions = assignment.submissions || [];
      const url = `./teacher_assignment_report.html?${new URLSearchParams({
        classroomId: state.classroomId,
        assignmentId: assignment.id,
      }).toString()}`;

      return `
        <a class="report-assignment-link ${isActive ? "is-active" : ""}" href="${url}">
          <strong>${assignment.title}</strong>
          <span>${assignment.algorithm} · ${submissions.length}/${state.students.length} 已交</span>
        </a>
      `;
    }).join("");
  }

  function renderReport() {
    const panel = document.getElementById("reportContentPanel");
    const assignment = getActiveAssignment();

    document.getElementById("reportMeta").textContent = state.classroom
      ? `${state.classroom.name} · ${state.classroom.classCode}`
      : "請回教師中心選擇教室";

    document.getElementById("backToAssignmentsLink").href = `./teacher_assignments.html?${new URLSearchParams({
      classroomId: state.classroomId,
    }).toString()}`;

    if (!state.classroom) {
      panel.innerHTML = `<p class="empty-state">請回教師中心重新選擇教室。</p>`;
      return;
    }

    if (!assignment) {
      document.getElementById("reportTitle").textContent = "作業成績報表";
      panel.innerHTML = `<p class="empty-state">尚未指派作業。</p>`;
      return;
    }

    state.assignmentId = assignment.id;
    document.getElementById("reportTitle").textContent = assignment.title;

    const submissions = assignment.submissions || [];
    const submittedCount = submissions.length;
    const averageScore = submittedCount
      ? (submissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) / submittedCount).toFixed(1)
      : "0";
    const maxTotal = submissions[0] ? submissions[0].total : getAssignmentQuestions(assignment.algorithm).length;
    const bestScore = submittedCount
      ? Math.max(...submissions.map((submission) => Number(submission.score || 0)))
      : 0;

    panel.innerHTML = `
      <div class="report-hero-card">
        <div>
          <p class="dashboard-eyebrow">Assignment Report</p>
          <h2>${assignment.title}</h2>
          <p>${assignment.algorithm} · ${formatDueDate(assignment.dueDate)}</p>
        </div>
        <a class="ghost-btn" href="./teacher_assignments.html?${new URLSearchParams({ classroomId: state.classroomId }).toString()}">修改作業</a>
      </div>

      <div class="grade-summary-grid report-metric-grid">
        <div><span>繳交狀態</span><strong>${submittedCount}/${state.students.length}</strong></div>
        <div><span>平均分數</span><strong>${averageScore}/${maxTotal}</strong></div>
        <div><span>最高分</span><strong>${bestScore}/${maxTotal}</strong></div>
      </div>

      <div class="report-detail-grid">
        <section class="report-section">
          <h3>題目答對率</h3>
          <div class="question-accuracy">${buildQuestionStats(assignment)}</div>
        </section>
        <section class="report-section">
          <h3>學生分數</h3>
          <div class="assignment-results">${buildStudentRows(assignment)}</div>
        </section>
      </div>
    `;
  }

  async function init() {
    state.session = window.Auth.requireRole("teacher", {
      allowedRoles: ["teacher", "admin"],
    });

    if (!state.session) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    state.classroomId = params.get("classroomId")
      || localStorage.getItem("activeTeacherClassroomId")
      || "";
    state.assignmentId = params.get("assignmentId") || "";

    try {
      state.classroom = await loadClassroom();

      if (state.classroom) {
        state.students = await loadStudents();
        state.assignments = await loadAssignments();
      }

      renderReport();
      renderAssignmentList();
    } catch (error) {
      document.getElementById("reportContentPanel").innerHTML = `<p class="empty-state">${error.message}</p>`;
    }
  }

  init();
})();
