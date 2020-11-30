const crypto = require('crypto');
const fs = require('fs');
const redis = require('redis');

// connect to redis, use environment variable (./redis.env)
const client = redis.createClient({
	host: process.env.REDIS_HOST,
	port: parseInt(process.env.REDIS_PORT),
	password: process.env.REDIS_PASS,
	detect_buffers: true,
});

// read all lua scripts file into this object
const scripts = {};
{
	const files = ['adduser'];

	for (const sc of files) {
		scripts[sc] = fs.readFileSync(`${__dirname}/${sc}.lua`, 'utf8');
	}
}

// constants for uid generation
const _NODEID = 0n;
const _EPOCH = 1605817350744;

function get_uid_gen() {
	// used between uid() calls
	let _uidcounter = 0n;

	return function uid() {
		const timestamp = BigInt(Date.now() - _EPOCH);
		_uidcounter = BigInt((_uidcounter + 1n) % 1024n);
		const id = timestamp << 23n | _NODEID << 10n | _uidcounter; 
		return BigInt.asUintN(64, id);
	}
}

// users and rooms have seperate uid generator
const new_userid = get_uid_gen();
const new_roomid = get_uid_gen();

class Db {
	// hash the pass, store the hashed pass and the salt
	signup(name, pass, callback) {
		const id = new_userid();
		const salt = crypto.randomBytes(16);

		crypto.scrypt(pass, salt, 32, (err, hashed_pass) => {
			if (err) return callback(err);

			client.eval(scripts.adduser, 2, `users:${id}`, 'name-id',
				id, name, hashed_pass, salt, (err, res) => {
					if (err) return callback(err);

					callback(null, res);
				});
		});
	}

	// return id if name and pass is valid
	login(name, pass, callback) {
		client.hget('name-id', name, (err, id) => {
			if (err) return callback(err);
			if (id === null) return callback(null, null);

			// send the key as Buffer (see node-redis detect_buffers)
			const hacky = Buffer(`users:${id}`)
			client.hmget(hacky, 'pass', 'salt', (err, [stored_pass, salt]) => {
				if (err) return callback(err);

				crypto.scrypt(pass, salt, 32, (err, hashed_pass) => {
					if (err) return callback(err);

					const valid = hashed_pass.equals(stored_pass);
					callback(null, valid ? id : null);
				});
			});
		});
	}

	// get user refresh token
	get_rkey(userid, callback) {
		client.get(`users:${userid}:rkey`, (err, rkey) => {
			if (err) return callback(err);
			callback(null, rkey);
		});
	}

	// set user refresh token
	set_rkey(userid, rkey, callback) {
		client.set(`users:${userid}:rkey`, rkey, 'ex', 86400, (err, res) => {
			if (err) return callback(err);
			if (callback) callback(null, res);
		});
	}

	// check if user(s) exists
	user_exist(...args) {
		const callback = args.pop();
		client.exists(args.map(id => `users:${id}`), callback);
	}

	// add 2 users to each other friend list
	befriends(userid1, userid2, callback) {
		client.multi()
			.sadd(`users:${userid1}:friends`, userid2)
			.sadd(`users:${userid2}:friends`, userid1)
			.exec((err, res) => {
				if (err) return callback(err);

				const success = res[0] && res[1];
				if (callback) callback(null, success);
			});
	}

	// remove 2 users from each other friend list
	unfriends(userid1, userid2, callback) {
		client.multi()
			.srem(`users:${userid1}:friends`, userid2)
			.srem(`users:${userid2}:friends`, userid1)
			.exec((err, res) => {
				if (err) return callback(err);

				const success = res[0] && res[1];
				if (callback) callback(null, success);
			});
	}

	// send plain text to client, frontend should be able to understand
	// the message
	notify(userid, msg, callback) {
		client.lpush(`users:${userid}:notifications`, msg, (err, res) => {
			if (err) return callback(err);
			if (callback) callback(null, res);
		});
	}

	// send private message
	privatechat(fromid, toid, msg, callback) {
		const time = Date.now();
		const data = JSON.stringify({ time, msg });

		client.exists(`users:${toid}`, (err, exist) => {
			if (err) return callback(err);
			if (!exist) return callback(null, null);

			client.lpush(`users:${toid}:inbox:${fromid}`, data, (err, res) => {
				if (err) return callback(err);
				callback(null, res);
			});
		});
	}

	// create a room
	addroom(userid, roomname, callback) {
		const roomid = new_roomid();
		client.multi()
			.set(`rooms:${roomid}:roomname`, roomname)
			.sadd(`rooms:${roomid}:members`, userid)
			.sadd(`users:${userid}:rooms`, roomid)
			.exec((err, res) => {
				if (err) return callback(err);

				const success = res[0] && res[1] && res[2];
				callback(null, success);
			});
	}

	// add user to a room
	addtoroom(roomid, userid, callback) {
		client.multi()
			.sadd(`rooms:${roomid}:members`, userid)
			.sadd(`users:${userid}:rooms`, roomid)
			.exec((err, res) => {
				if (err) return callback(err);

				const success = res[0] && res[1];
				callback(null, success);
			});
	}

	// remove user from a room
	remfromroom(roomid, userid, callback) {
		client.multi()
			.srem(`rooms:${roomid}:members`, userid)
			.srem(`users:${userid}:rooms`, roomid)
			.exec((err, res) => {
				if (err) return callback(err);

				const success = res[0] && res[1];
				callback(null, success);
			});
	}

	// send a group message
	groupchat(fromid, roomid, msg, callback) {
		client.sismember(`rooms:${roomid}:members`, fromid, (err, ismember) => {
			if (err) callback(err);
			if (!ismember) return callback(null, null);

			const time = Date.now();
			const data = JSON.stringify({ fromid, time, msg });

			client.lpush(`rooms:${roomid}:messages`, data, (err, res) => {
				if (err) return callback(err);
				callback(null, res);
			});
		});
	}
}

module.exports = new Db();
