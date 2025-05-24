// Game State Management
class QuizGame {
  constructor() {
    this.levels =
      JSON.parse(localStorage.getItem("quizLevels")) ||
      this.initializeDefaultLevels();
    this.gameStats = JSON.parse(localStorage.getItem("gameStats")) || {
      totalScore: 0,
      completedLevels: 0,
      streak: 0,
      totalTime: 0,
      unlockedLevels: 1,
    };

    this.settings = JSON.parse(localStorage.getItem("gameSettings")) || {
      questionTime: 30,
      showFeedback: true,
      shuffleQuestions: true,
      darkMode: false,
    };

    this.currentQuiz = {
      level: 0,
      questions: [],
      currentQuestion: 0,
      score: 0,
      startTime: 0,
      timeRemaining: this.settings.questionTime,
      answers: [],
    };

    this.timerInterval = null;
    this.init();
  }

  initializeDefaultLevels() {
    return [];
  }

  init() {
    this.updateUI();
    this.generateParticles();
    this.bindEvents();
    if (window.location.pathname.includes("quiz.html")) {
      this.handleQuizPage();
    }
    if (window.location.pathname.includes("index.html")) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("open") === "settings") {
        this.showSettings();
      }
    }
    this.loadSettings();
  }

  bindEvents() {
    // Form submissions
    const addQuestionForm = document.getElementById("addQuestionForm");
    if (addQuestionForm) {
      addQuestionForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addQuestion();
      });
    }

    const addLevelForm = document.getElementById("addLevelForm");
    if (addLevelForm) {
      addLevelForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addLevel();
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (
          document.getElementById("quizModal") &&
          !document.getElementById("quizModal").classList.contains("hidden")
        ) {
          this.closeQuiz();
        } else if (
          document.getElementById("resultModal") &&
          !document.getElementById("resultModal").classList.contains("hidden")
        ) {
          this.closeResult();
        } else if (
          document.getElementById("settingsModal") &&
          !document.getElementById("settingsModal").classList.contains("hidden")
        ) {
          this.closeSettings();
        } else if (
          document.getElementById("questionContainer") &&
          !document
            .getElementById("questionContainer")
            .classList.contains("hidden")
        ) {
          hideQuestionContainer();
        }
      }
    });

    // Bind settings form submission
    const settingsForm = document.getElementById("settingsForm");
    if (settingsForm) {
      settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }
  }

  handleQuizPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get("section");
    switch (section) {
      case "addLevel":
        showAddLevel();
        break;
      case "addQuestion":
        showAddQuestion();
        break;
      case "levels":
      default:
        showLevelSelect();
        break;
    }
    this.updateLevelSelect();
  }

  generateParticles() {
    const container = document.getElementById("particles");
    if (!container) return;
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.left = Math.random() * 100 + "%";
      particle.style.top = Math.random() * 100 + "%";
      particle.style.width = Math.random() * 4 + 2 + "px";
      particle.style.height = particle.style.width;
      particle.style.animationDelay = Math.random() * 6 + "s";
      particle.style.animationDuration = Math.random() * 3 + 3 + "s";
      container.appendChild(particle);
    }
  }

  updateUI() {
    const totalScore = document.getElementById("totalScore");
    const completedLevels = document.getElementById("completedLevels");
    const streak = document.getElementById("streak");
    const totalTime = document.getElementById("totalTime");
    const progressCircle = document.getElementById("progress-circle");
    const progressText = document.getElementById("progressText");

    if (totalScore) totalScore.textContent = this.gameStats.totalScore;
    if (completedLevels)
      completedLevels.textContent = this.gameStats.completedLevels;
    if (streak) streak.textContent = this.gameStats.streak;
    if (totalTime)
      totalTime.textContent = Math.floor(this.gameStats.totalTime / 60) + "m";

    if (progressCircle && progressText) {
      const progress = this.levels.length
        ? (this.gameStats.completedLevels / this.levels.length) * 100
        : 0;
      const circumference = 2 * Math.PI * 20;
      const offset = circumference - (progress / 100) * circumference;
      progressCircle.style.strokeDashoffset = offset;
      progressText.textContent = Math.round(progress) + "%";
    }

    if (window.location.pathname.includes("quiz.html")) {
      this.renderLevels();
    }
    this.updateLevelRepeatsSettings();
  }

  renderLevels() {
    const container = document.getElementById("levelGrid");
    if (!container) return;
    container.innerHTML = "";

    if (this.levels.length === 0) {
      const message = document.createElement("div");
      message.className = "text-center";
      message.textContent = "Belum ada level. Tambahkan level baru!";
      container.appendChild(message);
      return;
    }

    this.levels.forEach((level, index) => {
      const isUnlocked = index < this.gameStats.unlockedLevels;
      const isCompleted =
        level.completed && level.currentRepeats >= level.requiredRepeats;

      const levelCard = document.createElement("div");
      levelCard.className = `level-card ${!isUnlocked ? "locked" : ""} ${
        isCompleted ? "completed" : ""
      }`;

      levelCard.innerHTML = `
                <div class="level-icon">
                    <i class="fas ${
                      !isUnlocked
                        ? "fa-lock"
                        : isCompleted
                        ? "fa-trophy"
                        : "fa-play-circle"
                    }"></i>
                </div>
                <div class="level-number">${level.name}</div>
                <div class="level-questions">${
                  level.questions.length
                } Soal</div>
                ${
                  isCompleted
                    ? `<div class="level-score">Skor: ${level.score}</div>`
                    : ""
                }
                <div class="repeat-status">Pengulangan: ${
                  level.currentRepeats
                }/${level.requiredRepeats}</div>
            `;

      if (isUnlocked && !isCompleted) {
        levelCard.addEventListener("click", () => this.startLevel(index));
      }

      container.appendChild(levelCard);
    });
  }

  updateLevelSelect() {
    const select = document.getElementById("levelSelect");
    if (!select) return;
    select.innerHTML = '<option value="">Pilih Level</option>';

    this.levels.forEach((level, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = level.name;
      select.appendChild(option);
    });
  }

  addLevel() {
    const levelName = document.getElementById("levelName").value.trim();
    const levelDescription = document
      .getElementById("levelDescription")
      .value.trim();

    if (!levelName) {
      this.showToast("Nama level tidak boleh kosong!", "error");
      return;
    }

    const newLevel = {
      id: this.levels.length + 1,
      name: levelName,
      description: levelDescription || "Level baru",
      questions: [],
      completed: false,
      score: 0,
      bestTime: 0,
      requiredRepeats: 2,
      currentRepeats: 0,
    };

    this.levels.push(newLevel);
    this.saveData();
    this.updateUI();
    this.updateLevelSelect();

    // Reset form
    document.getElementById("addLevelForm").reset();

    this.showToast("Level baru berhasil dibuat!", "success");
    showLevelSelect();
  }

  addQuestion() {
    const levelIndex = parseInt(document.getElementById("levelSelect").value);
    const questionText = document.getElementById("questionText").value.trim();
    const options = [
      document.getElementById("option1").value.trim(),
      document.getElementById("option2").value.trim(),
      document.getElementById("option3").value.trim(),
      document.getElementById("option4").value.trim(),
    ];
    const correctAnswer = parseInt(
      document.querySelector('input[name="correctAnswer"]:checked').value
    );
    const difficulty = document.getElementById("difficulty").value;

    // Validation
    if (isNaN(levelIndex) || !questionText || options.some((opt) => !opt)) {
      this.showToast("Harap lengkapi semua field!", "error");
      return;
    }

    const newQuestion = {
      question: questionText,
      options: options,
      correct: correctAnswer,
      difficulty: difficulty,
    };

    this.levels[levelIndex].questions.push(newQuestion);
    this.saveData();
    this.updateUI();

    // Reset form
    document.getElementById("addQuestionForm").reset();

    this.showToast("Soal berhasil ditambahkan!", "success");
    showLevelSelect();
  }

  deleteQuestion(levelIndex, questionIndex) {
    if (confirm("Apakah Anda yakin ingin menghapus soal ini?")) {
      this.levels[levelIndex].questions.splice(questionIndex, 1);
      this.saveData();
      this.updateUI();
      this.showToast("Soal berhasil dihapus!", "success");
    }
  }

  updateLevelRepeatsSettings() {
    const container = document.getElementById("levelRepeatsSettings");
    if (!container) return;
    container.innerHTML = "";

    if (this.levels.length === 0) {
      const message = document.createElement("div");
      message.className = "text-center";
      message.textContent = "Belum ada level untuk diatur pengulangannya.";
      container.appendChild(message);
      return;
    }

    this.levels.forEach((level, index) => {
      const item = document.createElement("div");
      item.className = "level-repeat-item";
      item.innerHTML = `
                <label>${level.name}</label>
                <input type="number" min="1" max="10" value="${level.requiredRepeats}" data-level="${index}">
            `;
      container.appendChild(item);
    });
  }

  setLevelRepeats(levelIndex, value, silent = false) {
    const repeats = parseInt(value);
    if (isNaN(repeats) || repeats < 1 || repeats > 10) {
      this.showToast("Jumlah pengulangan harus antara 1 dan 10!", "error");
      return;
    }
    this.levels[levelIndex].requiredRepeats = repeats;
    this.saveData();
    this.updateUI();
    if (!silent) {
      this.showToast(
        `Jumlah pengulangan untuk ${this.levels[levelIndex].name} diatur ke ${repeats}!`,
        "success"
      );
    }
  }

  startLevel(levelIndex) {
    if (levelIndex >= this.gameStats.unlockedLevels) {
      this.showToast("Level ini masih terkunci!", "error");
      return;
    }

    const level = this.levels[levelIndex];
    if (level.questions.length === 0) {
      this.showToast("Level ini belum memiliki soal!", "error");
      return;
    }

    this.currentQuiz.level = levelIndex;
    this.currentQuiz.questions = [...level.questions];
    this.currentQuiz.currentQuestion = 0;
    this.currentQuiz.score = 0;
    this.currentQuiz.startTime = Date.now();
    this.currentQuiz.timeRemaining = this.settings.questionTime;
    this.currentQuiz.answers = [];

    if (this.settings.shuffleQuestions) {
      this.shuffleArray(this.currentQuiz.questions);
    }

    this.showQuizModal();
    this.displayQuestion();
    this.startTimer();
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  showQuizModal() {
    const quizModal = document.getElementById("quizModal");
    if (!quizModal) return;
    quizModal.classList.remove("hidden");
    document.getElementById("currentLevelBadge").textContent =
      this.levels[this.currentQuiz.level].name;
    document.getElementById("totalQuestions").textContent =
      this.currentQuiz.questions.length;
  }

  displayQuestion() {
    const question =
      this.currentQuiz.questions[this.currentQuiz.currentQuestion];
    document.getElementById("questionTitle").textContent = question.question;
    document.getElementById("currentQuestion").textContent =
      this.currentQuiz.currentQuestion + 1;

    const optionsContainer = document.getElementById("optionsGrid");
    optionsContainer.innerHTML = "";

    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "option-button";
      button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
      button.addEventListener("click", () => this.selectAnswer(index));
      optionsContainer.appendChild(button);
    });

    this.updateQuizProgress();
    this.resetQuestionTimer();
  }

  resetQuestionTimer() {
    this.currentQuiz.timeRemaining = this.settings.questionTime;
    document.getElementById("timer").textContent =
      this.currentQuiz.timeRemaining;
  }

  selectAnswer(selectedIndex) {
    const question =
      this.currentQuiz.questions[this.currentQuiz.currentQuestion];
    const buttons = document.querySelectorAll(".option-button");

    // Stop timer
    this.stopTimer();

    // Disable all buttons
    buttons.forEach((btn) => (btn.style.pointerEvents = "none"));

    // Show correct/incorrect if feedback is enabled
    if (this.settings.showFeedback) {
      buttons[selectedIndex].classList.add(
        selectedIndex === question.correct ? "correct" : "incorrect"
      );
      if (selectedIndex !== question.correct) {
        buttons[question.correct].classList.add("correct");
      }
    }

    // Record answer
    this.currentQuiz.answers.push({
      questionIndex: this.currentQuiz.currentQuestion,
      selected: selectedIndex,
      correct: question.correct,
      isCorrect: selectedIndex === question.correct,
      timeUsed: this.settings.questionTime - this.currentQuiz.timeRemaining,
    });

    // Calculate score
    if (selectedIndex === question.correct) {
      const points =
        question.difficulty === "easy"
          ? 10
          : question.difficulty === "medium"
          ? 20
          : 30;
      // Bonus points for quick answers
      const timeBonus = Math.floor(
        (this.currentQuiz.timeRemaining / this.settings.questionTime) * 5
      );
      this.currentQuiz.score += points + timeBonus;
    }

    // Next question after delay
    setTimeout(
      () => {
        this.nextQuestion();
      },
      this.settings.showFeedback ? 1500 : 100
    );
  }

  nextQuestion() {
    this.currentQuiz.currentQuestion++;

    if (this.currentQuiz.currentQuestion >= this.currentQuiz.questions.length) {
      this.finishQuiz();
    } else {
      this.displayQuestion();
      this.startTimer();
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.currentQuiz.timeRemaining--;
      document.getElementById("timer").textContent =
        this.currentQuiz.timeRemaining;

      if (this.currentQuiz.timeRemaining <= 0) {
        this.timeOut();
      }
    }, 1000);
  }

  timeOut() {
    this.stopTimer();
    const question =
      this.currentQuiz.questions[this.currentQuiz.currentQuestion];
    const buttons = document.querySelectorAll(".option-button");

    // Disable all buttons
    buttons.forEach((btn) => (btn.style.pointerEvents = "none"));

    // Show correct answer if feedback is enabled
    if (this.settings.showFeedback) {
      buttons[question.correct].classList.add("correct");
    }

    // Record answer as incorrect
    this.currentQuiz.answers.push({
      questionIndex: this.currentQuiz.currentQuestion,
      selected: -1,
      correct: question.correct,
      isCorrect: false,
      timeUsed: this.settings.questionTime,
    });

    // Immediately show failure message
    setTimeout(
      () => {
        this.failQuiz();
      },
      this.settings.showFeedback ? 1000 : 0
    );
  }

  failQuiz() {
    this.stopTimer();

    const level = this.levels[this.currentQuiz.level];
    const totalTime = Math.floor(
      (Date.now() - this.currentQuiz.startTime) / 1000
    );
    const correctAnswers = this.currentQuiz.answers.filter(
      (a) => a.isCorrect
    ).length;
    const accuracy = Math.round(
      (correctAnswers / this.currentQuiz.questions.length) * 100
    );

    // Update level data
    level.score = Math.max(level.score, this.currentQuiz.score);

    this.saveData();

    // Show failure result
    document.getElementById("quizModal").classList.add("hidden");

    const resultModal = document.getElementById("resultModal");
    const resultIcon = document.getElementById("resultIcon");
    const resultTitle = document.getElementById("resultTitle");
    const resultMessage = document.getElementById("resultMessage");

    resultIcon.className = "result-icon fail";
    resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
    resultTitle.textContent = "Belum Berhasil";
    resultMessage.textContent = `Waktu habis atau akurasi di bawah 70%! Anda telah menyelesaikan ${level.currentRepeats}/${level.requiredRepeats} pengulangan. Coba lagi!`;

    document.getElementById("levelScore").textContent = this.currentQuiz.score;
    document.getElementById("levelTime").textContent = totalTime + "s";
    document.getElementById("levelAccuracy").textContent = accuracy + "%";
    document.getElementById("nextLevelBtn").style.display = "none";

    resultModal.classList.remove("hidden");

    // Update UI
    this.updateUI();
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  finishQuiz() {
    this.stopTimer();

    const level = this.levels[this.currentQuiz.level];
    const totalTime = Math.floor(
      (Date.now() - this.currentQuiz.startTime) / 1000
    );
    const correctAnswers = this.currentQuiz.answers.filter(
      (a) => a.isCorrect
    ).length;
    const accuracy = Math.round(
      (correctAnswers / this.currentQuiz.questions.length) * 100
    );

    // Update level data
    const isNewRecord =
      !level.completed || this.currentQuiz.score > level.score;
    level.score = Math.max(level.score, this.currentQuiz.score);
    level.bestTime =
      level.bestTime === 0 ? totalTime : Math.min(level.bestTime, totalTime);

    // Increment current repeats if accuracy >= 70%
    if (accuracy >= 70) {
      level.currentRepeats = (level.currentRepeats || 0) + 1;
    }

    // Check if level is completed based on required repeats
    level.completed = level.currentRepeats >= level.requiredRepeats;

    // Update game stats
    if (isNewRecord) {
      this.gameStats.totalScore +=
        this.currentQuiz.score - (level.score - this.currentQuiz.score);
    }

    if (
      level.completed &&
      this.currentQuiz.level + 1 === this.gameStats.completedLevels
    ) {
      this.gameStats.completedLevels++;
      this.gameStats.streak++;
    }

    if (
      level.completed &&
      this.currentQuiz.level + 1 >= this.gameStats.unlockedLevels
    ) {
      this.gameStats.unlockedLevels = Math.min(
        this.gameStats.unlockedLevels + 1,
        this.levels.length
      );
    }

    this.gameStats.totalTime += totalTime;

    this.saveData();
    this.showResult(correctAnswers, totalTime, accuracy);
  }

  showResult(correctAnswers, totalTime, accuracy) {
    document.getElementById("quizModal").classList.add("hidden");

    const resultModal = document.getElementById("resultModal");
    const resultIcon = document.getElementById("resultIcon");
    const resultTitle = document.getElementById("resultTitle");
    const resultMessage = document.getElementById("resultMessage");
    const level = this.levels[this.currentQuiz.level];

    if (accuracy >= 70 && level.currentRepeats >= level.requiredRepeats) {
      resultIcon.className = "result-icon success";
      resultIcon.innerHTML = '<i class="fas fa-trophy"></i>';
      resultTitle.textContent = "Selamat!";
      resultMessage.textContent = `Anda berhasil menyelesaikan ${level.name} dengan ${level.currentRepeats}/${level.requiredRepeats} pengulangan!`;
    } else if (accuracy >= 70) {
      resultIcon.className = "result-icon success";
      resultIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
      resultTitle.textContent = "Pengulangan Berhasil!";
      resultMessage.textContent = `Anda telah menyelesaikan pengulangan ${
        level.currentRepeats
      }/${level.requiredRepeats}. Selesaikan ${
        level.requiredRepeats - level.currentRepeats
      } pengulangan lagi untuk membuka level berikutnya!`;
    } else {
      resultIcon.className = "result-icon fail";
      resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
      resultTitle.textContent = "Belum Berhasil";
      resultMessage.textContent = `Akurasi Anda di bawah 70%. Anda telah menyelesaikan ${level.currentRepeats}/${level.requiredRepeats} pengulangan. Coba lagi untuk mendapatkan nilai yang lebih baik!`;
    }

    document.getElementById("levelScore").textContent = this.currentQuiz.score;
    document.getElementById("levelTime").textContent = totalTime + "s";
    document.getElementById("levelAccuracy").textContent = accuracy + "%";

    const nextBtn = document.getElementById("nextLevelBtn");
    if (
      this.currentQuiz.level + 1 < this.levels.length &&
      level.currentRepeats >= level.requiredRepeats
    ) {
      nextBtn.style.display = "inline-flex";
    } else {
      nextBtn.style.display = "none";
    }

    resultModal.classList.remove("hidden");

    // Update UI
    this.updateUI();
  }

  updateQuizProgress() {
    const progress =
      ((this.currentQuiz.currentQuestion + 1) /
        this.currentQuiz.questions.length) *
      100;
    document.getElementById("quizProgress").style.width = progress + "%";
  }

  closeQuiz() {
    this.stopTimer();
    document.getElementById("quizModal").classList.add("hidden");
    showLevelSelect();
  }

  closeResult() {
    document.getElementById("resultModal").classList.add("hidden");
    showLevelSelect();
  }

  startNextLevel() {
    this.closeResult();
    if (this.currentQuiz.level + 1 < this.levels.length) {
      this.startLevel(this.currentQuiz.level + 1);
    }
  }

  showSettings() {
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.classList.remove("hidden");
    }
  }

  loadSettings() {
    const questionTime = document.getElementById("questionTime");
    const showFeedback = document.getElementById("showFeedback");
    const shuffleQuestions = document.getElementById("shuffleQuestions");
    const darkMode = document.getElementById("darkMode");

    if (questionTime) questionTime.value = this.settings.questionTime;
    if (showFeedback) showFeedback.checked = this.settings.showFeedback;
    if (shuffleQuestions)
      shuffleQuestions.checked = this.settings.shuffleQuestions;
    if (darkMode) darkMode.checked = this.settings.darkMode || false;

    document.documentElement.setAttribute(
      "data-theme",
      this.settings.darkMode ? "dark" : ""
    );
    this.updateLevelRepeatsSettings();
  }

  saveSettings() {
    const questionTime = document.getElementById("questionTime");
    const showFeedback = document.getElementById("showFeedback");
    const shuffleQuestions = document.getElementById("shuffleQuestions");
    const darkMode = document.getElementById("darkMode");

    if (questionTime) this.settings.questionTime = parseInt(questionTime.value);
    if (showFeedback) this.settings.showFeedback = showFeedback.checked;
    if (shuffleQuestions)
      this.settings.shuffleQuestions = shuffleQuestions.checked;
    if (darkMode) this.settings.darkMode = darkMode.checked;

    document.documentElement.setAttribute(
      "data-theme",
      this.settings.darkMode ? "dark" : ""
    );

    const repeatInputs = document.querySelectorAll(
      "#levelRepeatsSettings input"
    );
    let changed = false;
    repeatInputs.forEach((input) => {
      const levelIndex = parseInt(input.dataset.level);
      const value = parseInt(input.value);
      if (!isNaN(value) && this.levels[levelIndex].requiredRepeats !== value) {
        this.setLevelRepeats(levelIndex, value, true);
        changed = true;
      }
    });

    this.saveData();
    localStorage.setItem("gameSettings", JSON.stringify(this.settings));

    this.showToast("Pengaturan berhasil disimpan!", "success");
    this.closeSettings();
  }

  closeSettings() {
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.classList.add("hidden");
      // Reset toggle state when closing settings
      const repeatsContainer = document.getElementById("levelRepeatsSettings");
      const toggleIcon = document.getElementById("toggleIcon");
      if (repeatsContainer) repeatsContainer.classList.add("hidden");
      if (toggleIcon) toggleIcon.classList.remove("rotate");
    }
  }

  saveData() {
    localStorage.setItem("quizLevels", JSON.stringify(this.levels));
    localStorage.setItem("gameStats", JSON.stringify(this.gameStats));
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon =
      type === "success"
        ? "fa-check-circle"
        : type === "error"
        ? "fa-exclamation-circle"
        : "fa-info-circle";

    toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Navigation Functions
function goToQuiz(section) {
  window.location.href = `quiz.html?section=${section}`;
}

function goToDashboard() {
  window.location.href = "index.html";
}

function showLevelSelect() {
  const levelSection = document.getElementById("levelSection");
  const addQuestionSection = document.getElementById("addQuestionSection");
  const addLevelSection = document.getElementById("addLevelSection");

  if (levelSection) levelSection.classList.remove("hidden");
  if (addQuestionSection) addQuestionSection.classList.add("hidden");
  if (addLevelSection) addLevelSection.classList.add("hidden");
}

function showAddQuestion() {
  const levelSection = document.getElementById("levelSection");
  const addQuestionSection = document.getElementById("addQuestionSection");
  const addLevelSection = document.getElementById("addLevelSection");

  if (levelSection) levelSection.classList.add("hidden");
  if (addQuestionSection) addQuestionSection.classList.remove("hidden");
  if (addLevelSection) addLevelSection.classList.add("hidden");
}

function showAddLevel() {
  const levelSection = document.getElementById("levelSection");
  const addQuestionSection = document.getElementById("addQuestionSection");
  const addLevelSection = document.getElementById("addLevelSection");

  if (levelSection) levelSection.classList.add("hidden");
  if (addQuestionSection) addQuestionSection.classList.add("hidden");
  if (addLevelSection) addLevelSection.classList.remove("hidden");
}

function showSettings() {
  const settingsModal = document.getElementById("settingsModal");
  const questionContainer = document.getElementById("questionContainer");
  const mainMenu = document.getElementById("mainMenu");

  if (settingsModal) settingsModal.classList.remove("hidden");
  if (questionContainer) questionContainer.classList.add("hidden");
  if (mainMenu) mainMenu.classList.remove("hidden");
}

function showQuestionContainer() {
  const mainMenu = document.getElementById("mainMenu");
  const questionContainer = document.getElementById("questionContainer");
  const welcomeSection = document.getElementById("welcomeSection");

  if (mainMenu) mainMenu.classList.add("hidden");
  if (questionContainer) questionContainer.classList.remove("hidden");
  if (welcomeSection) welcomeSection.classList.remove("hidden");
}

function hideQuestionContainer(event) {
  if (event) {
    event.stopPropagation();
  }
  const questionContainer = document.getElementById("questionContainer");
  const mainMenu = document.getElementById("mainMenu");
  const welcomeSection = document.getElementById("welcomeSection");

  if (questionContainer) questionContainer.classList.add("hidden");
  if (mainMenu) mainMenu.classList.remove("hidden");
  if (welcomeSection) welcomeSection.classList.remove("hidden");
}

function closeSettings() {
  game.closeSettings();
}

function saveSettings() {
  game.saveSettings();
}

function toggleLevelRepeats() {
  const repeatsContainer = document.getElementById("levelRepeatsSettings");
  const toggleIcon = document.getElementById("toggleIcon");
  if (repeatsContainer) repeatsContainer.classList.toggle("hidden");
  if (toggleIcon) toggleIcon.classList.toggle("rotate");
}

// Initialize Game
let game;
document.addEventListener("DOMContentLoaded", () => {
  game = new QuizGame();
});

// Export functions for button onclick handlers
window.goToQuiz = goToQuiz;
window.goToDashboard = goToDashboard;
window.showLevelSelect = showLevelSelect;
window.showAddQuestion = showAddQuestion;
window.showAddLevel = showAddLevel;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.closeQuiz = () => game.closeQuiz();
window.closeResult = () => game.closeResult();
window.startNextLevel = () => game.startNextLevel();
window.deleteQuestion = (levelIndex, questionIndex) =>
  game.deleteQuestion(levelIndex, questionIndex);
window.toggleLevelRepeats = toggleLevelRepeats;
window.showQuestionContainer = showQuestionContainer;
window.hideQuestionContainer = hideQuestionContainer;
