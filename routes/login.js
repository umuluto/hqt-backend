const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

const router = express.Router();

// If username and password is valid update and return refresh token
router.post('/', (req, res, next) => {
	const { name, pass } = req.body;
	if (!name || !pass) {
		return res.status(400)
			.send('Missing username or password');
	}

	db.login(name, pass, (err, id) => {
		if (err) next(err);
		if (!id) {
			return res.status(401)
				.send('Invalid username or password');
		}

		const secret = process.env.JWT_SECRET;
		const rkey = Math.random();
		const claim = { id, rkey };

		jwt.sign(claim, secret, (err, rtoken) => {
			db.set_rkey(id, rkey, () => {
				res.send(rtoken);
			});
		});
	});
});

module.exports = router;
