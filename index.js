import chalk from "chalk";
import clear from "clear";
import inquirer from "inquirer";
import checkerSvc from "./services/checker.service.js";
import searcherSvc from "./services/searcher.service.js";
import figlet from "figlet";

(async function main() {
    clear();
    console.log(
        chalk.yellow(figlet.textSync("Wordle", { horizontalLayout: "full" }))
    );

    const gameMode = await getUserChoice();

    const guessWordHandle = getGuessWordHandler(gameMode.mode, gameMode.size, gameMode.word);
    const searcherHandle = getSearchHandler();

    let guess = "?".repeat(gameMode.size);
    const absentChars = new Set();
    const presentChars = new Set();
    const checkedWords = new Set();

    while (guess.includes("?")) {
        const recommendWords = await searcherHandle(guess);
        if (recommendWords.length === 0) {
            console.log(chalk.red("No word found"));
            return
        }
        for (let i = 0; i < recommendWords.length; i++) {
            if (i > 0) {
                showCurrentGuess(guess);
            }

            const currentGuess = guess;
            const recommendWord = recommendWords[i];
            if (checkedWords.has(recommendWord.word)) {
                continue;
            }
            // filter word by size
            if (recommendWord.word.length !== gameMode.size) {
                continue;
            }

            // filter word by absent char
            for (let j = 0; j < recommendWord.word.length; j++) {
                const char = recommendWord.word[j];
                if (absentChars.has(char) || presentChars.has(char)) {
                    continue;
                }
            }

            const guessRegular = convertToRegular(guess);
            // filter word by regex
            if (!guessRegular.test(recommendWord.word)) {
                continue;
            }
            // Add the word to checked words
            checkedWords.add(recommendWord.word);

            const guessWord = recommendWord.word;

            showGuess(guessWord)
            const guessResult = await guessWordHandle(guessWord);
            if (guessResult.find((element) => element.result !== "correct")) {
                showWrongGuess(guessWord)
            } else {
                guess = guessWord;
                break;
            }

            for (let idx = 0; idx < guessResult.length; idx++) {
                const char = guessResult[idx];
                if (char.result === "absent") {
                    absentChars.add(char.char);
                    continue;
                }

                // if char is present, replace the guess word to find the position of the char
                if (char.result === "present") {
                    const guessWord = guess.replaceAll("?", char.guess);
                    showSpamGuess(guessWord)
                    const spamGuessResult = await guessWordHandle(guessWord);

                    spamGuessResult.forEach((element) => {
                        if (element.result === "correct") {
                            guess = replaceAt(guess, element.slot, element.guess);
                        }
                    });
                    presentChars.add(char.char);
                    continue;
                }

                if (char.result === "correct") {
                    guess = replaceAt(guess, char.slot, char.guess);
                    presentChars.add(char.char);
                    continue;
                }
            }

            if (currentGuess !== guess) {
                break;
            }
        }

        if (guess === "?".repeat(gameMode.size)) {
            console.log(chalk.red("No word found"));
            return
        }
    }

    showRightGuess(guess);
    if (await questionMore()) {
        main();
    }
})();

function replaceAt(str, index, replacement) {
    return str.slice(0, index) + replacement + str.slice(index + 1);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function convertToRegular(guess) {
    const regularGuess = guess.replace(/\?/g, ".");
    return new RegExp(`${regularGuess}`, "i");
}

const showGuess = (guess) => {
    console.log(chalk.blue(`Guess ${guess}`));
}

const showWrongGuess = (guess) => {
    console.log(chalk.red(`Wrong ${guess}`));
}

const showSpamGuess = (guess) => {
    console.log(chalk.yellow(`Spam ${guess}`));
}
const showCurrentGuess = (guess) => {
    console.log("Current ", chalk.white(guess));
}

const showRightGuess = (guess) => {
    console.log(
        chalk.white(figlet.textSync("Result : "))
    );
    console.log(
        chalk.green(figlet.textSync(guess, { horizontalLayout: "full" }))
    );
}

function getGuessWordHandler(mode = "random", size = 5, word = "") {
    const seed = getRandomInt(1, 10);

    if (mode === "random") {
        return (guess) => {
            return checkerSvc
                .guessRandom({ guess, size, seed })
                .then(([res]) => {
                    ;
                    return res ?? []
                })
        };
    }
    if (mode === "daily") {
        return (guess) => {
            return checkerSvc
                .guessDaily({ guess, size })
                .then(([res]) => {
                    return res ?? []
                })
        };
    }
    if (word === "") {
        throw new Error("Word must be provided when mode is word");
    }
    return (guess) => {
        return checkerSvc
            .guessWord(word, guess)
            .then(([res]) => {
                console.log(res);
                
                return res ?? []
            })
    }
}

function getSearchHandler() {
    const max = 100;
    return (word) => searcherSvc.search(word, max).then(([res]) => res ?? []);
}

async function getUserChoice() {
    const defaultSize = 5;
    let size = defaultSize;
    let word = "";
    let questions = [
        {
            type: "list",
            name: "mode",
            message: "Choice a game mode to play:",
            choices: ["daily", "random", "word"],
            default: "daily",
        },
    ];
    const { mode } = await inquirer.prompt(questions);

    if (mode === "word") {
        questions = [
            {
                type: "input",
                name: "word",
                message: "Enter the word to guess",
            },
        ];
        const result = await inquirer.prompt(questions);
        if (/^[A-Za-z]+$/i.test(result.word) === false) {
            console.log(chalk.red("Word must be a string, no spaces or special characters"));
            throw new Error();
        }
        const findWord = await searcherSvc.search(result.word, 10).then(([res]) => res ?? []);
        if (findWord.length === 0) {
            console.log(chalk.red("Word not found"));
            throw new Error();
        }
        word = result.word;
        size = word.length;
    } else {
        questions = [
            {
                type: "input",
                name: "size",
                message: "Enter the size of the word",
                default: 5,
            },
        ];
        const result = await inquirer.prompt(questions);

        // Validate size
        if (!(/^\d+$/.test(result.size))) {
            throw new Error("Size must be a number");
        } else if (Number(result.size) == 0) {
            throw new Error("Size must be greater than 0");
        }
        size = Number(result.size);
    }

    return { mode, size, word };
}

async function questionMore() {
    const questions = [
        {
            type: "confirm",
            name: "more",
            message: "Do you want to play again?",
            default: true,
        },
    ];
    const { more } = await inquirer.prompt(questions);
    return more;
}
