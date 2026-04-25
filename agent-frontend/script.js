const API_BASE = "http://127.0.0.1:5000";

const state = {
    topic: "",
    questions: [],
    answers: [],
    currentIndex: 0,
    evaluation: null,
    dashboard: null,
    charts: {
        scoreHistory: null,
        weakTopic: null
    }
};

const el = {
    screens: document.querySelectorAll(".screen"),
    topicInput: document.getElementById("topic-input"),
    startBtn: document.getElementById("start-btn"),
    quizTopic: document.getElementById("quiz-topic"),
    progressText: document.getElementById("progress-text"),
    questionText: document.getElementById("question-text"),
    optionsList: document.getElementById("options-list"),
    nextBtn: document.getElementById("next-btn"),
    scoreText: document.getElementById("score-text"),
    weakAreasList: document.getElementById("weak-areas-list"),
    actionText: document.getElementById("action-text"),
    studyPlanBtn: document.getElementById("study-plan-btn"),
    dashboardBtn: document.getElementById("dashboard-btn"),
    restartBtn: document.getElementById("restart-btn"),
    studyPlanList: document.getElementById("study-plan-list"),
    planToDashboardBtn: document.getElementById("plan-to-dashboard-btn"),
    avgScoreText: document.getElementById("avg-score-text"),
    totalTestsText: document.getElementById("total-tests-text"),
    weakTopicsList: document.getElementById("weak-topics-list"),
    dashboardRestartBtn: document.getElementById("dashboard-restart-btn"),
    loadingOverlay: document.getElementById("loading-overlay"),
    errorToast: document.getElementById("error-toast")
};

function switchScreen(screenId) {
    el.screens.forEach((screen) => screen.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");
}

function setLoading(isLoading) {
    el.loadingOverlay.classList.toggle("hidden", !isLoading);
}

function showError(message) {
    el.errorToast.textContent = message;
    el.errorToast.classList.remove("hidden");
    window.setTimeout(() => el.errorToast.classList.add("hidden"), 3500);
}

async function apiGet(path) {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
        throw new Error(`API failed (${response.status})`);
    }
    return response.json();
}

async function apiPost(path, body) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`API failed (${response.status})`);
    }
    return response.json();
}

function renderQuestion() {
    const questionObj = state.questions[state.currentIndex];
    const total = state.questions.length;

    el.quizTopic.textContent = `Topic: ${state.topic}`;
    el.progressText.textContent = `Q${state.currentIndex + 1}/${total}`;
    el.questionText.textContent = questionObj.question;
    el.optionsList.innerHTML = "";

    questionObj.options.forEach((option) => {
        const optionButton = document.createElement("button");
        optionButton.className = "option-btn";
        optionButton.type = "button";
        optionButton.textContent = option;
        if (state.answers[state.currentIndex] === option) {
            optionButton.classList.add("selected");
        }

        optionButton.addEventListener("click", () => {
            state.answers[state.currentIndex] = option;
            [...el.optionsList.children].forEach((btn) => btn.classList.remove("selected"));
            optionButton.classList.add("selected");
        });

        el.optionsList.appendChild(optionButton);
    });

    el.nextBtn.textContent = state.currentIndex === total - 1 ? "Submit Quiz" : "Next";
}

async function startQuiz() {
    const topic = el.topicInput.value.trim();
    if (!topic) {
        showError("Please enter a topic to start.");
        return;
    }

    try {
        setLoading(true);
        const generated = await apiGet(`/generate?topic=${encodeURIComponent(topic)}`);

        if (!generated.questions || generated.questions.length === 0) {
            throw new Error("No questions returned for this topic.");
        }

        if (generated.error) {
            throw new Error(generated.error);
        }

        state.topic = generated.topic || topic;
        state.questions = generated.questions;
        state.answers = new Array(state.questions.length).fill(null);
        state.currentIndex = 0;
        state.evaluation = null;

        renderQuestion();
        switchScreen("quiz-screen");
    } catch (error) {
        showError(error.message || "Unable to generate quiz.");
    } finally {
        setLoading(false);
    }
}

async function goNext() {
    if (!state.answers[state.currentIndex]) {
        showError("Select an option before moving forward.");
        return;
    }

    if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex += 1;
        renderQuestion();
        return;
    }

    try {
        setLoading(true);
        const evaluation = await apiPost("/evaluate", {
            topic: state.topic,
            questions: state.questions,
            answers: state.answers
        });
        state.evaluation = evaluation;
        renderResult();
        switchScreen("result-screen");
    } catch (error) {
        showError(error.message || "Failed to evaluate quiz.");
    } finally {
        setLoading(false);
    }
}

function renderResult() {
    const evaluation = state.evaluation;
    el.scoreText.textContent = `${evaluation.score}/${evaluation.total}`;
    el.actionText.textContent = evaluation.action || "practice";
    el.weakAreasList.innerHTML = "";

    const weakAreas = evaluation.weak_areas || [];
    if (weakAreas.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No weak areas detected. Great work!";
        el.weakAreasList.appendChild(li);
    } else {
        weakAreas.forEach((area) => {
            const li = document.createElement("li");
            li.textContent = area;
            el.weakAreasList.appendChild(li);
        });
    }
}

async function loadStudyPlan() {
    try {
        setLoading(true);
        const plan = await apiGet("/learning-path");
        el.studyPlanList.innerHTML = "";

        Object.entries(plan).forEach(([day, content]) => {
            const card = document.createElement("article");
            card.className = "mini-card";
            card.innerHTML = `<p class="mini-title">${day}</p><p>${content}</p>`;
            el.studyPlanList.appendChild(card);
        });

        switchScreen("study-plan-screen");
    } catch (error) {
        showError(error.message || "Unable to load study plan.");
    } finally {
        setLoading(false);
    }
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history.map((item, index) => {
        if (typeof item === "number") {
            return { label: `Test ${index + 1}`, value: item };
        }

        const total = Number(item.total ?? item.max ?? 0);
        const score = Number(item.score ?? item.value ?? 0);
        const label = item.label || item.topic || `Test ${index + 1}`;
        return {
            label,
            value: total > 0 ? score / total : score
        };
    });
}

function buildWeakTopicFrequency(weakTopics) {
    if (!Array.isArray(weakTopics)) {
        return {};
    }
    return weakTopics.reduce((acc, topic) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
    }, {});
}

function destroyCharts() {
    if (state.charts.scoreHistory) {
        state.charts.scoreHistory.destroy();
    }
    if (state.charts.weakTopic) {
        state.charts.weakTopic.destroy();
    }
}

function renderDashboardCharts(dashboardData) {
    destroyCharts();

    const history = normalizeHistory(dashboardData.history);
    const scoreCtx = document.getElementById("score-history-chart").getContext("2d");
    const weakCtx = document.getElementById("weak-topic-chart").getContext("2d");

    state.charts.scoreHistory = new Chart(scoreCtx, {
        type: "line",
        data: {
            labels: history.map((entry) => entry.label),
            datasets: [{
                label: "Score",
                data: history.map((entry) => entry.value),
                borderColor: "#9c88ff",
                backgroundColor: "rgba(156, 136, 255, 0.25)",
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#f8faff" } } },
            scales: {
                x: { ticks: { color: "#d4ddff" }, grid: { color: "rgba(255,255,255,0.08)" } },
                y: { ticks: { color: "#d4ddff" }, grid: { color: "rgba(255,255,255,0.08)" } }
            }
        }
    });

    const weakMap = buildWeakTopicFrequency(dashboardData.weak_topics);
    state.charts.weakTopic = new Chart(weakCtx, {
        type: "bar",
        data: {
            labels: Object.keys(weakMap),
            datasets: [{
                label: "Weak Frequency",
                data: Object.values(weakMap),
                backgroundColor: "rgba(89, 190, 255, 0.55)",
                borderColor: "#59beff",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#f8faff" } } },
            scales: {
                x: { ticks: { color: "#d4ddff" }, grid: { color: "rgba(255,255,255,0.08)" } },
                y: { ticks: { color: "#d4ddff" }, grid: { color: "rgba(255,255,255,0.08)" }, beginAtZero: true }
            }
        }
    });
}

async function loadDashboard() {
    try {
        setLoading(true);
        const dashboard = await apiGet("/dashboard");
        state.dashboard = dashboard;

        el.avgScoreText.textContent = String(dashboard.average_score ?? 0);
        el.totalTestsText.textContent = String(dashboard.total_tests ?? 0);
        el.weakTopicsList.innerHTML = "";

        const weakTopics = dashboard.weak_topics || [];
        if (weakTopics.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No weak topics available.";
            el.weakTopicsList.appendChild(li);
        } else {
            weakTopics.forEach((topic) => {
                const li = document.createElement("li");
                li.textContent = topic;
                el.weakTopicsList.appendChild(li);
            });
        }

        renderDashboardCharts(dashboard);
        switchScreen("dashboard-screen");
    } catch (error) {
        showError(error.message || "Unable to load dashboard.");
    } finally {
        setLoading(false);
    }
}

function resetToLanding() {
    state.topic = "";
    state.questions = [];
    state.answers = [];
    state.currentIndex = 0;
    state.evaluation = null;
    el.topicInput.value = "";
    switchScreen("landing-screen");
}

function bindEvents() {
    el.startBtn.addEventListener("click", startQuiz);
    el.nextBtn.addEventListener("click", goNext);
    el.studyPlanBtn.addEventListener("click", loadStudyPlan);
    el.dashboardBtn.addEventListener("click", loadDashboard);
    el.planToDashboardBtn.addEventListener("click", loadDashboard);
    el.restartBtn.addEventListener("click", resetToLanding);
    el.dashboardRestartBtn.addEventListener("click", resetToLanding);
}

document.addEventListener("DOMContentLoaded", bindEvents);