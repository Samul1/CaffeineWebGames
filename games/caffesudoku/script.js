// ===== Sudoku-kokojen konfiguraatiot =====
//
// size:
//     Sudoku-laudan rivien ja sarakkeiden määrä.
//
// boxRows:
//     Yhden Sudoku-lohkon korkeus.
//
// boxCols:
//     Yhden Sudoku-lohkon leveys.
//
// Kaikissa konfiguraatioissa:
//
// boxRows × boxCols = size

const SUDOKU_CONFIGS = {
    4: {
        size: 4,
        boxRows: 2,
        boxCols: 2,
    },

    6: {
        size: 6,
        boxRows: 2,
        boxCols: 3,
    },

    8: {
        size: 8,
        boxRows: 2,
        boxCols: 4,
    },

    9: {
        size: 9,
        boxRows: 3,
        boxCols: 3,
    },
};

// ===== Vaikeustasojen konfiguraatiot =====
//
// clueRatio kertoo, kuinka suuri osa laudan numeroista
// pyritään jättämään näkyviin.
//
// Easy:
//     Noin 60 prosenttia ruuduista on valmiiksi täytetty.
//
// Medium:
//     Noin 45 prosenttia ruuduista on valmiiksi täytetty.
//
// Hard:
//     Noin 35 prosenttia ruuduista on valmiiksi täytetty.
//
// Numeroita poistetaan vain silloin, kun pulman ratkaisu
// säilyy yksikäsitteisenä.

const DIFFICULTY_CONFIGS = {
    easy: {
        clueRatio: 0.60,
    },

    medium: {
        clueRatio: 0.45,
    },

    hard: {
        clueRatio: 0.35,
    },
};

// ===== Pelin tämänhetkinen tila =====
//
// solution:
//     Kokonaan ratkaistu Sudoku.
//
// puzzle:
//     Pelaajalle alussa annettu pulma.
//
// board:
//     Pelaajan tämänhetkinen muokattava lauta.
//
// hintedCells:
//     Vihjeellä paljastettujen ruutujen koordinaatit.
//
// Koordinaatti tallennetaan merkkijonona:
//
// "row,col"
//
// Esimerkiksi:
//
// "2,5"

const gameState = {
    size: 9,
    difficulty: "medium",
    config: SUDOKU_CONFIGS[9],

    solution: [],
    puzzle: [],
    board: [],

    hintedCells: new Set(),

    selectedRow: null,
    selectedCol: null,

    playing: false,

    timerId: null,
    timerStartedAt: null,
    elapsedSeconds: 0,
};

// ===== Sivun käynnistäminen =====

window.addEventListener("DOMContentLoaded", () => {
    // ===== HTML-elementit =====

    const mainMenu = document.getElementById("mainMenu");
    const gameView = document.getElementById("gameView");

    const boardSizeSelect = document.getElementById("boardSize");
    const difficultySelect = document.getElementById("difficulty");

    const playButton = document.getElementById("playButton");
    const mainMenuButton = document.getElementById("mainMenuButton");
    const restartButton = document.getElementById("restartButton");
    const newGameButton = document.getElementById("newGameButton");

    const sudokuGrid = document.getElementById("sudokuGrid");
    const numberPad = document.getElementById("numberPad");

    const gameMessage = document.getElementById("gameMessage");
    const iterationMessage = document.getElementById("iterationMessage");

    const sizeInfo = document.getElementById("sizeInfo");
    const difficultyInfo = document.getElementById("difficultyInfo");
    const timerText = document.getElementById("timerText");

    // ===== HTML-elementtien tarkistus =====

    if (
        !mainMenu ||
        !gameView ||
        !boardSizeSelect ||
        !difficultySelect ||
        !playButton ||
        !mainMenuButton ||
        !restartButton ||
        !newGameButton ||
        !sudokuGrid ||
        !numberPad ||
        !gameMessage ||
        !iterationMessage ||
        !sizeInfo ||
        !difficultyInfo ||
        !timerText
    ) {
        console.error(
            "CaffeSudoku initialization failed: one or more HTML elements are missing."
        );

        return;
    }

    // ===== Tekstin muotoilu =====

    function capitalizeFirstLetter(text) {
        if (!text) {
            return "";
        }

        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    // ===== Peliajan muotoileminen =====
    //
    // Alle tunnin kestänyt peli:
    //
    // 03:42
    //
    // Yli tunnin kestänyt peli:
    //
    // 01:03:42

    function formatElapsedTime(totalSeconds) {
        const safeSeconds =
            Math.max(0, Math.floor(totalSeconds));

        const hours =
            Math.floor(safeSeconds / 3600);

        const minutes =
            Math.floor((safeSeconds % 3600) / 60);

        const seconds =
            safeSeconds % 60;

        const formattedMinutes =
            String(minutes).padStart(2, "0");

        const formattedSeconds =
            String(seconds).padStart(2, "0");

        if (hours === 0) {
            return `${formattedMinutes}:${formattedSeconds}`;
        }

        const formattedHours =
            String(hours).padStart(2, "0");

        return (
            `${formattedHours}:` +
            `${formattedMinutes}:` +
            `${formattedSeconds}`
        );
    }

    // ===== Ajastimen tekstin päivittäminen =====

    function updateTimerText() {
        // Kun ajastin käy, aika lasketaan aina todellisen
        // alkamishetken perusteella.
        //
        // Näin selainvälilehden mahdollinen hidastuminen
        // ei aiheuta ajastimeen pysyvää virhettä.

        if (gameState.timerStartedAt !== null) {
            gameState.elapsedSeconds =
                Math.floor(
                    (
                        Date.now() -
                        gameState.timerStartedAt
                    ) / 1000
                );
        }

        timerText.textContent =
            formatElapsedTime(
                gameState.elapsedSeconds
            );
    }

    // ===== Ajastimen nollaaminen =====

    function resetTimer() {
        if (gameState.timerId !== null) {
            window.clearInterval(
                gameState.timerId
            );
        }

        gameState.timerId = null;
        gameState.timerStartedAt = null;
        gameState.elapsedSeconds = 0;

        updateTimerText();
    }

    // ===== Ajastimen käynnistäminen =====

    function startTimer() {
        resetTimer();

        gameState.timerStartedAt =
            Date.now();

        updateTimerText();

        // Päivitetään hieman useammin kuin kerran sekunnissa,
        // jotta näkyvä sekunti vaihtuu mahdollisimman täsmällisesti.

        gameState.timerId =
            window.setInterval(
                updateTimerText,
                250
            );
    }

    // ===== Ajastimen pysäyttäminen =====

    function stopTimer() {
        // Tallennetaan vielä tarkka lopullinen aika.

        updateTimerText();

        if (gameState.timerId !== null) {
            window.clearInterval(
                gameState.timerId
            );
        }

        gameState.timerId = null;
        gameState.timerStartedAt = null;

        updateTimerText();
    }

    // ===== Pelin hallintapainikkeiden lukitseminen =====
    //
    // Restart ja New Game lukitaan siksi aikaa,
    // kun uutta pulmaa generoidaan.

    function setGameActionButtonsDisabled(disabled) {
        restartButton.disabled = disabled;
        newGameButton.disabled = disabled;
    }

    // ===== Valitun pelitilan lukeminen =====

    function readSelectedGameSettings() {
        const selectedSize = Number(boardSizeSelect.value);
        const selectedDifficulty = difficultySelect.value;

        const selectedConfig =
            SUDOKU_CONFIGS[selectedSize];

        const selectedDifficultyConfig =
            DIFFICULTY_CONFIGS[selectedDifficulty];

        // ===== Sudoku-koon tarkistus =====

        if (!selectedConfig) {
            console.error(
                `Unknown Sudoku board size: ${selectedSize}`
            );

            return false;
        }

        // ===== Vaikeustason tarkistus =====

        if (!selectedDifficultyConfig) {
            console.error(
                `Unknown Sudoku difficulty: ${selectedDifficulty}`
            );

            return false;
        }

        gameState.size = selectedSize;
        gameState.difficulty = selectedDifficulty;
        gameState.config = selectedConfig;

        return true;
    }

    // ===== Tyhjän Sudoku-taulukon luominen =====
    //
    // Tyhjä ruutu esitetään arvolla 0.

    function createEmptyBoard(size) {
        return Array.from(
            { length: size },
            () => Array(size).fill(0)
        );
    }

    // ===== Sudoku-taulukon kopioiminen =====
    //
    // Kaksiulotteinen taulukko täytyy kopioida riveittäin.
    //
    // Pelkkä:
    //
    // const puzzle = solution;
    //
    // ei riitä, koska molemmat muuttujat osoittaisivat samaan taulukkoon.

    function cloneBoard(board) {
        return board.map(row => [...row]);
    }

    // ===== Ruudun koordinaattiavaimen luominen =====
    //
    // Set-rakenteeseen ei tallenneta erillistä kaksiulotteista taulukkoa,
    // vaan jokainen vihjeruutu tunnistetaan merkkijonolla.

    function createCellKey(row, col) {
        return `${row},${col}`;
    }

    // ===== Tarkistetaan, onko ruutu paljastettu vihjeellä =====

    function isHintedCell(row, col) {
        return gameState.hintedCells.has(
            createCellKey(row, col)
        );
    }

    // ===== Numeroiden luominen =====

    function createNumberList(size) {
        return Array.from(
            { length: size },
            (_, index) => index + 1
        );
    }

    // ===== Taulukon satunnaistaminen =====
    //
    // Fisher–Yates-algoritmi.
    //
    // Alkuperäistä taulukkoa ei muuteta.

    function shuffleArray(array) {
        const shuffled = [...array];

        for (
            let index = shuffled.length - 1;
            index > 0;
            index--
        ) {
            const randomIndex = Math.floor(
                Math.random() * (index + 1)
            );

            [
                shuffled[index],
                shuffled[randomIndex],
            ] = [
                shuffled[randomIndex],
                shuffled[index],
            ];
        }

        return shuffled;
    }

    // ===== Numeron sijoituksen tarkistaminen =====
    //
    // Numero voidaan sijoittaa ruutuun vain, jos samaa numeroa ei ole:
    //
    // 1. samalla rivillä
    // 2. samassa sarakkeessa
    // 3. samassa Sudoku-lohkossa

    function isValidPlacement(
        board,
        row,
        col,
        value,
        config
    ) {
        const {
            size,
            boxRows,
            boxCols,
        } = config;

        // ===== Rivin tarkistus =====

        for (
            let currentCol = 0;
            currentCol < size;
            currentCol++
        ) {
            if (board[row][currentCol] === value) {
                return false;
            }
        }

        // ===== Sarakkeen tarkistus =====

        for (
            let currentRow = 0;
            currentRow < size;
            currentRow++
        ) {
            if (board[currentRow][col] === value) {
                return false;
            }
        }

        // ===== Lohkon vasen yläkulma =====

        const boxStartRow =
            Math.floor(row / boxRows) * boxRows;

        const boxStartCol =
            Math.floor(col / boxCols) * boxCols;

        // ===== Lohkon tarkistus =====

        for (
            let currentRow = boxStartRow;
            currentRow < boxStartRow + boxRows;
            currentRow++
        ) {
            for (
                let currentCol = boxStartCol;
                currentCol < boxStartCol + boxCols;
                currentCol++
            ) {
                if (board[currentRow][currentCol] === value) {
                    return false;
                }
            }
        }

        return true;
    }

    // ===== Sallittujen numeroiden etsiminen =====

    function getCandidates(
        board,
        row,
        col,
        config
    ) {
        const numbers =
            createNumberList(config.size);

        return numbers.filter(number =>
            isValidPlacement(
                board,
                row,
                col,
                number,
                config
            )
        );
    }

    // ===== Parhaan tyhjän ruudun etsiminen =====
    //
    // Käytetään MRV-periaatetta:
    //
    // Minimum Remaining Values
    //
    // Algoritmi valitsee tyhjän ruudun, jolla on vähiten
    // sallittuja numeroita.

    function findBestEmptyCell(board, config) {
        let bestCell = null;

        for (
            let row = 0;
            row < config.size;
            row++
        ) {
            for (
                let col = 0;
                col < config.size;
                col++
            ) {
                if (board[row][col] !== 0) {
                    continue;
                }

                const candidates = getCandidates(
                    board,
                    row,
                    col,
                    config
                );

                // Tyhjä ruutu ilman yhtään vaihtoehtoa
                // tarkoittaa umpikujaa.

                if (candidates.length === 0) {
                    return {
                        row,
                        col,
                        candidates,
                    };
                }

                if (
                    !bestCell ||
                    candidates.length <
                    bestCell.candidates.length
                ) {
                    bestCell = {
                        row,
                        col,
                        candidates,
                    };
                }
            }
        }

        return bestCell;
    }

    // ===== Backtracking-ratkaisualgoritmi =====
    //
    // Tätä käytetään kokonaan ratkaistun Sudoku-laudan luomiseen.
    //
    // Numerovaihtoehdot sekoitetaan, jotta jokainen uusi peli
    // tuottaa erilaisen ratkaisun.

    function solveBoard(board, config) {
        const emptyCell = findBestEmptyCell(
            board,
            config
        );

        // Tyhjiä ruutuja ei enää ole.

        if (!emptyCell) {
            return true;
        }

        const {
            row,
            col,
            candidates,
        } = emptyCell;

        // Nykyinen ratkaisupolku on umpikujassa.

        if (candidates.length === 0) {
            return false;
        }

        const shuffledCandidates =
            shuffleArray(candidates);

        for (const value of shuffledCandidates) {
            board[row][col] = value;

            if (solveBoard(board, config)) {
                return true;
            }

            // Perutaan epäonnistunut sijoitus.

            board[row][col] = 0;
        }

        return false;
    }

    // ===== Täydellisen Sudoku-ratkaisun generointi =====

    function generateSolvedBoard(config) {
        const board =
            createEmptyBoard(config.size);

        const solutionWasFound =
            solveBoard(board, config);

        if (!solutionWasFound) {
            throw new Error(
                `Unable to generate a solved ${config.size} × ${config.size} Sudoku board.`
            );
        }

        return board;
    }

    // ===== Sudokun ratkaisujen laskeminen =====
    //
    // Tämä on backtracking-algoritmin toinen versio.
    //
    // Se ei lopeta ensimmäisen ratkaisun löytymiseen, vaan laskee
    // ratkaisuja annettuun rajaan asti.
    //
    // Pulman generoinnissa rajana käytetään arvoa 2:
    //
    // 0 = Sudokulla ei ole ratkaisua.
    // 1 = Sudokulla on täsmälleen yksi ratkaisu.
    // 2 = Sudokulla on vähintään kaksi ratkaisua.
    //
    // Algoritmin ei tarvitse etsiä kaikkia mahdollisia ratkaisuja.
    // Se voi lopettaa heti toisen ratkaisun löydyttyä.

    function countSolutions(
        board,
        config,
        limit = 2
    ) {
        const emptyCell = findBestEmptyCell(
            board,
            config
        );

        // Tyhjiä ruutuja ei ole.
        // Yksi kokonainen ratkaisu löytyi.

        if (!emptyCell) {
            return 1;
        }

        const {
            row,
            col,
            candidates,
        } = emptyCell;

        // Tyhjään ruutuun ei sovi mitään numeroa.
        // Nykyinen ratkaisupolku ei tuota ratkaisua.

        if (candidates.length === 0) {
            return 0;
        }

        let solutionCount = 0;

        for (const value of candidates) {
            board[row][col] = value;

            solutionCount += countSolutions(
                board,
                config,
                limit - solutionCount
            );

            // Jokainen rekursion aikana tehty sijoitus perutaan.

            board[row][col] = 0;

            // Kun haluttu raja saavutetaan, etsintä voidaan lopettaa.

            if (solutionCount >= limit) {
                return solutionCount;
            }
        }

        return solutionCount;
    }

    // ===== Vaikeustason tavoitenumeromäärä =====

    function getTargetClueCount(
        config,
        difficulty
    ) {
        const difficultyConfig =
            DIFFICULTY_CONFIGS[difficulty];

        const totalCells =
            config.size * config.size;

        return Math.round(
            totalCells * difficultyConfig.clueRatio
        );
    }

    // ===== Kaikkien ruutujen koordinaattien luominen =====
    //
    // Esimerkiksi 4 × 4 Sudoku tuottaa 16 objektia:
    //
    // [
    //     { row: 0, col: 0 },
    //     { row: 0, col: 1 },
    //     ...
    //     { row: 3, col: 3 }
    // ]

    function createCellPositions(size) {
        const positions = [];

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                positions.push({
                    row,
                    col,
                });
            }
        }

        return positions;
    }

    // ===== Yhden pulmanmuodostusyrityksen suorittaminen =====
    //
    // Numeroita kokeillaan poistaa satunnaisessa järjestyksessä.
    //
    // Jokaisen poiston jälkeen tarkistetaan, että Sudokulla on
    // edelleen täsmälleen yksi ratkaisu.
    //
    // Jos ratkaisuja löytyy useampi kuin yksi, numero palautetaan.

    function createPuzzleAttempt(
        solution,
        config,
        targetClues
    ) {
        const puzzle =
            cloneBoard(solution);

        const positions = shuffleArray(
            createCellPositions(config.size)
        );

        let clueCount =
            config.size * config.size;

        for (const position of positions) {
            // Tavoitemäärä on saavutettu.

            if (clueCount <= targetClues) {
                break;
            }

            const {
                row,
                col,
            } = position;

            const removedValue =
                puzzle[row][col];

            // Poistetaan numero väliaikaisesti.

            puzzle[row][col] = 0;

            // countSolutions muokkaa taulukkoa väliaikaisesti,
            // joten sille annetaan pulman kopio.

            const testBoard =
                cloneBoard(puzzle);

            const solutionCount =
                countSolutions(
                    testBoard,
                    config,
                    2
                );

            // Numero voidaan jättää pois vain silloin,
            // kun pulman ratkaisu säilyy yksikäsitteisenä.

            if (solutionCount === 1) {
                clueCount--;
            } else {
                puzzle[row][col] =
                    removedValue;
            }
        }

        return {
            puzzle,
            clueCount,
        };
    }

    // ===== Yksikäsitteisen Sudoku-pulman generointi =====
    //
    // Numeroiden poistamisjärjestys vaikuttaa siihen, kuinka monta
    // numeroa voidaan poistaa yksikäsitteisyyden säilyessä.
    //
    // Siksi tehdään korkeintaan kolme yritystä eri satunnaisilla
    // poistamisjärjestyksillä.
    //
    // Jos tavoitemäärä saavutetaan, funktio palauttaa heti.
    //
    // Muussa tapauksessa palautetaan yritys, jossa näkyviä numeroita
    // jäi vähiten.

    function generatePuzzle(
        solution,
        config,
        difficulty
    ) {
        const targetClues =
            getTargetClueCount(
                config,
                difficulty
            );

        const maximumAttempts = 3;

        let bestResult = null;

        for (
            let attempt = 0;
            attempt < maximumAttempts;
            attempt++
        ) {
            const result =
                createPuzzleAttempt(
                    solution,
                    config,
                    targetClues
                );

            if (
                !bestResult ||
                result.clueCount < bestResult.clueCount
            ) {
                bestResult = result;
            }

            // Täsmällinen tavoitemäärä saavutettiin.

            if (result.clueCount === targetClues) {
                break;
            }
        }

        return {
            puzzle: bestResult.puzzle,
            clueCount: bestResult.clueCount,
            targetClues,
        };
    }

    // ===== Pelitietojen päivittäminen =====

    function updateGameInfo() {
        sizeInfo.textContent =
            `${gameState.size} × ${gameState.size}`;

        difficultyInfo.textContent =
            capitalizeFirstLetter(
                gameState.difficulty
            );
    }

    // ===== Iteraatioviestin päivittäminen =====

    // ===== Tyhjien ruutujen laskeminen =====

    function countEmptyCells() {
        let emptyCount = 0;

        for (const row of gameState.board) {
            for (const value of row) {
                if (value === 0) {
                    emptyCount++;
                }
            }
        }

        return emptyCount;
    }

    // ===== Ohjetekstin päivittäminen =====

    function updateIterationMessage() {
        const emptyCount = countEmptyCells();

        if (emptyCount === 0) {
            iterationMessage.textContent =
                "All cells are filled. Checking the solution...";

            return;
        }

        const cellWord =
            emptyCount === 1 ? "cell" : "cells";

        iterationMessage.textContent =
            `${emptyCount} ${cellWord} remaining. Select a cell and enter a number.`;
    }

    // ===== Solun lohkorajojen lisääminen =====

    function addCellBorderClasses(
        cell,
        row,
        col,
        config
    ) {
        const {
            size,
            boxRows,
            boxCols,
        } = config;

        const isLastColumn =
            col === size - 1;

        const isLastRow =
            row === size - 1;

        const isBoxRightEdge =
            (col + 1) % boxCols === 0;

        const isBoxBottomEdge =
            (row + 1) % boxRows === 0;

        if (
            isBoxRightEdge &&
            !isLastColumn
        ) {
            cell.classList.add(
                "box-border-right"
            );
        }

        if (
            isBoxBottomEdge &&
            !isLastRow
        ) {
            cell.classList.add(
                "box-border-bottom"
            );
        }

        if (isLastColumn) {
            cell.classList.add(
                "last-column"
            );
        }

        if (isLastRow) {
            cell.classList.add(
                "last-row"
            );
        }
    }

    // ===== Sudoku-pulman näyttäminen =====
    //
    // Solutyypit:
    //
    // given:
    //     Alkuperäisessä pulmassa annettu numero.
    //
    // hinted:
    //     Vihjeellä paljastettu ja lukittu numero.
    //
    // editable:
    //     Pelaajan muokattava ruutu.

    function renderBoard() {
        const config = gameState.config;
        const fragment = document.createDocumentFragment();

        sudokuGrid.innerHTML = "";
        sudokuGrid.classList.remove("completed");

        sudokuGrid.style.setProperty(
            "--board-size",
            config.size
        );

        for (let row = 0; row < config.size; row++) {
            for (let col = 0; col < config.size; col++) {
                const value =
                    gameState.board[row][col];

                const isGiven =
                    gameState.puzzle[row][col] !== 0;

                const isHinted =
                    isHintedCell(row, col);

                const cell =
                    document.createElement("button");

                cell.type = "button";
                cell.dataset.row = row;
                cell.dataset.col = col;

                // ===== Solun luokka =====

                if (isGiven) {
                    cell.className =
                        "sudoku-cell given";
                } else if (isHinted) {
                    cell.className =
                        "sudoku-cell hinted";
                } else {
                    const valueClass =
                        value === 0
                            ? "empty"
                            : "filled";

                    cell.className =
                        `sudoku-cell editable ${valueClass}`;
                }

                // ===== Solun sisältö =====

                cell.textContent =
                    value === 0 ? "" : value;

                // Alkuperäiset numerot ja vihjeet lukitaan.

                cell.disabled =
                    isGiven || isHinted;

                // ===== Saavutettavuusteksti =====

                if (isGiven) {
                    cell.setAttribute(
                        "aria-label",
                        `Row ${row + 1}, column ${col + 1}, given value ${value}`
                    );
                } else if (isHinted) {
                    cell.setAttribute(
                        "aria-label",
                        `Row ${row + 1}, column ${col + 1}, hinted value ${value}`
                    );
                } else if (value === 0) {
                    cell.setAttribute(
                        "aria-label",
                        `Row ${row + 1}, column ${col + 1}, empty`
                    );
                } else {
                    cell.setAttribute(
                        "aria-label",
                        `Row ${row + 1}, column ${col + 1}, player value ${value}`
                    );
                }

                addCellBorderClasses(
                    cell,
                    row,
                    col,
                    config
                );

                fragment.appendChild(cell);
            }
        }

        sudokuGrid.appendChild(fragment);
    }

    // ===== Yksittäisen solun hakeminen =====

    function getCellElement(row, col) {
        return sudokuGrid.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
        );
    }

    // ===== Peliviestin tyhjentäminen =====

    function clearGameMessage() {
        gameMessage.textContent = "";
        gameMessage.className = "game-message";
    }

    // ===== Soluvalinnan poistaminen =====

    function clearSelection() {
        const selectedCell =
            sudokuGrid.querySelector(
                ".sudoku-cell.selected"
            );

        if (selectedCell) {
            selectedCell.classList.remove(
                "selected"
            );
        }

        gameState.selectedRow = null;
        gameState.selectedCol = null;
    }

    // ===== Muokattavan solun valitseminen =====

    function selectCell(row, col) {
        if (!gameState.playing) {
            return;
        }

        // Alkuperäistä tai vihjeellä paljastettua numeroa
        // ei voi valita eikä muuttaa.

        if (
            gameState.puzzle[row][col] !== 0 ||
            isHintedCell(row, col)
        ) {
            return;
        }

        clearSelection();

        gameState.selectedRow = row;
        gameState.selectedCol = col;

        const cell =
            getCellElement(row, col);

        if (cell) {
            cell.classList.add("selected");
            cell.focus();
        }
    }

    // ===== Ensimmäisen muokattavan solun valitseminen =====

    function selectFirstEditableCell() {
        const firstEditableCell =
            sudokuGrid.querySelector(
                ".sudoku-cell.editable:not(:disabled)"
            );

        if (!firstEditableCell) {
            return;
        }

        selectCell(
            Number(firstEditableCell.dataset.row),
            Number(firstEditableCell.dataset.col)
        );
    }

    // ===== Yksittäisen solun päivittäminen =====

    function updateCell(row, col) {
        const cell =
            getCellElement(row, col);

        if (!cell) {
            return;
        }

        const value =
            gameState.board[row][col];

        cell.textContent =
            value === 0 ? "" : value;

        cell.classList.toggle(
            "empty",
            value === 0
        );

        cell.classList.toggle(
            "filled",
            value !== 0
        );

        cell.setAttribute(
            "aria-label",
            value === 0
                ? `Row ${row + 1}, column ${col + 1}, empty`
                : `Row ${row + 1}, column ${col + 1}, player value ${value}`
        );
    }

    // ===== Numeronäppäimistön luominen =====

    function renderNumberPad() {
        const fragment =
            document.createDocumentFragment();

        numberPad.innerHTML = "";

        // ===== Numeropainikkeet =====

        for (
            let value = 1;
            value <= gameState.size;
            value++
        ) {
            const button =
                document.createElement("button");

            button.type = "button";
            button.className = "number-button";

            button.dataset.action = "number";
            button.dataset.value = value;

            button.textContent = value;

            button.setAttribute(
                "aria-label",
                `Enter number ${value}`
            );

            fragment.appendChild(button);
        }

        // ===== Numeron poistaminen =====

        const eraseButton =
            document.createElement("button");

        eraseButton.type = "button";

        eraseButton.className =
            "number-button erase-button";

        eraseButton.dataset.action = "erase";
        eraseButton.textContent = "Erase";

        eraseButton.setAttribute(
            "aria-label",
            "Erase selected cell"
        );

        fragment.appendChild(eraseButton);

        // ===== Vihjepainike =====

        const hintButton =
            document.createElement("button");

        hintButton.type = "button";

        hintButton.className =
            "number-button hint-button";

        hintButton.dataset.action = "hint";
        hintButton.textContent = "Hint";

        hintButton.setAttribute(
            "aria-label",
            "Reveal one correct number"
        );

        fragment.appendChild(hintButton);

        numberPad.appendChild(fragment);
    }

    // ===== Numeronäppäimistön lukitseminen =====

    function setNumberPadDisabled(disabled) {
        const buttons =
            numberPad.querySelectorAll(
                ".number-button"
            );

        for (const button of buttons) {
            button.disabled = disabled;
        }
    }

    // ===== Numeron asettaminen valittuun soluun =====

    function setSelectedCellValue(value) {
        const row = gameState.selectedRow;
        const col = gameState.selectedCol;

        if (
            !gameState.playing ||
            row === null ||
            col === null
        ) {
            return;
        }

        // Alkuperäistä numeroa tai vihjettä ei saa muuttaa.

        if (
            gameState.puzzle[row][col] !== 0 ||
            isHintedCell(row, col)
        ) {
            return;
        }

        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value > gameState.size
        ) {
            return;
        }

        gameState.board[row][col] = value;

        updateCell(row, col);

        checkBoardCompletion();
    }

    // ===== Tyhjien muokattavien ruutujen etsiminen =====
    //
    // Vihje voidaan sijoittaa vain ruutuun, joka:
    //
    // 1. ei ollut alkuperäisessä pulmassa valmiiksi annettu
    // 2. ei ole aikaisemmin paljastettu vihjeellä
    // 3. on edelleen tyhjä eli sen arvo on 0
    //
    // Pelaajan jo täyttämää ruutua ei korjata vihjeellä,
    // vaikka siinä olisi väärä numero.

    function getEmptyEditableCells() {
        const emptyCells = [];

        for (
            let row = 0;
            row < gameState.size;
            row++
        ) {
            for (
                let col = 0;
                col < gameState.size;
                col++
            ) {
                const isGiven =
                    gameState.puzzle[row][col] !== 0;

                const isHinted =
                    isHintedCell(row, col);

                const isEmpty =
                    gameState.board[row][col] === 0;

                if (
                    !isGiven &&
                    !isHinted &&
                    isEmpty
                ) {
                    emptyCells.push({
                        row,
                        col,
                    });
                }
            }
        }

        return emptyCells;
    }

    // ===== Satunnaisen vihjeruudun valitseminen =====
    //
    // Valittu Sudoku-ruutu jätetään kokonaan huomiotta.
    //
    // Jokaisella vielä tyhjällä pelaajan ruudulla on yhtä suuri
    // mahdollisuus tulla valituksi vihjeen kohteeksi.

    function chooseHintCell() {
        const emptyCells =
            getEmptyEditableCells();

        // Laudalla ei ole enää tyhjiä ruutuja.

        if (emptyCells.length === 0) {
            return null;
        }

        const randomIndex =
            Math.floor(
                Math.random() *
                emptyCells.length
            );

        return emptyCells[randomIndex];
    }

    // ===== Yhden satunnaisen numeron paljastaminen =====

    function revealHint() {
        if (!gameState.playing) {
            return;
        }
    
        // Valitaan satunnainen vielä tyhjä pelaajan ruutu.
    
        const hintCell =
            chooseHintCell();
    
        // Tyhjiä ruutuja ei enää ole.
        //
        // checkBoardCompletion näyttää joko voiton
        // tai jäljellä olevien virheiden määrän.
    
        if (!hintCell) {
            checkBoardCompletion();
            return;
        }
    
        const {
            row,
            col,
        } = hintCell;
    
        // ===== Oikean numeron paljastaminen =====
    
        gameState.board[row][col] =
            gameState.solution[row][col];
    
        // Merkitään ruutu vihjeellä täytetyksi,
        // jotta se näytetään vihreänä ja lukitaan.
    
        gameState.hintedCells.add(
            createCellKey(row, col)
        );
    
        // Rakennetaan ruudukko uudelleen,
        // jotta uusi hinted-luokka tulee näkyviin.
    
        clearSelection();
        renderBoard();
    
        clearGameMessage();
    
        // Valitaan seuraava muokattava ruutu pelaamista varten.
        //
        // Tämä valinta ei enää vaikuta seuraavan vihjeen sijaintiin.
    
        selectFirstEditableCell();
    
        // Tarkistetaan, täyttikö vihje viimeisen tyhjän ruudun.
    
        checkBoardCompletion();
    }

    // ===== Laudan täyttymisen tarkistaminen =====

    function isBoardFilled() {
        return gameState.board.every(row =>
            row.every(value => value !== 0)
        );
    }

    // ===== Virheiden laskeminen =====
    //
    // Pelaajan koko lautaa verrataan generaattorin ratkaisuun.
    //
    // Virheellisten solujen sijainteja ei merkitä näkyviin.

    function countBoardErrors() {
        let errorCount = 0;

        for (
            let row = 0;
            row < gameState.size;
            row++
        ) {
            for (
                let col = 0;
                col < gameState.size;
                col++
            ) {
                if (
                    gameState.board[row][col] !==
                    gameState.solution[row][col]
                ) {
                    errorCount++;
                }
            }
        }

        return errorCount;
    }

    // ===== Laudan lukitseminen voiton jälkeen =====

    function lockCompletedBoard() {
        const editableCells =
            sudokuGrid.querySelectorAll(
                ".sudoku-cell.editable"
            );

        for (const cell of editableCells) {
            cell.disabled = true;
        }

        setNumberPadDisabled(true);
        clearSelection();
    }

    // ===== Täyden laudan tarkistaminen =====

    function checkBoardCompletion() {
        // ===== Laudalla on vielä tyhjiä ruutuja ===== 

        if (!isBoardFilled()) {
            clearGameMessage(); 

            sudokuGrid.classList.remove(
                "completed"
            );  

            updateIterationMessage();   

            return;
        }   

        // ===== Koko lauta on täynnä ===== 

        const errorCount =
            countBoardErrors(); 

        // ===== Oikea ratkaisu =====   

        if (errorCount === 0) {
            gameState.playing = false;  

            // Pysäytetään aika ennen voittoviestin muodostamista.  

            stopTimer();    

            iterationMessage.textContent =
                "Puzzle completed correctly.";  

            gameMessage.textContent =
                `You Win! Time: ${formatElapsedTime(gameState.elapsedSeconds)}.`;   

            gameMessage.className =
                "game-message success"; 

            sudokuGrid.classList.add(
                "completed"
            );  

            lockCompletedBoard();   

            return;
        }   

        // ===== Virheellinen ratkaisu =====
        //
        // Ajastinta ei pysäytetä, koska peli jatkuu.
        //
        // Pelaajalle kerrotaan vain virheiden määrä,
        // mutta ei virheellisten ruutujen sijainteja.  

        const errorWord =
            errorCount === 1
                ? "error"
                : "errors"; 

        iterationMessage.textContent =
            "The board is full. Correct the mistakes and try again.";   

        gameMessage.textContent =
            `There ${errorCount === 1 ? "is" : "are"} ${errorCount} ${errorWord}.`; 

        gameMessage.className =
            "game-message error";
    }

    // ===== Valinnan siirtäminen nuolinäppäimillä =====

    function moveSelection(rowDirection, colDirection) {
        if (
            gameState.selectedRow === null ||
            gameState.selectedCol === null
        ) {
            selectFirstEditableCell();
            return;
        }

        let row = gameState.selectedRow;
        let col = gameState.selectedCol;

        for (
            let step = 0;
            step < gameState.size;
            step++
        ) {
            const nextRow =
                row + rowDirection;

            const nextCol =
                col + colDirection;

            if (
                nextRow < 0 ||
                nextRow >= gameState.size ||
                nextCol < 0 ||
                nextCol >= gameState.size
            ) {
                return;
            }

            row = nextRow;
            col = nextCol;

            const isEditable =
                gameState.puzzle[row][col] === 0;

            const isNotHinted =
                !isHintedCell(row, col);

            if (
                isEditable &&
                isNotHinted
            ) {
                selectCell(row, col);
                return;
            }
        }
    }

    // ===== Fyysisen näppäimistön käsittely =====

    function handleKeyboardInput(event) {
        if (!gameState.playing) {
            return;
        }

        // ===== Numerot 1–9 =====

        if (/^[1-9]$/.test(event.key)) {
            const value =
                Number(event.key);

            if (value <= gameState.size) {
                event.preventDefault();

                setSelectedCellValue(value);
            }

            return;
        }

        // ===== Numeron poistaminen =====

        if (
            event.key === "Backspace" ||
            event.key === "Delete" ||
            event.key === "0"
        ) {
            event.preventDefault();

            setSelectedCellValue(0);

            return;
        }

        // ===== Valinnan liikuttaminen =====

        const directions = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
        };

        const direction =
            directions[event.key];

        if (!direction) {
            return;
        }

        event.preventDefault();

        moveSelection(
            direction[0],
            direction[1]
        );
    }

    // ===== Uuden pulman generointi ja käynnistäminen =====
    //
    // Tätä funktiota käytetään kahdesta paikasta:
    //
    // 1. Main Menun Play-painikkeesta.
    // 2. Pelinäkymän New Game -painikkeesta.
    //
    // New Game säilyttää nykyisen koon ja vaikeustason,
    // mutta generoi kokonaan uuden ratkaisun ja pulman.

    function generateAndStartPuzzle() {
        // ===== Vanhan pelikierroksen pysäyttäminen =====

        gameState.playing = false;

        stopTimer();
        resetTimer();

        clearSelection();
        clearGameMessage();

        gameState.selectedRow = null;
        gameState.selectedCol = null;
        gameState.hintedCells.clear();

        sudokuGrid.classList.remove(
            "completed"
        );

        sudokuGrid.innerHTML = "";
        numberPad.innerHTML = "";

        iterationMessage.textContent =
            "Generating puzzle...";

        setGameActionButtonsDisabled(true);

        updateGameInfo();
        showGameView();

        try {
            // ===== Täydellinen ratkaisu =====

            const solution =
                generateSolvedBoard(
                    gameState.config
                );

            // ===== Yksikäsitteinen pulma =====

            const puzzleResult =
                generatePuzzle(
                    solution,
                    gameState.config,
                    gameState.difficulty
                );

            // ===== Pelitilan tallentaminen =====

            gameState.solution =
                solution;

            gameState.puzzle =
                puzzleResult.puzzle;

            gameState.board =
                cloneBoard(
                    puzzleResult.puzzle
                );
            
            gameState.hintedCells.clear();

            gameState.selectedRow = null;
            gameState.selectedCol = null;
            gameState.playing = true;

            // ===== Käyttöliittymän rakentaminen =====

            renderBoard();
            renderNumberPad();

            setNumberPadDisabled(false);
            setGameActionButtonsDisabled(false);

            updateIterationMessage();

            // Ajastin käynnistyy vasta, kun pulma on valmis.
            // Generointiin käytettyä aikaa ei siis lasketa peliaikaan.

            startTimer();

            selectFirstEditableCell();
        } catch (error) {
            console.error(
                "Sudoku generation failed:",
                error
            );

            // ===== Pelitilan tyhjentäminen =====

            gameState.solution = [];
            gameState.puzzle = [];
            gameState.board = [];

            gameState.hintedCells.clear();
            gameState.playing = false;
            gameState.selectedRow = null;
            gameState.selectedCol = null;

            resetTimer();

            sudokuGrid.innerHTML = "";
            numberPad.innerHTML = "";

            iterationMessage.textContent = "";

            gameMessage.textContent =
                "Sudoku generation failed. Please try again.";

            gameMessage.className =
                "game-message error";

            // Restart ei ole mahdollinen ilman olemassa olevaa pulmaa.
            // New Game jätetään käyttöön, jotta käyttäjä voi yrittää uudelleen.

            restartButton.disabled = true;
            newGameButton.disabled = false;

            showGameView();
        }
    }

    // ===== Nykyisen pulman aloittaminen alusta =====
    //
    // Restart ei generoi uutta Sudokua.
    //
    // Se palauttaa board-taulukon alkuperäisen puzzle-taulukon
    // mukaiseksi ja käynnistää ajan uudelleen nollasta.

    function restartCurrentPuzzle() {
        // Jos pulmaa ei ole onnistuneesti generoitu,
        // mitään ei voida käynnistää uudelleen.

        if (
            !Array.isArray(gameState.puzzle) ||
            gameState.puzzle.length === 0
        ) {
            return;
        }

        gameState.playing = false;

        stopTimer();
        clearSelection();
        clearGameMessage();

        // ===== Palautetaan alkuperäinen pulma =====

        gameState.board =
            cloneBoard(
                gameState.puzzle
            );

        gameState.hintedCells.clear();
        gameState.selectedRow = null;
        gameState.selectedCol = null;

        // ===== Rakennetaan käyttöliittymä uudelleen =====

        renderBoard();

        // Numeronäppäimistö on normaalisti jo olemassa.
        // Tämä varmistus auttaa myös mahdollisissa virhetilanteissa.

        if (numberPad.children.length === 0) {
            renderNumberPad();
        }

        setNumberPadDisabled(false);
        setGameActionButtonsDisabled(false);

        gameState.playing = true;

        updateIterationMessage();
        startTimer();

        selectFirstEditableCell();
    }

    // ===== Päävalikon näyttäminen =====

    function showMainMenu() {
        gameState.playing = false;

        stopTimer();
        clearSelection();

        gameView.classList.add("hidden");
        mainMenu.classList.remove("hidden");
    }

    // ===== Pelinäkymän näyttäminen =====

    function showGameView() {
        mainMenu.classList.add("hidden");
        gameView.classList.remove("hidden");
    }

    // ===== Pelin käynnistäminen päävalikosta =====

    function startGame() {
        // Play-painike lukee päävalikon tämänhetkiset valinnat.

        if (!readSelectedGameSettings()) {
            return;
        }

        generateAndStartPuzzle();
    }

    // ===== Päävalikon Play =====

    playButton.addEventListener(
        "click",
        startGame
    );

    // ===== Paluu päävalikkoon =====

    mainMenuButton.addEventListener(
        "click",
        showMainMenu
    );

    // ===== Saman pulman aloittaminen alusta =====

    restartButton.addEventListener(
        "click",
        restartCurrentPuzzle
    );

    // ===== Uuden pulman generointi =====
    //
    // Nykyinen koko ja vaikeustaso säilyvät,
    // koska niitä ei lueta uudelleen päävalikosta.

    newGameButton.addEventListener(
        "click",
        generateAndStartPuzzle
    );

    // ===== Sudoku-solun valitseminen =====
    //
    // Käytetään event delegation -mallia, joten jokaiselle
    // dynaamisesti luodulle solulle ei tarvita omaa kuuntelijaa.

    sudokuGrid.addEventListener(
        "click",
        event => {
            const cell =
                event.target.closest(
                    ".sudoku-cell.editable"
                );

            if (!cell) {
                return;
            }

            selectCell(
                Number(cell.dataset.row),
                Number(cell.dataset.col)
            );
        }
    );

    // ===== Näytöllä olevan numeronäppäimistön käsittely =====

    numberPad.addEventListener(
        "click",
        event => {
            const button =
                event.target.closest(
                    ".number-button"
                );

            if (
                !button ||
                button.disabled
            ) {
                return;
            }

            const action =
                button.dataset.action;

            // ===== Numero =====

            if (action === "number") {
                setSelectedCellValue(
                    Number(button.dataset.value)
                );

                return;
            }

            // ===== Numeron poistaminen =====

            if (action === "erase") {
                setSelectedCellValue(0);
                return;
            }

            // ===== Vihje =====

            if (action === "hint") {
                revealHint();
            }
        }
    );

    // ===== Fyysisen näppäimistön käsittely =====

    document.addEventListener(
        "keydown",
        handleKeyboardInput
    );

    // ===== Sovelluksen alkutila =====

    showMainMenu();
});