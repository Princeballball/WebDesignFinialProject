(function () {
  async function saveQuizResult(result) {
    const session = window.Auth ? window.Auth.getSession() : null;
    const payload = {
      ...result,
      userId: result.userId || (session && session.id),
      classroomId: result.classroomId || localStorage.getItem("activeClassroomId") || "",
    };

    const response = await fetch("/api/quiz-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Quiz result was not saved.");
    }

    return response.json();
  }

  async function loadQuizResults(userId) {
    const query = new URLSearchParams({ userId });
    const response = await fetch(`/api/quiz-results?${query.toString()}`);

    if (!response.ok) {
      throw new Error("Quiz results could not be loaded.");
    }

    return response.json();
  }

  window.QuizApi = {
    saveQuizResult,
    loadQuizResults,
  };
})();
