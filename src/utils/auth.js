function getUserId(req) {
  return req.user.id;
}

module.exports = { getUserId };
