const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

const router = express.Router();

// if create a new access token if refresh token is valid
router.post('/', (req, res, next) => {
	const rtoken = req.body.rtoken;
	const secret = process.env.JWT_SECRET;

	jwt.verify(rtoken, secret, (err, rclaim) => {
		const { id, rkey } = rclaim;
		db.get_rkey(id, (err, stored_rkey) => {
			if (err) next(err);

			if (rkey == stored_rkey) {
				const aclaim = { id };
				const options = { expiresIn: '20m' };

				jwt.sign(aclaim, secret, options, (err, atoken) => {
					res.send(atoken);
				});
			} else {
				res.status(401)
					.send("Refresh token doesn't match");
			}
		});
	})
});

module.exports = router;
