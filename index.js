import chalk from "chalk";
import clear from "clear";
import inquirer from "inquirer";
import checkerSvc from "./services/checker.service.js";
import searcherSvc from "./services/searcher.service.js";
import figlet from "figlet";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";


let gameModeCache;

(async function main() {
    clear();
    console.log(
        chalk.yellow(figlet.textSync("Wordle", { horizontalLayout: "full" }))
    );

    const gameMode = await getUserChoice(gameModeCache);
    gameModeCache = gameMode;

    const ctx = {
        guess: "?".repeat(gameMode.size),
        absentChars: new Set(),
        presentChars: new Set(),
        checkedWords: new Set(),
        gameMode,
    }

    const guessWordHandle = getGuessWordHandler(ctx);
    const searcherHandle = getSearchHandler(ctx);
    let time = 0;
    while (ctx.guess.includes("?")) {
        if (time >= 50) {
            break;
        }
        time++;
        showCurrentGuess(ctx.guess);
        const recommendWords = await searcherHandle(ctx.guess);

        if (recommendWords.length === 0) {
            console.log(chalk.red("No word found"));
            return
        }
        for (let i = 0; i < recommendWords.length; i++) {
            const currentGuess = ctx.guess;
            const recommendWord = recommendWords[i];
            if (ctx.checkedWords.has(recommendWord)) {
                continue;
            }
            // Add the word to checked words
            ctx.checkedWords.add(recommendWord);
            // filter word by size
            if (recommendWord.length !== ctx.gameMode.size) {
                continue;
            }

            // filter word by absent char
            for (let j = 0; j < recommendWord.length; j++) {
                const char = recommendWord[j];
                if (ctx.absentChars.has(char) || ctx.presentChars.has(char)) {
                    continue;
                }
            }

            const guessRegular = convertToRegular(ctx.guess);
            // filter word by regex
            if (!guessRegular.test(recommendWord)) {
                continue;
            }

            const guessWord = recommendWord;

            showGuess(guessWord)
            const guessResult = await guessWordHandle(guessWord);
            if (guessResult.find((element) => element.result !== "correct")) {
                showWrongGuess(guessWord)
            } else {
                ctx.guess = guessWord;
                break;
            }

            for (let idx = 0; idx < guessResult.length; idx++) {
                const char = guessResult[idx];
                if (char.result === "absent") {
                    ctx.absentChars.add(char.guess);
                    continue;
                }

                // if char is present, replace the guess word to find the position of the char
                if (char.result === "present") {
                    const guessWord = ctx.guess.replaceAll("?", char.guess);
                    showSpamGuess(guessWord)
                    const spamGuessResult = await guessWordHandle(guessWord);

                    spamGuessResult.forEach((element) => {
                        if (element.result === "correct") {
                            ctx.guess = replaceAt(ctx.guess, element.slot, element.guess);
                        }
                    });
                    ctx.presentChars.add(char.guess);
                    continue;
                }

                if (char.result === "correct") {
                    ctx.guess = replaceAt(ctx.guess, char.slot, char.guess);
                    ctx.presentChars.add(char.guess);
                    continue;
                }
            }

            if (currentGuess !== ctx.guess && !ctx.gameMode.useGPT) {
                break;
            }
        }

        if (ctx.guess === "?".repeat(ctx.gameMode.size)) {
            return
        }
    }

    if (ctx.guess.includes("?")) {
        console.log(chalk.red(
            figlet.textSync("Program can't find the word", { horizontalLayout: "full" })
        ));
    } else {
        showRightGuess(ctx.guess);
    }

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

function getGuessWordHandler(ctx) {
    const seed = getRandomInt(1, 10);

    if (ctx.gameMode.mode === "random") {
        return (guess) => {
            return checkerSvc
                .guessRandom({
                    guess,
                    seed,
                    size: ctx.gameMode.size,
                }).then(([res]) => {
                    ;
                    return res ?? []
                })
        };
    }
    if (ctx.gameMode.mode === "daily") {
        return (guess) => {
            return checkerSvc
                .guessDaily({ guess, size: ctx.gameMode.size })
                .then(([res]) => {
                    return res ?? []
                })
        };
    }
    if (ctx.gameMode.word === "") {
        throw new Error("Word must be provided when mode is word");
    }
    return (guess) => {
        return checkerSvc
            .guessWord(ctx.gameMode.word, guess)
            .then(([res]) => {
                console.log(res);

                return res ?? []
            })
    }
}

function getSearchHandler(ctx) {
    const max = 100;
    if (ctx.gameMode.useGPT) {
        const handleSearch = gptSearchSvc(ctx)
        return (word) => handleSearch(word);
    }
    return (word) => searcherSvc.search(word, max).then(([res]) => res ?? []).then((res) => res.map((element) => element.word));
}

async function getUserChoice(gameMode = {}) {
    const defaultSize = gameMode.size ?? 5;
    let size = defaultSize;
    let word = "";
    let questions = [
        {
            type: "list",
            name: "mode",
            message: "Choice a game mode to play:",
            choices: ["daily", "random", "word"],
            default: gameMode.mode ?? "daily",
        },
    ];
    const { mode } = await inquirer.prompt(questions);

    if (mode === "word") {
        questions = [
            {
                type: "input",
                name: "word",
                message: "Enter the word to guess",
                default: gameMode.word ?? "",
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
                default: defaultSize,
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

    questions = [
        {
            type: "confirm",
            name: "useGPT",
            message: "Do you want use openAI of GPT ?",
            default: gameMode.useGPT ?? false,
        },
    ];
    const { useGPT } = await inquirer.prompt(questions);
    let openaiKey = "";
    if (useGPT) {
        questions = [
            {
                type: "input",
                name: "openaiKey",
                message: "Enter the openAI key",
                default: gameMode.openaiKey ?? "",
            },
        ];
        const result = await inquirer.prompt(questions);
        if (result.openaiKey === "") {
            console.log(chalk.red("OpenAI key must be provided"));
            throw new Error();
        }
        openaiKey = result.openaiKey
    }

    return { mode, size, word, useGPT, openaiKey };
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

// Setup OpenAI
const CalendarEvent = z.object({
    name: z.string(),
    items: z.array(z.string()),
});
let openai;
const gptSearchSvc = (ctx) => {
    if (!ctx.gameMode.openaiKey) {
        throw new Error("OpenAI key must be provided");
    }

    openai = new OpenAI({ apiKey: ctx.gameMode.openaiKey });

    return async function gptSearch(guess) {
        const excludeCharacters = [...Array.from(ctx.absentChars), ...Array.from(ctx.presentChars)];
        let checkedWords = Array.from(ctx.checkedWords);
        checkedWords = checkedWords.length > 10 ? checkedWords.slice(checkedWords.length - 6, checkedWords.length - 1) : checkedWords;
        const content = `word is ${guess} fill each '?' a letters to complete this word, word have ${guess.length} letters, ${excludeCharacters.length > 0 ? `exclude letters ${excludeCharacters.toString()},` : ''} ${checkedWords.length > 0 ? `exclude word ${checkedWords.toString()},` : ''}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",

            messages: [
                { role: "system", content: `You extract word into JSON data like a array ["word1", "word2"] with max element are 100` },
                {
                    role: "user",
                    content,
                },
            ],
            response_format: zodResponseFormat(CalendarEvent, "event")
        });

        const response = JSON.parse(completion.choices[0].message.content).items.map((element) => element.toLowerCase());
        console.log('GPT search:', response);
        return response;
    }
}
