const authService = require("../services/authService");
const { error, ok, ERROR_CODES } = require("../utils/response");

async function signup(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 400, "Email and password are required", ERROR_CODES.BAD_REQUEST);
    }

    const user = await authService.signup(email, password);

    ok(res, { user });
  } catch (err) {
    if (err.message.includes("duplicate key")) {
      return error(res, 400, "Email already exists", ERROR_CODES.BAD_REQUEST);
    }
    error(res, 400, err.message, ERROR_CODES.BAD_REQUEST);
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 400, "Email and password are required", ERROR_CODES.BAD_REQUEST);
    }

    const data = await authService.login(email, password);

    ok(res, data);
  } catch (err) {
    error(res, 401, err.message, ERROR_CODES.UNAUTHORIZED);
  }
}

module.exports = { signup, login };
