(function () {
  const LOCAL_USERS_KEY = "sortVisualizerLocalUsers";

  function getSession() {
    return window.Auth.getSession();
  }

  function getLocalUsers() {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
  }

  function saveLocalUsers(users) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  }

  function publicLocalUser(user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

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

  async function loadUsers(adminId) {
    try {
      const query = new URLSearchParams({ adminId });
      return await requestJson(`/api/admin/users?${query.toString()}`);
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      return { users: getLocalUsers().map(publicLocalUser), source: "local" };
    }
  }

  async function createUser({ adminId, email, password, role }) {
    try {
      return await requestJson("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ adminId, email, password, role }),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      const users = getLocalUsers();
      const exists = users.some((user) => user.email === email && user.role === role);

      if (exists) {
        throw new Error("此角色已存在相同帳號。");
      }

      const user = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        email,
        password,
        role,
        createdAt: new Date().toISOString(),
      };
      saveLocalUsers([...users, user]);
      return { user: publicLocalUser(user), source: "local" };
    }
  }

  async function deleteUser({ adminId, userId }) {
    try {
      return await requestJson(`/api/admin/users/${userId}`, {
        method: "DELETE",
        body: JSON.stringify({ adminId }),
      });
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }

      saveLocalUsers(getLocalUsers().filter((user) => user.id !== userId));
      return { ok: true, source: "local" };
    }
  }

  function setMessage(element, message, type = "success") {
    element.textContent = message;
    element.className = `dashboard-message is-${type}`;
  }

  function renderUsers(container, users, currentAdminId) {
    if (!users.length) {
      container.innerHTML = `<p class="empty-state">目前沒有使用者。</p>`;
      return;
    }

    container.innerHTML = "";
    users.forEach((user) => {
      const item = document.createElement("article");
      const canDelete = user.id !== currentAdminId;
      item.className = "admin-user-item";
      item.innerHTML = `
        <div>
          <h3>${user.email}</h3>
          <p>ID: ${user.id}</p>
          <span class="role-badge is-${user.role}">${user.role}</span>
        </div>
        ${
          canDelete
            ? `<button class="danger-btn" type="button" data-delete-user="${user.id}">刪除</button>`
            : `<span class="empty-state">目前帳號</span>`
        }
      `;
      container.appendChild(item);
    });
  }

  function initAdminDashboard() {
    const form = document.getElementById("adminCreateUserForm");

    if (!form) {
      return;
    }

    const session = window.Auth.requireRole("admin");

    if (!session) {
      return;
    }

    const adminEmail = document.getElementById("adminEmail");
    const emailInput = document.getElementById("adminUserEmail");
    const passwordInput = document.getElementById("adminUserPassword");
    const roleInput = document.getElementById("adminUserRole");
    const message = document.getElementById("adminMessage");
    const userList = document.getElementById("adminUserList");
    const refreshBtn = document.getElementById("refreshUsersBtn");

    adminEmail.textContent = session.email;

    async function refresh() {
      try {
        const { users } = await loadUsers(session.id);
        renderUsers(userList, users, session.id);
      } catch (error) {
        userList.innerHTML = `<p class="empty-state">無法載入使用者：${error.message}</p>`;
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const role = roleInput.value;

      if (!email || password.length < 6) {
        setMessage(message, "請輸入帳號，且密碼至少 6 個字。", "error");
        return;
      }

      try {
        await createUser({
          adminId: session.id,
          email,
          password,
          role,
        });
        emailInput.value = "";
        passwordInput.value = "";
        roleInput.value = "student";
        setMessage(message, "帳號已建立。");
        await refresh();
      } catch (error) {
        setMessage(message, error.message, "error");
      }
    });

    refreshBtn.addEventListener("click", refresh);

    userList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-user]");

      if (!button) {
        return;
      }

      try {
        await deleteUser({
          adminId: session.id,
          userId: button.dataset.deleteUser,
        });
        setMessage(message, "使用者已刪除。");
        await refresh();
      } catch (error) {
        setMessage(message, error.message, "error");
      }
    });

    refresh();
  }

  window.Admin = {
    loadUsers,
    createUser,
    deleteUser,
  };

  initAdminDashboard();
})();
