window.addEventListener("DOMContentLoaded", () => {
    // ===== Word Index Data =====
    // Tämä peli käyttää yhtä flat word_index.json-tiedostoa.
    //
    // word_index.json pitää olla valmiiksi lajiteltu.
    // Binary search toimii vain, jos lista on samassa järjestyksessä kuin compareWords käyttää.

    let WORD_INDEX = [];
    let wordIndexLoaded = false;

    // ===== Game Settings =====
    const MIN_WORD_LENGTH = 3;
    const MIN_TARGET_WORDS = 5;
    const MAX_TARGET_WORDS = 24;
    const MIN_LETTERS = 5;
    const MAX_LETTERS = 10;

    // ===== Game State =====
    let targetWordCount = 5;
    let foundWords = [];
    let letters = [];
    let isDragging = false;
    let selectedNodes = [];
    let selectedWord = "";
    let pointerPosition = null;
    let timerInterval = null;
    let elapsedSeconds = 0;
    let gameFinished = false;
    let messageTimeout = null;

    // ===== Elements =====
    const targetCountSelect = document.getElementById("targetCountSelect");
    const wordList = document.getElementById("wordList");
    const progressText = document.getElementById("progressText");
    const letterCircle = document.getElementById("letterCircle");
    const selectionLines = document.getElementById("selectionLines");
    const currentWord = document.getElementById("currentWord");
    const messageText = document.getElementById("messageText");
    const mainMenu = document.getElementById("mainMenu");
    const gameView = document.getElementById("gameView");
    const playButton = document.getElementById("playButton");
    const backButton = document.getElementById("backButton");
    const timerText = document.getElementById("timerText");
    const shuffleButton = document.getElementById("shuffleButton");
    const winScreen = document.getElementById("winScreen");
    const winTimeText = document.getElementById("winTimeText");
    const winWordText = document.getElementById("winWordText");
    const restartButton = document.getElementById("restartButton");
    const mainMenuButton = document.getElementById("mainMenuButton");
    const loadingScreen = document.getElementById("loadingScreen");
    const loadingText = document.getElementById("loadingText");

    // ===== Initialization =====
    initializeGame();

    letterCircle.addEventListener("pointerdown", startDrag);
    letterCircle.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    playButton.addEventListener("click", () => {
        if (playButton.disabled || !wordIndexLoaded) return;
        startGame();
    });

    backButton.addEventListener("click", returnToMenu);
    shuffleButton.addEventListener("click", shuffleCurrentLetters);
    restartButton.addEventListener("click", startGame);
    mainMenuButton.addEventListener("click", returnToMenu);

    // ===== Initialize Game =====
    async function initializeGame() {
        createTargetOptions();

        playButton.disabled = true;
        playButton.classList.add("disabled");

        showLoading("Loading word index...");
        await nextFrame();

        const loaded = await loadWordIndex();

        hideLoading();

        if (!loaded) {
            playButton.textContent = "Word index failed";
            playButton.disabled = true;
            playButton.classList.add("disabled");
            return;
        }

        updatePlayButton();
    }

    // ===== Target Options =====
    function createTargetOptions() {
        targetCountSelect.innerHTML = "";

        for (let count = MIN_TARGET_WORDS; count <= MAX_TARGET_WORDS; count++) {
            const option = document.createElement("option");

            option.value = String(count);
            option.textContent = `${count} words`;

            if (count === 10) {
                option.selected = true;
            }

            targetCountSelect.appendChild(option);
        }
    }

    // ===== Load Word Index =====
    async function loadWordIndex() {
        try {
            const response = await fetch("word_index.json");

            if (!response.ok) {
                throw new Error(`word_index.json request failed: ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error("word_index.json must be a JSON array.");
            }

            WORD_INDEX = cleanWordIndex(data);
            wordIndexLoaded = WORD_INDEX.length > 0;

            if (!wordIndexLoaded) {
                throw new Error("No usable words found.");
            }

            return true;
        } catch (error) {
            console.error("Failed to load word index:", error);
            loadingText.textContent = "Could not load word index.";
            return false;
        }
    }

    // ===== Clean Word Index =====
    function cleanWordIndex(words) {
        return [...new Set(words)]
            .map(word => normalizeWord(word))
            .filter(word => word.length >= MIN_WORD_LENGTH && word.length <= MAX_LETTERS)
            .filter(word => /^[a-zåäö]+$/i.test(word))
            .sort(compareWords);
    }

    // ===== Play Button =====
    function updatePlayButton() {
        playButton.disabled = !wordIndexLoaded;
        playButton.classList.toggle("disabled", !wordIndexLoaded);
        playButton.textContent = wordIndexLoaded ? "Play" : "Loading...";
    }

    // ===== Start Game =====
    async function startGame() {
        if (!wordIndexLoaded) return;

        gameFinished = false;
        targetWordCount = Number(targetCountSelect.value);
        foundWords = [];

        stopTimer();
        resetSelection();

        winScreen.classList.add("hidden");

        showLoading("Building letter circle...");
        await nextFrame();

        letters = createLetterCircle(targetWordCount);

        mainMenu.classList.add("hidden");
        gameView.classList.remove("hidden");

        createWordSlots();
        createLetterNodes(letters);
        updateProgressText();
        startTimer();

        clearMessage();
        hideLoading();
    }

    // ===== Return To Menu =====
    function returnToMenu() {
        gameFinished = false;

        stopTimer();
        resetSelection();
        hideLoading();
        clearMessage();

        winScreen.classList.add("hidden");
        gameView.classList.add("hidden");
        mainMenu.classList.remove("hidden");

        foundWords = [];
        letters = [];

        wordList.innerHTML = "";
        letterCircle.querySelectorAll(".letter-node").forEach(node => node.remove());

        progressText.textContent = "";
        currentWord.textContent = "";
        timerText.textContent = "00:00";
        winTimeText.textContent = "Time: 00:00";
        winWordText.textContent = "Words found: 0";
    }

    // ===== Create Letter Circle =====
    function createLetterCircle(targetCount) {
        const minSeedLength = getMinimumSeedLength(targetCount);
        const maxSeedLength = MAX_LETTERS;

        const candidates = WORD_INDEX.filter(word => (
            word.length >= minSeedLength &&
            word.length <= maxSeedLength &&
            new Set(word).size >= 4
        ));

        const seedWord = randomItem(candidates.length ? candidates : WORD_INDEX.filter(word => word.length >= MIN_LETTERS && word.length <= MAX_LETTERS));

        return shuffle([...seedWord]);
    }

    // ===== Minimum Seed Length =====
    function getMinimumSeedLength(targetCount) {
        if (targetCount >= 20) return 9;
        if (targetCount >= 14) return 8;
        if (targetCount >= 9) return 7;
        return 5;
    }

    // ===== Shuffle Current Letters =====
    function shuffleCurrentLetters() {
        if (gameFinished || !letters.length) return;

        letters = shuffle(letters);
        createLetterNodes(letters);
        resetSelection();
    }

    // ===== Create Word Slots =====
    function createWordSlots() {
        wordList.innerHTML = "";

        for (let i = 0; i < targetWordCount; i++) {
            const slot = document.createElement("div");

            slot.className = "guess-word";
            slot.textContent = "";

            wordList.appendChild(slot);
        }

        for (let i = targetWordCount; i < MAX_TARGET_WORDS; i++) {
            const empty = document.createElement("div");

            empty.className = "guess-word empty";
            wordList.appendChild(empty);
        }
    }

    // ===== Add Found Word To Next Slot =====
    function addFoundWord(word) {
        foundWords.push(word);

        const slot = wordList.children[foundWords.length - 1];

        slot.textContent = word;
        slot.classList.add("found");

        updateProgressText();

        if (foundWords.length >= targetWordCount) {
            showWinScreen();
        }
    }

    // ===== Create Letter Nodes =====
    function createLetterNodes(letters) {
        letterCircle.querySelectorAll(".letter-node").forEach(node => node.remove());

        const radius = letters.length >= 9 ? 37 : 34;

        letters.forEach((letter, index) => {
            const angle = Math.PI * 2 / letters.length * index - Math.PI / 2;
            const node = document.createElement("div");

            node.className = "letter-node";
            node.textContent = letter;
            node.dataset.letter = letter;
            node.style.left = `${50 + Math.cos(angle) * radius}%`;
            node.style.top = `${50 + Math.sin(angle) * radius}%`;
            node.style.transform = "translate(-50%, -50%)";

            letterCircle.appendChild(node);
        });
    }

    // ===== Drag Selection =====
    function startDrag(event) {
        if (gameFinished) return;

        isDragging = true;
        selectedNodes = [];
        selectedWord = "";
        pointerPosition = localPointer(event);

        const node = nodeUnderPointer(event);
        if (node) selectNode(node);

        updateWordText();
        drawSelectionLines();
    }

    function moveDrag(event) {
        if (!isDragging || gameFinished) return;

        pointerPosition = localPointer(event);

        const node = nodeUnderPointer(event);
        if (node && !selectedNodes.includes(node)) selectNode(node);

        updateWordText();
        drawSelectionLines();
    }

    function endDrag() {
        if (!isDragging || gameFinished) return;

        checkSelectedWord();
        resetSelection();
    }

    function selectNode(node) {
        node.classList.add("selected");
        selectedNodes.push(node);
        selectedWord += node.dataset.letter;
    }

    function resetSelection() {
        isDragging = false;

        selectedNodes.forEach(node => node.classList.remove("selected"));

        selectedNodes = [];
        selectedWord = "";
        pointerPosition = null;

        updateWordText();
        drawSelectionLines();
    }

    // ===== Check Selected Word =====
    function checkSelectedWord() {
        const word = normalizeWord(selectedWord);

        if (word.length < MIN_WORD_LENGTH) {
            showMessage("Too short");
            return;
        }

        if (foundWords.includes(word)) {
            showMessage("Already found");
            return;
        }

        if (!binarySearchWord(WORD_INDEX, word)) {
            showMessage("Not in word bank");
            return;
        }

        addFoundWord(word);
        showMessage("Found!");
    }

    // ===== Binary Search =====
    function binarySearchWord(words, target) {
        let left = 0;
        let right = words.length - 1;

        while (left <= right) {
            const middle = Math.floor((left + right) / 2);
            const current = words[middle];
            const comparison = compareWords(current, target);

            if (comparison === 0) {
                return true;
            }

            if (comparison < 0) {
                left = middle + 1;
            } else {
                right = middle - 1;
            }
        }

        return false;
    }

    // ===== Word Compare =====
    function compareWords(left, right) {
        if (left === right) return 0;
        return left < right ? -1 : 1;
    }

    // ===== UI Updates =====
    function updateWordText() {
        currentWord.textContent = selectedWord;
    }

    function updateProgressText() {
        progressText.textContent = `${foundWords.length} / ${targetWordCount}`;
    }

    function showMessage(text) {
        messageText.textContent = text;

        if (messageTimeout) {
            clearTimeout(messageTimeout);
        }

        messageTimeout = setTimeout(() => {
            messageText.textContent = "";
        }, 900);
    }

    function clearMessage() {
        if (messageTimeout) {
            clearTimeout(messageTimeout);
        }

        messageTimeout = null;
        messageText.textContent = "";
    }

    // ===== Win State =====
    function showWinScreen() {
        gameFinished = true;

        stopTimer();
        resetSelection();

        winTimeText.textContent = `Time: ${formatTime(elapsedSeconds)}`;
        winWordText.textContent = `Words found: ${foundWords.length}`;
        winScreen.classList.remove("hidden");
    }

    // ===== Timer =====
    function startTimer() {
        stopTimer();

        elapsedSeconds = 0;
        updateTimerText();

        timerInterval = setInterval(() => {
            elapsedSeconds++;
            updateTimerText();
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
    }

    function updateTimerText() {
        timerText.textContent = formatTime(elapsedSeconds);
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    // ===== Loading UI =====
    function showLoading(text) {
        loadingText.textContent = text;
        loadingScreen.classList.remove("hidden");
    }

    function hideLoading() {
        loadingScreen.classList.add("hidden");
    }

    function nextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    // ===== Selection Lines =====
    function drawSelectionLines() {
        selectionLines.innerHTML = "";

        if (!selectedNodes.length) return;

        for (let i = 0; i < selectedNodes.length - 1; i++) {
            drawLine(nodeCenter(selectedNodes[i]), nodeCenter(selectedNodes[i + 1]));
        }

        if (isDragging && pointerPosition) {
            drawLine(nodeCenter(selectedNodes[selectedNodes.length - 1]), pointerPosition, true);
        }
    }

    function drawLine(from, to, preview = false) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", from.x);
        line.setAttribute("y1", from.y);
        line.setAttribute("x2", to.x);
        line.setAttribute("y2", to.y);
        line.setAttribute("stroke", preview ? "rgba(0,145,255,0.45)" : "rgba(0,145,255,0.85)");
        line.setAttribute("stroke-width", preview ? "12" : "16");
        line.setAttribute("stroke-linecap", "round");

        selectionLines.appendChild(line);
    }

    // ===== Helpers =====
    function normalizeWord(word) {
        return String(word).trim().toLowerCase();
    }

    function shuffle(items) {
        return [...items].sort(() => Math.random() - 0.5);
    }

    function randomItem(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    function localPointer(event) {
        const rect = letterCircle.getBoundingClientRect();

        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    function nodeCenter(node) {
        const circleRect = letterCircle.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();

        return {
            x: nodeRect.left + nodeRect.width / 2 - circleRect.left,
            y: nodeRect.top + nodeRect.height / 2 - circleRect.top,
        };
    }

    function nodeUnderPointer(event) {
        return [...document.querySelectorAll(".letter-node")].find(node => {
            const rect = node.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            return Math.hypot(event.clientX - centerX, event.clientY - centerY) <= rect.width * 0.65;
        });
    }
});