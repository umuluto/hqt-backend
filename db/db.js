const crypto = require('crypto');
const fs = require('fs');
const redis = require('redis');

// connect to redis, use environment variable (./redis.env)
const client = redis.createClient({
	host: process.env.REDIS_HOST,
	port: parseInt(process.env.REDIS_PORT),
	password: process.env.REDIS_PASS,
});

// read all lua scripts file into this object
const scripts = {};
{
	const names = ['adduser',];

	for (const sc of names) {
		scripts[sc] = fs.readFileSync(`${sc}.lua`, 'utf8');
	}
}

// constants for uid generation
const _NODEID = 0n;
const _EPOCH = 1605817350744;

// used between uid() calls
let _uidcounter = 0n;

function uid() {
	const timestamp = BigInt(Date.now() - _EPOCH);
	_uidcounter = BigInt((_uidcounter + 1n) % 1024n);

	const id = timestamp << 23n | _NODEID << 10n | _uidcounter; 
	return BigInt.asUintN(64, id);
}

function signup(name, pass, callback) {
	const id = uid();

	client.eval(scripts.adduser, 2, `users:${id}`, 'name-id',
		id, name, pass, (err, res) => {
			if (err) throw err;
			return callback(res);
		});
}

// login() return token that contains uid
function login(name, pass, callback) {
	client.hget('name-id', name, (err, id) => {
		if (err) throw err;
		if (id === null) return callback(null);
		client.hmget(`users:${id}`, 'pass', 'token', (err, [_pass,token]) => {
			if (err) throw err;
			return callback(pass == _pass ? token : null);
		});
	});
}

function befriends(a, b, callback) {
	client.multi()
		.sadd(`users:${a}:friends`, b)
		.sadd(`users:${b}:friends`, a)
		.exec((err, res) => {
			if (err) throw err;
			return callback(res);
		});
}

function unfriends(a, b, callback) {
	client.multi()
		.srem(`users:${a}:friends`, b)
		.srem(`users:${b}:friends`, a)
		.exec((err, res) => {
			if (err) throw err;
			return callback(res);
		});
}

// send plain text to client, frontend should be
// able to understand the message
function notify(id, msg) {
	client.lpush(`users:${id}:notifications`, msg, (err, res) => {
		if (err) throw err;
		return callback(res);
	});
}

function privatechat(from, to, msg, callback) {
	const time = Date.now();
	const data = JSON.stringify({ from, time, msg });
	client.exists(`users:${to}`, (err, exist) => {
		if (err) throw err;
		if (!exist) return callback(null);
		client.lpush(`users:${to}:inbox`, data, (err, res) => {
			if (err) throw err;
			return callback(res);
		});
	});
}

function addroom(userid, name, callback) {
	const roomid = uid();
	client.multi()
		.set(`rooms:${roomid}:name`, name)
		.sadd(`rooms:${roomid}:members`, userid)
		.sadd(`users:${userid}:rooms`, roomid)
		.exec((err, res) => {
			if (err) throw err;
			return callback(res);
		});
}

function addtoroom(roomid, userid) {
	client.multi()
		.sadd(`rooms:${roomid}:members`, userid)
		.sadd(`users:${userid}:rooms`, roomid)
		.exec((err, res) => {
			if (err) throw err;
			return callback(res);
		});
}

function remfromroom(roomid, userid) {
	client.multi()
		.srem(`rooms:${roomid}:members`, userid)
		.srem(`users:${userid}:rooms`, roomid)
		.exec((err, res) => {
			if (err) throw err;
			return callback(res);
		});
}

function groupchat(from, room, msg, callback) {
	client.sismember(`rooms:${room}:members`, from, (err, ismember) => {
		if (err) throw err;
		if (!ismember) return callback(null);
		const time = Date.now();
		const data = JSON.stringify({ from, time, msg });
		client.lpush(`rooms:${room}:messages`, data, (err, res) => {
			if (err) throw err;
			return callback(res);
		});
	});
}
