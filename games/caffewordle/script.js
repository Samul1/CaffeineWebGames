window.addEventListener("DOMContentLoaded", () => {
    // ===== Puzzle Pack Data =====
    // Peli ei enää generoi puzzleja selaimessa.
    //
    // Sen sijaan peli lukee valmiiksi generoidun puzzles.json-tiedoston:
    //
    // {
    //   "meta": { ... },
    //   "puzzleSets": {
    //     "food": {
    //       "title": "Food and Drink",
    //       "categories": ["food"],
    //       "puzzles": [
    //         {
    //           "id": "food-0001",
    //           "letters": ["t", "e", "e", "a", "o"],
    //           "words": ["tee", "teema"]
    //         }
    //       ]
    //     }
    //   }
    // }

    let PUZZLE_SETS = {};
    let CATEGORY_IDS = [];
    let puzzlePacksLoaded = false;

    // ===== Category Labels =====
    // Nämä näytetään pelaajalle päävalikossa.
    // puzzles.json käyttää silti vakaita id-arvoja: jobs, places, food jne.
    const CATEGORY_LABELS = {
        jobs: "Ammatit ja työt",
        places: "Maantiede ja paikat",
        food: "Ruoka ja juoma",
        nature: "Eläimet ja luonto",
        culture: "Viihde ja kulttuuri",
        sports: "Urheilu ja liikunta",
        objects: "Esineet ja vaatteet",
    };

    // ===== Preferred Category Order =====
    // Tätä käytetään, jotta avain muodostuu aina samassa järjestyksessä.
    //
    // Esimerkiksi vaikka käyttäjä painaa:
    // food -> jobs
    //
    // Avain muodostetaan silti:
    // jobs__food
    const CATEGORY_ORDER = ["jobs", "places", "food", "nature", "culture", "sports", "objects"];

    // ===== Luokat =====
    class GuessWord {
        constructor(word) {
            this.word = word;
            this.found = false;
            this.revealedLetters = 0;
            this.element = null;
        }

        createElement() {
            const el = document.createElement("div");

            el.className = "guess-word";
            el.dataset.word = this.word;
            el.dataset.hidden = "•".repeat(this.word.length);

            this.element = el;
            return el;
        }

        markFound() {
            this.found = true;
            this.revealedLetters = this.word.length;
            this.element.dataset.hidden = this.word;
            this.element.classList.add("found");
        }

        revealNextLetter() {
            if (this.found || this.revealedLetters >= this.word.length) return false;

            this.revealedLetters++;
            this.updateHiddenText();

            return true;
        }

        updateHiddenText() {
            this.element.dataset.hidden = this.word.slice(0, this.revealedLetters) + "•".repeat(this.word.length - this.revealedLetters);
        }
    }

    // ===== Asetukset ja tila =====
    const MAX_WORDS = 24;
    let activeCategories = [];
    let puzzle = null;
    let letters = [];
    let guessWords = [];
    let isDragging = false;
    let selectedNodes = [];
    let selectedWord = "";
    let pointerPosition = null;
    let timerInterval = null;
    let elapsedSeconds = 0;
    let gameFinished = false;
    let hintCount = 0;

    // ===== Elementit =====
    const wordList = document.getElementById("wordList");
    const progressText = document.getElementById("progressText");
    const letterCircle = document.getElementById("letterCircle");
    const selectionLines = document.getElementById("selectionLines");
    const currentWord = document.getElementById("currentWord");
    const mainMenu = document.getElementById("mainMenu");
    const gameView = document.getElementById("gameView");
    const categoryList = document.getElementById("categoryList");
    const playButton = document.getElementById("playButton");
    const backButton = document.getElementById("backButton");
    const timerText = document.getElementById("timerText");
    const helpButton = document.getElementById("helpButton");
    const winScreen = document.getElementById("winScreen");
    const winTimeText = document.getElementById("winTimeText");
    const winHintText = document.getElementById("winHintText");
    const restartButton = document.getElementById("restartButton");
    const mainMenuButton = document.getElementById("mainMenuButton");
    const loadingScreen = document.getElementById("loadingScreen");
    const loadingText = document.getElementById("loadingText");

    // ===== Alustus =====
    initializeGame();

    letterCircle.addEventListener("pointerdown", startDrag);
    letterCircle.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    backButton.addEventListener("click", returnToMenu);
    helpButton.addEventListener("click", revealHintLetter);
    restartButton.addEventListener("click", restartGame);
    mainMenuButton.addEventListener("click", returnToMenu);

    playButton.addEventListener("click", event => {
        if (playButton.disabled || !activeCategories.length || !getPuzzleSetForSelection()) return event.preventDefault();
        startGame();
    });

    // ===== Game Initialization =====
    async function initializeGame() {
        playButton.disabled = true;
        playButton.classList.add("disabled");

        showLoading("Loading puzzle packs...");
        await nextFrame();

        const loaded = await loadPuzzlePacks();

        hideLoading();

        if (!loaded) {
            playButton.textContent = "Puzzlejen lataus epäonnistui";
            playButton.disabled = true;
            playButton.classList.add("disabled");
            return;
        }

        createCategoryButtons();
        updatePlayButton();
    }

    // ===== Load Puzzle Packs =====
    async function loadPuzzlePacks() {
        try {
            const response = await fetch("puzzles.json");

            if (!response.ok) {
                throw new Error(`puzzles.json request failed: ${response.status}`);
            }

            const data = await response.json();

            if (!data.puzzleSets || typeof data.puzzleSets !== "object") {
                throw new Error("puzzles.json does not contain puzzleSets object.");
            }

            PUZZLE_SETS = cleanPuzzleSets(data.puzzleSets);
            CATEGORY_IDS = getCategoryIdsFromPuzzleSets(PUZZLE_SETS);
            puzzlePacksLoaded = Object.keys(PUZZLE_SETS).length > 0 && CATEGORY_IDS.length > 0;

            if (!puzzlePacksLoaded) {
                throw new Error("No usable puzzle sets found.");
            }

            return true;
        } catch (error) {
            console.error("Failed to load puzzle packs:", error);
            loadingText.textContent = "Could not load puzzle packs.";
            return false;
        }
    }

    // ===== Clean Puzzle Sets =====
    // Siivotaan pois täysin rikkinäiset setit.
    // Tyhjä puzzle-lista saa jäädä mukaan, koska kategoria voi silti olla mukana yhdistelmissä.
    function cleanPuzzleSets(puzzleSets) {
        return Object.fromEntries(
            Object.entries(puzzleSets)
                .filter(([, set]) => set && Array.isArray(set.categories) && Array.isArray(set.puzzles))
                .map(([setKey, set]) => [
                    setKey,
                    {
                        title: set.title || setKey,
                        categories: set.categories.map(category => String(category).trim()).filter(Boolean),
                        puzzles: set.puzzles
                            .filter(isValidPuzzle)
                            .map(cleanPuzzle),
                    },
                ])
        );
    }

    // ===== Puzzle Validation =====
    function isValidPuzzle(puzzleData) {
        return (
            puzzleData &&
            Array.isArray(puzzleData.letters) &&
            Array.isArray(puzzleData.words) &&
            puzzleData.letters.length > 0 &&
            puzzleData.words.length > 0
        );
    }

    // ===== Clean One Puzzle =====
    function cleanPuzzle(puzzleData) {
        return {
            id: puzzleData.id || "unknown-puzzle",
            letters: puzzleData.letters.map(letter => String(letter).trim().toLowerCase()).filter(Boolean),
            words: [...new Set(puzzleData.words.map(word => String(word).trim().toLowerCase()).filter(Boolean))],
        };
    }

    // ===== Category Id Collection =====
    function getCategoryIdsFromPuzzleSets(puzzleSets) {
        const categoryIds = new Set();

        Object.values(puzzleSets).forEach(set => {
            set.categories.forEach(category => categoryIds.add(category));
        });

        return [...categoryIds].sort((a, b) => categorySortIndex(a) - categorySortIndex(b));
    }

    // ===== Menu =====
    function createCategoryButtons() {
        categoryList.innerHTML = "";

        CATEGORY_IDS.forEach(category => {
            const btn = document.createElement("button");

            btn.className = "category-button";
            btn.textContent = CATEGORY_LABELS[category] || category;
            btn.dataset.category = category;

            btn.addEventListener("click", () => toggleCategory(category, btn));

            categoryList.appendChild(btn);
        });
    }

    function toggleCategory(category, btn) {
        if (activeCategories.includes(category)) {
            activeCategories = activeCategories.filter(item => item !== category);
            btn.classList.remove("active");
        } else {
            activeCategories.push(category);
            btn.classList.add("active");
        }

        activeCategories = sortCategoryIds(activeCategories);
        updatePlayButton();
    }

    function updatePlayButton() {
        const selectedSet = getPuzzleSetForSelection();
        const canPlay = puzzlePacksLoaded && activeCategories.length > 0 && Boolean(selectedSet);

        playButton.disabled = !canPlay;
        playButton.classList.toggle("disabled", !canPlay);

        if (!puzzlePacksLoaded) {
            playButton.textContent = "Ladataan...";
        } else if (!activeCategories.length) {
            playButton.textContent = "Pelaa";
        } else if (!selectedSet) {
            playButton.textContent = "Ei puzzleja";
        } else {
            playButton.textContent = "Pelaa";
        }
    }

    // ===== Pelin käynnistys =====
    async function startGame() {
        if (!puzzlePacksLoaded || !activeCategories.length) return;

        gameFinished = false;
        hintCount = 0;
        playButton.disabled = true;
        playButton.classList.add("disabled");
        winScreen.classList.add("hidden");

        showLoading("Loading puzzle...");
        await nextFrame();

        puzzle = selectPuzzleForActiveCategories();

        if (!puzzle || !puzzle.words.length) {
            hideLoading();
            playButton.disabled = false;
            updatePlayButton();
            return;
        }

        showLoading("Preparing board...");
        await nextFrame();

        letters = [...puzzle.letters];
        guessWords = sortWordsForGrid(puzzle.words).map(word => new GuessWord(word));

        mainMenu.classList.add("hidden");
        gameView.classList.remove("hidden");

        resetSelection();
        createGuessWords();
        createLetterNodes(letters);
        updateProgressText();
        startTimer();

        hideLoading();
        playButton.disabled = false;
        updatePlayButton();
    }

    // ===== Paluu päävalikkoon =====
    function returnToMenu() {
        gameFinished = false;
        hintCount = 0;

        stopTimer();
        resetSelection();
        hideLoading();

        winScreen.classList.add("hidden");
        gameView.classList.add("hidden");
        mainMenu.classList.remove("hidden");

        wordList.innerHTML = "";
        letterCircle.querySelectorAll(".letter-node").forEach(node => node.remove());

        progressText.textContent = "";
        currentWord.textContent = "";
        timerText.textContent = "00:00";
        winTimeText.textContent = "Time: 00:00";
        winHintText.textContent = "Hints used: 0";

        updatePlayButton();
    }

    // ===== Win State =====
    function showWinScreen() {
        gameFinished = true;

        stopTimer();
        resetSelection();

        winTimeText.textContent = `Time: ${formatTime(elapsedSeconds)}`;
        winHintText.textContent = `Hints used: ${hintCount}`;
        winScreen.classList.remove("hidden");
    }

    function restartGame() {
        stopTimer();
        resetSelection();

        hintCount = 0;
        winScreen.classList.add("hidden");
        wordList.innerHTML = "";
        letterCircle.querySelectorAll(".letter-node").forEach(node => node.remove());

        startGame();
    }

    // ===== Puzzle Selection =====
    // Tässä valitaan valmis puzzle aktiivisten kategorioiden perusteella.
    //
    // Toimintalogiikka:
    // 1. Jos tarkka setti löytyy, käytä sitä.
    //    Esim. food + nature -> food__nature
    //
    // 2. Jos valittu monta kategoriaa, mutta tarkkaa settiä ei ole,
    //    käytä suurinta löytyvää subsettiä.
    //    Esim. food + nature + sports -> food__nature, jos se löytyy.
    //
    // 3. Jos mikään ei löydy, Play-nappi pysyy disabled-tilassa.
    function selectPuzzleForActiveCategories() {
        const puzzleSet = getPuzzleSetForSelection();

        if (!puzzleSet || !puzzleSet.puzzles.length) {
            return null;
        }

        const selectedPuzzle = randomItem(puzzleSet.puzzles);

        return {
            id: selectedPuzzle.id,
            setKey: puzzleSet.key,
            setTitle: puzzleSet.title,
            letters: [...selectedPuzzle.letters],
            words: [...selectedPuzzle.words],
        };
    }

    // ===== Puzzle Set For Current Selection =====
    function getPuzzleSetForSelection() {
        if (!puzzlePacksLoaded || !activeCategories.length) return null;

        const exactKey = getCategorySetKey(activeCategories);
        const exactSet = getPlayablePuzzleSet(exactKey);

        if (exactSet) {
            return exactSet;
        }

        const subsetSets = getPlayableSubsetPuzzleSets(activeCategories);

        if (subsetSets.length > 0) {
            return randomItem(subsetSets);
        }

        return null;
    }

    // ===== Get Playable Puzzle Set =====
    function getPlayablePuzzleSet(setKey) {
        const set = PUZZLE_SETS[setKey];

        if (!set || !set.puzzles || set.puzzles.length === 0) {
            return null;
        }

        return {
            key: setKey,
            title: set.title,
            categories: set.categories,
            puzzles: set.puzzles,
        };
    }

    // ===== Get Playable Subsets =====
    // Jos käyttäjä valitsee 3+ kategoriaa, meillä ei välttämättä ole juuri sitä settiä.
    // Silloin voidaan käyttää jotakin valittujen kategorioiden alijoukkoa.
    function getPlayableSubsetPuzzleSets(categoryIds) {
        const sorted = sortCategoryIds(categoryIds);
        const results = [];

        for (let size = sorted.length - 1; size >= 1; size--) {
            const combos = getCombinations(sorted, size);

            combos.forEach(combo => {
                const set = getPlayablePuzzleSet(getCategorySetKey(combo));
                if (set) results.push(set);
            });

            if (results.length > 0) {
                return results;
            }
        }

        return results;
    }

    // ===== Category Key Helpers =====
    function getCategorySetKey(categoryIds) {
        const sorted = sortCategoryIds(categoryIds);

        if (sorted.length === CATEGORY_IDS.length) {
            const allSet = getPlayablePuzzleSet("all");
            if (allSet) return "all";
        }

        return sorted.join("__");
    }

    function sortCategoryIds(categoryIds) {
        return [...categoryIds].sort((a, b) => categorySortIndex(a) - categorySortIndex(b));
    }

    function categorySortIndex(category) {
        const index = CATEGORY_ORDER.indexOf(category);
        return index === -1 ? 999 : index;
    }

    function getCombinations(items, size) {
        const result = [];

        function walk(startIndex, current) {
            if (current.length === size) {
                result.push([...current]);
                return;
            }

            for (let i = startIndex; i < items.length; i++) {
                current.push(items[i]);
                walk(i + 1, current);
                current.pop();
            }
        }

        walk(0, []);

        return result;
    }

    // ===== Sanat ja kirjaimet ruudulle =====
    function createGuessWords() {
        wordList.innerHTML = "";

        guessWords.forEach(word => {
            wordList.appendChild(word.createElement());
        });

        for (let i = guessWords.length; i < MAX_WORDS; i++) {
            const empty = document.createElement("div");

            empty.className = "guess-word empty";
            empty.dataset.hidden = "";

            wordList.appendChild(empty);
        }
    }

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

    // ===== Pelaajan raahaus =====
    function startDrag(event) {
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
        if (!isDragging) return;

        pointerPosition = localPointer(event);

        const node = nodeUnderPointer(event);
        if (node && !selectedNodes.includes(node)) selectNode(node);

        updateWordText();
        drawSelectionLines();
    }

    function endDrag() {
        if (!isDragging) return;

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

    function checkSelectedWord() {
        const match = guessWords.find(word => word.word === selectedWord && !word.found);

        if (!match) return;

        match.markFound();
        updateProgressText();
    }

    // ===== UI-päivitykset =====
    function updateWordText() {
        currentWord.textContent = selectedWord;
    }

    function updateProgressText() {
        const found = guessWords.filter(word => word.found).length;

        progressText.textContent = `${found} / ${guessWords.length}`;

        if (!gameFinished && guessWords.length && found === guessWords.length) {
            showWinScreen();
        }
    }

    function revealHintLetter() {
        if (gameFinished) return;

        const candidates = guessWords.filter(word => !word.found && word.revealedLetters < word.word.length);
        if (!candidates.length) return;

        const revealed = randomItem(candidates).revealNextLetter();

        if (revealed) {
            hintCount++;
        }
    }

    // ===== Ajastin =====
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

    // ===== Valintaviivat =====
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

    // ===== Apufunktiot =====
    function sortWordsForGrid(words) {
        return [...words].sort((a, b) => a.length - b.length || a.localeCompare(b, "fi"));
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