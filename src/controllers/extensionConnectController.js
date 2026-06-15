const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const {
  validateConnectInitBody,
  createConnectToken,
  exchangeConnectToken,
} = require("../services/extensionConnectService");

const postConnectInitController = async (req, res) => {
  try {
    const bundle = validateConnectInitBody(req.body);
    const result = await createConnectToken(req.user.id, bundle);
    return ok(res, result);
  } catch (err) {
    if (err.code === "BAD_REQUEST") {
      return error(res, 400, err.message, ERROR_CODES.BAD_REQUEST);
    }
    logError("EXTENSION_CONNECT_INIT_ERROR", err, { reqId: req.requestId, userId: req.user?.id });
    return error(res, 503, "Connect service temporarily unavailable", ERROR_CODES.INTERNAL_ERROR);
  }
};

const postConnectExchangeController = async (req, res) => {
  try {
    const connectToken = req.body?.connectToken;
    const session = await exchangeConnectToken(connectToken);
    return ok(res, session);
  } catch (err) {
    if (err.code === "BAD_REQUEST") {
      return error(res, 400, err.message, ERROR_CODES.BAD_REQUEST);
    }
    if (err.code === "CONNECT_TOKEN_EXPIRED") {
      return error(res, 410, err.message, ERROR_CODES.NOT_FOUND);
    }
    logError("EXTENSION_CONNECT_EXCHANGE_ERROR", err, { reqId: req.requestId });
    return error(res, 503, "Connect service temporarily unavailable", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  postConnectInitController,
  postConnectExchangeController,
};
