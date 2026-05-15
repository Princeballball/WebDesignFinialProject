(function () {
  const LOCAL_CLASSROOMS_KEY = "sortVisualizerLocalClassrooms";
  const LOCAL_ASSIGNMENTS_KEY = "sortVisualizerLocalAssignments";
  const LOCAL_ASSIGNMENT_SUBMISSIONS_KEY = "sortVisualizerLocalAssignmentSubmissions";
  const LOCAL_USERS_KEY = "sortVisualizerLocalUsers";

  const state = {
    session: null,
    classroomId: "",
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

  function saveLocalAssignments(assignments) {
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(assignments));
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

  function setMessage(message, type = "success") {
    const messageEl = document.getElementById("teacherAssignmentMessage");
    messageEl.textContent = message;
    messageEl.className = `dashboard-message is-${type}`;
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

  async function createAssignment(payload) {
    try {
      return await requestJson("/api/assignments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const assignment = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        classroomId: payload.classroomId,
        title: payload.title,
        algorithm: payload.algorithm,
        dueDate: payload.dueDate,
        teacherId: state.classroom.teacherId,
        createdAt: new Date().toISOString(),
      };
      saveLocalAssignments([...getLocalAssignments(), assignment]);
      return { assignment };
    }
  }

  async function updateAssignment(assignmentId, payload) {
    try {
      return await requestJson(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const assignments = getLocalAssignments().map((assignment) => (
        assignment.id === assignmentId
          ? {
            ...assignment,
            title: payload.title,
            algorithm: payload.algorithm,
            dueDate: payload.dueDate,
            updatedAt: new Date().toISOString(),
          }
          : assignment
      ));
      saveLocalAssignments(assignments);
      return { assignment: assignments.find((assignment) => assignment.id === assignmentId) };
    }
  }

  function renderClassroomSummary() {
    document.getElementById("teacherAssignmentMeta").textContent = state.classroom
      ? `${state.classroom.name} · ${state.classroom.classCode}`
      : "請回教師中心選擇教室";
    document.getElementById("assignmentClassroomTitle").textContent = state.classroom
      ? state.classroom.name
      : "找不到教室";
    document.getElementById("assignmentClassroomSummary").innerHTML = state.classroom
      ? `
        <article class="class-item">
          <div>
            <h3>${state.classroom.name}</h3>
            <p>${state.classroom.courseName || "未設定課程名稱"}</p>
            <span class="class-code">${state.classroom.classCode}</span>
          </div>
          <span class="assignment-score">${state.students.length} students</span>
        </article>
      `
      : `<p class="empty-state">找不到教室。</p>`;
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

  function renderAssignments() {
    const panel = document.getElementById("teacherAssignmentPanel");

    if (!state.assignments.length) {
      panel.innerHTML = `<p class="empty-state">尚未指派作業。</p>`;
      return;
    }

    panel.innerHTML = `
      <div class="assignment-list">
        ${state.assignments.map((assignment) => {
          const submissions = assignment.submissions || [];
          const submittedCount = submissions.length;
          const averageScore = submittedCount
            ? (submissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) / submittedCount).toFixed(1)
            : "0";
          const maxTotal = submissions[0] ? submissions[0].total : getAssignmentQuestions(assignment.algorithm).length;
          const bestScore = submittedCount
            ? Math.max(...submissions.map((submission) => Number(submission.score || 0)))
            : 0;
          const studentRows = state.students.length
            ? state.students.map((student) => {
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
                    <p>送出時間：${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "未記錄"}</p>
                  </div>
                  <span class="assignment-score">${submission.score}/${submission.total}</span>
                </article>
              `;
            }).join("")
            : `<p class="empty-state">此教室尚未加入學生。</p>`;

          return `
            <article class="assignment-item">
              <div class="assignment-grade-card">
                <div class="section-heading">
                  <div>
                    <h3>${assignment.title}</h3>
                    <p>Algorithm: ${assignment.algorithm}</p>
                    <p>${formatDueDate(assignment.dueDate)}</p>
                  </div>
                  <button class="ghost-btn" type="button" data-edit-assignment="${assignment.id}">修改作業</button>
                </div>
                <div class="grade-summary-grid">
                  <div><span>繳交狀態</span><strong>${submittedCount}/${state.students.length}</strong></div>
                  <div><span>平均分數</span><strong>${averageScore}/${maxTotal}</strong></div>
                  <div><span>最高分</span><strong>${bestScore}/${maxTotal}</strong></div>
                </div>
                <div class="question-accuracy">
                  <h4>題目答對率</h4>
                  ${buildQuestionStats(assignment)}
                </div>
                <div class="assignment-results">
                  <h4>學生分數</h4>
                  ${studentRows}
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function resetForm() {
    document.getElementById("editingAssignmentId").value = "";
    document.getElementById("assignmentTitleInput").value = "";
    document.getElementById("assignmentAlgorithmInput").value = "bubble";
    document.getElementById("assignmentDueDateInput").value = "";
    document.getElementById("assignmentFormTitle").textContent = "指派作業";
    document.getElementById("assignmentSubmitBtn").textContent = "指派作業";
    document.getElementById("cancelEditAssignmentBtn").classList.add("hidden");
  }

  function fillEditForm(assignmentId) {
    const assignment = state.assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
      return;
    }

    document.getElementById("editingAssignmentId").value = assignment.id;
    document.getElementById("assignmentTitleInput").value = assignment.title;
    document.getElementById("assignmentAlgorithmInput").value = assignment.algorithm;
    document.getElementById("assignmentDueDateInput").value = assignment.dueDate || "";
    document.getElementById("assignmentFormTitle").textContent = "修改作業";
    document.getElementById("assignmentSubmitBtn").textContent = "儲存修改";
    document.getElementById("cancelEditAssignmentBtn").classList.remove("hidden");
    document.getElementById("assignmentTitleInput").focus();
  }

  async function refresh() {
    state.classroom = await loadClassroom();

    if (!state.classroom) {
      renderClassroomSummary();
      document.getElementById("teacherAssignmentPanel").innerHTML = `<p class="empty-state">請回教師中心重新選擇教室。</p>`;
      return;
    }

    state.students = await loadStudents();
    state.assignments = await loadAssignments();
    renderClassroomSummary();
    renderAssignments();
  }

  function bindEvents() {
    document.getElementById("teacherAssignmentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const editingId = document.getElementById("editingAssignmentId").value;
      const payload = {
        requesterId: state.session.id,
        classroomId: state.classroomId,
        title: document.getElementById("assignmentTitleInput").value.trim(),
        algorithm: document.getElementById("assignmentAlgorithmInput").value,
        dueDate: document.getElementById("assignmentDueDateInput").value,
      };

      if (!payload.title) {
        setMessage("請輸入作業名稱。", "error");
        return;
      }

      try {
        if (editingId) {
          await updateAssignment(editingId, payload);
          setMessage("作業已更新。");
        } else {
          await createAssignment(payload);
          setMessage("作業已指派。");
        }

        resetForm();
        await refresh();
      } catch (error) {
        setMessage(error.message, "error");
      }
    });

    document.getElementById("cancelEditAssignmentBtn").addEventListener("click", resetForm);

    document.getElementById("teacherAssignmentPanel").addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-assignment]");

      if (!button) {
        return;
      }

      fillEditForm(button.dataset.editAssignment);
    });
  }

  async function init() {
    state.session = window.Auth.requireRole("teacher", {
      allowedRoles: ["teacher", "admin"],
    });

    if (!state.session) {
      return;
    }

    state.classroomId = new URLSearchParams(window.location.search).get("classroomId")
      || localStorage.getItem("activeTeacherClassroomId")
      || "";

    bindEvents();
    await refresh();
  }

  init();
})();
