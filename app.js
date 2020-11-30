const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const express = require('express');
const logger = require('morgan');
const path = require('path');

const auth = require('./middleware/auth');

const indexRouter = require('./routes/index');
const signup = require('./routes/signup');
const login = require('./routes/login');
const refresh = require('./routes/refresh');
const friends = require('./routes/friends');
const rooms = require('./routes/rooms');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// create a namespace for the app
app.use((req, res, next) => {
	if (!req.hqt) req.hqt = {};
	next();
});

app.use(auth.authParser);

app.use('/', indexRouter);
app.use('/signup', signup);
app.use('/login', login);
app.use('/refresh', refresh);
app.use('/friends', friends);
app.use('/rooms', rooms);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

module.exports = app;
