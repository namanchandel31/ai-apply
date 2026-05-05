function getUserId(req) {
  return req.body.userId;
}

module.exports = { getUserId };
