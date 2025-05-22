// Import Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase
const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with your Supabase URL
const supabaseKey = 'YOUR_SUPABASE_AN遵1d5f ANON_KEY'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// Game State Management
class QuizGame {
  constructor() {
    this.levels = JSON.parse(localStorage.getItem('quizLevels')) || this.initializeDefaultLevels();
    this.gameStats = JSON.parse(localStorage.getItem('gameStats')) || {
      totalScore: 0,
      completedLevels: 0,
      streak: 0,
      totalTime: 0,
      unlockedLevels: 1
    };
    this.settings = JSON.parse(localStorage.getItem('gameSettings')) || {
      questionTime: 30,
      showFeedback: true,
      shuffleQuestions: true,
      darkMode: false,
      singleDeviceMode: false // New setting for single vs multi-device mode
    };
    this.currentQuiz = {
      level: 0,
      questions: [],
      currentQuestion: 0,
      score: 0,
      startTime: 0,
      timeRemaining: this.settings.questionTime,
      answers: []
    };
    this.currentStudent = null; // Track current student
    this.students = []; // Store student list
    this.isAdmin = false; // Track admin status
    this.timerInterval = null;
    this.init();
  }

  async init() {
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      this.currentStudent = await this.getStudentById(user.id);
      this.isAdmin = user.email === 'admin@example.com'; // Replace with your admin email
    }
    this.updateUI();
    this.generateParticles();
    this.bindEvents();
    this.updateLevelSelect();
    this.loadSettings();
    await this.loadStudents();
    if (!this.currentStudent && !this.settings.singleDeviceMode) {
      this.showLoginModal();
    } else if (this.settings.singleDeviceMode) {
      this.showStudentSelect();
    } else {
      this.showWelcome();
    }
  }

  initializeDefaultLevels() {
    return [
      {
        id: 1,
        name: "Level 1 - Dasar",
        description: "Level pengenalan dengan soal-soal dasar",
        questions: [
          {
            question: "Apa ibu kota Indonesia?",
            options: ["Jakarta", "Bandung", "Surabaya", "Medan"],
            correct: 0,
            difficulty: "easy"
          },
          {
            question: "Berapa hasil dari 2 + 2?",
            options: ["3", "4", "5", "6"],
            correct: 1,
            difficulty: "easy"
          }
        ],
        completed: false,
        score: 0,
        bestTime: 0,
        requiredRepeats: 2,
        currentRepeats: 0
      },
      {
        id: 2,
        name: "Level 2 - Menengah",
        description: "Level dengan tingkat kesulitan sedang",
        questions: [
          {
            question: "Siapa penemu lampu pijar?",
            options: ["Thomas Edison", "Nikola Tesla", "Albert Einstein", "Isaac Newton"],
            correct: 0,
            difficulty: "medium"
          }
        ],
        completed: false,
        score: 0,
        bestTime: 0,
        requiredRepeats: 2,
        currentRepeats: 0
      }
    ];
  }

  async getStudentById(id) {
    const { data, error } = await supabase.from('students').select('*').eq('id', id).single();
    if (error) {
      this.showToast('Gagal memuat data siswa: ' + error.message, 'error');
      return null;
    }
    return data;
  }

  async loadStudents() {
    const { data, error } = await supabase.from('students').select('*');
    if (error) {
      this.showToast('Gagal memuat daftar siswa: ' + error.message, 'error');
      return;
    }
    this.students = data || [];
    this.renderStudentList();
  }

  async addStudent(name, email, password) {
    if (!this.isAdmin) {
      this.showToast('Hanya admin yang dapat menambah siswa!', 'error');
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    if (authError) {
      this.showToast('Gagal mendaftarkan siswa: ' + authError.message, 'error');
      return;
    }
    const { error } = await supabase
      .from('students')
      .insert([{ id: authData.user.id, name, email, active: false }]);
    if (error) {
      this.showToast('Gagal menambah siswa: ' + error.message, 'error');
      return;
    }
    await this.loadStudents();
    document.getElementById('addStudentForm').reset();
    this.showToast('Siswa berhasil ditambahkan!', 'success');
    showTab('listStudent');
  }

  async deleteStudent(studentId) {
    if (!this.isAdmin) {
      this.showToast('Hanya admin yang dapat menghapus siswa!', 'error');
      return;
    }
    if (confirm('Apakah Anda yakin ingin menghapus siswa ini?')) {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) {
        this.showToast('Gagal menghapus siswa: ' + error.message, 'error');
        return;
      }
      await supabase.from('student_progress').delete().eq('student_id', studentId);
      await this.loadStudents();
      this.showToast('Siswa berhasil dihapus!', 'success');
    }
  }

  async selectStudent(studentId) {
    if (!this.settings.singleDeviceMode) {
      this.showToast('Pilih siswa hanya tersedia di mode single device!', 'error');
      return;
    }
    this.currentStudent = this.students.find(s => s.id === studentId);
    await supabase.from('students').update({ active: true }).eq('id', studentId);
    await supabase.from('students').update({ active: false }).neq('id', studentId);
    this.showToast(`Siswa ${this.currentStudent.name} dipilih!`, 'success');
    this.showWelcome();
  }

  async loginStudent(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      this.showToast('Login gagal: ' + error.message, 'error');
      return;
    }
    this.currentStudent = await this.getStudentById(data.user.id);
    this.isAdmin = data.user.email === 'admin@example.com'; // Replace with your admin email
    this.showToast(`Selamat datang, ${this.currentStudent.name}!`, 'success');
    this.closeLoginModal();
    this.showWelcome();
  }

  renderStudentList() {
    const container = document.getElementById('studentList');
    container.innerHTML = '';
    this.students.forEach(student => {
      const item = document.createElement('div');
      item.className = 'student-item';
      item.innerHTML = `
        <span>${student.name} (${student.email})${student.active ? ' (Aktif)' : ''}</span>
        <div>
          ${this.settings.singleDeviceMode ? `<button class="btn-primary" onclick="game.selectStudent('${student.id}')">Pilih</button>` : ''}
          ${this.isAdmin ? `<button class="btn-secondary" onclick="game.deleteStudent('${student.id}')">Hapus</button>` : ''}
        </div>
      `;
      container.appendChild(item);
    });
  }

  showStudentSelect() {
    if (!this.settings.singleDeviceMode) return;
    showAdminPanel();
    showTab('listStudent');
  }

  showLoginModal() {
    if (this.settings.singleDeviceMode) return;
    document.getElementById('loginModal').classList.remove('hidden');
  }

  closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
  }

  async startLevel(levelIndex) {
    if (!this.currentStudent) {
      this.showToast('Pilih atau login sebagai siswa terlebih dahulu!', 'error');
      return;
    }
    if (levelIndex >= this.gameStats.unlockedLevels) {
      this.showToast('Level ini masih terkunci!', 'error');
      return;
    }
    const level = this.levels[levelIndex];
    if (level.questions.length === 0) {
      this.showToast('Level ini belum memiliki soal!', 'error');
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

  async finishQuiz() {
    this.stopTimer();
    const level = this.levels[this.currentQuiz.level];
    const totalTime = Math.floor((Date.now() - this.currentQuiz.startTime) / 1000);
    const correctAnswers = this.currentQuiz.answers.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correctAnswers / this.currentQuiz.questions.length) * 100);

    // Save progress to Supabase
    const { error } = await supabase
      .from('student_progress')
      .upsert({
        student_id: this.currentStudent.id,
        level_id: level.id,
        score: this.currentQuiz.score,
        completed: accuracy >= 70 && level.currentRepeats >= level.requiredRepeats,
        repeats: level.currentRepeats + (accuracy >= 70 ? 1 : 0),
        last_attempt: new Date().toISOString()
      }, { onConflict: ['student_id', 'level_id'] });
    if (error) {
      this.showToast('Gagal menyimpan progres: ' + error.message, 'error');
    }

    const isNewRecord = !level.completed || this.currentQuiz.score > level.score;
    level.score = Math.max(level.score, this.currentQuiz.score);
    level.bestTime = level.bestTime === 0 ? totalTime : Math.min(level.bestTime, totalTime);
    if (accuracy >= 70) {
      level.currentRepeats = (level.currentRepeats || 0) + 1;
    }
    level.completed = level.currentRepeats >= level.requiredRepeats;
    if (isNewRecord) {
      this.gameStats.totalScore += this.currentQuiz.score - (level.score - this.currentQuiz.score);
    }
    if (level.completed && this.currentQuiz.level + 1 === this.gameStats.completedLevels) {
      this.gameStats.completedLevels++;
      this.gameStats.streak++;
    }
    if (level.completed && this.currentQuiz.level + 1 >= this.gameStats.unlockedLevels) {
      this.gameStats.unlockedLevels = Math.min(this.gameStats.unlockedLevels + 1, this.levels.length);
    }
    this.gameStats.totalTime += totalTime;
    this.saveData();
    this.showResult(correctAnswers, totalTime, accuracy);
  }

  bindEvents() {
    document.getElementById('addQuestionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addQuestion();
    });
    document.getElementById('addLevelForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addLevel();
    });
    document.getElementById('addStudentForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('studentName').value;
      const email = document.getElementById('studentEmail').value;
      const password = document.getElementById('studentPassword').value;
      this.addStudent(name, email, password);
    });
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      this.loginStudent(email, password);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!document.getElementById('quiz Vila').classList.contains('hidden')) {
          this.closeQuiz();
        } else if (!document.getElementById('resultModal').classList.contains('hidden')) {
          this.closeResult();
        } else if (!document.getElementById('settingsModal').classList.contains('hidden')) {
          this.closeSettings();
        } else if (!document.getElementById('loginModal').classList.contains('hidden')) {
          this.closeLoginModal();
        } else if (!document.getElementById('adminSection').classList.contains('hidden')) {
          this.showLevelSelect();
        }
      }
    });
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });
  }

  generateParticles() {
    const container = document.getElementById('particles');
    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.width = Math.random() * 4 + 2 + 'px';
      particle.style.height = particle.style.width;
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
      container.appendChild(particle);
    }
  }

  updateUI() {
    document.getElementById('totalScore').textContent = this.gameStats.totalScore;
    document.getElementById('completedLevels').textContent = this.gameStats.completedLevels;
    document.getElementById('streak').textContent = this.gameStats.streak;
    document.getElementById('totalTime').textContent = Math.floor(this.gameStats.totalTime / 60) + 'm';
    const progress = (this.gameStats.completedLevels / this.levels.length) * 100;
    const circumference = 2 * Math.PI * 20;
    const offset = circumference - (progress / 100) * circumference;
    document.getElementById('progress-circle').style.strokeDashoffset = offset;
    document.getElementById('progressText').textContent = Math.round(progress) + '%';
    this.renderLevels();
    this.updateLevelRepeatsSettings();
  }

  renderLevels() {
    const container = document.getElementById('levelGrid');
    container.innerHTML = '';
    this.levels.forEach((level, index) => {
      const isUnlocked = index < this.gameStats.unlockedLevels;
      const isCompleted = level.completed && level.currentRepeats >= level.requiredRepeats;
      const levelCard = document.createElement('div');
      levelCard.className = `level-card ${!isUnlocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`;
      levelCard.innerHTML = `
        <div class="level-icon">
          <i class="fas ${!isUnlocked ? 'fa-lock' : isCompleted ? 'fa-trophy' : 'fa-play-circle'}"></i>
        </div>
        <div class="level-number">${level.name}</div>
        <div class="level-questions">${level.questions.length} Soal</div>
        ${isCompleted ? `<div class="level-score">Skor: ${level.score}</div>` : ''}
        <div class="repeat-status">Pengulangan: ${level.currentRepeats}/${level.requiredRepeats}</div>
      `;
      if (isUnlocked && !isCompleted) {
        levelCard.addEventListener('click', () => this.startLevel(index));
      }
      container.appendChild(levelCard);
    });
  }

  updateLevelSelect() {
    const select = document.getElementById('levelSelect');
    select.innerHTML = '<option value="">Pilih Level</option>';
    this.levels.forEach((level, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = level.name;
      select.appendChild(option);
    });
  }

  addLevel() {
    if (!this.isAdmin) {
      this.showToast('Hanya admin yang dapat membuat level!', 'error');
      return;
    }
    const levelName = document.getElementById('levelName').value.trim();
    const levelDescription = document.getElementById('levelDescription').value.trim();
    if (!levelName) {
      this.showToast('Nama level tidak boleh kosong!', 'error');
      return;
    }
    const newLevel = {
      id: this.levels.length + 1,
      name: levelName,
      description: levelDescription || 'Level baru',
      questions: [],
      completed: false,
      score: 0,
      bestTime: 0,
      requiredRepeats: 2,
      currentRepeats: 0
    };
    this.levels.push(newLevel);
    this.saveData();
    this.updateUI();
    this.updateLevelSelect();
    document.getElementById('addLevelForm').reset();
    this.showToast('Level baru berhasil dibuat!', 'success');
    this.showLevelSelect();
  }

  addQuestion() {
    if (!this.isAdmin) {
      this.showToast('Hanya admin yang dapat menambah soal!', 'error');
      return;
    }
    const levelIndex = parseInt(document.getElementById('levelSelect').value);
    const questionText = document.getElementById('questionText').value.trim();
    const options = [
      document.getElementById('option1').value.trim(),
      document.getElementById('option2').value.trim(),
      document.getElementById('option3').value.trim(),
      document.getElementById('option4').value.trim()
    ];
    const correctAnswer = parseInt(document.querySelector('input[name="correctAnswer"]:checked').value);
    const difficulty = document.getElementById('difficulty').value;
    if (isNaN(levelIndex) || !questionText || options.some(opt => !opt)) {
      this.showToast('Harap lengkapi semua field!', 'error');
      return;
    }
    const newQuestion = {
      question: questionText,
      options: options,
      correct: correctAnswer,
      difficulty: difficulty
    };
    this.levels[levelIndex].questions.push(newQuestion);
    this.saveData();
    this.updateUI();
    document.getElementById('addQuestionForm').reset();
    this.showToast('Soal berhasil ditambahkan!', 'success');
    this.showLevelSelect();
  }

  deleteQuestion(levelIndex, questionIndex) {
    if (!this.isAdmin) {
      this.showToast('Hanya admin yang dapat menghapus soal!', 'error');
      return;
    }
    if (confirm('Apakah Anda yakin ingin menghapus soal ini?')) {
      this.levels[levelIndex].questions.splice(questionIndex, 1);
      this.saveData();
      this.updateUI();
      this.showToast('Soal berhasil dihapus!', 'success');
    }
  }

  updateLevelRepeatsSettings() {
    const container = document.getElementById('levelRepeatsSettings');
    container.innerHTML = '';
    this.levels.forEach((level, index) => {
      const item = document.createElement('div');
      item.className = 'level-repeat-item';
      item.innerHTML = `
        <label>${level.name}</label>
        <input type="number" min="1" max="10" value="${level.requiredRepeats}" data-level="${index}">
      `;
      container.appendChild(item);
    });
  }

  setLevelRepeats(levelIndex, value, silent = false) {
    if (!this.isAdmin) {
      this.showToast('Hanya admin yang dapat mengatur pengulangan!', 'error');
      return;
    }
    const repeats = parseInt(value);
    if (isNaN(repeats) || repeats < 1 || repeats > 10) {
      this.showToast('Jumlah pengulangan harus antara 1 dan 10!', 'error');
      return;
    }
    this.levels[levelIndex].requiredRepeats = repeats;
    this.saveData();
    this.updateUI();
    if (!silent) {
      this.showToast(`Jumlah pengulangan untuk ${this.levels[levelIndex].name} diatur ke ${repeats}!`, 'success');
    }
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  showQuizModal() {
    document.getElementById('quizModal').classList.remove('hidden');
    document.getElementById('currentLevelBadge').textContent = this.levels[this.currentQuiz.level].name;
    document.getElementById('totalQuestions').textContent = this.currentQuiz.questions.length;
  }

  displayQuestion() {
    const question = this.currentQuiz.questions[this.currentQuiz.currentQuestion];
    document.getElementById('questionTitle').textContent = question.question;
    document.getElementById('currentQuestion').textContent = this.currentQuiz.currentQuestion + 1;
    const optionsContainer = document.getElementById('optionsGrid');
    optionsContainer.innerHTML = '';
    question.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.className = 'option-button';
      button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
      button.addEventListener('click', () => this.selectAnswer(index));
      optionsContainer.appendChild(button);
    });
    this.updateQuizProgress();
    this.resetQuestionTimer();
  }

  resetQuestionTimer() {
    this.currentQuiz.timeRemaining = this.settings.questionTime;
    document.getElementById('timer').textContent = this.currentQuiz.timeRemaining;
  }

  selectAnswer(selectedIndex) {
    const question = this.currentQuiz.questions[this.currentQuiz.currentQuestion];
    const buttons = document.querySelectorAll('.option-button');
    this.stopTimer();
    buttons.forEach(btn => btn.style.pointerEvents = 'none');
    if (this.settings.showFeedback) {
      buttons[selectedIndex].classList.add(selectedIndex === question.correct ? 'correct' : 'incorrect');
      if (selectedIndex !== question.correct) {
        buttons[question.correct].classList.add('correct');
      }
    }
    this.currentQuiz.answers.push({
      questionIndex: this.currentQuiz.currentQuestion,
      selected: selectedIndex,
      correct: question.correct,
      isCorrect: selectedIndex === question.correct,
      timeUsed: this.settings.questionTime - this.currentQuiz.timeRemaining
    });
    if (selectedIndex === question.correct) {
      const points = question.difficulty === 'easy' ? 10 : question.difficulty === 'medium' ? 20 : 30;
      const timeBonus = Math.floor((this.currentQuiz.timeRemaining / this.settings.questionTime) * 5);
      this.currentQuiz.score += points + timeBonus;
    }
    setTimeout(() => {
      this.nextQuestion();
    }, this.settings.showFeedback ? 1500 : 100);
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
      document.getElementById('timer').textContent = this.currentQuiz.timeRemaining;
      if (this.currentQuiz.timeRemaining <= 0) {
        this.timeOut();
      }
    }, 1000);
  }

  timeOut() {
    this.stopTimer();
    const question = this.currentQuiz.questions[this.currentQuiz.currentQuestion];
    const buttons = document.querySelectorAll('.option-button');
    buttons.forEach(btn => btn.style.pointerEvents = 'none');
    if (this.settings.showFeedback) {
      buttons[question.correct]. classList.add('correct');
    }
    this.currentQuiz.answers.push({
      questionIndex: this.currentQuiz.currentQuestion,
      selected: -1,
      correct: question.correct,
      isCorrect: false,
      timeUsed: this.settings.questionTime
    });
    setTimeout(() => {
      this.failQuiz();
    }, this.settings.showFeedback ? 1000 : 0);
  }

  failQuiz() {
    this.stopTimer();
    const level = this.levels[this.currentQuiz.level];
    const totalTime = Math.floor((Date.now() - this.currentQuiz.startTime) / 1000);
    const correctAnswers = this.currentQuiz.answers.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correctAnswers / this.currentQuiz.questions.length) * 100);
    level.score = Math.max(level.score, this.currentQuiz.score);
    this.saveData();
    document.getElementById('quizModal').classList.add('hidden');
    const resultModal = document.getElementById('resultModal');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    resultIcon.className = 'result-icon fail';
    resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
    resultTitle.textContent = 'Belum Berhasil';
    resultMessage.textContent = `Waktu habis atau akurasi di bawah 70%! Anda telah menyelesaikan ${level.currentRepeats}/${level.requiredRepeats} pengulangan. Coba lagi!`;
    document.getElementById('levelScore').textContent = this.currentQuiz.score;
    document.getElementById('levelTime').textContent = totalTime + 's';
    document.getElementById('levelAccuracy').textContent = accuracy + '%';
    document.getElementById('nextLevelBtn').style.display = 'none';
    resultModal.classList.remove('hidden');
    this.updateUI();
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  showResult(correctAnswers, totalTime, accuracy) {
    document.getElementById('quizModal').classList.add('hidden');
    const resultModal = document.getElementById('resultModal');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const level = this.levels[this.currentQuiz.level];
    if (accuracy >= 70 && level.currentRepeats >= level.requiredRepeats) {
      resultIcon.className = 'result-icon success';
      resultIcon.innerHTML = '<i class="fas fa-trophy"></i>';
      resultTitle.textContent = 'Selamat!';
      resultMessage.textContent = `Anda berhasil menyelesaikan ${level.name} dengan ${level.currentRepeats}/${level.requiredRepeats} pengulangan!`;
    } else if (accuracy >= 70) {
      resultIcon.className = 'result-icon success';
      resultIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
      resultTitle.textContent = 'Pengulangan Berhasil!';
      resultMessage.textContent = `Anda telah menyelesaikan pengulangan ${level.currentRepeats}/${level.requiredRepeats}. Selesaikan ${level.requiredRepeats - level.currentRepeats} pengulangan lagi untuk membuka level berikutnya!`;
    } else {
      resultIcon.className = 'result-icon fail';
      resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
      resultTitle.textContent = 'Belum Berhasil';
      resultMessage.textContent = `Akurasi Anda di bawah 70%. Anda telah menyelesaikan ${level.currentRepeats}/${level.requiredRepeats} pengulangan. Coba lagi untuk mendapatkan nilai yang lebih baik!`;
    }
    document.getElementById('levelScore').textContent = this.currentQuiz.score;
    document.getElementById('levelTime').textContent = totalTime + 's';
    document.getElementById('levelAccuracy').textContent = accuracy + '%';
    const nextBtn = document.getElementById('nextLevelBtn');
    if (this.currentQuiz.level + 1 < this.levels.length && level.currentRepeats >= level.requiredRepeats) {
      nextBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'none';
    }
    resultModal.classList.remove('hidden');
    this.updateUI();
  }

  updateQuizProgress() {
    const progress = ((this.currentQuiz.currentQuestion + 1) / this.currentQuiz.questions.length) * 100;
    document.getElementById('quizProgress').style.width = progress + '%';
  }

  closeQuiz() {
    this.stopTimer();
    document.getElementById('quizModal').classList.add('hidden');
    this.showLevelSelect();
  }

  closeResult() {
    document.getElementById('resultModal').classList.add('hidden');
    this.showLevelSelect();
  }

  startNextLevel() {
    this.closeResult();
    if (this.currentQuiz.level + 1 < this.levels.length) {
      this.startLevel(this.currentQuiz.level + 1);
    }
  }

  loadSettings() {
    document.getElementById('questionTime').value = this.settings.questionTime;
    document.getElementById('showFeedback').checked = this.settings.showFeedback;
    document.getElementById('shuffleQuestions').checked = this.settings.shuffleQuestions;
    document.getElementById('darkMode').checked = this.settings.darkMode;
    document.getElementById('singleDeviceMode').checked = this.settings.singleDeviceMode;
    document.documentElement.setAttribute('data-theme', this.settings.darkMode ? 'dark' : '');
    this.updateLevelRepeatsSettings();
  }

  saveSettings() {
    if (!this.isAdmin) {
      this.showToast('Hanya admin yang dapat mengubah pengaturan!', 'error');
      return;
    }
    this.settings.questionTime = parseInt(document.getElementById('questionTime').value);
    this.settings.showFeedback = document.getElementById('showFeedback').checked;
    this.settings.shuffleQuestions = document.getElementById('shuffleQuestions').checked;
    this.settings.darkMode = document.getElementById('darkMode').checked;
    this.settings.singleDeviceMode = document.getElementById('singleDeviceMode').checked;
    document.documentElement.setAttribute('data-theme', this.settings.darkMode ? 'dark' : '');
    const repeatInputs = document.querySelectorAll('#levelRepeatsSettings input');
    repeatInputs.forEach(input => {
      const levelIndex = parseInt(input.dataset.level);
      const value = parseInt(input.value);
      if (!isNaN(value) && this.levels[levelIndex].requiredRepeats !== value) {
        this.setLevelRepeats(levelIndex, value, true);
      }
    });
    localStorage.setItem('gameSettings', JSON.stringify(this.settings));
    this.showToast('Pengaturan berhasil disimpan!', 'success');
    this.closeSettings();
  }

  closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
    const repeatsContainer = document.getElementById('levelRepeatsSettings');
    const toggleIcon = document.getElementById('toggleIcon');
    repeatsContainer.classList.add('hidden');
    toggleIcon.classList.remove('rotate');
  }

  saveData() {
    localStorage.setItem('quizLevels', JSON.stringify(this.levels));
    localStorage.setItem('gameStats', JSON.stringify(this.gameStats));
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' :
                 'fa-info-circle';
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
function showWelcome() {
  document.getElementById('welcomeSection').classList.remove('hidden');
  document.getElementById('levelSection').classList.add('hidden');
  document.getElementById('addQuestionSection').classList.add('hidden');
  document.getElementById('addLevelSection').classList.add('hidden');
  document.getElementById('adminSection').classList.add('hidden');
}

function showLevelSelect() {
  document.getElementById('welcomeSection').classList.add('hidden');
  document.getElementById('levelSection').classList.remove('hidden');
  document.getElementById('addQuestionSection').classList.add('hidden');
  document.getElementById('addLevelSection').classList.add('hidden');
  document.getElementById('adminSection').classList.add('hidden');
}

function showAddQuestion() {
  document.getElementById('welcomeSection').classList.add('hidden');
  document.getElementById('levelSection').classList.add('hidden');
  document.getElementById('addQuestionSection').classList.remove('hidden');
  document.getElementById('addLevelSection').classList.add('hidden');
  document.getElementById('adminSection').classList.add('hidden');
}

function showAddLevel() {
  document.getElementById('welcomeSection').classList.add('hidden');
  document.getElementById('levelSection').classList.add('hidden');
  document.getElementById('addQuestionSection').classList.add('hidden');
  document.getElementById('addLevelSection').classList.remove('hidden');
  document.getElementById('adminSection').classList.add('hidden');
}

function showAdminPanel() {
  document.getElementById('welcomeSection').classList.add('hidden');
  document.getElementById('levelSection').classList.add('hidden');
  document.getElementById('addQuestionSection').classList.add('hidden');
  document.getElementById('addLevelSection').classList.add('hidden');
  document.getElementById('adminSection').classList.remove('hidden');
  showTab('addStudent');
}

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');
}

function showSettings() {
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  game.closeSettings();
}

function saveSettings() {
  game.saveSettings();
}

function toggleLevelRepeats() {
  const repeatsContainer = document.getElementById('levelRepeatsSettings');
  const toggleIcon = document.getElementById('toggleIcon');
  repeatsContainer.classList.toggle('hidden');
  toggleIcon.classList.toggle('rotate');
}

function closeLoginModal() {
  game.closeLoginModal();
}

// Initialize Game
let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new QuizGame();
});

// Export functions for button onclick handlers
window.showWelcome = showWelcome;
window.showLevelSelect = showLevelSelect;
window.showAddQuestion = showAddQuestion;
window.showAddLevel = showAddLevel;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.closeQuiz = () => game.closeQuiz();
window.closeResult = () => game.closeResult();
window.startNextLevel = () => game.startNextLevel();
window.deleteQuestion = (levelIndex, questionIndex) => game.deleteQuestion(levelIndex, questionIndex);
window.toggleLevelRepeats = toggleLevelRepeats;
window.showAdminPanel = showAdminPanel;
window.showTab = showTab;
window.closeLoginModal = closeLoginModal;
