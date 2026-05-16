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

  function renderAssignments() {
    const panel = document.getElementById("teacherAssignmentPanel");

    if (!state.assignments.length) {
      panel.innerHTML = `<p class="empty-state">尚未指派作業。</p>`;
      return;
    }

    panel.innerHTML = `
      <div class="assignment-list">
        ${state.assignments.map((assignment, index) => {
          const submissions = assignment.submissions || [];
          const submittedCount = submissions.length;
          const averageScore = submittedCount
            ? (submissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) / submittedCount).toFixed(1)
            : "0";
          const maxTotal = submissions[0] ? submissions[0].total : getAssignmentQuestions(assignment.algorithm).length;
          const bestScore = submittedCount
            ? Math.max(...submissions.map((submission) => Number(submission.score || 0)))
            : 0;
          const reportUrl = `./teacher_assignment_report.html?${new URLSearchParams({
            classroomId: state.classroomId,
            assignmentId: assignment.id,
          }).toString()}`;
          const detailId = `assignmentDetail${index}`;

          return `
            <article class="assignment-item assignment-summary-item is-collapsed">
              <button
                class="assignment-summary-toggle"
                type="button"
                aria-expanded="false"
                aria-controls="${detailId}"
                data-toggle-assignment
              >
                <div>
                  <h3>${assignment.title}</h3>
                  <p>Algorithm: ${assignment.algorithm} · ${formatDueDate(assignment.dueDate)}</p>
                </div>
                <span class="collapse-indicator">展開</span>
              </button>

              <div id="${detailId}" class="assignment-summary-detail hidden">
                <div class="assignment-mini-metrics">
                  <span>繳交 ${submittedCount}/${state.students.length}</span>
                  <span>平均 ${averageScore}/${maxTotal}</span>
                  <span>最高 ${bestScore}/${maxTotal}</span>
                </div>
                <div class="assignment-item-actions">
                  <a class="primary-link" href="${reportUrl}">查看成績</a>
                  <button class="ghost-btn" type="button" data-edit-assignment="${assignment.id}">修改作業</button>
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

  function setCollapsibleContent(toggle, expanded) {
    const content = document.getElementById(toggle.getAttribute("aria-controls"));
    const indicator = toggle.querySelector(".collapse-indicator");

    toggle.setAttribute("aria-expanded", String(expanded));

    if (content) {
      content.classList.toggle("hidden", !expanded);
    }

    if (indicator) {
      indicator.textContent = expanded ? "收合" : "展開";
    }
  }

  function openCollapsibleContent(contentId) {
    const toggle = document.querySelector(`[aria-controls="${contentId}"]`);

    if (toggle) {
      setCollapsibleContent(toggle, true);
    }
  }

  function toggleAssignmentCard(toggle) {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    const item = toggle.closest(".assignment-summary-item");

    setCollapsibleContent(toggle, expanded);

    if (item) {
      item.classList.toggle("is-collapsed", !expanded);
    }
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
    openCollapsibleContent("assignmentFormContent");
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
    document.querySelectorAll(".collapsible-card-toggle").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        setCollapsibleContent(toggle, toggle.getAttribute("aria-expanded") !== "true");
      });
    });

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
      const assignmentToggle = event.target.closest("[data-toggle-assignment]");

      if (assignmentToggle) {
        toggleAssignmentCard(assignmentToggle);
        return;
      }

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
