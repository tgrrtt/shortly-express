var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');
var GithubStrategy = require('passport-github').Strategy;
var passport = require('passport')

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'yo'
}));
/////////////// GITHUB SHIT/////////////
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(user, done) {
  done(null, user);
});
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GithubStrategy({
  clientID: '4135b81b7440354c59ab',
  clientSecret: '57fa85c7acf183b8487ef42c903b2410461241db',
  callbackURL: 'http://localhost:4568/auth/callback'
}, function(accessToken, refreshToken, profile, done){
      process.nextTick(function () {
      return done(null, profile);
    });

}));
/////////////// GITHUB SHIT/////////////


app.use(express.static(__dirname + '/public'));


app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/', ensureAuthenticated,
function(req, res) {
  res.render('index');
});

app.get('/create', ensureAuthenticated,
function(req, res) {
  res.render('index');
});


app.get('/links', ensureAuthenticated,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

/////////////// GITHUB SHIT/////////////
app.get('/auth/github',
  passport.authenticate('github'),
  function(req, res){
});

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });


/////////////// GITHUB SHIT/////////////
app.post('/login',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var salt;
  new User({username: username})
    .fetch()
    .then(function(model) {
      var hash = model.get('hash');
      var salt = model.get('salt');
      var hashedPass = bcrypt.hashSync(password, salt);
      if(hash === hashedPass){
        req.session.regenerate(function(){
          req.session.user = username;
          res.redirect('/');
        });
      } else {
        //res.redirect('login');
        res.end();
      }
    }).catch(function() {
      res.redirect('/login');
    });
});

app.post('/signup',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);
  new User({username: username, hash: hash, salt: salt}).save().then(function(model) {
    req.session.regenerate(function(){
          req.session.user = username;
          res.redirect('/');
        });
  });

});

app.get('/logout',
function(req, res) {
  req.session.destroy(function(err) {
    res.redirect('/login');
  });
});

app.post('/links', ensureAuthenticated,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

function restrict(req, res, next){
    //if user has a current valid session, then allow to proceed
    if(req.session.user){
      next();
    }else{
      res.redirect('/login');
    }
};



function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
