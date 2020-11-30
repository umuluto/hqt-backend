const express = require('express');
const db = require('../db/db.js');

const router = express.Router();

router.post('/', (req, res, next) => {
	const { name, pass } = req.body;
	if (!name || !pass) {
		return res.status(400)
			.send('Missing username or password');
	}

	db.signup(name, pass, (err, success) => {
		if (err) return next(err);
		if (!success) {
			return res.status(403)
				.send('Username already exists');
		}

		res.sendStatus(200);
	});
});

module.exports = router;
