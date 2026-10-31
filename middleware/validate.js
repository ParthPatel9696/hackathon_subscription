function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ success: false, error: 'Request validation failed.', details: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) });
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return res.status(400).json({ success: false, error: 'Query validation failed.', details: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) });
    Object.assign(req.query, result.data);
    next();
  };
}

function validateObjectIdParam(...names) {
  const mongoose = require('mongoose');
  return (req, res, next) => {
    const invalid = names.find((name) => !mongoose.isValidObjectId(req.params[name]));
    if (invalid) return res.status(400).json({ success: false, error: `Invalid ${invalid}.` });
    next();
  };
}

module.exports = { validateBody, validateQuery, validateObjectIdParam };
