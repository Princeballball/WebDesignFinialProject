(function () {
  function getReviewData() {
    try {
      return JSON.parse(sessionStorage.getItem("assignmentReview") || "null");
    } catch (error) {
      return null;
    }
  }

  function renderMissingState() {
    document.getElementById("reviewTitle").textContent = "找不到詳解資料";
    document.getElementById("reviewMeta").textContent = "請回學生中心重新進入作業。";
    document.getElementById("reviewSummary").innerHTML = `<p class="empty-state">沒有可顯示的作答紀錄。</p>`;
  }

  function renderSummary(data) {
    document.getElementById("reviewTitle").textContent = data.assignment.title;
    document.getElementById("reviewMeta").textContent = `${data.assignment.algorithm} · 已送出`;
    document.getElementById("reviewSummary").innerHTML = `
      <dl>
        <div>
          <dt>作答狀態</dt>
          <dd>已完成</dd>
        </div>
        <div>
          <dt>分數</dt>
          <dd>${data.score}/${data.total}</dd>
        </div>
        <div>
          <dt>截止日期</dt>
          <dd>${data.assignment.dueDate || "沒有截止日期"}</dd>
        </div>
        <div>
          <dt>送出時間</dt>
          <dd>${new Date(data.submittedAt).toLocaleString()}</dd>
        </div>
      </dl>
    `;
  }

  function renderQuestions(data) {
    const container = document.getElementById("reviewQuestions");
    container.innerHTML = data.questions.map((question, index) => {
      const answer = data.answers[index];
      const isCorrect = answer && answer.isCorrect;

      return `
        <article id="review-question-${index}" class="assignment-question-card ${isCorrect ? "is-correct" : "is-wrong"}">
          <h2>${index + 1}. ${question.question}</h2>
          ${question.options.map((option) => {
            const selected = answer && answer.selectedAnswer === option;
            const correct = question.answer === option;
            return `
              <div class="review-option ${selected ? "is-selected" : ""} ${correct ? "is-answer" : ""}">
                <span>${option}</span>
                ${correct ? "<strong>正確答案</strong>" : ""}
                ${selected && !correct ? "<strong>你的答案</strong>" : ""}
              </div>
            `;
          }).join("")}
          <div class="review-explanation">
            <strong>${isCorrect ? "答對了" : "答錯了"}</strong>
            <p>${question.explanation}</p>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderNavigator(data) {
    const navigator = document.getElementById("reviewNavigator");
    navigator.innerHTML = data.answers.map((answer, index) => `
      <button class="question-nav-btn ${answer.isCorrect ? "is-answered" : "is-red"}" type="button" data-review-goto="${index}">
        ${index + 1}
      </button>
    `).join("");

    navigator.addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-goto]");

      if (!button) {
        return;
      }

      document.getElementById(`review-question-${button.dataset.reviewGoto}`).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function init() {
    const session = window.Auth.requireRole("student");

    if (!session) {
      return;
    }

    const data = getReviewData();

    if (!data) {
      renderMissingState();
      return;
    }

    renderSummary(data);
    renderQuestions(data);
    renderNavigator(data);
  }

  init();
})();
