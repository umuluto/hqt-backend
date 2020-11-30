const jwt = require('jsonwebtoken');

// Parse, verify Bearer token, merge to req.hqt.claim
function authParser(req, res, next) {
	const auth = req.get('Authorization');

	if (!auth) return next();

	const token = auth.split(' ')[1];
	const secret = process.env.JWT_SECRET;

	jwt.verify(token, secret, (err, claim) => {
		if (err) {
			if (err.name !== 'TokenExpiredError') next(err);
		}

		req.hqt.claim = { ...req.hqt.claim, ...claim };
		next();
	});
}

// require logged in on certain routes
function requireLogin(req, res, next) {
	const claim = req.hqt.claim;
	if (claim.exp < Date.now()) {
		return res.status(401)
			.send('Access token expired');
	}
	next();
}

module.exports = { authParser, requireLogin };
