const db = require('../db/db');
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/request', (req, res, next) => {
	const userid = req.hqt.claim.id;
	const { friendid, token } = req.body;
	const secret = process.env.JWT_SECRET;

	if (friendid) {
		db.user_exist(friendid, (err, exist) => {
			if (err) return next(err);
			if (!exist) {
				return res.status(404)
					.send('User not found');
			}

			const data = { userid, friendid };
			jwt.sign(data, secret, (err, token) => {
				if (err) return next(err);
				const msg = JSON.stringify({
					type: 'friend_request',
					req_token: token
				});
				db.notify(friendid, msg);
				res.sendStatus(200);
			});
		});
	} else { 
		jwt.verify(token, secret, (err, friend_req) => {
			if (err) return next(err);
			const { req_userid, req_friendid } = friend_req;
			if (userid != req_friendid) {
				return res.status(403)
					.send("Your ID doesn't match the request's");
			}

			db.befriends(req_userid, req_friendid, (err, success) => {
				if (err) return next(err);
				if (!success) {
					return res.status(409)
					.send('Befriend failed');
				}

				const msg1 = JSON.stringify({
					type: 'new_friend',
					id: req_friendid
				});

				const msg2 = JSON.stringify({
					type: 'new_friend',
					id: req_userid
				});

				db.notify(req_userid, msg1);
				db.notify(req_friendid, msg2);
				res.sendStatus(200);
			});
		});
	}
});

router.post('/unfriends', (req, res, next) => {
	const userid = req.hqt.claim.id;
	const friendid = req.body.friendid;

	db.unfriends(userid, friendid, (err, success) => {
		if (err) return next(err);

		if (success) {
			res.sendStatus(200);
		} else {
			res.status(409)
				.send('Unfriend failed');
		}
	});
});

module.exports = router;
