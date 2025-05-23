import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase
const supabase = createClient('https://wqcsyrycewaxdgsfjbqf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxY3N5cnljZXdheGRnc2ZqYnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5Mjc1MDEsImV4cCI6MjA2MzUwMzUwMX0.v24w0cq4bZcEcIjr-57V_uPjOCLKMmStbyAaEX1I1dY');

// Game State Management
class QuizGame {
    constructor() {
        this.user = null;
        this.currentStudentId = null; // Untuk mode 1 device
        this.levels = [];
        this.students = [];
        this.classes = [];
        this.gameStats = {
            totalScore: 0,
            completedLevels: 0,
            streak: 0,
            totalTime: 0,
            unlockedLevels: 1
        };
        this.settings = {
            questionTime: 30,
            showFeedback: true,
            shuffleQuestions: true,
            darkMode: false
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
        this.timerInterval = null;
        this.init();
    }

    async init() {
        await this.initAuth();
        this.generateParticles();
        this.bindEvents();
        this.loadSettings();
    }

    async initAuth() {
        const { data: { user } } = await supabase.auth.getUser();
        this.user = user;
        if (!user) {
            window.location.href = 'login.html'; // Redirect ke login jika belum autentikasi
        } else {
            await this.loadUserData();
            this.updateUI();
            if (this.user.role === 'guru') {
                this.subscribeToGameStats();
            }
        }
    }

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            this.showToast('Login gagal: ' + error.message, 'error');
            return false;
        }
        this.user = data.user;
        window.location.href = data.user.role === 'guru' ? 'guru-dashboard.html' : 'murid-dashboard.html';
        return true;
    }

    async signup(email, password, name, role) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            this.showToast('Pendaftaran gagal: ' + error.message, 'error');
            return false;
        }
        await supabase.from('users').insert({ id: data.user.id, email, name, role });
        this.user = data.user;
        window.location.href = role === 'guru' ? 'guru-dashboard.html' : 'murid-dashboard.html';
        return true;
    }

    async loadUserData() {
        if (this.user.role === 'guru') {
            this.levels = await this.loadLevels(this.user.id);
            this.students = await this.loadStudents(this.user.id);
            this.classes = await this.loadClasses(this.user.id);
        } else {
            this.levels = await this.loadAssignedLevels(this.user.id);
            this.gameStats = await this.loadUserStats(this.user.id);
        }
        this.updateLevelSelect();
    }

    async loadLevels(guruId) {
        const { data, error } = await supabase.from('levels').select('*').eq('guru_id', guruId);
        if (error) throw error;
        return data;
    }

    async loadQuestions(levelId) {
        const { data, error } = await supabase.from('questions').select('*').eq('level_id', levelId);
        if (error) throw error;
        return data;
    }

    async loadStudents(guruId) {
        const { data, error } = await supabase.from('class_students')
            .select('users(id, name)')
            .eq('class_id', (await this.loadClasses(guruId))[0]?.id);
        if (error) throw error;
        return data.map(d => d.users);
    }

    async loadClasses(guruId) {
        const { data, error } = await supabase.from('classes').select('*').eq('guru_id', guruId);
        if (error) throw error;
        return data;
    }

    async loadAssignedLevels(userId) {
        const { data, error } = await supabase.from('class_students')
            .select('classes(levels(*))')
            .eq('student_id', userId);
        if (error) throw error;
        return data.flatMap(d => d.classes.levels);
    }

    async loadUserStats(userId) {
        const { data, error } = await supabase.from('game_stats').select('*').eq('user_id', userId);
        if (error) throw error;
        return {
            totalScore: data.reduce((sum, stat) => sum + stat.score, 0),
            completedLevels: data.filter(stat => stat.accuracy >= 70).length,
            streak: Math.max(...data.map(stat => stat.streak) || [0]),
            totalTime: data.reduce((sum, stat) => sum + stat.time, 0),
            unlockedLevels: data.length + 1
        };
    }

    generateParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
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

    bindEvents() {
        const addQuestionForm = document.getElementById('addQuestionForm');
        if (addQuestionForm) {
            addQuestionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addQuestion();
            });
        }

        const addLevelForm = document.getElementById('addLevelForm');
        if (addLevelForm) {
            addLevelForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addLevel();
            });
        }

        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                await this.login(email, password);
            });
        }

        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const name = document.getElementById('name').value;
                const role = document.getElementById('role').value;
                await this.signup(email, password, name, role);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!document.getElementById('quizModal')?.classList.contains('hidden')) {
                    this.closeQuiz();
                } else if (!document.getElementById('resultModal')?.classList.contains('hidden')) {
                    this.closeResult();
                } else if (!document.getElementById('settingsModal')?.classList.contains('hidden')) {
                    this.closeSettings();
                }
            }
        });

        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }
    }

    async createClass(name) {
        const code = this.generateClassCode();
        const { data, error } = await supabase.from('classes').insert({
            guru_id: this.user.id,
            name,
            code
        });
        if (error) {
            this.showToast('Gagal membuat kelas: ' + error.message, 'error');
            return;
        }
        this.classes.push(data[0]);
        this.showToast('Kelas berhasil dibuat! Kode: ' + code, 'success');
        this.updateUI();
    }

    async addStudent(classId, name, email) {
        const { data: user, error } = await supabase.from('users').insert({
            email,
            name,
            role: 'murid'
        });
        if (error) {
            this.showToast('Gagal menambah murid: ' + error.message, 'error');
            return;
        }
        const { error: joinError } = await supabase.from('class_students').insert({
            class_id: classId,
            student_id: user.id
        });
        if (joinError) {
            this.showToast('Gagal menambah murid ke kelas: ' + joinError.message, 'error');
            return;
        }
        this.students.push(user);
        this.showToast('Murid berhasil ditambahkan!', 'success');
        this.updateUI();
    }

    async joinClass(code) {
        const { data: classData, error } = await supabase.from('classes').select('id').eq('code', code).single();
        if (error) {
            this.showToast('Kode kelas tidak valid!', 'error');
            return;
        }
        const { error: joinError } = await supabase.from('class_students').insert({
            class_id: classData.id,
            student_id: this.user.id
        });
        if (joinError) {
            this.showToast('Gagal bergabung: ' + joinError.message, 'error');
            return;
        }
        this.showToast('Berhasil bergabung ke kelas!', 'success');
        this.loadUserData();
    }

    generateClassCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async addLevel() {
        const levelName = document.getElementById('levelName')?.value.trim();
        const levelDescription = document.getElementById('levelDescription')?.value.trim();
        const classId = document.getElementById('classSelect')?.value;

        if (!levelName) {
            this.showToast('Nama level tidak boleh kosong!', 'error');
            return;
        }

        const { data, error } = await supabase.from('levels').insert({
            guru_id: this.user.id,
            class_id: classId || null,
            name: levelName,
            description: levelDescription || 'Level baru',
            required_repeats: 2
        });
        if (error) {
            this.showToast('Gagal membuat level: ' + error.message, 'error');
            return;
        }

        this.levels.push(data[0]);
        this.updateUI();
        this.updateLevelSelect();
        document.getElementById('addLevelForm')?.reset();
        this.showToast('Level baru berhasil dibuat!', 'success');
        showLevelSelect();
    }

    async addQuestion() {
        const levelIndex = parseInt(document.getElementById('levelSelect')?.value);
        const questionText = document.getElementById('questionText')?.value.trim();
        const options = [
            document.getElementById('option1')?.value.trim(),
            document.getElementById('option2')?.value.trim(),
            document.getElementById('option3')?.value.trim(),
            document.getElementById('option4')?.value.trim()
        ];
        const correctAnswer = parseInt(document.querySelector('input[name="correctAnswer"]:checked')?.value);
        const difficulty = document.getElementById('difficulty')?.value;

        if (isNaN(levelIndex) || !questionText || options.some(opt => !opt)) {
            this.showToast('Harap lengkapi semua field!', 'error');
            return;
        }

        const { data, error } = await supabase.from('questions').insert({
            level_id: this.levels[levelIndex].id,
            question: questionText,
            options: JSON.stringify(options),
            correct: correctAnswer,
            difficulty
        });
        if (error) {
            this.showToast('Gagal menambah soal: ' + error.message, 'error');
            return;
        }

        this.levels[levelIndex].questions = this.levels[levelIndex].questions || [];
        this.levels[levelIndex].questions.push(data[0]);
        this.updateUI();
        document.getElementById('addQuestionForm')?.reset();
        this.showToast('Soal berhasil ditambahkan!', 'success');
        showLevelSelect();
    }

    async deleteQuestion(levelIndex, questionId) {
        if (confirm('Apakah Anda yakin ingin menghapus soal ini?')) {
            const { error } = await supabase.from('questions').delete().eq('id', questionId);
            if (error) {
                this.showToast('Gagal menghapus soal: ' + error.message, 'error');
                return;
            }
            this.levels[levelIndex].questions = this.levels[levelIndex].questions.filter(q => q.id !== questionId);
            this.updateUI();
            this.showToast('Soal berhasil dihapus!', 'success');
        }
    }

    async deleteStudent(studentId) {
        if (confirm('Apakah Anda yakin ingin menghapus murid ini?')) {
            const { error } = await supabase.from('class_students').delete().eq('student_id', studentId);
            if (error) {
                this.showToast('Gagal menghapus murid: ' + error.message, 'error');
                return;
            }
            this.students = this.students.filter(s => s.id !== studentId);
            this.updateUI();
            this.showToast('Murid berhasil dihapus!', 'success');
        }
    }

    updateUI() {
        if (!this.user) return;

        // Update header stats
        const totalScore = document.getElementById('totalScore');
        const completedLevels = document.getElementById('completedLevels');
        const streak = document.getElementById('streak');
        const totalTime = document.getElementById('totalTime');
        if (totalScore) totalScore.textContent = this.gameStats.totalScore;
        if (completedLevels) completedLevels.textContent = this.gameStats.completedLevels;
        if (streak) streak.textContent = this.gameStats.streak;
        if (totalTime) totalTime.textContent = Math.floor(this.gameStats.totalTime / 60) + 'm';

        // Update progress circle
        const progressCircle = document.getElementById('progress-circle');
        const progressText = document.getElementById('progressText');
        if (progressCircle && progressText) {
            const progress = (this.gameStats.completedLevels / this.levels.length) * 100;
            const circumference = 2 * Math.PI * 20;
            const offset = circumference - (progress / 100) * circumference;
            progressCircle.style.strokeDashoffset = offset;
            progressText.textContent = Math.round(progress) + '%';
        }

        this.renderLevels();
        this.renderStudents();
        this.updateLevelRepeatsSettings();
    }

    renderLevels() {
        const container = document.getElementById('levelGrid');
        if (!container) return;
        container.innerHTML = '';

        this.levels.forEach((level, index) => {
            const isUnlocked = index < this.gameStats.unlockedLevels;
            const isCompleted = level.completed && level.currentRepeats >= level.required_repeats;

            const levelCard = document.createElement('div');
            levelCard.className = `level-card ${!isUnlocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`;
            levelCard.innerHTML = `
                <div class="level-icon">
                    <i class="fas ${!isUnlocked ? 'fa-lock' : isCompleted ? 'fa-trophy' : 'fa-play-circle'}"></i>
                </div>
                <div class="level-number">${level.name}</div>
                <div class="level-questions">${level.questions?.length || 0} Soal</div>
                ${isCompleted ? `<div class="level-score">Skor: ${level.score}</div>` : ''}
                <div class="repeat-status">Pengulangan: ${level.currentRepeats || 0}/${level.required_repeats}</div>
            `;

            if (isUnlocked && !isCompleted) {
                levelCard.addEventListener('click', () => this.startLevel(index, this.currentStudentId));
            }

            container.appendChild(levelCard);
        });
    }

    renderStudents() {
        const container = document.getElementById('studentList');
        if (!container) return;
        container.innerHTML = '';

        this.students.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.name}</td>
                <td>${student.completedLevels || 0}</td>
                <td>${student.totalScore || 0}</td>
                <td>${student.totalTime || 0}s</td>
                <td><button onclick="game.deleteStudent('${student.id}')">Hapus</button></td>
            `;
            container.appendChild(row);
        });
    }

    updateLevelSelect() {
        const select = document.getElementById('levelSelect');
        if (!select) return;
        select.innerHTML = '<option value="">Pilih Level</option>';

        this.levels.forEach((level, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = level.name;
            select.appendChild(option);
        });
    }

    updateLevelRepeatsSettings() {
        const container = document.getElementById('levelRepeatsSettings');
        if (!container) return;
        container.innerHTML = '';

        this.levels.forEach((level, index) => {
            const item = document.createElement('div');
            item.className = 'level-repeat-item';
            item.innerHTML = `
                <label>${level.name}</label>
                <input type="number" min="1" max="10" value="${level.required_repeats}" data-level="${index}">
            `;
            container.appendChild(item);
        });
    }

    async setLevelRepeats(levelIndex, value, silent = false) {
        const repeats = parseInt(value);
        if (isNaN(repeats) || repeats < 1 || repeats > 10) {
            this.showToast('Jumlah pengulangan harus antara 1 dan 10!', 'error');
            return;
        }
        const { error } = await supabase.from('levels').update({ required_repeats: repeats }).eq('id', this.levels[levelIndex].id);
        if (error) {
            this.showToast('Gagal mengatur pengulangan: ' + error.message, 'error');
            return;
        }
        this.levels[levelIndex].required_repeats = repeats;
        this.updateUI();
        if (!silent) {
            this.showToast(`Jumlah pengulangan untuk ${this.levels[levelIndex].name} diatur ke ${repeats}!`, 'success');
        }
    }

    async startLevel(levelIndex, studentId = null) {
        if (this.user.role === 'guru' && !studentId) {
            this.showToast('Pilih murid terlebih dahulu!', 'error');
            return;
        }
        if (levelIndex >= this.gameStats.unlockedLevels) {
            this.showToast('Level ini masih terkunci!', 'error');
            return;
        }

        const level = this.levels[levelIndex];
        const questions = await this.loadQuestions(level.id);
        if (questions.length === 0) {
            this.showToast('Level ini belum memiliki soal!', 'error');
            return;
        }

        this.currentStudentId = studentId || this.user.id;
        this.currentQuiz = {
            level: levelIndex,
            questions,
            currentQuestion: 0,
            score: 0,
            startTime: Date.now(),
            timeRemaining: this.settings.questionTime,
            answers: []
        };

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
        const quizModal = document.getElementById('quizModal');
        if (!quizModal) return;
        quizModal.classList.remove('hidden');
        document.getElementById('currentLevelBadge').textContent = this.levels[this.currentQuiz.level].name;
        document.getElementById('totalQuestions').textContent = this.currentQuiz.questions.length;
        if (this.user.role === 'guru' && this.currentStudentId) {
            supabase.from('users').select('name').eq('id', this.currentStudentId).single().then(({ data }) => {
                document.getElementById('currentStudent')?.textContent = `Murid: ${data.name}`;
            });
        }
    }

    displayQuestion() {
        const question = this.currentQuiz.questions[this.currentQuiz.currentQuestion];
        document.getElementById('questionTitle').textContent = question.question;
        document.getElementById('currentQuestion').textContent = this.currentQuiz.currentQuestion + 1;

        const optionsContainer = document.getElementById('optionsGrid');
        optionsContainer.innerHTML = '';

        JSON.parse(question.options).forEach((option, index) => {
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
            buttons[question.correct].classList.add('correct');
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

    async failQuiz() {
        this.stopTimer();
        const level = this.levels[this.currentQuiz.level];
        const totalTime = Math.floor((Date.now() - this.currentQuiz.startTime) / 1000);
        const correctAnswers = this.currentQuiz.answers.filter(a => a.isCorrect).length;
        const accuracy = Math.round((correctAnswers / this.currentQuiz.questions.length) * 100);

        await supabase.from('game_stats').insert({
            user_id: this.currentStudentId,
            level_id: level.id,
            score: this.currentQuiz.score,
            time: totalTime,
            accuracy
        });

        document.getElementById('quizModal').classList.add('hidden');

        const resultModal = document.getElementById('resultModal');
        const resultIcon = document.getElementById('resultIcon');
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');

        resultIcon.className = 'result-icon fail';
        resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
        resultTitle.textContent = 'Belum Berhasil';
        resultMessage.textContent = `Waktu habis atau akurasi di bawah 70%! Anda telah menyelesaikan ${level.currentRepeats || 0}/${level.required_repeats} pengulangan. Coba lagi!`;

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

    async finishQuiz() {
        this.stopTimer();
        const level = this.levels[this.currentQuiz.level];
        const totalTime = Math.floor((Date.now() - this.currentQuiz.startTime) / 1000);
        const correctAnswers = this.currentQuiz.answers.filter(a => a.isCorrect).length;
        const accuracy = Math.round((correctAnswers / this.currentQuiz.questions.length) * 100);

        const isNewRecord = !level.completed || this.currentQuiz.score > level.score;
        level.score = Math.max(level.score || 0, this.currentQuiz.score);
        level.bestTime = level.bestTime === 0 ? totalTime : Math.min(level.bestTime || Infinity, totalTime);

        if (accuracy >= 70) {
            level.currentRepeats = (level.currentRepeats || 0) + 1;
        }
        level.completed = level.currentRepeats >= level.required_repeats;

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

        await supabase.from('game_stats').insert({
            user_id: this.currentStudentId,
            level_id: level.id,
            score: this.currentQuiz.score,
            time: totalTime,
            accuracy
        });

        await supabase.from('levels').update({
            score: level.score,
            bestTime: level.bestTime,
            currentRepeats: level.currentRepeats,
            completed: level.completed
        }).eq('id', level.id);

        this.showResult(correctAnswers, totalTime, accuracy);
    }

    showResult(correctAnswers, totalTime, accuracy) {
        document.getElementById('quizModal').classList.add('hidden');

        const resultModal = document.getElementById('resultModal');
        const resultIcon = document.getElementById('resultIcon');
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        const level = this.levels[this.currentQuiz.level];

        if (accuracy >= 70 && level.currentRepeats >= level.required_repeats) {
            resultIcon.className = 'result-icon success';
            resultIcon.innerHTML = '<i class="fas fa-trophy"></i>';
            resultTitle.textContent = 'Selamat!';
            resultMessage.textContent = `Anda berhasil menyelesaikan ${level.name} dengan ${level.currentRepeats}/${level.required_repeats} pengulangan!`;
        } else if (accuracy >= 70) {
            resultIcon.className = 'result-icon success';
            resultIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            resultTitle.textContent = 'Pengulangan Berhasil!';
            resultMessage.textContent = `Anda telah menyelesaikan pengulangan ${level.currentRepeats}/${level.required_repeats}. Selesaikan ${level.required_repeats - level.currentRepeats} pengulangan lagi untuk membuka level berikutnya!`;
        } else {
            resultIcon.className = 'result-icon fail';
            resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
            resultTitle.textContent = 'Belum Berhasil';
            resultMessage.textContent = `Akurasi Anda di bawah 70%. Anda telah menyelesaikan ${level.currentRepeats || 0}/${level.required_repeats} pengulangan. Coba lagi untuk mendapatkan nilai yang lebih baik!`;
        }

        document.getElementById('levelScore').textContent = this.currentQuiz.score;
        document.getElementById('levelTime').textContent = totalTime + 's';
        document.getElementById('levelAccuracy').textContent = accuracy + '%';

        const nextBtn = document.getElementById('nextLevelBtn');
        if (this.currentQuiz.level + 1 < this.levels.length && level.currentRepeats >= level.required_repeats) {
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
        showLevelSelect();
    }

    closeResult() {
        document.getElementById('resultModal').classList.add('hidden');
        showLevelSelect();
    }

    startNextLevel() {
        this.closeResult();
        if (this.currentQuiz.level + 1 < this.levels.length) {
            this.startLevel(this.currentQuiz.level + 1, this.currentStudentId);
        }
    }

    async loadSettings() {
        const { data, error } = await supabase.from('settings').select('*').eq('user_id', this.user.id).single();
        if (data) {
            this.settings = data;
        }
        const questionTime = document.getElementById('questionTime');
        const showFeedback = document.getElementById('showFeedback');
        const shuffleQuestions = document.getElementById('shuffleQuestions');
        const darkMode = document.getElementById('darkMode');
        if (questionTime) questionTime.value = this.settings.questionTime;
        if (showFeedback) showFeedback.checked = this.settings.showFeedback;
        if (shuffleQuestions) shuffleQuestions.checked = this.settings.shuffleQuestions;
        if (darkMode) {
            darkMode.checked = this.settings.darkMode;
            document.documentElement.setAttribute('data-theme', this.settings.darkMode ? 'dark' : '');
        }
        this.updateLevelRepeatsSettings();
    }

    async saveSettings() {
        this.settings.questionTime = parseInt(document.getElementById('questionTime')?.value);
        this.settings.showFeedback = document.getElementById('showFeedback')?.checked;
        this.settings.shuffleQuestions = document.getElementById('shuffleQuestions')?.checked;
        this.settings.darkMode = document.getElementById('darkMode')?.checked;
        document.documentElement.setAttribute('data-theme', this.settings.darkMode ? 'dark' : '');

        const repeatInputs = document.querySelectorAll('#levelRepeatsSettings input');
        for (const input of repeatInputs) {
            const levelIndex = parseInt(input.dataset.level);
            const value = parseInt(input.value);
            if (!isNaN(value) && this.levels[levelIndex].required_repeats !== value) {
                await this.setLevelRepeats(levelIndex, value, true);
            }
        }

        await supabase.from('settings').upsert({
            user_id: this.user.id,
            ...this.settings
        });

        this.showToast('Pengaturan berhasil disimpan!', 'success');
        this.closeSettings();
    }

    closeSettings() {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) settingsModal.classList.add('hidden');
        const repeatsContainer = document.getElementById('levelRepeatsSettings');
        const toggleIcon = document.getElementById('toggleIcon');
        if (repeatsContainer) repeatsContainer.classList.add('hidden');
        if (toggleIcon) toggleIcon.classList.remove('rotate');
    }

    subscribeToGameStats() {
        supabase
            .channel('game_stats')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_stats' }, async payload => {
                const { user_id, level_id, score, time, accuracy } = payload.new;
                const { data: user } = await supabase.from('users').select('name').eq('id', user_id).single();
                const { data: level } = await supabase.from('levels').select('name').eq('id', level_id).single();
                this.updateGuruDashboard({ name: user.name, level: level.name, score, time, accuracy });
            })
            .subscribe();
    }

    updateGuruDashboard(data) {
        const table = document.getElementById('studentList');
        if (!table) return;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.name}</td>
            <td>${data.level}</td>
            <td>${data.score}</td>
            <td>${data.time}s</td>
            <td><button onclick="game.deleteStudent('${data.user_id}')">Hapus</button></td>
        `;
        table.appendChild(row);
    }

    async renderClassPerformanceChart(classId) {
        const { data } = await supabase.from('game_stats').select('score, user_id').eq('class_id', classId);
        const scores = data.map(d => d.score);
        const labels = await Promise.all(data.map(async d => {
            const { data: user } = await supabase.from('users').select('name').eq('id', d.user_id).single();
            return user.name;
        }));

        ```chartjs
        {
            "type": "bar",
            "data": {
                "labels": ${JSON.stringify(labels)},
                "datasets": [{
                    "label": "Skor",
                    "data": ${JSON.stringify(scores)},
                    "backgroundColor": "#3498db",
                    "borderColor": "#2980b9",
                    "borderWidth": 1
                }]
            },
            "options": {
                "scales": {
                    "y": {
                        "beginAtZero": true,
                        "title": {
                            "display": true,
                            "text": "Skor"
                        }
                    },
                    "x": {
                        "title": {
                            "display": true,
                            "text": "Murid"
                        }
                    }
                },
                "plugins": {
                    "legend": {
                        "display": true
                    }
                }
            }
        }
}

showToast(message, type = 'info') {
const container = document.getElementById('toastContainer');
if (!container) return;
const toast = document.createElement('div');
toast.className = toast ${type};
const icon = type === 'success' ? 'fa-check-circle' :
type === 'error' ? 'fa-exclamation-circle' :
'fa-info-circle';
toast.innerHTML =             <i class="fas ${icon}"></i>             <span>${message}</span>        ;
container.appendChild(toast);
setTimeout(() => toast.remove(), 3000);
}
}

// Navigation Functions
function showWelcome() {
const welcomeSection = document.getElementById('welcomeSection');
const levelSection = document.getElementById('levelSection');
const addQuestionSection = document.getElementById('addQuestionSection');
const addLevelSection = document.getElementById('addLevelSection');
if (welcomeSection) welcomeSection.classList.remove('hidden');
if (levelSection) levelSection.classList.add('hidden');
if (addQuestionSection) addQuestionSection.classList.add('hidden');
if (addLevelSection) addLevelSection.classList.add('hidden');
}

function showLevelSelect() {
const welcomeSection = document.getElementById('welcomeSection');
const levelSection = document.getElementById('levelSection');
const addQuestionSection = document.getElementById('addQuestionSection');
const addLevelSection = document.getElementById('addLevelSection');
if (welcomeSection) welcomeSection.classList.add('hidden');
if (levelSection) levelSection.classList.remove('hidden');
if (addQuestionSection) addQuestionSection.classList.add('hidden');
if (addLevelSection) addLevelSection.classList.add('hidden');
}

function showAddQuestion() {
const welcomeSection = document.getElementById('welcomeSection');
const levelSection = document.getElementById('levelSection');
const addQuestionSection = document.getElementById('addQuestionSection');
const addLevelSection = document.getElementById('addLevelSection');
if (welcomeSection) welcomeSection.classList.add('hidden');
if (levelSection) levelSection.classList.add('hidden');
if (addQuestionSection) addQuestionSection.classList.remove('hidden');
if (addLevelSection) addLevelSection.classList.add('hidden');
}

function showAddLevel() {
const welcomeSection = document.getElementById('welcomeSection');
const levelSection = document.getElementById('levelSection');
const addQuestionSection = document.getElementById('addQuestionSection');
const addLevelSection = document.getElementById('addLevelSection');
if (welcomeSection) welcomeSection.classList.add('hidden');
if (levelSection) levelSection.classList.add('hidden');
if (addQuestionSection) addQuestionSection.classList.add('hidden');
if (addLevelSection) addLevelSection.classList.remove('hidden');
}

function showSettings() {
const settingsModal = document.getElementById('settingsModal');
if (settingsModal) settingsModal.classList.remove('hidden');
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
if (repeatsContainer) repeatsContainer.classList.toggle('hidden');
if (toggleIcon) toggleIcon.classList.toggle('rotate');
}

function showAddClass() {
const addClassModal = document.getElementById('addClassModal');
if (addClassModal) addClassModal.classList.remove('hidden');
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
window.deleteQuestion = (levelIndex, questionId) => game.deleteQuestion(levelIndex, questionId);
window.deleteStudent = (studentId) => game.deleteStudent(studentId);
window.toggleLevelRepeats = toggleLevelRepeats;
window.showAddClass = showAddClass;
