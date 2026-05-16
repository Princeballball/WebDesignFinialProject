(function () {
  const API_BASE = "";
  const SESSION_KEY = "sortVisualizerSession";
  const LOCAL_USERS_KEY = "sortVisualizerLocalUsers";

  function safeParse(value) {
    try {
      return JSON.parse(value || "null");
    } catch (error) {
      return null;
    }
  }

  function getSession() {
    const appSession = safeParse(localStorage.getItem(SESSION_KEY));
    const currentUser = safeParse(localStorage.getItem("currentUser"))
      || safeParse(sessionStorage.getItem("currentUser"));

    if (appSession && appSession.id && appSession.role) {
      return appSession;
    }

    if (currentUser && currentUser.id && currentUser.role) {
      return currentUser;
    }

    return null;
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.setItem("currentUser", JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("currentUser");
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  }

  function getLocalUsers() {
    const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    const hasAdmin = users.some((user) => user.email === "admin" && user.role === "admin");

    if (hasAdmin) {
      return users;
    }

    const adminUser = {
      id: "local-admin",
      email: "admin",
      password: "yen-1019",
      role: "admin",
    };
    const seededUsers = [adminUser, ...users];
    saveLocalUsers(seededUsers);
    return seededUsers;
  }

  function saveLocalUsers(users) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  }

  async function requestJson(path, options) {
    const response = await fetch(`${API_BASE}${path}`, {
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

  function createLocalUser(email, password, role) {
    const users = getLocalUsers();
    const exists = users.some((user) => user.email === email && user.role === role);

    if (exists) {
      throw new Error("這個角色已註冊過此信箱。");
    }

    const user = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      email,
      password,
      role,
    };

    saveLocalUsers([...users, user]);
    return user;
  }

  function loginLocalUser(email, password, role) {
    const user = getLocalUsers().find(
      (item) => item.email === email && item.password === password && item.role === role,
    );

    if (!user) {
      throw new Error("找不到符合的帳號，請確認角色、信箱與密碼。");
    }

    return user;
  }

  async function registerUser({ email, password, role }) {
    try {
      return await requestJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      return { user: createLocalUser(email, password, role), source: "local" };
    }
  }

  async function loginUser({ email, password, role }) {
    const rolesToTry = role === "teacher" ? ["teacher", "admin"] : [role];

    try {
      let lastError;

      for (const loginRole of rolesToTry) {
        try {
          return await requestJson("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password, role: loginRole }),
          });
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      let lastError;

      for (const loginRole of rolesToTry) {
        try {
          return { user: loginLocalUser(email, password, loginRole), source: "local" };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    }
  }

  function redirectByRole(role) {
    const pagePrefix = window.location.pathname.includes("/pages/") ? "." : "./pages";
    const targets = {
      admin: `${pagePrefix}/dashboard_teacher.html`,
      teacher: `${pagePrefix}/dashboard_teacher.html`,
      student: `${pagePrefix}/dashboard_student.html`,
    };
    const target = targets[role] || `${pagePrefix}/dashboard_student.html`;
    window.location.href = target;
  }

  function showAccessGuard(message) {
    const guard = document.getElementById("authGuard");
    const guardMessage = document.getElementById("authGuardMessage");
    const content = document.getElementById("dashboardContent");

    if (content) {
      content.classList.add("hidden");
    }

    if (guardMessage && message) {
      guardMessage.textContent = message;
    }

    if (guard) {
      guard.classList.remove("hidden");
    }
  }

  function showDashboardContent() {
    const guard = document.getElementById("authGuard");
    const content = document.getElementById("dashboardContent");

    if (guard) {
      guard.classList.add("hidden");
    }

    if (content) {
      content.classList.remove("hidden");
    }
  }

  function normalizeRoles(role) {
    return Array.isArray(role) ? role : [role];
  }

  function requireRole(role, options = {}) {
    const allowedRoles = options.allowedRoles || normalizeRoles(role);
    const session = getSession();

    if (!session) {
      if (options.redirect) {
        window.location.href = "./index.html";
      } else {
        const messages = {
          admin: "請先登入後再使用管理員後台。",
          teacher: "請先登入後再使用教師教室管理。",
          student: "請先登入後再使用學生學習中心。",
        };
        showAccessGuard(messages[role] || "請先登入後再使用此頁面。");
      }

      return null;
    }

    if (!allowedRoles.includes(session.role)) {
      if (options.redirect) {
        window.location.href = "./index.html";
      } else {
        showAccessGuard(`目前登入角色是 ${session.role}，沒有權限進入這個頁面。`);
      }

      return null;
    }

    showDashboardContent();
    return session;
  }

  function initDashboardGuard() {
    const requiredRole = document.body.dataset.requiredRole;
    const allowedRoles = document.body.dataset.allowedRoles
      ? document.body.dataset.allowedRoles.split(" ").filter(Boolean)
      : null;

    if (!requiredRole) {
      return;
    }

    requireRole(requiredRole, { allowedRoles });
  }

  function initAuthPage() {
    const form = document.getElementById("authForm");

    if (!form) {
      return;
    }

    const authMode = document.getElementById("authMode");
    const roleInput = document.getElementById("role");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const confirmPasswordGroup = document.getElementById("confirmPasswordGroup");
    const confirmPassword = document.getElementById("confirmPassword");
    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");
    const confirmPasswordError = document.getElementById("confirmPasswordError");
    const togglePassword = document.getElementById("togglePassword");
    const submitBtn = document.getElementById("submitBtn");
    const formMessage = document.getElementById("formMessage");
    const modeTabs = document.querySelectorAll(".mode-tab");
    const roleTabs = document.querySelectorAll(".role-tab");

    function updateSubmitText() {
      const modeText = authMode.value === "login" ? "登入" : "註冊";
      const roleNames = {
        admin: "管理員",
        teacher: "教師",
        student: "學生",
      };
      const roleText = roleNames[roleInput.value] || "學生";
      submitBtn.textContent = `${modeText}${roleText}帳號`;
    }

    function updateModeFields() {
      const isRegister = authMode.value === "register";
      confirmPasswordGroup.classList.toggle("hidden", !isRegister);
      password.autocomplete = isRegister ? "new-password" : "current-password";

      if (!isRegister) {
        confirmPassword.value = "";
        confirmPasswordError.classList.add("hidden");
      }
    }

    function setMessage(message, type) {
      formMessage.textContent = message;
      formMessage.className = `form-message is-${type}`;
    }

    modeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        authMode.value = tab.id === "registerModeBtn" ? "register" : "login";
        modeTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
        formMessage.classList.add("hidden");
        updateModeFields();
        updateSubmitText();
      });
    });

    roleTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        roleInput.value = tab.dataset.role;
        roleTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
        updateSubmitText();
      });
    });

    togglePassword.addEventListener("click", () => {
      const isPassword = password.type === "password";
      password.type = isPassword ? "text" : "password";
      togglePassword.textContent = isPassword ? "隱藏" : "顯示";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const emailValue = email.value.trim();
      const passwordValue = password.value.trim();
      const confirmPasswordValue = confirmPassword.value.trim();
      const isRegister = authMode.value === "register";
      const role = roleInput.value;
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailIsValid = role === "teacher" && emailValue === "admin"
        ? true
        : emailPattern.test(emailValue);
      const passwordMatches = !isRegister || passwordValue === confirmPasswordValue;
      let isValid = true;

      emailError.classList.toggle("hidden", emailIsValid);
      passwordError.classList.toggle("hidden", passwordValue.length >= 6);
      confirmPasswordError.classList.toggle("hidden", passwordMatches);

      if (!emailIsValid || passwordValue.length < 6 || !passwordMatches) {
        isValid = false;
      }

      if (isRegister && emailValue === "admin") {
        setMessage("管理員帳號由系統初始化建立，請直接使用 Teacher 模式登入。", "error");
        return;
      }

      if (!isValid) {
        setMessage("請先修正欄位內容。", "error");
        return;
      }

      submitBtn.disabled = true;
      setMessage("處理中...", "success");

      try {
        const action = authMode.value === "register" ? registerUser : loginUser;
        const { user } = await action({ email: emailValue, password: passwordValue, role });
        setSession({
          id: user.id,
          email: user.email,
          role: user.role,
        });
        redirectByRole(user.role);
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        submitBtn.disabled = false;
      }
    });

    updateSubmitText();
    updateModeFields();
  }

  function initLogout() {
    const logoutBtn = document.getElementById("logoutBtn");

    if (!logoutBtn) {
      return;
    }

    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "./index.html";
    });
  }

  window.Auth = {
    getSession,
    requireRole,
    clearSession,
    loginUser,
    registerUser,
  };

  initAuthPage();
  initLogout();
  initDashboardGuard();
})();
