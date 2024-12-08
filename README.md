# Wordle Game

Welcome to the Wordle Game project! This is a command-line version of the popular word-guessing game, Wordle. In this game, you can either play manually or let GPT-4o-mini play for you by providing your OpenAI key. Follow the instructions below to set up and run the project.


## I. Run Project

1. Clone the repository:
  ```sh
  git clone /Users/mr.xep/Desktop/my-project/wordle
  ```

2. Navigate to the project directory:
  ```sh
  cd wordle
  ```

3. Install the dependencies:
  ```sh
  yarn install
  ```

4. Start the game:
  ```sh
  node index.js
  ```

5. Choose the mode to play:

![alt text](image.png)

6. Input length of word

![alt text](image-1.png)

7. Choose have using GPT to play.

![alt text](image-3.png)

8. If using GPT to play Enter openAI key (It only using in the session of the game play and will not send to any where)

![alt text](image-4.png)

9. The Programming will auto play the game.

![alt text](image-2.png)

## II. Document

### Querying the Datamuse API

To query a word using the Datamuse API, you can use the following endpoint:

```sh
https://api.datamuse.com/words?sp=he??o
```

### Example Response

The response from the Datamuse API for the query `https://api.datamuse.com/words?sp=he??o` might look like this:

```json
[
  {
    "word": "hello",
    "score": 4231
  },
  {
    "word": "hero",
    "score": 3000
  }
]
```

For more information on the Datamuse API, visit [Datamuse API Documentation](https://www.datamuse.com/api/).
