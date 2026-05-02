(function () {
  const LOCAL_CLASSROOMS_KEY = "sortVisualizerLocalClassrooms";
  const LOCAL_USERS_KEY = "sortVisualizerLocalUsers";

  let teacherSession = null;
  let selectedClassroomId = "";

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
    return JSON.parse(localStorage.getItem(LOCAL_CLASSROOMS_KEY) || "[]").map(normalizeClassroom);
  }

  function saveLocalClassrooms(classrooms) {
    localStorage.setItem(LOCAL_CLASSROOMS_KEY, JSON.stringify(classrooms.map(normalizeClassroom)));
  }

  function getLocalUsers() {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
  }

  function normalizeClassroom(classroom) {
    const { studentIds, ...rest } = classroom;
    return {
      ...rest,
      students: classroom.students || studentIds || [],
    };
  }

  function makeClassCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const numbers = "23456789";
    return Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("")
      + Array.from({ length: 3 }, () => numbers[Math.floor(Math.random() * numbers.length)]).join("");
  }

  function canManageLocalClassroom(user, classroom) {
    return user && (user.role === "admin" || classroom.teacherId === user.id);
  }

  async function createClassroom({ name, courseName, teacherId }) {
    try {
      return await requestJson("/api/classrooms", {
        method: "POST",
        body: JSON.stringify({ name, courseName, teacherId }),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const classrooms = getLocalClassrooms();
      const classroom = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name,
        courseName,
        teacherId,
        classCode: makeClassCode(),
        students: [],
        createdAt: new Date().toISOString(),
      };
      saveLocalClassrooms([...classrooms, classroom]);
      return { classroom, source: "local" };
    }
  }

  async function loadClassrooms(user) {
    try {
      const query = new URLSearchParams({ userId: user.id, role: user.role });
      return await requestJson(`/api/classrooms?${query.toString()}`);
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const classrooms = getLocalClassrooms().filter((classroom) => {
        if (user.role === "admin") {
          return true;
        }

        if (user.role === "teacher") {
          return classroom.teacherId === user.id;
        }

        return classroom.students.includes(user.id);
      });

      return { classrooms, source: "local" };
    }
  }

  async function joinClassroom({ classCode, studentId }) {
    try {
      return await requestJson("/api/classrooms/join", {
        method: "POST",
        body: JSON.stringify({ classCode, studentId }),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const classrooms = getLocalClassrooms();
      const classroom = classrooms.find((item) => item.classCode === classCode.toUpperCase());

      if (!classroom) {
        throw new Error("找不到這個 classCode。");
      }

      if (!classroom.students.includes(studentId)) {
        classroom.students.push(studentId);
      }

      saveLocalClassrooms(classrooms);
      return { classroom, source: "local" };
    }
  }

  async function loadClassroomStudents(classroomId) {
    try {
      return await requestJson(`/api/classrooms/${classroomId}/students`);
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const classroom = getLocalClassrooms().find((item) => item.id === classroomId);
      const students = getLocalUsers()
        .filter((user) => classroom && classroom.students.includes(user.id))
        .map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
        }));

      return { classroom, students, quizResults: [], source: "local" };
    }
  }

  async function addStudentToClassroom(classroomId) {
    const input = document.getElementById("teacherStudentEmailInput");
    const message = document.getElementById("teacherStudentMessage");
    const studentEmail = input.value.trim();

    if (!studentEmail) {
      setMessage(message, "請輸入學生 email。", "error");
      return;
    }

    try {
      await requestJson(`/api/classrooms/${classroomId}/students`, {
        method: "POST",
        body: JSON.stringify({
          requesterId: teacherSession.id,
          studentEmail,
        }),
      });
    } catch (error) {
      if (error.isHttpError) {
        setMessage(message, error.message, "error");
        return;
      }

      try {
        addLocalStudentToClassroom(classroomId, studentEmail);
      } catch (localError) {
        setMessage(message, localError.message, "error");
        return;
      }
    }

    input.value = "";
    setMessage(message, "學生已加入教室。");
    await renderStudents(classroomId);
  }

  function addLocalStudentToClassroom(classroomId, studentEmail) {
    const classrooms = getLocalClassrooms();
    const classroom = classrooms.find((item) => item.id === classroomId);
    const matchingUsers = getLocalUsers().filter((item) => item.email === studentEmail);
    const user = matchingUsers.find((item) => item.role === "student");

    if (!classroom || !canManageLocalClassroom(teacherSession, classroom)) {
      throw new Error("沒有權限操作此教室。");
    }

    if (!matchingUsers.length) {
      throw new Error("找不到此學生帳號");
    }

    if (!user) {
      throw new Error("此帳號不是學生");
    }

    if (classroom.students.includes(user.id)) {
      throw new Error("學生已在此教室");
    }

    classroom.students.push(user.id);
    saveLocalClassrooms(classrooms);
  }

  async function removeStudentFromClassroom(classroomId, studentId) {
    if (!confirm("確定要將這位學生移出教室嗎？")) {
      return;
    }

    try {
      await requestJson(`/api/classrooms/${classroomId}/students/${studentId}`, {
        method: "DELETE",
        body: JSON.stringify({
          requesterId: teacherSession.id,
        }),
      });
    } catch (error) {
      if (error.isHttpError) {
        const message = document.getElementById("teacherStudentMessage");
        setMessage(message, error.message, "error");
        return;
      }

      const classrooms = getLocalClassrooms();
      const classroom = classrooms.find((item) => item.id === classroomId);

      if (classroom && canManageLocalClassroom(teacherSession, classroom)) {
        classroom.students = classroom.students.filter((id) => id !== studentId);
        saveLocalClassrooms(classrooms);
      }
    }

    await renderStudents(classroomId);
  }

  function setMessage(element, message, type = "success") {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = `dashboard-message is-${type}`;
  }

  function classroomMarkup(classroom, showManageButton) {
    return `
      <div>
        <h3>${classroom.name}</h3>
        <p>${classroom.courseName || "未設定課程名稱"}</p>
        <span class="class-code">${classroom.classCode}</span>
      </div>
      ${
        showManageButton
          ? `<button class="ghost-btn" type="button" data-classroom-id="${classroom.id}">查看學生</button>`
          : `<a class="primary-link" href="../homepage.html" data-active-classroom-id="${classroom.id}">開始練習</a>`
      }
    `;
  }

  function renderClassrooms(container, classrooms, showManageButton = false) {
    if (!container) {
      return;
    }

    if (!classrooms.length) {
      container.innerHTML = `<p class="empty-state">目前沒有教室。</p>`;
      return;
    }

    container.innerHTML = "";
    classrooms.forEach((classroom) => {
      const item = document.createElement("article");
      item.className = "class-item";
      item.innerHTML = classroomMarkup(classroom, showManageButton);
      container.appendChild(item);
    });
  }

  async function renderTeacherClassrooms() {
    const list = document.getElementById("teacherClassroomList");

    try {
      const { classrooms } = await loadClassrooms(teacherSession);
      renderClassrooms(list, classrooms, true);
    } catch (error) {
      list.innerHTML = `<p class="empty-state">無法載入教室資料：${error.message}</p>`;
    }
  }

  async function selectClassroom(classroomId) {
    selectedClassroomId = classroomId;
    const { classrooms } = await loadClassrooms(teacherSession);
    const classroom = classrooms.find((item) => item.id === classroomId);
    const studentPanelTitle = document.getElementById("studentPanelTitle");
    const studentsContainer = document.getElementById("classStudentList");

    studentPanelTitle.textContent = classroom ? `${classroom.name} 學生名單` : "學生名單";
    studentsContainer.classList.remove("empty-state");
    studentsContainer.innerHTML = `
      <form id="teacherAddStudentForm" class="inline-form student-add-form">
        <input id="teacherStudentEmailInput" type="email" placeholder="輸入學生 email" />
        <button class="primary-btn" type="submit">加入學生</button>
      </form>
      <p id="teacherStudentMessage" class="dashboard-message hidden"></p>
      <div id="teacherStudentRows" class="student-list"></div>
    `;

    document.getElementById("teacherAddStudentForm").addEventListener("submit", (event) => {
      event.preventDefault();
      addStudentToClassroom(classroomId);
    });

    await renderStudents(classroomId);
  }

  async function renderStudents(classroomId) {
    const rows = document.getElementById("teacherStudentRows");

    if (!rows) {
      return;
    }

    try {
      const { students, quizResults } = await loadClassroomStudents(classroomId);

      if (!students.length) {
        rows.innerHTML = `<p class="empty-state">這個教室目前還沒有學生。</p>`;
        return;
      }

      rows.innerHTML = "";
      students.forEach((student) => {
        const attempts = quizResults.filter((result) => result.userId === student.id);
        const item = document.createElement("article");
        item.className = "student-item";
        item.innerHTML = `
          <div>
            <h3>${student.email}</h3>
            <p>Quiz records: ${attempts.length}</p>
          </div>
          <button class="danger-btn" type="button" data-remove-student="${student.id}" data-classroom-id="${classroomId}">
            移除
          </button>
        `;
        rows.appendChild(item);
      });
    } catch (error) {
      rows.innerHTML = `<p class="empty-state">無法載入學生資料：${error.message}</p>`;
    }
  }

  function initStudentDashboard() {
    const emailLabel = document.getElementById("studentEmail");
    const list = document.getElementById("studentClassroomList");
    const form = document.getElementById("joinClassroomForm");
    const input = document.getElementById("classCodeInput");
    const message = document.getElementById("studentMessage");

    if (!form) {
      return;
    }

    const session = window.Auth.requireRole("student");
    if (!session) {
      return;
    }

    emailLabel.textContent = session.email;

    async function refresh() {
      try {
        const { classrooms } = await loadClassrooms(session);
        renderClassrooms(list, classrooms);
      } catch (error) {
        list.innerHTML = `<p class="empty-state">無法載入教室資料：${error.message}</p>`;
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const classCode = input.value.trim().toUpperCase();

      if (!classCode) {
        setMessage(message, "請輸入 classCode。", "error");
        return;
      }

      try {
        await joinClassroom({ classCode, studentId: session.id });
        input.value = "";
        setMessage(message, "已加入教室。");
        await refresh();
      } catch (error) {
        setMessage(message, error.message, "error");
      }
    });

    list.addEventListener("click", (event) => {
      const link = event.target.closest("[data-active-classroom-id]");

      if (!link) {
        return;
      }

      localStorage.setItem("activeClassroomId", link.dataset.activeClassroomId);
    });

    refresh();
  }

  function initTeacherDashboard() {
    const emailLabel = document.getElementById("teacherEmail");
    const form = document.getElementById("createClassroomForm");
    const nameInput = document.getElementById("classroomNameInput");
    const courseInput = document.getElementById("courseNameInput");
    const list = document.getElementById("teacherClassroomList");
    const studentsContainer = document.getElementById("classStudentList");
    const message = document.getElementById("teacherMessage");
    const adminConsoleBtn = document.getElementById("adminConsoleBtn");
    const roleLabel = document.getElementById("teacherRoleLabel");
    const pageTitle = document.getElementById("teacherPageTitle");

    if (!form) {
      return;
    }

    teacherSession = window.Auth.requireRole("teacher", {
      allowedRoles: ["teacher", "admin"],
    });

    if (!teacherSession) {
      return;
    }

    emailLabel.textContent = teacherSession.email;

    if (teacherSession.role === "admin") {
      adminConsoleBtn.classList.remove("hidden");
      roleLabel.textContent = "Admin";
      pageTitle.textContent = "管理員測試模式";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();

      if (!name) {
        setMessage(message, "請輸入教室名稱。", "error");
        return;
      }

      try {
        const { classroom } = await createClassroom({
          name,
          courseName: courseInput.value.trim(),
          teacherId: teacherSession.id,
        });
        nameInput.value = "";
        courseInput.value = "";
        setMessage(message, `已建立教室，classCode：${classroom.classCode}`);
        await renderTeacherClassrooms();
      } catch (error) {
        setMessage(message, error.message, "error");
      }
    });

    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-classroom-id]");

      if (!button) {
        return;
      }

      await selectClassroom(button.dataset.classroomId);
    });

    studentsContainer.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-remove-student]");

      if (!button) {
        return;
      }

      await removeStudentFromClassroom(button.dataset.classroomId, button.dataset.removeStudent);
    });

    renderTeacherClassrooms();
  }

  window.Classroom = {
    createClassroom,
    loadClassrooms,
    joinClassroom,
    loadClassroomStudents,
    renderTeacherClassrooms,
    selectClassroom,
    renderStudents,
    addStudentToClassroom,
    removeStudentFromClassroom,
  };

  initStudentDashboard();
  initTeacherDashboard();
})();
