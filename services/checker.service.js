import fetcher from '../utils/fetcher.js';
import axios from 'axios';

const instance = axios.create({
  baseURL: 'https://wordle.votee.dev:8000',
});

const apiCaller = fetcher(instance);



const checkerSvc = {
  guessDaily: async ({guess, size}) => {
    if (guess.length !== size) {
      throw new Error('Guess length must equal to size');
    }
    
    const params = new URLSearchParams();
    guess && params.append('guess', guess);
    size && params.append('size', size);

    return apiCaller.get(`/daily?${params.toString()}`);
  },
  guessRandom: ({guess, size, seed}) => {
    if (guess.length !== size) {
      throw new Error('Guess length must equal to size');
    }

    const params = new URLSearchParams();
    guess && params.append('guess', guess);
    size && params.append('size', size);
    seed && params.append('seed', seed);

    return apiCaller.get(`/random?${params.toString()}`);
  },
  guessWord: (wordQuizzer, guess) => apiCaller.get(`/word/${wordQuizzer}?guess=${guess}`),
}

export default checkerSvc;
