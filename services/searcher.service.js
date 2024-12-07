import axios from 'axios';
import fetcher from '../utils/fetcher.js';
console.log(fetcher);

const instance = axios.create({
  baseURL: 'https://api.datamuse.com',
});

const apiCaller = fetcher(instance);



const searcherSvc = {
  search: (guess, max = undefined) => {
    return apiCaller.get(`/words?sp=${guess}&max=${max}`);
  },
}

export default searcherSvc;
