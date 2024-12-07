const handleResponse = (response) => {
  if (response.status === 200) {
    return [response.data, null];
  }
  return [null, response.data];
};

const fetcher = (instance) => {
  return {
    get: async (url, option) =>
      instance.get(url, option).then(handleResponse).catch(handleResponse),
    post: async (url, data, option) =>
      instance.post(url, data, option).then(handleResponse).catch(handleResponse),
    put: async (url, data, option) =>
      instance.put(url, data, option).then(handleResponse).catch(handleResponse),
  };
};

export default fetcher;
