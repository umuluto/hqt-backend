const db = require('../db/db');
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/create', (req, res, next) => {
	const roomname = req.body.name;
	const userid = req.hqt.claim.id;

	db.addroom(userid, roomname, (err, success) => {
		if (err) return next(err);
		if (!success) {
			return res.status(409)
				.send('Create room failed');
		}

		res.sendStatus(200);
	});
});

router.post('/addmember', (req, res, next) => {
	const userid = req.hqt.claim.id;
	const { roomid, memberid } = req.body;

	db.addtoroom(roomid, memberid, (err, success) => {
		if (err) return next(err);
		if (!success) {
			return res.status(409)
				.send('Add to room failed');
		}

		res.sendStatus(200);
	});
});

router.post('/kick', (req, res, next) => {
	const userid = req.hqt.claim.id;
	const { roomid, memberid } = req.body;

	db.remfromroom(roomid, memberid, (err, success) => {
		if (err) return next(err);
		if (!success) {
			return res.status(409)
				.send('Kick from room failed');
		}

		res.sendStatus(200);
	});
});

module.exports = router;
