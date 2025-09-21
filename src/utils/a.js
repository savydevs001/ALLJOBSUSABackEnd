const a = (fn) => async (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default a;