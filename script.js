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
        
        this.currentQuiz = {
            level: 0,
            questions: [],
            currentQuestion: 0,
            score: 0,
            startTime: 0,
            timeRemaining: 60,
            answers: []
        };
        
        this.timerInterval = null;
        this.init();
    }
    
    initializeDefaultLevels() {
        return [
            {
                id: 1,
                name: "Level 1 - Dasar",
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
                bestTime: 0
            },
            {
                id: 2,
                name: "Level 2 - Menengah",
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
                bestTime: 0
            }
        ];
    }
    
    init() {
        this.updateUI();
        this.generateParticles();
        this.bindEvents();
        this.updateLevelSelect();
    }
    
    bindEvents() {
        // Form submission
        document.getElementById('addQuestionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addQuestion();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!document.getElementById('quizModal').classList.contains('hidden')) {
                    this.closeQuiz();
                } else if (!document.getElementById('resultModal').classList.contains('hidden')) {
                    this.closeResult();
                }
            }
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
        // Update header stats
        document.getElementById('totalScore').textContent = this.gameStats.totalScore;
        document.getElementById('completedLevels').textContent = this.gameStats.completedLevels;
        document.getElementById('streak').textContent = this.gameStats.streak;
        document.getElementById('totalTime').textContent = Math.floor(this.gameStats.totalTime / 60) + 'm';
        
        // Update progress circle
        const progress = (this.gameStats.completedLevels / this.levels.length) * 100;
        const circumference = 2 * Math.PI * 20;
        const offset = circumference - (progress / 100) * circumference;
        document.getElementById('progress-circle').style.strokeDashoffset = offset;
        document.getElementById('progressText').textContent = Math.round(progress) + '%';
        
        this.renderLevels();
    }
    
    renderLevels() {
        const container = document.getElementById('levelGrid');
        container.innerHTML = '';
        
        this.levels.forEach((level, index) => {
            const isUnlocked = index < this.gameStats.unlockedLevels;
            const isCompleted = level.completed;
            
            const levelCard = document.createElement('div');
            levelCard.className = `level-card ${!isUnlocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`;
            
            levelCard.innerHTML = `
                <div class="level-icon">
                    <i class="fas ${!isUnlocked ? 'fa-lock' : isCompleted ? 'fa-trophy' : 'fa-play-circle'}"></i>
                </div>
                <div class="level-number">${level.name}</div>
                <div class="level-questions">${level.questions.length} Soal</div>
                ${isCompleted ? `<div class="level-score">Skor: ${level.score}</div>` : ''}
            `;
            
            if (isUnlocked) {
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
    
    addQuestion() {
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
        
        // Validation
        if (levelIndex === '' || !questionText || options.some(opt => !opt)) {
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
        
        // Reset form
        document.getElementById('addQuestionForm').reset();
        
        this.showToast('Soal berhasil ditambahkan!', 'success');
        this.showLevelSelect();
    }
    
    startLevel(levelIndex) {
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
        this.currentQuiz.timeRemaining = 60;
        this.currentQuiz.answers = [];
        
        this.shuffleArray(this.currentQuiz.questions);
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
    }
    
    selectAnswer(selectedIndex) {
        const question = this.currentQuiz.questions[this.currentQuiz.currentQuestion];
        const buttons = document.querySelectorAll('.option-button');
        
        // Disable all buttons
        buttons.forEach(btn => btn.style.pointerEvents = 'none');
        
        // Show correct/incorrect
        buttons[selectedIndex].classList.add(selectedIndex === question.correct ? 'correct' : 'incorrect');
        if (selectedIndex !== question.correct) {
            buttons[question.correct].classList.add('correct');
        }
        
        // Record answer
        this.currentQuiz.answers.push({
            questionIndex: this.currentQuiz.currentQuestion,
            selected: selectedIndex,
            correct: question.correct,
            isCorrect: selectedIndex === question.correct
        });
        
        // Calculate score
        if (selectedIndex === question.correct) {
            const points = question.difficulty === 'easy' ? 10 : question.difficulty === 'medium' ? 20 : 30;
            this.currentQuiz.score += points;
        }
        
        // Next question after delay
        setTimeout(() => {
            this.nextQuestion();
        }, 1500);
    }
    
    nextQuestion() {
        this.currentQuiz.currentQuestion++;
        
        if (this.currentQuiz.currentQuestion >= this.currentQuiz.questions.length) {
            this.finishQuiz();
        } else {
            this.displayQuestion();
        }
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            this.currentQuiz.timeRemaining--;
            document.getElementById('timer').textContent = this.currentQuiz.timeRemaining;
            
            if (this.currentQuiz.timeRemaining <= 0) {
                this.finishQuiz();
            }
        }, 1000);
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
        const totalTime = Math.floor((Date.now() - this.currentQuiz.startTime) / 1000);
        const correctAnswers = this.currentQuiz.answers.filter(a => a.isCorrect).length;
        const accuracy = Math.round((correctAnswers / this.currentQuiz.questions.length) * 100);
        
        // Update level data
        const isNewRecord = !level.completed || this.currentQuiz.score > level.score;
        level.completed = true;
        level.score = Math.max(level.score, this.currentQuiz.score);
        level.bestTime = level.bestTime === 0 ? totalTime : Math.min(level.bestTime, totalTime);
        
        // Update game stats
        if (isNewRecord) {
            this.gameStats.totalScore += this.currentQuiz.score - (level.score - this.currentQuiz.score);
        }
        
        if (this.currentQuiz.level + 1 === this.gameStats.completedLevels) {
            this.gameStats.completedLevels++;
            this.gameStats.streak++;
        }
        
        if (this.currentQuiz.level + 1 >= this.gameStats.unlockedLevels && accuracy >= 70) {
            this.gameStats.unlockedLevels = Math.min(this.gameStats.unlockedLevels + 1, this.levels.length);
        }
        
        this.gameStats.totalTime += totalTime;
        
        this.saveData();
        this.showResult(correctAnswers, totalTime, accuracy);
    }
    
    showResult(correctAnswers, totalTime, accuracy) {
        document.getElementById('quizModal').classList.add('hidden');
        
        const resultModal = document.getElementById('resultModal');
        const resultIcon = document.getElementById('resultIcon');
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        
        if (accuracy >= 70) {
            resultIcon.className = 'result-icon success';
            resultIcon.innerHTML = '<i class="fas fa-trophy"></i>';
            resultTitle.textContent = 'Selamat!';
            resultMessage.textContent = 'Anda berhasil menyelesaikan level ini!';
        } else {
            resultIcon.className = 'result-icon fail';
            resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
            resultTitle.textContent = 'Belum Berhasil';
            resultMessage.textContent = 'Coba lagi untuk mendapatkan nilai yang lebih baik!';
        }
        
        document.getElementById('levelScore').textContent = this.currentQuiz.score;
        document.getElementById('levelTime').textContent = totalTime + 's';
        document.getElementById('levelAccuracy').textContent = accuracy + '%';
        
        const nextBtn = document.getElementById('nextLevelBtn');
        if (this.currentQuiz.level + 1 < this.levels.length && accuracy >= 70) {
            nextBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'none';
        }
        
        resultModal.classList.remove('hidden');
        
        // Update UI
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
}

function showLevelSelect() {
    document.getElementById('welcomeSection').classList.add('hidden');
    document.getElementById('levelSection').classList.remove('hidden');
    document.getElementById('addQuestionSection').classList.add('hidden');
}

function showAddQuestion() {
    document.getElementById('welcomeSection').classList.add('hidden');
    document.getElementById('levelSection').classList.add('hidden');
    document.getElementById('addQuestionSection').classList.remove('hidden');
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
window.closeQuiz = () => game.closeQuiz();
window.closeResult = () => game.closeResult();
window.startNextLevel = () => game.startNextLevel();